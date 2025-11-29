"use client";

import React, { useEffect, useState } from "react";
import axios from "axios";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";

interface RankingItem {
    rank: number;
    jugadorId: number;
    nombre: string;
    puntos: number;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8080';
axios.defaults.withCredentials = true;

export default function Leaderboard() {
    const [periodo, setPeriodo] = useState<"dia" | "semana" | "mes" | "historico">("dia");
    const [ranking, setRanking] = useState<RankingItem[]>([]);

    const fetchRanking = async (p: string) => {
        try {
            const res = await axios.get(`${API_BASE}/api/ranking/${p}`);
            setRanking(res.data);
        } catch (error) {
            console.error("Error fetching ranking:", error);
        }
    };

    useEffect(() => {
        fetchRanking(periodo);
    }, [periodo]);

    useEffect(() => {
        const socket = new SockJS(`${API_BASE}/ws`);
        const client = new Client({
            webSocketFactory: () => socket,
            onConnect: () => {
                client.subscribe(`/topic/ranking/${periodo}`, (message) => {
                    if (message.body) {
                        setRanking(JSON.parse(message.body));
                    }
                });
            },
        });

        client.activate();

        return () => {
            client.deactivate();
        };
    }, [periodo]);

    return (
        <div className="bg-gray-800/50 backdrop-blur-md border border-white/10 rounded-xl p-4 w-full h-full flex flex-col">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <span className="text-yellow-400">🏆</span> Clasificación
            </h2>

            <div className="flex gap-1 mb-4 bg-gray-900/50 p-1 rounded-lg">
                {(["dia", "semana", "mes", "historico"] as const).map((p) => (
                    <button
                        key={p}
                        onClick={() => setPeriodo(p)}
                        className={`flex-1 py-1 px-2 text-xs font-medium rounded-md transition-all ${periodo === p
                            ? "bg-blue-600 text-white shadow-lg"
                            : "text-gray-400 hover:text-white hover:bg-white/5"
                            }`}
                    >
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                    </button>
                ))}
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {ranking.length === 0 ? (
                    <div className="text-center text-gray-500 py-8 text-sm">
                        No hay datos aún
                    </div>
                ) : (
                    ranking.map((item) => (
                        <div
                            key={item.jugadorId}
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
                            </div>
                            <div className="text-sm font-bold text-blue-400">
                                {item.puntos} <span className="text-xs font-normal text-gray-500">PR</span>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
