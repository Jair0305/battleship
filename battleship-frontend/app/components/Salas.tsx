"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Leaderboard from "./Leaderboard";
import { api } from "../lib/api";
import type { LobbySnapshot, RoomSnapshot, TableSnapshot } from "../lib/types";
import { useRealtime } from "../hooks/useRealtime";
import {
  EmptyState,
  ErrorState,
  GameBadge,
  GameButton,
  GameCard,
  GamePanel,
  GameScore,
  GameSection,
  GameStatus,
  LoadingState,
} from "./nightly/primitives";

const stateLabel: Record<string, string> = {
  WAITING_FOR_PLAYERS: "Esperando",
  PLAYERS_SEATED: "Sentados",
  PLACING_SHIPS: "Colocando",
  READY_TO_START: "Listo",
  IN_PROGRESS: "Jugando",
  FINISHED: "Finalizada",
  ABANDONED: "Abandonada",
  CANCELLED: "Cancelada",
};

export default function Salas() {
  const router = useRouter();
  const [lobby, setLobby] = useState<LobbySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creatingSalaId, setCreatingSalaId] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      setLobby(await api.lobby());
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el lobby");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const connected = useRealtime([
    {
      topic: "/topic/lobby",
      onMessage: () => refresh(),
    },
  ]);

  const rooms = useMemo(() => lobby?.salas ?? [], [lobby]);
  const onlineCount = lobby?.onlinePlayers.length ?? 0;
  const tableCount = rooms.reduce((count, room) => count + room.mesas.length, 0);

  const createTable = async (room: RoomSnapshot) => {
    setCreatingSalaId(room.id);
    try {
      const table = await api.createTable(room.id, `Mesa ${room.mesas.length + 1}`);
      await api.joinTable(table.id);
      router.push(`/juego/${table.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la mesa");
    } finally {
      setCreatingSalaId(null);
    }
  };

  const joinTable = async (table: TableSnapshot) => {
    try {
      await api.joinTable(table.id);
      router.push(`/juego/${table.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo entrar a la mesa");
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <GameSection
        eyebrow="public lobby"
        title="Mesas activas"
        description="Crea una mesa, ocupa un asiento o mira una partida como espectador. Las notificaciones publicas solo invalidan snapshots privados."
        action={
          <div className="flex flex-wrap gap-2">
            <GameStatus label="Socket" value={connected ? "Tiempo real" : "Reconectando"} tone={connected ? "success" : "warning"} pulse={!connected} />
            <GameButton variant="secondary" onClick={refresh}>Refrescar</GameButton>
          </div>
        }
      >
        <div className="grid gap-3 md:grid-cols-3">
          <GameScore label="Usuarios" value={onlineCount} />
          <GameScore label="Mesas" value={tableCount} />
          <GameScore label="Reglas" value="Classic" />
        </div>

        {error && <ErrorState body={error} />}

        {loading ? (
          <LoadingState title="Cargando lobby" body="Buscando salas, mesas y jugadores online." />
        ) : rooms.length === 0 ? (
          <EmptyState title="Sin salas disponibles" body="El lobby aun no tiene salas publicadas por el backend." />
        ) : (
          <div className="space-y-5">
            {rooms.map((room) => (
              <RoomPanel
                key={room.id}
                room={room}
                creating={creatingSalaId === room.id}
                onCreate={() => createTable(room)}
                onJoin={joinTable}
              />
            ))}
          </div>
        )}
      </GameSection>

      <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
        <GamePanel title="Usuarios online" eyebrow="lobby presence">
          <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {(lobby?.onlinePlayers ?? []).length === 0 ? (
              <EmptyState title="Lobby vacio" body="Cuando alguien entre, aparecera aqui." />
            ) : (
              lobby!.onlinePlayers.map((player) => (
                <GameCard key={player.id} className="flex items-center justify-between gap-3 p-3">
                  <span className="min-w-0 truncate text-sm text-night-text">{player.displayName}</span>
                  <GameBadge tone={player.guest ? "neutral" : "accent"}>{player.guest ? "Invitado" : player.rating}</GameBadge>
                </GameCard>
              ))
            )}
          </div>
        </GamePanel>
        <Leaderboard />
      </aside>
    </div>
  );
}

function RoomPanel({
  room,
  creating,
  onCreate,
  onJoin,
}: {
  room: RoomSnapshot;
  creating: boolean;
  onCreate: () => void;
  onJoin: (table: TableSnapshot) => void;
}) {
  return (
    <GamePanel
      title={room.nombre}
      eyebrow="room cluster"
      action={<GameButton onClick={onCreate} disabled={creating}>{creating ? "Creando..." : "Crear mesa"}</GameButton>}
      className="nightly-scanline"
    >
      <div className="mb-4 flex flex-wrap gap-2">
        <GameBadge tone="accent">{room.onlinePlayers} jugadores</GameBadge>
        <GameBadge>{room.spectators} espectadores</GameBadge>
        <GameBadge tone={room.disponible ? "success" : "warning"}>{room.disponible ? "Disponible" : "Cerrada"}</GameBadge>
      </div>

      {room.mesas.length === 0 ? (
        <EmptyState title="Sin mesas" body="Crea una mesa nueva para abrir partida en esta sala." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {room.mesas.map((table, index) => (
            <TableCard key={table.id} table={table} index={index} onJoin={() => onJoin(table)} />
          ))}
        </div>
      )}
    </GamePanel>
  );
}

function TableCard({ table, index, onJoin }: { table: TableSnapshot; index: number; onJoin: () => void }) {
  const seats = [table.seatA, table.seatB];
  const isJoinable = table.estado !== "CANCELLED";

  return (
    <GameCard interactive className="flex min-h-64 flex-col" tone={table.estado === "IN_PROGRESS" ? "accent" : "neutral"}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-night-faint">table {String(index + 1).padStart(2, "0")}</div>
          <h3 className="mt-1 truncate font-display text-2xl uppercase text-night-text">{table.nombre}</h3>
          <div className="mt-1 font-mono text-xs text-night-faint">Mesa #{table.id}</div>
        </div>
        <GameBadge tone={table.estado === "IN_PROGRESS" ? "accent" : table.estado === "FINISHED" ? "success" : "neutral"}>
          {stateLabel[table.estado] ?? table.estado}
        </GameBadge>
      </div>

      <div className="mt-5 flex-1 space-y-2">
        {seats.map((seat) => (
          <div key={seat.seat} className="flex items-center justify-between gap-3 rounded-night-sm border border-white/10 bg-[#090909]/60 px-3 py-2 text-sm">
            <span className="font-mono text-xs uppercase tracking-[0.16em] text-night-faint">Seat {seat.seat}</span>
            <span className={seat.occupied ? "min-w-0 truncate text-night-text" : "text-night-faint"}>
              {seat.displayName || "Libre"}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-night-faint">
        <span className="font-mono">{table.spectators} spectators</span>
        {table.privateView?.opponentShipsPlaced && <span className="text-night-accent">Rival listo</span>}
      </div>

      <GameButton onClick={onJoin} disabled={!isJoinable} variant={table.estado === "CANCELLED" ? "ghost" : "secondary"} className="mt-4 w-full">
        Entrar
      </GameButton>
    </GameCard>
  );
}
