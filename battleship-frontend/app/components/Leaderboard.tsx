"use client";

import { useSyncExternalStore } from "react";
import axios from "axios";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { apiUrl, realtimeUrl } from "../lib/api";

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
        <div className="bg-gray-800/50 backdrop-blur-md border border-white/10 rounded-xl p-4 w-full h-full flex flex-col">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                Rating competitivo
            </h2>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {ranking.length === 0 ? (
                    <div className="text-center text-gray-500 py-8 text-sm">
                        No hay partidas rated aun
                    </div>
                ) : (
                    ranking.map((item) => (
                        <div
                            key={`${item.nombre}-${item.rank}`}
                            className={`flex items-center justify-between p-2 rounded-lg border ${item.rank === 1
                                ? "bg-yellow-500/10 border-yellow-500/30"
                                : item.rank === 2
                                    ? "bg-gray-400/10 border-gray-400/30"
                                    : item.rank === 3
                                        ? "bg-orange-700/10 border-orange-700/30"
                                        : "bg-white/5 border-white/5"
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <div
                                    className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${item.rank === 1
                                        ? "bg-yellow-500 text-black"
                                        : item.rank === 2
                                            ? "bg-gray-400 text-black"
                                            : item.rank === 3
                                                ? "bg-orange-700 text-white"
                                                : "bg-gray-700 text-gray-300"
                                        }`}
                                >
                                    {item.rank}
                                </div>
                                <span className="text-sm font-medium text-gray-200 truncate max-w-[100px]">
                                    {item.nombre}
                                </span>
                                <span className="text-xs text-gray-500">
                                    {item.wins ?? 0}W / {item.losses ?? 0}L
                                </span>
                            </div>
                            <div className="text-sm font-bold text-blue-400">
                                {item.puntos} <span className="text-xs font-normal text-gray-500">rating</span>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
