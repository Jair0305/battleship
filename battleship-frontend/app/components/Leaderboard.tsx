"use client";

import { useSyncExternalStore } from "react";
import axios from "axios";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { apiUrl, realtimeUrl } from "../lib/api";
import { EmptyState, GamePanel } from "./nightly/primitives";

interface RankingItem {
  rank: number;
  jugadorId: number;
  nombre: string;
  puntos: number;
  gamesPlayed?: number;
  wins?: number;
  losses?: number;
}

axios.defaults.withCredentials = true;

let rankingSnapshot: RankingItem[] = [];
let rankingClient: Client | null = null;
let rankingRequest: Promise<void> | null = null;
const rankingListeners = new Set<() => void>();

function notifyRankingListeners() {
  rankingListeners.forEach((listener) => listener());
}

async function fetchRanking() {
  rankingRequest ??= axios
    .get(apiUrl("/api/ranking/historico"))
    .then((res) => {
      rankingSnapshot = res.data;
      notifyRankingListeners();
    })
    .catch((error) => {
      console.error("Error fetching ranking:", error);
    })
    .finally(() => {
      rankingRequest = null;
    });
  return rankingRequest;
}

function ensureRankingSocket() {
  if (typeof window === "undefined" || rankingClient) return;
  rankingClient = new Client({
    webSocketFactory: () => new SockJS(realtimeUrl()),
    onConnect: () => {
      rankingClient?.subscribe("/topic/ranking/historico", (message) => {
        if (!message.body) return;
        try {
          const nextRanking = JSON.parse(message.body);
          rankingSnapshot = Array.isArray(nextRanking) ? nextRanking : rankingSnapshot;
          notifyRankingListeners();
        } catch {
          void fetchRanking();
        }
      });
    },
  });
  rankingClient.activate();
}

function subscribeRanking(listener: () => void) {
  rankingListeners.add(listener);
  void fetchRanking();
  ensureRankingSocket();
  return () => {
    rankingListeners.delete(listener);
    if (rankingListeners.size === 0) {
      void rankingClient?.deactivate();
      rankingClient = null;
    }
  };
}

function getRankingSnapshot() {
  return rankingSnapshot;
}

function getServerRankingSnapshot() {
  return [];
}

export default function Leaderboard() {
  const ranking = useSyncExternalStore(subscribeRanking, getRankingSnapshot, getServerRankingSnapshot);

  return (
    <GamePanel title="Rating competitivo" eyebrow="Clasificacion" tone="warning">
      {ranking.length === 0 ? (
        <EmptyState title="Sin partidas rated" body="Los duelos entre cuentas registradas apareceran aqui." />
      ) : (
        <ol className="max-h-[30rem] divide-y divide-white/[0.07] overflow-y-auto rounded-night-sm border border-white/[0.08] bg-[#0d0d0c]">
          {ranking.map((item) => (
            <li
              key={`${item.nombre}-${item.rank}`}
              className="nightly-row grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5 hover:bg-white/[0.025]"
            >
              <div className={rankClassName(item.rank)}>#{item.rank}</div>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-night-text">{item.nombre}</div>
                <div className="mt-1 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-night-faint">
                  {item.wins ?? 0}V / {item.losses ?? 0}D
                </div>
              </div>
              <span className="font-mono text-base tabular-nums text-night-accent">{item.puntos}</span>
            </li>
          ))}
        </ol>
      )}
    </GamePanel>
  );
}

function rankClassName(rank: number) {
  const base = "grid h-8 w-8 place-items-center rounded-night-sm border font-mono text-xs tabular-nums";
  if (rank === 1) return `${base} border-night-warning/40 bg-night-warning/10 text-night-warning`;
  if (rank <= 3) return `${base} border-white/15 bg-white/[0.04] text-night-text`;
  return `${base} border-transparent text-night-faint`;
}
