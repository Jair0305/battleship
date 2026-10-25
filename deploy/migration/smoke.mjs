// Destructive only to the explicitly selected test environment. Never prints session tokens.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { createFrameLog, isChatFrame } from './stomp-frames.mjs';

const base = process.argv[2]?.replace(/\/$/, '');
if (!base || !process.argv.includes('--allow-test-writes')) {
  throw new Error('Usage: node smoke.mjs BASE_URL --allow-test-writes (isolated restored database only)');
}
const sockets = [];
const checks = [];
const polling = process.argv.includes('--sockjs-polling');
function passed(check) { checks.push(check); console.log('PASS ' + check); }
async function api(path, token, body, expected = 200) {
  const response = await fetch(base + '/api' + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { 'X-Session-Token': token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  assert.equal(response.status, expected, `${path}: unexpected HTTP status`);
  return response.json();
}
async function stomp() {
  const ws = polling
    ? new (createRequire(resolve('package.json'))('sockjs-client'))(base + '/ws', null, { transports: ['xhr-polling'] })
    : new WebSocket(base.replace(/^http/, 'ws') + '/ws/websocket');
  sockets.push(ws);
  const frames = createFrameLog();
  const { inbox, history } = frames;
  ws.addEventListener('message', e => frames.record(e.data));
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('WebSocket open timeout')), 10000);
    ws.addEventListener('open', () => { clearTimeout(timeout); resolve(); }, { once: true });
    ws.addEventListener('error', () => { clearTimeout(timeout); reject(new Error('WebSocket handshake failed')); }, { once: true });
  });
  async function waitFor(predicate) {
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      const index = inbox.findIndex(predicate);
      if (index >= 0) return inbox.splice(index, 1)[0];
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    throw new Error('STOMP frame timeout');
  }
  ws.send('CONNECT\naccept-version:1.2\nhost:localhost\nheart-beat:0,0\n\n\0');
  await waitFor(frame => frame.startsWith('CONNECTED'));
  return { ws, inbox, history, waitFor };
}

try {
  assert.match(await (await fetch(base)).text(), /Nightly/i);
  for (const [method, path] of [
    ['POST', '/partidas/0/cancelar'], ['POST', '/partidas/0/empate'],
    ['GET', '/sala'], ['POST', '/juego/disparo/0'], ['POST', '/chat/0'],
  ]) {
    const response = await fetch(base + '/api' + path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: method === 'GET' ? undefined : '{}',
      signal: AbortSignal.timeout(15000),
    });
    assert.equal(response.status, 404, `${path}: retired API remains reachable`);
  }
  passed('retired legacy APIs return 404 through the application proxy');
  const suffix = randomBytes(5).toString('hex');
  const username = 'migration_' + suffix;
  const password = randomBytes(18).toString('base64url');
  const registered = await api('/auth/register', null, { username, password, passwordConfirm: password });
  assert.equal(registered.guest, false);
  const a = await api('/auth/login', null, { username, password });
  assert.equal((await api('/session/me', a.token)).displayName, username);
  await api('/session/me', 'invalid-migration-token', undefined, 401);
  const ranked = process.argv.includes('--ranked');
  const b = ranked
    ? await api('/auth/register', null, { username: username + '_b', password, passwordConfirm: password })
    : await api('/session/guest', null, { displayName: 'Migration B ' + suffix });
  const spectator = await api('/session/guest', null, { displayName: 'Migration S ' + suffix });
  passed('registration, password login, persisted session, rejected invalid session, guests');
  const lobby = await api('/lobby', a.token);
  const publicLobby = await api('/lobby');
  for (const visible of publicLobby.onlinePlayers) assert.ok(!('token' in visible));
  assert.ok(!JSON.stringify(publicLobby).includes(a.token));
  assert.ok(!JSON.stringify(publicLobby).includes(b.token));
  assert.ok(lobby.salas.length > 0);
  let table = await api(`/salas/${lobby.salas[0].id}/mesas`, a.token, { name: 'Migration ' + suffix });
  const path = `/mesas/${table.id}`;
  await api(path + '/join', b.token, {});
  await api(path + '/join', spectator.token, {});
  await api(path + '/seat/A/sit', a.token, {});
  await api(path + '/seat/B/sit', b.token, {});
  const clients = await Promise.all([stomp(), stomp(), stomp()]);
  for (const [index, client] of clients.entries()) {
    client.ws.send(`SUBSCRIBE\nid:chat-${index}\ndestination:/topic/mesas/${table.id}/chat\nack:auto\n\n\0`);
  }
  await new Promise(resolve => setTimeout(resolve, 200));
  const forgedChat = 'forbidden-control-' + suffix;
  clients[2].ws.send(`SEND\ndestination:/topic/mesas/${table.id}/chat\ncontent-type:application/json\n\n${JSON.stringify({ sender: 'Forged migration sender', content: forgedChat, type: 'CHAT' })}\0`);
  const chat = 'authentic-control-' + suffix;
  await api(path + '/chat', a.token, { content: chat });
  await Promise.all(clients.map(c => c.waitFor(frame => isChatFrame(frame, chat))));
  await new Promise(resolve => setTimeout(resolve, 200));
  assert.ok(clients.every(c => c.history.filter(frame => isChatFrame(frame, chat)).length === 1));
  passed((polling ? 'SockJS XHR polling' : 'WebSocket upgrade') + ', STOMP subscriptions, chat delivered once to two players and spectator');
  assert.ok(clients.every(c => c.history.every(frame => !isChatFrame(frame, forgedChat))));
  await api(path + '/ready', a.token, {});
  table = await api(path + '/ready', b.token, {});
  assert.equal(table.estado, 'PLACING_SHIPS');
  const positions = [ ['A1','A2','A3','A4'], ['C1','C2','C3'], ['E1','E2','E3'],
    ['G1','G2'], ['I1','I2'], ['A6','A7'], ['C6'], ['E6'], ['G6'], ['I6'] ];
  const ships = table.fleetSpec.map((spec, index) => ({ ...spec, orientation: 'H', cells: positions[index] }));
  await api(path + '/ships', a.token, { ships });
  table = await api(path + '/ships', b.token, { ships });
  assert.equal(table.estado, 'IN_PROGRESS');
  const spectatorTable = await api(path, spectator.token);
  assert.ok(!JSON.stringify(spectatorTable.spectatorView).includes('battleship_1'));
  const playerTable = await api(path, a.token);
  assert.equal(Object.keys(playerTable.privateView.ownShips).length, 20);
  const attacker = table.turnoActualJugadorId === playerTable.privateView.myJugadorId ? a : b;
  for (const position of positions.flat()) {
    const shot = await api(path + '/shots', attacker.token, { position });
    assert.ok(shot.hit);
  }
  table = await api(path, a.token);
  assert.equal(table.estado, 'FINISHED');
  assert.ok(table.ganadorId);
  passed('seats, ready, full fleet placement, spectator privacy, shots, sunk ships and victory');
  if (ranked) {
    const players = await Promise.all([a, b].map(player => api('/session/me', player.token)));
    assert.ok(players.every(player => player.gamesPlayed === 1));
    assert.equal(players.reduce((sum, player) => sum + player.wins, 0), 1);
    assert.equal(players.reduce((sum, player) => sum + player.losses, 0), 1);
    assert.ok(players.every(player => player.rating !== 1200));
    const ranking = await api('/ranking/historico');
    // The public leaderboard contains only the top ten, so either new player
    // may be absent when this restored test database already has ranked games.
    assert.ok(ranking.length > 0 && ranking.length <= 10);
    for (const [index, entry] of ranking.entries()) {
      assert.equal(entry.rank, index + 1);
      if (index > 0) assert.ok(ranking[index - 1].puntos >= entry.puntos);
      const player = players.find(candidate => candidate.displayName === entry.nombre);
      if (player) {
        assert.equal(entry.puntos, player.rating);
        assert.equal(entry.gamesPlayed, player.gamesPlayed);
        assert.equal(entry.wins, player.wins);
        assert.equal(entry.losses, player.losses);
      }
    }
    passed('ranked victory updates both registered players once, rating, wins and losses');
  }
  await api(path + '/rematch', a.token, {});
  table = await api(path + '/rematch', b.token, {});
  assert.equal(table.estado, 'PLACING_SHIPS');
  assert.ok(table.partidaId);
  await api(path + '/resign', a.token, {});
  for (const player of [a, b, spectator]) await api(path + '/leave', player.token, {});
  assert.ok(clients.every(c => c.history.every(frame => !isChatFrame(frame, forgedChat))));
  assert.ok(clients.every(c => c.history.filter(frame => isChatFrame(frame, chat)).length === 1));
  passed('client STOMP publication blocked while authenticated server chat is delivered');
  passed('rematch, resignation and all three sessions leave');
  console.log(JSON.stringify({ status: 'passed', checks: checks.length }));
} finally {
  for (const ws of sockets) ws.close();
}
