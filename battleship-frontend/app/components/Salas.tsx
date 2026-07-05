"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Leaderboard from "./Leaderboard";
import { api } from "../lib/api";
import type { LobbySnapshot, RoomSnapshot, TableSnapshot } from "../lib/types";
import { useRealtime } from "../hooks/useRealtime";

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
    <div className="grid min-h-[calc(100vh-104px)] gap-6 lg:grid-cols-[1fr_320px]">
      <section className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Lobby publico</h1>
            <p className="text-sm text-slate-400">Mesas rapidas, asientos claros y espectadores sin friccion.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`rounded px-2 py-1 text-xs ${connected ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-300"}`}>
              {connected ? "Tiempo real" : "Reconectando"}
            </span>
            <button
              type="button"
              onClick={refresh}
              className="rounded border border-slate-700 px-3 py-2 text-sm text-slate-200 transition hover:bg-slate-800"
            >
              Refrescar
            </button>
          </div>
        </div>

        {error && <div className="rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}

        {loading ? (
          <div className="glass-card rounded-lg p-8 text-center text-slate-400">Cargando lobby...</div>
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
      </section>

      <aside className="space-y-5">
        <div className="glass-card rounded-lg p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Usuarios en lobby</h2>
          <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
            {(lobby?.onlinePlayers ?? []).length === 0 ? (
              <div className="text-sm text-slate-500">Sin usuarios conectados</div>
            ) : (
              lobby!.onlinePlayers.map((player) => (
                <div key={player.id} className="flex items-center justify-between rounded bg-slate-900/60 px-3 py-2 text-sm">
                  <span className="truncate text-slate-200">{player.displayName}</span>
                  <span className="text-xs text-slate-500">{player.guest ? "Invitado" : player.rating}</span>
                </div>
              ))
            )}
          </div>
        </div>
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
    <div className="glass-card rounded-lg p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">{room.nombre}</h2>
          <div className="mt-1 text-sm text-slate-400">
            {room.onlinePlayers} jugadores sentados · {room.spectators} espectadores
          </div>
        </div>
        <button
          type="button"
          onClick={onCreate}
          disabled={creating}
          className="rounded bg-cyan-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-60"
        >
          {creating ? "Creando..." : "Crear mesa"}
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {room.mesas.map((table) => (
          <TableCard key={table.id} table={table} onJoin={() => onJoin(table)} />
        ))}
      </div>
    </div>
  );
}

function TableCard({ table, onJoin }: { table: TableSnapshot; onJoin: () => void }) {
  const seats = [table.seatA, table.seatB];
  const isJoinable = table.estado !== "CANCELLED";

  return (
    <article className="rounded border border-slate-800 bg-slate-950/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-100">{table.nombre}</h3>
          <div className="mt-1 text-xs text-slate-500">Mesa #{table.id}</div>
        </div>
        <span className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-300">
          {stateLabel[table.estado] ?? table.estado}
        </span>
      </div>

      <div className="mt-4 space-y-2">
        {seats.map((seat) => (
          <div key={seat.seat} className="flex items-center justify-between rounded bg-slate-900/70 px-3 py-2 text-sm">
            <span className="text-slate-400">Asiento {seat.seat}</span>
            <span className={seat.occupied ? "text-slate-100" : "text-slate-500"}>
              {seat.displayName || "Libre"}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
        <span>{table.spectators} espectadores</span>
        {table.privateView?.opponentShipsPlaced && <span>Oponente listo</span>}
      </div>

      <button
        type="button"
        onClick={onJoin}
        disabled={!isJoinable}
        className="mt-4 w-full rounded border border-cyan-500/40 px-3 py-2 text-sm font-medium text-cyan-200 transition hover:bg-cyan-500/10 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Entrar
      </button>
    </article>
  );
}
