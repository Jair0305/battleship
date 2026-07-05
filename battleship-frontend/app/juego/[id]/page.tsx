"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, ensureSession } from "../../lib/api";
import {
  BOARD_SIZE,
  FLEET,
  type CellShot,
  type ChatMessage,
  type SeatSnapshot,
  type ShipPlacement,
  type TableSnapshot,
} from "../../lib/types";
import { useRealtime } from "../../hooks/useRealtime";

const rows = Array.from({ length: BOARD_SIZE }, (_, index) => String.fromCharCode(65 + index));
const cols = Array.from({ length: BOARD_SIZE }, (_, index) => index + 1);

const stateLabel: Record<string, string> = {
  WAITING_FOR_PLAYERS: "Esperando jugadores",
  PLAYERS_SEATED: "Jugadores sentados",
  PLACING_SHIPS: "Colocando flotas",
  READY_TO_START: "Listo para iniciar",
  IN_PROGRESS: "En partida",
  FINISHED: "Finalizada",
  ABANDONED: "Abandonada",
  CANCELLED: "Cancelada",
};

type Seat = "A" | "B";
type ActionResult = TableSnapshot | void;

export default function TablePage() {
  const params = useParams<{ id: string }>();
  const mesaId = Number(params.id);

  if (!Number.isFinite(mesaId)) {
    return <ShellMessage title="Mesa invalida" body="Regresa al lobby y elige una mesa disponible." />;
  }

  return <TableExperience key={mesaId} mesaId={mesaId} />;
}

function TableExperience({ mesaId }: { mesaId: number }) {
  const router = useRouter();
  const [table, setTable] = useState<TableSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [fleet, setFleet] = useState<ShipPlacement[]>(() => randomFleet());
  const [shotMessage, setShotMessage] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatDraft, setChatDraft] = useState("");

  const loadTable = useCallback(
    async (join: boolean) => {
      setError(null);
      await ensureSession();
      const snapshot = join ? await api.joinTable(mesaId) : await api.table(mesaId);
      setTable(snapshot);
      setLoading(false);
      return snapshot;
    },
    [mesaId],
  );

  useEffect(() => {
    let alive = true;
    const boot = async () => {
      try {
        const snapshot = await loadTable(true);
        if (!alive) return;
        setTable(snapshot);
      } catch (err) {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "No se pudo cargar la mesa");
        setLoading(false);
      }
    };
    boot();
    return () => {
      alive = false;
    };
  }, [loadTable]);

  const connected = useRealtime([
    {
      topic: `/topic/mesas/${mesaId}`,
      onMessage: () => {
        loadTable(false).catch((err) => setError(err instanceof Error ? err.message : "No se pudo actualizar la mesa"));
      },
    },
    {
      topic: `/topic/mesas/${mesaId}/chat`,
      onMessage: (message) => {
        try {
          setChatMessages((current) => [...current.slice(-49), JSON.parse(message.body) as ChatMessage]);
        } catch {
          // Ignore malformed notifications; the table snapshot remains authoritative.
        }
      },
    },
  ]);

  const mySeat = table?.privateView?.mySeat ?? null;
  const mySeatSnapshot = mySeat ? seatByCode(table, mySeat) : null;
  const opponentSeat = mySeat === "A" ? table?.seatB : mySeat === "B" ? table?.seatA : null;
  const bothSeatsOccupied = Boolean(table?.seatA.occupied && table.seatB.occupied);
  const isActiveRound = table?.estado === "PLACING_SHIPS" || table?.estado === "READY_TO_START" || table?.estado === "IN_PROGRESS";
  const canTakeSeat = Boolean(table && !mySeat && !isActiveRound);
  const isMyTurn = Boolean(table?.privateView && table.estado === "IN_PROGRESS" && table.turnoActualJugadorId === table.privateView.myJugadorId);
  const canPlaceShips = Boolean(
    table?.privateView &&
      (table.estado === "PLACING_SHIPS" || table.estado === "READY_TO_START") &&
      !table.privateView.ownShipsPlaced,
  );

  const runAction = async (label: string, action: () => Promise<ActionResult>) => {
    setBusy(label);
    setError(null);
    setShotMessage(null);
    try {
      const next = await action();
      if (next) setTable(next);
      else await loadTable(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "La accion no se pudo completar");
    } finally {
      setBusy(null);
    }
  };

  const handleSit = (seat: Seat) => runAction(`sit-${seat}`, () => api.sit(mesaId, seat));
  const handleStand = () => runAction("stand", () => api.stand(mesaId));
  const handleReady = () => runAction("ready", () => api.ready(mesaId));
  const handlePlaceFleet = () => runAction("ships", () => api.ships(mesaId, fleet));
  const handleResign = () => runAction("resign", () => api.resign(mesaId));
  const handleRematch = () => runAction("rematch", () => api.rematch(mesaId));
  const handleShot = (cell: string) =>
    runAction(`shot-${cell}`, async () => {
      const result = await api.shot(mesaId, cell);
      const label = result.result === "WIN" ? "Victoria" : result.result === "SUNK" ? "Hundido" : result.hit ? "Impacto" : "Agua";
      setShotMessage(`${cell}: ${label}`);
      return api.table(mesaId);
    });

  const handleLeave = () =>
    runAction("leave", async () => {
      await api.leaveTable(mesaId);
      router.push("/");
    });

  const handleSendChat = async () => {
    const content = chatDraft.trim();
    if (!content) return;
    setBusy("chat");
    setError(null);
    try {
      const message = await api.chat(mesaId, content);
      setChatMessages((current) => [...current.slice(-49), message]);
      setChatDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar el mensaje");
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <ShellMessage title="Cargando mesa" body="Preparando el tablero..." />;
  if (!table) return <ShellMessage title="Mesa no disponible" body={error ?? "Regresa al lobby y vuelve a intentarlo."} />;

  return (
    <div className="min-h-[calc(100vh-96px)] space-y-5">
      <div className="flex flex-col gap-3 border-b border-slate-800 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <button onClick={() => router.push("/")} className="mb-3 text-sm text-cyan-300 transition hover:text-cyan-100">
            Volver al lobby
          </button>
          <h1 className="text-3xl font-bold text-white">{table.nombre}</h1>
          <p className="mt-1 text-sm text-slate-400">
            {table.salaNombre} · Mesa #{table.id} · {stateLabel[table.estado] ?? table.estado}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded px-2 py-1 text-xs ${connected ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-300"}`}>
            {connected ? "Tiempo real" : "Reconectando"}
          </span>
          <button
            onClick={() => loadTable(false)}
            className="rounded border border-slate-700 px-3 py-2 text-sm text-slate-200 transition hover:bg-slate-800"
          >
            Refrescar
          </button>
          <button
            onClick={handleLeave}
            disabled={busy === "leave"}
            className="rounded border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800 disabled:opacity-50"
          >
            Salir
          </button>
        </div>
      </div>

      {error && <div className="rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}
      {shotMessage && <div className="rounded border border-cyan-500/30 bg-cyan-500/10 p-3 text-sm text-cyan-100">{shotMessage}</div>}

      <section className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <aside className="space-y-4">
          <Panel title="Asientos">
            <div className="space-y-3">
              <SeatCard
                seat={table.seatA}
                canSit={canTakeSeat && !table.seatA.occupied}
                isMine={mySeat === "A"}
                busy={busy === "sit-A"}
                onSit={() => handleSit("A")}
              />
              <SeatCard
                seat={table.seatB}
                canSit={canTakeSeat && !table.seatB.occupied}
                isMine={mySeat === "B"}
                busy={busy === "sit-B"}
                onSit={() => handleSit("B")}
              />
            </div>

            <div className="mt-4 space-y-2">
              {mySeat ? (
                <>
                  <div className="rounded bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100">
                    Estas sentado en el asiento {mySeat}.
                  </div>
                  <button
                    onClick={handleStand}
                    disabled={busy === "stand"}
                    className="w-full rounded border border-slate-700 px-3 py-2 text-sm text-slate-200 transition hover:bg-slate-800 disabled:opacity-50"
                  >
                    {isActiveRound ? "Rendirme y liberar asiento" : "Liberar asiento"}
                  </button>
                </>
              ) : (
                <div className="rounded bg-slate-900/70 px-3 py-2 text-sm text-slate-400">
                  Elige un asiento libre para jugar. Si no te sientas, ves la mesa como espectador.
                </div>
              )}

              {mySeat && bothSeatsOccupied && !isActiveRound && !mySeatSnapshot?.ready && (
                <button
                  onClick={handleReady}
                  disabled={busy === "ready"}
                  className="w-full rounded bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                >
                  Listo
                </button>
              )}

              {mySeat && isActiveRound && (
                <button
                  onClick={handleResign}
                  disabled={busy === "resign"}
                  className="w-full rounded border border-red-500/50 px-3 py-2 text-sm text-red-200 transition hover:bg-red-500/10 disabled:opacity-50"
                >
                  Abandonar partida
                </button>
              )}

              {mySeat && (table.estado === "FINISHED" || table.estado === "ABANDONED") && (
                <button
                  onClick={handleRematch}
                  disabled={busy === "rematch"}
                  className="w-full rounded bg-cyan-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-50"
                >
                  Pedir revancha
                </button>
              )}
            </div>
          </Panel>

          <Panel title="Chat">
            <div className="h-44 space-y-2 overflow-y-auto rounded bg-slate-950/70 p-3 text-sm">
              {chatMessages.length === 0 ? (
                <div className="text-slate-500">Sin mensajes todavia</div>
              ) : (
                chatMessages.map((message, index) => (
                  <div key={`${message.receivedAt}-${index}`} className="rounded bg-slate-900/80 px-2 py-1">
                    <span className="font-semibold text-cyan-200">{message.sender}: </span>
                    <span className="text-slate-200">{message.content}</span>
                  </div>
                ))
              )}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                value={chatDraft}
                onChange={(event) => setChatDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleSendChat();
                }}
                className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-500"
                placeholder="Mensaje"
              />
              <button
                onClick={handleSendChat}
                disabled={busy === "chat"}
                className="rounded bg-slate-800 px-3 py-2 text-sm text-slate-100 transition hover:bg-slate-700 disabled:opacity-50"
              >
                Enviar
              </button>
            </div>
          </Panel>
        </aside>

        <main className="space-y-4">
          <StatusStrip table={table} mySeat={mySeat} opponentName={opponentSeat?.displayName ?? null} />

          {canPlaceShips && (
            <Panel title="Colocar flota">
              <div className="grid gap-4 xl:grid-cols-[auto_1fr]">
                <BoardGrid title="Vista previa" ships={fleetToCells(fleet)} shots={{}} />
                <div className="space-y-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    {fleet.map((ship) => (
                      <div key={ship.key} className="rounded bg-slate-900/70 px-3 py-2 text-sm">
                        <div className="font-medium text-slate-100">{ship.name}</div>
                        <div className="text-xs text-slate-500">
                          {ship.size} celdas · {ship.orientation === "H" ? "Horizontal" : "Vertical"} · {ship.cells.join(", ")}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setFleet(randomFleet())}
                      className="rounded border border-slate-700 px-3 py-2 text-sm text-slate-200 transition hover:bg-slate-800"
                    >
                      Reordenar flota
                    </button>
                    <button
                      onClick={handlePlaceFleet}
                      disabled={busy === "ships"}
                      className="rounded bg-cyan-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-50"
                    >
                      Colocar flota
                    </button>
                  </div>
                </div>
              </div>
            </Panel>
          )}

          {table.privateView ? (
            <div className="grid gap-4 xl:grid-cols-2">
              <Panel title="Tu tablero">
                <BoardGrid
                  title={table.seatA.jugadorId === table.privateView.myJugadorId ? table.seatA.displayName ?? "Jugador A" : table.seatB.displayName ?? "Jugador B"}
                  ships={table.privateView.ownShips}
                  shots={table.privateView.ownReceivedShots}
                />
              </Panel>

              <Panel title="Tablero rival">
                <BoardGrid
                  title={opponentSeat?.displayName ?? "Rival"}
                  ships={revealedOpponentShips(table)}
                  shots={table.privateView.targetShots}
                  canShoot={isMyTurn}
                  disabledReason={isMyTurn ? null : table.estado === "IN_PROGRESS" ? "Espera tu turno" : "La partida no esta en curso"}
                  onCellClick={handleShot}
                />
              </Panel>
            </div>
          ) : (
            <SpectatorBoards table={table} />
          )}

          <Panel title="Historial">
            <ShotHistory table={table} />
          </Panel>
        </main>
      </section>
    </div>
  );
}

function SeatCard({
  seat,
  canSit,
  isMine,
  busy,
  onSit,
}: {
  seat: SeatSnapshot;
  canSit: boolean;
  isMine: boolean;
  busy: boolean;
  onSit: () => void;
}) {
  return (
    <div className="rounded border border-slate-800 bg-slate-950/70 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-100">Asiento {seat.seat}</div>
          <div className="mt-1 text-sm text-slate-400">{seat.displayName ?? "Libre"}</div>
        </div>
        {seat.occupied && (
          <span className={`rounded px-2 py-1 text-xs ${seat.ready ? "bg-emerald-500/10 text-emerald-300" : "bg-slate-800 text-slate-300"}`}>
            {seat.ready ? "Listo" : isMine ? "Tu" : "Ocupado"}
          </span>
        )}
      </div>
      {!seat.occupied && (
        <button
          onClick={onSit}
          disabled={!canSit || busy}
          className="mt-3 w-full rounded bg-cyan-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Sentarme
        </button>
      )}
    </div>
  );
}

function StatusStrip({
  table,
  mySeat,
  opponentName,
}: {
  table: TableSnapshot;
  mySeat: Seat | null;
  opponentName: string | null;
}) {
  const view = table.privateView;
  const turnName = table.turnoActualJugadorId === table.seatA.jugadorId ? table.seatA.displayName : table.seatB.displayName;
  const winnerName = table.ganadorId === table.seatA.jugadorId ? table.seatA.displayName : table.ganadorId === table.seatB.jugadorId ? table.seatB.displayName : null;

  return (
    <div className="grid gap-3 md:grid-cols-3">
      <InfoTile label="Rol" value={mySeat ? `Jugador ${mySeat}` : "Espectador"} />
      <InfoTile label="Estado" value={stateLabel[table.estado] ?? table.estado} />
      <InfoTile
        label={winnerName ? "Ganador" : table.estado === "IN_PROGRESS" ? "Turno" : "Rival"}
        value={winnerName ?? turnName ?? opponentName ?? "Pendiente"}
        accent={Boolean(view && table.turnoActualJugadorId === view.myJugadorId)}
      />
    </div>
  );
}

function InfoTile({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded border p-3 ${accent ? "border-emerald-500/40 bg-emerald-500/10" : "border-slate-800 bg-slate-950/70"}`}>
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 truncate text-sm font-semibold text-slate-100">{value}</div>
    </div>
  );
}

function SpectatorBoards({ table }: { table: TableSnapshot }) {
  const spectator = table.spectatorView;
  if (!spectator) {
    return (
      <Panel title="Mesa">
        <div className="rounded bg-slate-950/70 p-4 text-sm text-slate-400">
          Sientate para jugar o espera a que haya una partida activa para verla como espectador.
        </div>
      </Panel>
    );
  }

  const playerIds = Object.keys(spectator.players);
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {playerIds.map((playerId) => (
        <Panel key={playerId} title={spectator.players[playerId]}>
          <BoardGrid
            title={spectator.players[playerId]}
            ships={spectator.revealedShips[playerId] ?? {}}
            shots={spectator.publicShots[playerId] ?? {}}
          />
        </Panel>
      ))}
    </div>
  );
}

function ShotHistory({ table }: { table: TableSnapshot }) {
  const history = table.privateView?.history ?? table.spectatorView?.history ?? [];
  if (history.length === 0) {
    return <div className="text-sm text-slate-500">Sin disparos todavia</div>;
  }
  const names = new Map<number, string>();
  if (table.seatA.jugadorId) names.set(table.seatA.jugadorId, table.seatA.displayName ?? "Jugador A");
  if (table.seatB.jugadorId) names.set(table.seatB.jugadorId, table.seatB.displayName ?? "Jugador B");

  return (
    <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
      {history
        .slice()
        .reverse()
        .map((shot, index) => (
          <div key={`${shot.ts}-${index}`} className="flex items-center justify-between rounded bg-slate-950/70 px-3 py-2 text-sm">
            <span className="truncate text-slate-300">
              {names.get(shot.atacanteId) ?? "Jugador"} disparo a {shot.posicion}
            </span>
            <span className={shot.acierto ? "text-red-300" : "text-slate-500"}>{shot.resultado}</span>
          </div>
        ))}
    </div>
  );
}

function BoardGrid({
  title,
  ships,
  shots,
  canShoot = false,
  disabledReason,
  onCellClick,
}: {
  title: string;
  ships: Record<string, string>;
  shots: Record<string, CellShot | undefined>;
  canShoot?: boolean;
  disabledReason?: string | null;
  onCellClick?: (cell: string) => void;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="truncate text-sm font-semibold text-slate-100">{title}</h3>
        {disabledReason && <span className="text-xs text-slate-500">{disabledReason}</span>}
      </div>
      <div className="grid w-fit grid-cols-[28px_repeat(10,36px)] gap-1 rounded bg-slate-950/70 p-2">
        <div />
        {cols.map((col) => (
          <div key={col} className="flex h-7 items-center justify-center text-xs text-slate-500">
            {col}
          </div>
        ))}
        {rows.map((row) => (
          <div key={row} className="contents">
            <div className="flex h-9 items-center justify-center text-xs text-slate-500">{row}</div>
            {cols.map((col) => {
              const cell = `${row}${col}`;
              const shot = shots[cell];
              const hasShip = Boolean(ships[cell]);
              const interactive = Boolean(canShoot && onCellClick && !shot);
              return (
                <button
                  key={cell}
                  type="button"
                  onClick={() => interactive && onCellClick?.(cell)}
                  disabled={!interactive}
                  title={`${cell}${hasShip ? ` · ${ships[cell]}` : ""}${shot ? ` · ${shot}` : ""}`}
                  className={cellClassName(hasShip, shot, interactive)}
                >
                  {shot === "MISS" ? "·" : shot === "HIT" ? "X" : shot === "SUNK" ? "!" : hasShip ? "" : ""}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded border border-slate-800 bg-slate-900/40 p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-300">{title}</h2>
      {children}
    </section>
  );
}

function ShellMessage({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex min-h-[calc(100vh-128px)] items-center justify-center">
      <div className="rounded border border-slate-800 bg-slate-900/60 p-6 text-center">
        <h1 className="text-xl font-semibold text-white">{title}</h1>
        <p className="mt-2 text-sm text-slate-400">{body}</p>
      </div>
    </div>
  );
}

function cellClassName(hasShip: boolean, shot: CellShot | undefined, interactive: boolean) {
  const classes = [
    "flex",
    "h-9",
    "w-9",
    "items-center",
    "justify-center",
    "rounded",
    "border",
    "text-sm",
    "font-bold",
    "transition",
  ];

  if (shot === "MISS") classes.push("border-slate-700", "bg-slate-800", "text-slate-400");
  else if (shot === "HIT") classes.push("border-red-400/60", "bg-red-500/20", "text-red-200");
  else if (shot === "SUNK") classes.push("border-fuchsia-400/60", "bg-fuchsia-500/20", "text-fuchsia-100");
  else if (hasShip) classes.push("border-cyan-400/50", "bg-cyan-500/20", "text-cyan-100");
  else classes.push("border-slate-800", "bg-slate-900/80", "text-slate-600");

  if (interactive) classes.push("cursor-crosshair", "hover:border-cyan-300", "hover:bg-cyan-500/10");
  else classes.push("cursor-default");

  return classes.join(" ");
}

function seatByCode(table: TableSnapshot | null, seat: Seat) {
  if (!table) return null;
  return seat === "A" ? table.seatA : table.seatB;
}

function fleetToCells(fleet: ShipPlacement[]) {
  const cells: Record<string, string> = {};
  for (const ship of fleet) {
    for (const cell of ship.cells) cells[cell] = ship.name;
  }
  return cells;
}

function revealedOpponentShips(table: TableSnapshot) {
  const view = table.privateView;
  if (!view) return {};
  const opponent = view.mySeat === "A" ? table.seatB : table.seatA;
  return opponent.jugadorId ? table.privateView?.revealedShips[String(opponent.jugadorId)] ?? {} : {};
}

function randomFleet() {
  const occupied = new Set<string>();
  const ships: ShipPlacement[] = [];

  for (const ship of FLEET) {
    for (let attempt = 0; attempt < 400; attempt += 1) {
      const orientation = Math.random() > 0.5 ? "H" : "V";
      const maxRow = orientation === "V" ? BOARD_SIZE - ship.size : BOARD_SIZE - 1;
      const maxCol = orientation === "H" ? BOARD_SIZE - ship.size : BOARD_SIZE - 1;
      const row = Math.floor(Math.random() * (maxRow + 1));
      const col = Math.floor(Math.random() * (maxCol + 1));
      const cells = Array.from({ length: ship.size }, (_, index) => {
        const nextRow = orientation === "V" ? row + index : row;
        const nextCol = orientation === "H" ? col + index : col;
        return `${String.fromCharCode(65 + nextRow)}${nextCol + 1}`;
      });

      if (cells.some((cell) => occupied.has(cell))) continue;
      cells.forEach((cell) => occupied.add(cell));
      ships.push({ ...ship, orientation, cells });
      break;
    }
  }

  return ships.length === FLEET.length ? ships : fallbackFleet();
}

function fallbackFleet() {
  let row = 0;
  return FLEET.map((ship) => {
    const cells = Array.from({ length: ship.size }, (_, index) => `${String.fromCharCode(65 + row)}${index + 1}`);
    row += 1;
    return { ...ship, orientation: "H" as const, cells };
  });
}
