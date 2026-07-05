"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useParams, useRouter } from "next/navigation";
import EntryScreen from "../../components/EntryScreen";
import { api } from "../../lib/api";
import {
  BOARD_SIZE,
  FLEET,
  type CellShot,
  type ChatMessage,
  type SeatSnapshot,
  type ShipPlacement,
  type ShipKey,
  type TableSnapshot,
} from "../../lib/types";
import { useSessionUser } from "../../hooks/useSessionUser";
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
type PlacementPreview = {
  cells: string[];
  valid: boolean;
  message: string | null;
};

let clockSnapshot = Date.now();
let clockTimer: number | null = null;
const clockListeners = new Set<() => void>();

function subscribeClock(listener: () => void) {
  clockListeners.add(listener);
  if (clockTimer === null) {
    clockSnapshot = Date.now();
    clockTimer = window.setInterval(() => {
      clockSnapshot = Date.now();
      clockListeners.forEach((current) => current());
    }, 1000);
  }

  return () => {
    clockListeners.delete(listener);
    if (clockListeners.size === 0 && clockTimer !== null) {
      window.clearInterval(clockTimer);
      clockTimer = null;
    }
  };
}

function getClockSnapshot() {
  return clockSnapshot;
}

function getServerClockSnapshot() {
  return 0;
}

export default function TablePage() {
  const params = useParams<{ id: string }>();
  const mesaId = Number(params.id);

  if (!Number.isFinite(mesaId)) {
    return <ShellMessage title="Mesa invalida" body="Regresa al lobby y elige una mesa disponible." />;
  }

  return <TableExperience key={mesaId} mesaId={mesaId} />;
}

function TableExperience({ mesaId }: { mesaId: number }) {
  const session = useSessionUser();

  if (!session) {
    return <EntryScreen />;
  }

  return <AuthedTableExperience mesaId={mesaId} />;
}

function AuthedTableExperience({ mesaId }: { mesaId: number }) {
  const router = useRouter();
  const [table, setTable] = useState<TableSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [fleet, setFleet] = useState<ShipPlacement[]>([]);
  const [selectedShipKey, setSelectedShipKey] = useState<ShipKey>(FLEET[0].key);
  const [orientation, setOrientation] = useState<"H" | "V">("H");
  const [hoverCell, setHoverCell] = useState<string | null>(null);
  const [shotMessage, setShotMessage] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatDraft, setChatDraft] = useState("");
  const clientNow = useSyncExternalStore(subscribeClock, getClockSnapshot, getServerClockSnapshot);
  const [lastSnapshotAt, setLastSnapshotAt] = useState(() => Date.now());
  const lastPartidaIdRef = useRef<number | null>(null);

  const applyTable = useCallback((snapshot: TableSnapshot) => {
    const isNewPlacementRound =
      snapshot.partidaId !== null &&
      snapshot.partidaId !== lastPartidaIdRef.current &&
      Boolean(snapshot.privateView) &&
      !snapshot.privateView?.ownShipsPlaced &&
      (snapshot.estado === "PLACING_SHIPS" || snapshot.estado === "READY_TO_START");
    if (isNewPlacementRound) {
      const nextFleetSpec = snapshot.fleetSpec?.length ? snapshot.fleetSpec : FLEET;
      setFleet([]);
      setSelectedShipKey(nextFleetSpec[0]?.key ?? FLEET[0].key);
      setHoverCell(null);
    }
    lastPartidaIdRef.current = snapshot.partidaId;
    setTable(snapshot);
    setLastSnapshotAt(Date.now());
  }, []);

  const loadTable = useCallback(
    async (join: boolean) => {
      setError(null);
      const snapshot = join ? await api.joinTable(mesaId) : await api.table(mesaId);
      applyTable(snapshot);
      setLoading(false);
      return snapshot;
    },
    [applyTable, mesaId],
  );

  useEffect(() => {
    let alive = true;
    const boot = () => {
      setError(null);
      api.joinTable(mesaId)
        .then((snapshot) => {
          if (!alive || !snapshot) return;
          applyTable(snapshot);
          setLoading(false);
        })
        .catch((err: unknown) => {
          if (!alive) return;
          setError(err instanceof Error ? err.message : "No se pudo cargar la mesa");
          setLoading(false);
        });
    };
    boot();
    return () => {
      alive = false;
    };
  }, [applyTable, mesaId]);

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

  const mySeat = table?.mySeat ?? table?.privateView?.mySeat ?? null;
  const mySeatSnapshot = mySeat ? seatByCode(table, mySeat) : null;
  const opponentSeat = mySeat === "A" ? table?.seatB : mySeat === "B" ? table?.seatA : null;
  const bothSeatsOccupied = Boolean(table?.seatA.occupied && table.seatB.occupied);
  const isActiveRound = table?.estado === "PLACING_SHIPS" || table?.estado === "READY_TO_START" || table?.estado === "IN_PROGRESS";
  const canTakeSeat = Boolean(table && !mySeat && !isActiveRound);
  const isMyTurn = Boolean(table?.privateView && table.estado === "IN_PROGRESS" && table.turnoActualJugadorId === table.privateView.myJugadorId);
  const fleetSpec = table?.fleetSpec?.length ? table.fleetSpec : FLEET;
  const selectedShip = fleetSpec.find((ship) => ship.key === selectedShipKey) ?? fleetSpec[0];
  const placedKeys = new Set(fleet.map((ship) => ship.key));
  const unplacedCount = fleetSpec.length - placedKeys.size;
  const estimatedServerNow = table?.serverNow ? Date.parse(table.serverNow) + (clientNow - lastSnapshotAt) : clientNow;
  const readyRemaining = secondsRemaining(table?.readyDeadlineAt ?? null, estimatedServerNow);
  const placementRemaining = secondsRemaining(table?.placementDeadlineAt ?? null, estimatedServerNow);
  const turnRemaining = secondsRemaining(table?.turnDeadlineAt ?? null, estimatedServerNow);
  const placementPreview = selectedShip && hoverCell
    ? buildPlacementPreview(selectedShip, hoverCell, orientation, fleet)
    : null;
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
      if (next) applyTable(next);
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
  const handlePlaceFleet = () => {
    if (fleet.length !== fleetSpec.length) {
      setError(`Te faltan ${fleetSpec.length - fleet.length} barcos por colocar`);
      return;
    }
    runAction("ships", () => api.ships(mesaId, fleet));
  };
  const handleRandomFleet = () => {
    const nextFleet = randomFleet(fleetSpec);
    setFleet(nextFleet);
    const firstUnplaced = fleetSpec.find((ship) => !nextFleet.some((placed) => placed.key === ship.key));
    if (firstUnplaced) setSelectedShipKey(firstUnplaced.key);
    setHoverCell(null);
    setError(null);
  };
  const handleClearFleet = () => {
    setFleet([]);
    setSelectedShipKey(fleetSpec[0]?.key ?? FLEET[0].key);
    setHoverCell(null);
    setError(null);
  };
  const handlePlaceSelectedShip = (cell: string) => {
    if (!selectedShip) return;
    const preview = buildPlacementPreview(selectedShip, cell, orientation, fleet);
    if (!preview.valid) {
      setError(preview.message ?? "Posicion invalida");
      return;
    }
    const placement: ShipPlacement = {
      ...selectedShip,
      orientation,
      cells: preview.cells,
    };
    const nextFleet = [...fleet.filter((ship) => ship.key !== selectedShip.key), placement];
    setFleet(nextFleet);
    const nextShip = fleetSpec.find((ship) => !nextFleet.some((placed) => placed.key === ship.key));
    if (nextShip) setSelectedShipKey(nextShip.key);
    setHoverCell(null);
    setError(null);
  };
  const handleRemoveShip = (shipKey: ShipKey) => {
    setFleet((current) => current.filter((ship) => ship.key !== shipKey));
    setSelectedShipKey(shipKey);
    setError(null);
  };
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
          <button type="button" onClick={() => router.push("/")} className="mb-3 text-sm text-cyan-300 transition hover:text-cyan-100">
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
            type="button"
            onClick={() => loadTable(false)}
            className="rounded border border-slate-700 px-3 py-2 text-sm text-slate-200 transition hover:bg-slate-800"
          >
            Refrescar
          </button>
          <button
            type="button"
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
                  {table.readyDeadlineAt && !isActiveRound && (
                    <div className={readyRemaining <= 5 ? "rounded bg-red-500/10 px-3 py-2 text-sm text-red-200" : "rounded bg-amber-500/10 px-3 py-2 text-sm text-amber-100"}>
                      Esperando OK rival: {formatSeconds(readyRemaining)}
                    </div>
                  )}
                  <button
                    type="button"
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
                  type="button"
                  onClick={handleReady}
                  disabled={busy === "ready"}
                  className="w-full rounded bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                >
                  Listo
                </button>
              )}

              {mySeat && isActiveRound && (
                <button
                  type="button"
                  onClick={handleResign}
                  disabled={busy === "resign"}
                  className="w-full rounded border border-red-500/50 px-3 py-2 text-sm text-red-200 transition hover:bg-red-500/10 disabled:opacity-50"
                >
                  Abandonar partida
                </button>
              )}

              {mySeat && (table.estado === "FINISHED" || table.estado === "ABANDONED") && (
                <button
                  type="button"
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
                aria-label="Mensaje de chat"
                value={chatDraft}
                onChange={(event) => setChatDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleSendChat();
                }}
                className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-500"
                placeholder="Mensaje"
              />
              <button
                type="button"
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
          <StatusStrip table={table} mySeat={mySeat} opponentName={opponentSeat?.displayName ?? null} readyRemaining={readyRemaining} turnRemaining={turnRemaining} />

          {canPlaceShips && (
            <Panel title="Colocar flota">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded bg-slate-950/70 px-3 py-2 text-sm">
                <span className="text-slate-300">
                  {unplacedCount === 0 ? "Flota completa" : `${unplacedCount} barcos pendientes`}
                </span>
                <span className={placementRemaining <= 10 ? "font-semibold text-red-300" : "text-cyan-200"}>
                  Colocacion: {formatSeconds(placementRemaining)}
                </span>
              </div>
              <div className="grid gap-4 xl:grid-cols-[auto_1fr]">
                <PlacementBoard
                  ships={fleetToCells(fleet)}
                  preview={placementPreview}
                  onCellClick={handlePlaceSelectedShip}
                  onCellEnter={setHoverCell}
                  onCellLeave={() => setHoverCell(null)}
                />
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setOrientation((current) => (current === "H" ? "V" : "H"))}
                      className="rounded border border-slate-700 px-3 py-2 text-sm text-slate-200 transition hover:bg-slate-800"
                    >
                      Rotar {orientation === "H" ? "Horizontal" : "Vertical"}
                    </button>
                    <button
                      type="button"
                      onClick={handleRandomFleet}
                      className="rounded border border-slate-700 px-3 py-2 text-sm text-slate-200 transition hover:bg-slate-800"
                    >
                      Aleatorizar
                    </button>
                    <button
                      type="button"
                      onClick={handleClearFleet}
                      className="rounded border border-slate-700 px-3 py-2 text-sm text-slate-200 transition hover:bg-slate-800"
                    >
                      Limpiar
                    </button>
                    <button
                      type="button"
                      onClick={handlePlaceFleet}
                      disabled={busy === "ships" || fleet.length !== fleetSpec.length}
                      className="rounded bg-cyan-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Confirmar flota
                    </button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {fleetSpec.map((ship) => {
                      const placed = fleet.find((item) => item.key === ship.key);
                      const selected = selectedShip?.key === ship.key;
                      return (
                        <div
                          key={ship.key}
                          className={`rounded border px-3 py-2 text-sm ${
                            selected ? "border-cyan-400 bg-cyan-500/10" : placed ? "border-emerald-500/30 bg-emerald-500/10" : "border-slate-800 bg-slate-950/70"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedShipKey(ship.key)}
                            className="flex w-full items-center justify-between gap-3 text-left"
                          >
                            <span className="font-medium text-slate-100">{ship.name}</span>
                            <span className="text-xs text-slate-500">{ship.size}</span>
                          </button>
                          <div className="mt-1 text-xs text-slate-500">
                            {placed ? `${placed.orientation === "H" ? "Horizontal" : "Vertical"} · ${placed.cells.join(", ")}` : "Sin colocar"}
                          </div>
                          {placed && (
                            <button
                              type="button"
                              onClick={() => handleRemoveShip(ship.key)}
                              className="mt-2 text-xs text-cyan-300 transition hover:text-cyan-100"
                            >
                              Mover
                            </button>
                          )}
                        </div>
                      );
                    })}
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
          type="button"
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
  readyRemaining,
  turnRemaining,
}: {
  table: TableSnapshot;
  mySeat: Seat | null;
  opponentName: string | null;
  readyRemaining: number;
  turnRemaining: number;
}) {
  const view = table.privateView;
  const turnName = table.turnoActualJugadorId === table.seatA.jugadorId ? table.seatA.displayName : table.seatB.displayName;
  const winnerName = table.ganadorId === table.seatA.jugadorId ? table.seatA.displayName : table.ganadorId === table.seatB.jugadorId ? table.seatB.displayName : null;

  return (
    <div className="grid gap-3 md:grid-cols-4">
      <InfoTile label="Rol" value={mySeat ? `Jugador ${mySeat}` : "Espectador"} />
      <InfoTile label="Estado" value={stateLabel[table.estado] ?? table.estado} />
      <InfoTile
        label={winnerName ? "Ganador" : table.estado === "IN_PROGRESS" ? "Turno" : "Rival"}
        value={winnerName ?? turnName ?? opponentName ?? "Pendiente"}
        accent={Boolean(view && table.turnoActualJugadorId === view.myJugadorId)}
      />
      <InfoTile
        label="Tiempo"
        value={table.estado === "IN_PROGRESS" ? formatSeconds(turnRemaining) : table.readyDeadlineAt ? formatSeconds(readyRemaining) : table.placementDeadlineAt ? "Colocando" : "Sin reloj"}
        accent={(table.estado === "IN_PROGRESS" && turnRemaining <= 10) || Boolean(table.readyDeadlineAt && readyRemaining <= 5)}
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
              {shot.automatic ? " · automatico" : ""}
            </span>
            <span className={shot.acierto ? "text-red-300" : "text-slate-500"}>{shot.resultado}</span>
          </div>
        ))}
    </div>
  );
}

function PlacementBoard({
  ships,
  preview,
  onCellClick,
  onCellEnter,
  onCellLeave,
}: {
  ships: Record<string, string>;
  preview: PlacementPreview | null;
  onCellClick: (cell: string) => void;
  onCellEnter: (cell: string) => void;
  onCellLeave: () => void;
}) {
  const previewCells = new Set(preview?.cells ?? []);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="truncate text-sm font-semibold text-slate-100">Tu flota</h3>
        <span className={preview?.valid === false ? "text-xs text-red-300" : "text-xs text-slate-500"}>
          {preview?.message ?? "Click para colocar"}
        </span>
      </div>
      <div className="max-w-full overflow-x-auto pb-2">
        <div className="grid w-max grid-cols-[28px_repeat(10,36px)] gap-1 rounded bg-slate-950/70 p-2">
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
                const hasShip = Boolean(ships[cell]);
                const inPreview = previewCells.has(cell);
                return (
                  <button
                    key={cell}
                    type="button"
                    onClick={() => onCellClick(cell)}
                    onMouseEnter={() => onCellEnter(cell)}
                    onMouseLeave={onCellLeave}
                    aria-label={`Colocar barco en ${cell}`}
                    className={placementCellClassName(hasShip, inPreview, preview?.valid ?? true)}
                    title={cell}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
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
      <div className="max-w-full overflow-x-auto pb-2">
        <div className="grid w-max grid-cols-[28px_repeat(10,36px)] gap-1 rounded bg-slate-950/70 p-2">
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
                    aria-label={`${interactive ? "Disparar a" : "Celda"} ${cell}${hasShip ? ` con ${ships[cell]}` : ""}${shot ? ` resultado ${shot}` : ""}`}
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

function placementCellClassName(hasShip: boolean, inPreview: boolean, previewValid: boolean) {
  const classes = [
    "h-9",
    "w-9",
    "rounded",
    "border",
    "transition",
    "cursor-crosshair",
  ];

  if (inPreview && previewValid) classes.push("border-emerald-300", "bg-emerald-500/30");
  else if (inPreview) classes.push("border-red-300", "bg-red-500/30");
  else if (hasShip) classes.push("border-cyan-400/50", "bg-cyan-500/25");
  else classes.push("border-slate-800", "bg-slate-900/80", "hover:border-cyan-500/60", "hover:bg-cyan-500/10");

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

function secondsRemaining(deadline: string | null, nowMs: number) {
  if (!deadline) return 0;
  return Math.max(0, Math.ceil((Date.parse(deadline) - nowMs) / 1000));
}

function formatSeconds(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function buildPlacementPreview(
  ship: { key: ShipKey; name: string; size: number },
  startCell: string,
  orientation: "H" | "V",
  fleet: ShipPlacement[],
): PlacementPreview {
  const start = parseCell(startCell);
  if (!start) return { cells: [], valid: false, message: "Celda invalida" };

  const cells = Array.from({ length: ship.size }, (_, index) => {
    const row = orientation === "V" ? start.row + index : start.row;
    const col = orientation === "H" ? start.col + index : start.col;
    return cellFrom(row, col);
  });

  if (cells.some((cell) => cell === null)) {
    return { cells: cells.filter(Boolean) as string[], valid: false, message: "Sale del tablero" };
  }

  const normalizedCells = cells as string[];
  const otherShips = fleet.filter((placed) => placed.key !== ship.key);
  const occupied = new Map<string, ShipKey>();
  for (const placed of otherShips) {
    for (const cell of placed.cells) occupied.set(cell, placed.key);
  }

  if (normalizedCells.some((cell) => occupied.has(cell))) {
    return { cells: normalizedCells, valid: false, message: "Se encima con otro barco" };
  }

  for (const cell of normalizedCells) {
    for (const occupiedCell of occupied.keys()) {
      if (touches(cell, occupiedCell)) {
        return { cells: normalizedCells, valid: false, message: "Los barcos no pueden tocarse" };
      }
    }
  }

  return { cells: normalizedCells, valid: true, message: null };
}

function parseCell(cell: string) {
  const match = /^([A-J])(10|[1-9])$/.exec(cell);
  if (!match) return null;
  return {
    row: match[1].charCodeAt(0) - 65,
    col: Number(match[2]) - 1,
  };
}

function cellFrom(row: number, col: number) {
  if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return null;
  return `${String.fromCharCode(65 + row)}${col + 1}`;
}

function touches(a: string, b: string) {
  const left = parseCell(a);
  const right = parseCell(b);
  if (!left || !right) return false;
  return Math.abs(left.row - right.row) <= 1 && Math.abs(left.col - right.col) <= 1;
}

function randomFleet(spec = FLEET) {
  const occupied = new Set<string>();
  const ships: ShipPlacement[] = [];

  for (let restart = 0; restart < 200; restart += 1) {
    occupied.clear();
    ships.length = 0;
    let failed = false;
    for (const ship of spec) {
      let placed = false;
      for (let attempt = 0; attempt < 300 && !placed; attempt += 1) {
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

        if (!canPlaceRandom(cells, occupied)) continue;
        cells.forEach((cell) => occupied.add(cell));
        ships.push({ ...ship, orientation, cells });
        placed = true;
      }
      if (!placed) {
        failed = true;
        break;
      }
    }
    if (!failed && ships.length === spec.length) return [...ships];
  }

  return fallbackFleet(spec);
}

function canPlaceRandom(cells: string[], occupied: Set<string>) {
  for (const cell of cells) {
    if (occupied.has(cell)) return false;
    for (const occupiedCell of occupied) {
      if (touches(cell, occupiedCell)) return false;
    }
  }
  return true;
}

function fallbackFleet(spec = FLEET) {
  const starts: Record<ShipKey, string[]> = {
    battleship_1: ["A1", "A2", "A3", "A4"],
    cruiser_1: ["C1", "C2", "C3"],
    cruiser_2: ["C6", "C7", "C8"],
    destroyer_1: ["E1", "E2"],
    destroyer_2: ["E5", "E6"],
    destroyer_3: ["E9", "E10"],
    boat_1: ["G1"],
    boat_2: ["G3"],
    boat_3: ["G5"],
    boat_4: ["G7"],
  };
  return spec.map((ship) => {
    const cells = starts[ship.key] ?? [];
    return { ...ship, orientation: "H" as const, cells };
  });
}
