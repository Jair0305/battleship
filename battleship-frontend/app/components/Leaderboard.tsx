"use client";

import { useSyncExternalStore } from "react";
import axios from "axios";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { apiUrl, realtimeUrl } from "../lib/api";
import { EmptyState, GameBadge, GameCard, GamePanel } from "./nightly/primitives";

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
    <GamePanel title="Rating competitivo" eyebrow="leaderboard">
      <div className="max-h-[30rem] space-y-2 overflow-y-auto pr-1">
        {ranking.length === 0 ? (
          <EmptyState title="Sin partidas rated" body="Los duelos entre cuentas registradas apareceran aqui." />
        ) : (
          ranking.map((item) => (
            <GameCard
              key={`${item.nombre}-${item.rank}`}
              className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 p-3"
              tone={item.rank === 1 ? "accent" : "neutral"}
            >
              <div className={rankClassName(item.rank)}>{item.rank}</div>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-night-text">{item.nombre}</div>
                <div className="mt-1 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-night-faint">
                  {item.wins ?? 0}W / {item.losses ?? 0}L
                </div>
              </div>
              <GameBadge tone={item.rank <= 3 ? "accent" : "neutral"}>{item.puntos} rating</GameBadge>
            </GameCard>
          ))
        )}
      </div>
    </GamePanel>
  );
}

function rankClassName(rank: number) {
  const base = "grid h-8 w-8 place-items-center rounded-night-sm border font-mono text-xs font-bold";
  if (rank === 1) return `${base} border-night-accent/40 bg-night-accent text-[#111409]`;
  if (rank === 2) return `${base} border-white/20 bg-white/10 text-night-text`;
  if (rank === 3) return `${base} border-night-warning/40 bg-night-warning/20 text-night-warning`;
  return `${base} border-white/10 bg-white/[0.04] text-night-muted`;
}
