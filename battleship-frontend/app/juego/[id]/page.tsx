"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useParams, useRouter } from "next/navigation";
import EntryScreen from "../../components/EntryScreen";
import { api } from "../../lib/api";
import {
  BOARD_SIZE,
  FLEET,
  type ChatMessage,
  type ShipPlacement,
  type ShipKey,
  type TableSnapshot,
} from "../../lib/types";
import { useSessionUser } from "../../hooks/useSessionUser";
import { useRealtime } from "../../hooks/useRealtime";
import type { PlacementPreview } from "../../components/battleship/BattleshipBoard";
import { TableSurface } from "../../components/battleship/TableSurface";
import type { Seat } from "../../components/battleship/TableWidgets";
import { GamePanel, LoadingState } from "../../components/nightly/primitives";

type ActionResult = TableSnapshot | void;

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

  if (loading) return <LoadingState title="Cargando mesa" body="Preparando el tablero..." />;
  if (!table) return <ShellMessage title="Mesa no disponible" body={error ?? "Regresa al lobby y vuelve a intentarlo."} />;

  return (
    <TableSurface
      table={table}
      connected={connected}
      busy={busy}
      error={error}
      shotMessage={shotMessage}
      mySeat={mySeat}
      mySeatSnapshot={mySeatSnapshot}
      opponentSeat={opponentSeat}
      bothSeatsOccupied={bothSeatsOccupied}
      isActiveRound={isActiveRound}
      canTakeSeat={canTakeSeat}
      isMyTurn={isMyTurn}
      fleetSpec={fleetSpec}
      selectedShip={selectedShip}
      fleet={fleet}
      orientation={orientation}
      unplacedCount={unplacedCount}
      placementRemaining={placementRemaining}
      readyRemaining={readyRemaining}
      turnRemaining={turnRemaining}
      placementPreview={placementPreview}
      canPlaceShips={canPlaceShips}
      chatMessages={chatMessages}
      chatDraft={chatDraft}
      onBackToLobby={() => router.push("/")}
      onRefresh={() => loadTable(false)}
      onLeave={handleLeave}
      onSit={handleSit}
      onStand={handleStand}
      onReady={handleReady}
      onResign={handleResign}
      onRematch={handleRematch}
      onSetOrientation={() => setOrientation((current) => (current === "H" ? "V" : "H"))}
      onRandomFleet={handleRandomFleet}
      onClearFleet={handleClearFleet}
      onPlaceFleet={handlePlaceFleet}
      onPlaceSelectedShip={handlePlaceSelectedShip}
      onCellEnter={setHoverCell}
      onCellLeave={() => setHoverCell(null)}
      onSelectShip={setSelectedShipKey}
      onRemoveShip={handleRemoveShip}
      onShot={handleShot}
      onChatDraftChange={setChatDraft}
      onChatKeyDown={(event) => {
        if (event.key === "Enter") handleSendChat();
      }}
      onSendChat={handleSendChat}
      formatSeconds={formatSeconds}
    />
  );
}

function ShellMessage({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto grid min-h-[calc(100dvh-180px)] max-w-lg place-items-center py-10">
      <GamePanel title={title} eyebrow="system message" className="w-full text-center">
        <p className="text-sm leading-6 text-night-muted">{body}</p>
      </GamePanel>
    </div>
  );
}

function seatByCode(table: TableSnapshot | null, seat: Seat) {
  if (!table) return null;
  return seat === "A" ? table.seatA : table.seatB;
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
