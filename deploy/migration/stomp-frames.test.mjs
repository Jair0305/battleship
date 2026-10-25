import assert from 'node:assert/strict';
import test from 'node:test';
import { createFrameLog, isChatFrame } from './stomp-frames.mjs';

function message(content, newline = '\n') {
  return `MESSAGE${newline}destination:/topic/test${newline}${newline}${JSON.stringify({ content })}\0`;
}

test('chat matching compares the complete content, including overlapping markers', () => {
  const legitimate = 'migration-chat-fixture';
  const forged = 'forged-' + legitimate;
  assert.equal(isChatFrame(message(legitimate), legitimate), true);
  assert.equal(isChatFrame(message(forged), legitimate), false);
  assert.equal(isChatFrame(message(forged), forged), true);
});

test('CRLF frames and JSON escaped content are parsed without substring matching', () => {
  const content = 'chat with \n and "quotes"';
  assert.equal(isChatFrame(message(content, '\r\n'), content), true);
  assert.equal(isChatFrame(message(content), 'quotes'), false);
});

test('control frames, malformed JSON and incomplete frames never count as chat', () => {
  for (const frame of ['CONNECTED\n\n\0', 'MESSAGE\n\nnot-json\0', message('test').slice(0, -1),
    'MESSAGE\n\n{"metadata":{"content":"test"}}\0']) {
    assert.equal(isChatFrame(frame, 'test'), false);
  }
});

test('consuming the inbox cannot erase evidence of a forbidden delivery', () => {
  const log = createFrameLog();
  const forged = message('forged-control');
  const authentic = message('authentic-control');
  log.record(forged);
  log.record(authentic);
  const index = log.inbox.findIndex(frame => isChatFrame(frame, 'authentic-control'));
  assert.equal(log.inbox.splice(index, 1)[0], authentic);
  log.inbox.splice(0);
  assert.equal(log.history.filter(frame => isChatFrame(frame, 'forged-control')).length, 1);
  assert.equal(log.history.filter(frame => isChatFrame(frame, 'authentic-control')).length, 1);
});

test('duplicate authentic deliveries remain observable after waits consume their inbox copies', () => {
  const log = createFrameLog();
  log.record(message('authentic-control'));
  log.record(message('authentic-control'));
  log.inbox.splice(0);
  assert.equal(log.history.filter(frame => isChatFrame(frame, 'authentic-control')).length, 2);
});
