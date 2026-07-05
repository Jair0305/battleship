"use client";

import type { SeatSnapshot, TableSnapshot } from "../../lib/types";
import {
  EmptyState,
  GameBadge,
  GameButton,
  GameCard,
  GamePanel,
  GameStatus,
  GameOverState,
  VictoryState,
} from "../nightly/primitives";
import { BoardGrid } from "./BattleshipBoard";

export type Seat = "A" | "B";

export const battleStateLabel: Record<string, string> = {
  WAITING_FOR_PLAYERS: "Esperando jugadores",
  PLAYERS_SEATED: "Jugadores sentados",
  PLACING_SHIPS: "Colocando flotas",
  READY_TO_START: "Listo para iniciar",
  IN_PROGRESS: "En partida",
  FINISHED: "Finalizada",
  ABANDONED: "Abandonada",
  CANCELLED: "Cancelada",
};

export function SeatCard({
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
    <GameCard className="p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-[0.67rem] uppercase tracking-[0.18em] text-night-faint">Asiento {seat.seat}</div>
          <div className="mt-1 truncate text-sm font-semibold text-night-text">{seat.displayName ?? "Libre"}</div>
        </div>
        {seat.occupied && (
          <GameBadge tone={seat.ready ? "success" : isMine ? "accent" : "neutral"}>
            {seat.ready ? "Listo" : isMine ? "Tu" : "Ocupado"}
          </GameBadge>
        )}
      </div>
      {!seat.occupied && (
        <GameButton onClick={onSit} disabled={!canSit || busy} className="mt-3 w-full">
          Sentarme
        </GameButton>
      )}
    </GameCard>
  );
}

export function StatusStrip({
  table,
  mySeat,
  opponentName,
  readyRemaining,
  turnRemaining,
  formatSeconds,
}: {
  table: TableSnapshot;
  mySeat: Seat | null;
  opponentName: string | null;
  readyRemaining: number;
  turnRemaining: number;
  formatSeconds: (seconds: number) => string;
}) {
  const view = table.privateView;
  const turnName = table.turnoActualJugadorId === table.seatA.jugadorId ? table.seatA.displayName : table.seatB.displayName;
  const winnerName = table.ganadorId === table.seatA.jugadorId ? table.seatA.displayName : table.ganadorId === table.seatB.jugadorId ? table.seatB.displayName : null;
  const criticalTime = (table.estado === "IN_PROGRESS" && turnRemaining <= 10) || Boolean(table.readyDeadlineAt && readyRemaining <= 5);

  return (
    <div className="grid gap-3 md:grid-cols-4">
      <GameStatus label="Rol" value={mySeat ? `Jugador ${mySeat}` : "Espectador"} />
      <GameStatus label="Estado" value={battleStateLabel[table.estado] ?? table.estado} tone={table.estado === "IN_PROGRESS" ? "accent" : "neutral"} />
      <GameStatus
        label={winnerName ? "Ganador" : table.estado === "IN_PROGRESS" ? "Turno" : "Rival"}
        value={winnerName ?? turnName ?? opponentName ?? "Pendiente"}
        tone={view && table.turnoActualJugadorId === view.myJugadorId ? "success" : "neutral"}
      />
      <GameStatus
        label="Tiempo"
        value={table.estado === "IN_PROGRESS" ? formatSeconds(turnRemaining) : table.readyDeadlineAt ? formatSeconds(readyRemaining) : table.placementDeadlineAt ? "Colocando" : "Sin reloj"}
        tone={criticalTime ? "danger" : "accent"}
        pulse={criticalTime}
      />
    </div>
  );
}

export function EndRoundBanner({
  table,
  mySeat,
  onRematch,
  onLeave,
  busy,
}: {
  table: TableSnapshot;
  mySeat: Seat | null;
  onRematch: () => void;
  onLeave: () => void;
  busy: string | null;
}) {
  if (table.estado !== "FINISHED" && table.estado !== "ABANDONED") return null;
  const winnerName = table.ganadorId === table.seatA.jugadorId ? table.seatA.displayName : table.ganadorId === table.seatB.jugadorId ? table.seatB.displayName : null;
  const myPlayerId = table.privateView?.myJugadorId ?? null;
  const won = Boolean(myPlayerId && table.ganadorId === myPlayerId);
  const body = table.estado === "ABANDONED"
    ? "La partida termino por abandono. Puedes pedir revancha o volver al lobby."
    : `${winnerName ?? "Un jugador"} hundio toda la flota rival.`;
  const action = (
    <>
      {mySeat && (
        <GameButton onClick={onRematch} disabled={busy === "rematch"}>
          Pedir revancha
        </GameButton>
      )}
      <GameButton variant="secondary" onClick={onLeave} disabled={busy === "leave"}>
        Volver al lobby
      </GameButton>
    </>
  );

  return won ? (
    <VictoryState title="Victoria" body={body} action={action} />
  ) : (
    <GameOverState title={table.estado === "ABANDONED" ? "Partida abandonada" : "Game over"} body={body} action={action} />
  );
}

export function SpectatorBoards({ table }: { table: TableSnapshot }) {
  const spectator = table.spectatorView;
  if (!spectator) {
    return (
      <GamePanel title="Mesa" eyebrow="spectator">
        <EmptyState title="Vista en espera" body="Sientate para jugar o espera a que haya una partida activa para verla como espectador." />
      </GamePanel>
    );
  }

  const playerIds = Object.keys(spectator.players);
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {playerIds.map((playerId) => (
        <GamePanel key={playerId} title={spectator.players[playerId]} eyebrow="spectator board">
          <BoardGrid
            title={spectator.players[playerId]}
            ships={spectator.revealedShips[playerId] ?? {}}
            shots={spectator.publicShots[playerId] ?? {}}
          />
        </GamePanel>
      ))}
    </div>
  );
}

export function ShotHistory({ table }: { table: TableSnapshot }) {
  const history = table.privateView?.history ?? table.spectatorView?.history ?? [];
  if (history.length === 0) {
    return <EmptyState title="Sin disparos" body="El historial se activara cuando empiece el combate." />;
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
          <GameCard key={`${shot.ts}-${index}`} className="flex items-center justify-between gap-3 p-3">
            <span className="min-w-0 truncate text-sm text-night-muted">
              {names.get(shot.atacanteId) ?? "Jugador"} disparo a <span className="font-mono text-night-text">{shot.posicion}</span>
              {shot.automatic ? " - automatico" : ""}
            </span>
            <GameBadge tone={shot.acierto ? "danger" : "neutral"}>{shot.resultado}</GameBadge>
          </GameCard>
        ))}
    </div>
  );
}
