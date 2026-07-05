"use client";

import type { KeyboardEvent } from "react";
import type { ChatMessage, SeatSnapshot, ShipKey, ShipPlacement, TableSnapshot } from "../../lib/types";
import { BoardGrid, PlacementBoard, type PlacementPreview } from "./BattleshipBoard";
import {
  EndRoundBanner,
  SeatCard,
  ShotHistory,
  SpectatorBoards,
  StatusStrip,
  battleStateLabel,
  type Seat,
} from "./TableWidgets";
import { ErrorState, GameBadge, GameButton, GamePanel } from "../nightly/primitives";

type FleetShip = { key: ShipKey; name: string; size: number };

export function TableSurface({
  table,
  connected,
  busy,
  error,
  shotMessage,
  mySeat,
  mySeatSnapshot,
  opponentSeat,
  bothSeatsOccupied,
  isActiveRound,
  canTakeSeat,
  isMyTurn,
  fleetSpec,
  selectedShip,
  fleet,
  orientation,
  unplacedCount,
  placementRemaining,
  readyRemaining,
  turnRemaining,
  placementPreview,
  canPlaceShips,
  chatMessages,
  chatDraft,
  onBackToLobby,
  onRefresh,
  onLeave,
  onSit,
  onStand,
  onReady,
  onResign,
  onRematch,
  onSetOrientation,
  onRandomFleet,
  onClearFleet,
  onPlaceFleet,
  onPlaceSelectedShip,
  onCellEnter,
  onCellLeave,
  onSelectShip,
  onRemoveShip,
  onShot,
  onChatDraftChange,
  onChatKeyDown,
  onSendChat,
  formatSeconds,
}: {
  table: TableSnapshot;
  connected: boolean;
  busy: string | null;
  error: string | null;
  shotMessage: string | null;
  mySeat: Seat | null;
  mySeatSnapshot: SeatSnapshot | null;
  opponentSeat: SeatSnapshot | null | undefined;
  bothSeatsOccupied: boolean;
  isActiveRound: boolean;
  canTakeSeat: boolean;
  isMyTurn: boolean;
  fleetSpec: FleetShip[];
  selectedShip: FleetShip | undefined;
  fleet: ShipPlacement[];
  orientation: "H" | "V";
  unplacedCount: number;
  placementRemaining: number;
  readyRemaining: number;
  turnRemaining: number;
  placementPreview: PlacementPreview | null;
  canPlaceShips: boolean;
  chatMessages: ChatMessage[];
  chatDraft: string;
  onBackToLobby: () => void;
  onRefresh: () => void;
  onLeave: () => void;
  onSit: (seat: Seat) => void;
  onStand: () => void;
  onReady: () => void;
  onResign: () => void;
  onRematch: () => void;
  onSetOrientation: () => void;
  onRandomFleet: () => void;
  onClearFleet: () => void;
  onPlaceFleet: () => void;
  onPlaceSelectedShip: (cell: string) => void;
  onCellEnter: (cell: string) => void;
  onCellLeave: () => void;
  onSelectShip: (shipKey: ShipKey) => void;
  onRemoveShip: (shipKey: ShipKey) => void;
  onShot: (cell: string) => void;
  onChatDraftChange: (value: string) => void;
  onChatKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onSendChat: () => void;
  formatSeconds: (seconds: number) => string;
}) {
  return (
    <div className="min-h-[calc(100dvh-160px)] space-y-5 py-3">
      <div className="flex flex-col gap-3 border-b border-white/10 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <button type="button" onClick={onBackToLobby} className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-night-accent transition hover:text-night-accent-strong">
            Volver al lobby
          </button>
          <h1 className="font-display text-4xl uppercase leading-none text-night-text md:text-5xl">{table.nombre}</h1>
          <p className="mt-2 font-mono text-xs uppercase tracking-[0.16em] text-night-faint">
            {table.salaNombre} / Mesa #{table.id} / {battleStateLabel[table.estado] ?? table.estado}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <GameBadge tone={connected ? "success" : "warning"}>{connected ? "Tiempo real" : "Reconectando"}</GameBadge>
          <GameButton variant="secondary" onClick={onRefresh}>Refrescar</GameButton>
          <GameButton variant="ghost" onClick={onLeave} disabled={busy === "leave"}>Salir</GameButton>
        </div>
      </div>

      {error && <ErrorState body={error} />}
      {shotMessage && <GameBadge tone="accent" className="w-full justify-center py-3">{shotMessage}</GameBadge>}
      <EndRoundBanner table={table} mySeat={mySeat} onRematch={onRematch} onLeave={onLeave} busy={busy} />

      <section className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <aside className="space-y-4">
          <Panel title="Asientos">
            <div className="space-y-3">
              <SeatCard seat={table.seatA} canSit={canTakeSeat && !table.seatA.occupied} isMine={mySeat === "A"} busy={busy === "sit-A"} onSit={() => onSit("A")} />
              <SeatCard seat={table.seatB} canSit={canTakeSeat && !table.seatB.occupied} isMine={mySeat === "B"} busy={busy === "sit-B"} onSit={() => onSit("B")} />
            </div>
            <SeatActions
              mySeat={mySeat}
              mySeatSnapshot={mySeatSnapshot}
              bothSeatsOccupied={bothSeatsOccupied}
              isActiveRound={isActiveRound}
              readyRemaining={readyRemaining}
              busy={busy}
              onStand={onStand}
              onReady={onReady}
              onResign={onResign}
              onRematch={onRematch}
              formatSeconds={formatSeconds}
              table={table}
            />
          </Panel>

          <Panel title="Chat">
            <ChatPanel
              messages={chatMessages}
              draft={chatDraft}
              busy={busy}
              onDraftChange={onChatDraftChange}
              onKeyDown={onChatKeyDown}
              onSend={onSendChat}
            />
          </Panel>
        </aside>

        <main className="space-y-4">
          <StatusStrip table={table} mySeat={mySeat} opponentName={opponentSeat?.displayName ?? null} readyRemaining={readyRemaining} turnRemaining={turnRemaining} formatSeconds={formatSeconds} />
          {canPlaceShips && (
            <PlacementPanel
              fleetSpec={fleetSpec}
              selectedShip={selectedShip}
              fleet={fleet}
              orientation={orientation}
              unplacedCount={unplacedCount}
              placementRemaining={placementRemaining}
              placementPreview={placementPreview}
              busy={busy}
              onSetOrientation={onSetOrientation}
              onRandomFleet={onRandomFleet}
              onClearFleet={onClearFleet}
              onPlaceFleet={onPlaceFleet}
              onPlaceSelectedShip={onPlaceSelectedShip}
              onCellEnter={onCellEnter}
              onCellLeave={onCellLeave}
              onSelectShip={onSelectShip}
              onRemoveShip={onRemoveShip}
              formatSeconds={formatSeconds}
            />
          )}
          <BoardsSection table={table} opponentSeat={opponentSeat} isMyTurn={isMyTurn} onShot={onShot} />
          <Panel title="Historial">
            <ShotHistory table={table} />
          </Panel>
        </main>
      </section>
    </div>
  );
}

function SeatActions({
  mySeat,
  mySeatSnapshot,
  bothSeatsOccupied,
  isActiveRound,
  readyRemaining,
  busy,
  onStand,
  onReady,
  onResign,
  onRematch,
  formatSeconds,
  table,
}: {
  mySeat: Seat | null;
  mySeatSnapshot: SeatSnapshot | null;
  bothSeatsOccupied: boolean;
  isActiveRound: boolean;
  readyRemaining: number;
  busy: string | null;
  onStand: () => void;
  onReady: () => void;
  onResign: () => void;
  onRematch: () => void;
  formatSeconds: (seconds: number) => string;
  table: TableSnapshot;
}) {
  return (
    <div className="mt-4 space-y-2">
      {mySeat ? (
        <>
          <div className="rounded-night-sm border border-night-accent/20 bg-night-accent/10 px-3 py-2 text-sm text-night-accent">Estas sentado en el asiento {mySeat}.</div>
          {table.readyDeadlineAt && !isActiveRound && (
            <div className={readyRemaining <= 5 ? "rounded-night-sm border border-night-danger/30 bg-night-danger/10 px-3 py-2 text-sm text-[#ffdadd]" : "rounded-night-sm border border-night-warning/30 bg-night-warning/10 px-3 py-2 text-sm text-night-warning"}>
              Esperando OK rival: {formatSeconds(readyRemaining)}
            </div>
          )}
          <GameButton variant="secondary" onClick={onStand} disabled={busy === "stand"} className="w-full">
            {isActiveRound ? "Rendirme y liberar asiento" : "Liberar asiento"}
          </GameButton>
        </>
      ) : (
        <div className="rounded-night-sm border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-night-muted">
          Elige un asiento libre para jugar. Si no te sientas, ves la mesa como espectador.
        </div>
      )}

      {mySeat && bothSeatsOccupied && !isActiveRound && !mySeatSnapshot?.ready && (
        <GameButton onClick={onReady} disabled={busy === "ready"} className="w-full">Listo</GameButton>
      )}
      {mySeat && isActiveRound && (
        <GameButton variant="danger" onClick={onResign} disabled={busy === "resign"} className="w-full">Abandonar partida</GameButton>
      )}
      {mySeat && (table.estado === "FINISHED" || table.estado === "ABANDONED") && (
        <GameButton onClick={onRematch} disabled={busy === "rematch"} className="w-full">Pedir revancha</GameButton>
      )}
    </div>
  );
}

function ChatPanel({
  messages,
  draft,
  busy,
  onDraftChange,
  onKeyDown,
  onSend,
}: {
  messages: ChatMessage[];
  draft: string;
  busy: string | null;
  onDraftChange: (value: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onSend: () => void;
}) {
  return (
    <>
      <div className="h-44 space-y-2 overflow-y-auto rounded-night-sm border border-white/10 bg-[#090909]/70 p-3 text-sm">
        {messages.length === 0 ? (
          <div className="text-night-faint">Sin mensajes todavia</div>
        ) : (
          messages.map((message, index) => (
            <div key={`${message.receivedAt}-${index}`} className="rounded-night-sm border border-white/10 bg-white/[0.04] px-2 py-1">
              <span className="font-mono text-night-accent">{message.sender}: </span>
              <span className="text-night-text">{message.content}</span>
            </div>
          ))
        )}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          aria-label="Mensaje de chat"
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={onKeyDown}
          className="nightly-input min-w-0 flex-1 text-sm"
          placeholder="Mensaje"
        />
        <GameButton variant="secondary" onClick={onSend} disabled={busy === "chat"}>Enviar</GameButton>
      </div>
    </>
  );
}

function PlacementPanel({
  fleetSpec,
  selectedShip,
  fleet,
  orientation,
  unplacedCount,
  placementRemaining,
  placementPreview,
  busy,
  onSetOrientation,
  onRandomFleet,
  onClearFleet,
  onPlaceFleet,
  onPlaceSelectedShip,
  onCellEnter,
  onCellLeave,
  onSelectShip,
  onRemoveShip,
  formatSeconds,
}: {
  fleetSpec: FleetShip[];
  selectedShip: FleetShip | undefined;
  fleet: ShipPlacement[];
  orientation: "H" | "V";
  unplacedCount: number;
  placementRemaining: number;
  placementPreview: PlacementPreview | null;
  busy: string | null;
  onSetOrientation: () => void;
  onRandomFleet: () => void;
  onClearFleet: () => void;
  onPlaceFleet: () => void;
  onPlaceSelectedShip: (cell: string) => void;
  onCellEnter: (cell: string) => void;
  onCellLeave: () => void;
  onSelectShip: (shipKey: ShipKey) => void;
  onRemoveShip: (shipKey: ShipKey) => void;
  formatSeconds: (seconds: number) => string;
}) {
  return (
    <Panel title="Colocar flota">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-night-sm border border-white/10 bg-[#090909]/70 px-3 py-2 text-sm">
        <span className="text-night-muted">{unplacedCount === 0 ? "Flota completa" : `${unplacedCount} barcos pendientes`}</span>
        <span className={placementRemaining <= 10 ? "font-mono font-semibold text-night-danger" : "font-mono text-night-accent"}>
          Colocacion: {formatSeconds(placementRemaining)}
        </span>
      </div>
      <div className="grid gap-4 xl:grid-cols-[auto_1fr]">
        <PlacementBoard
          ships={fleetToCells(fleet)}
          preview={placementPreview}
          onCellClick={onPlaceSelectedShip}
          onCellEnter={onCellEnter}
          onCellLeave={onCellLeave}
        />
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <GameButton variant="secondary" onClick={onSetOrientation}>Rotar {orientation === "H" ? "Horizontal" : "Vertical"}</GameButton>
            <GameButton variant="secondary" onClick={onRandomFleet}>Aleatorizar</GameButton>
            <GameButton variant="ghost" onClick={onClearFleet}>Limpiar</GameButton>
            <GameButton onClick={onPlaceFleet} disabled={busy === "ships" || fleet.length !== fleetSpec.length}>Confirmar flota</GameButton>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {fleetSpec.map((ship) => {
              const placed = fleet.find((item) => item.key === ship.key);
              const selected = selectedShip?.key === ship.key;
              return (
                <div
                  key={ship.key}
                  className={`rounded-night-sm border px-3 py-2 text-sm transition ${
                    selected ? "border-night-accent/50 bg-night-accent/10" : placed ? "border-night-success/30 bg-night-success/10" : "border-white/10 bg-[#090909]/70"
                  }`}
                >
                  <button type="button" onClick={() => onSelectShip(ship.key)} className="flex w-full items-center justify-between gap-3 text-left">
                    <span className="font-medium text-night-text">{ship.name}</span>
                    <span className="font-mono text-xs text-night-faint">{ship.size}</span>
                  </button>
                  <div className="mt-1 font-mono text-xs text-night-faint">
                    {placed ? `${placed.orientation === "H" ? "Horizontal" : "Vertical"} - ${placed.cells.join(", ")}` : "Sin colocar"}
                  </div>
                  {placed && (
                    <button type="button" onClick={() => onRemoveShip(ship.key)} className="mt-2 font-mono text-xs uppercase tracking-[0.16em] text-night-accent transition hover:text-night-accent-strong">
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
  );
}

function BoardsSection({
  table,
  opponentSeat,
  isMyTurn,
  onShot,
}: {
  table: TableSnapshot;
  opponentSeat: SeatSnapshot | null | undefined;
  isMyTurn: boolean;
  onShot: (cell: string) => void;
}) {
  if (!table.privateView) return <SpectatorBoards table={table} />;
  return (
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
          onCellClick={onShot}
        />
      </Panel>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <GamePanel title={title} eyebrow="battleship module">
      {children}
    </GamePanel>
  );
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
