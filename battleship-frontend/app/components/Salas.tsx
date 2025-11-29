"use client";
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';
import Leaderboard from './Leaderboard';

// Enviar cookies en peticiones CORS cuando el backend usa credenciales
axios.defaults.withCredentials = true;

interface Sala {
    id: number;
    nombre: string;
    disponible: boolean;
    ocupacion?: number; // capacidad actual (0..2)
    espectadores?: number;
    jugadores?: Jugador[];
}

interface User {
    id: number;
    username: string;
    createdAt: string;
}

// Jugador mínimo para capturar ID de backend
interface Jugador {
    id: number;
    nombre: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8080';

const Salas = () => {
    const [salas, setSalas] = useState<Sala[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [currentRoomId, setCurrentRoomId] = useState<number | null>(null);
    const router = useRouter();

    useEffect(() => {
        const rawUser = localStorage.getItem('bship:user');
        if (rawUser) setUser(JSON.parse(rawUser));
        const rawRoom = localStorage.getItem('bship:currentRoomId');
        if (rawRoom) setCurrentRoomId(parseInt(rawRoom, 10));

        const onStorage = (e: StorageEvent) => {
            if (e.key === 'bship:user') {
                if (e.newValue) {
                    setUser(JSON.parse(e.newValue));
                } else {
                    // Logout: limpiar estado sensible
                    setUser(null);
                    setSalas([]);
                    setCurrentRoomId(null);
                }
            }
            if (e.key === 'bship:currentRoomId') {
                setCurrentRoomId(e.newValue ? parseInt(e.newValue, 10) : null);
            }
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);

    const cargarSalas = async () => {
        if (!user) return; // No cargar salas sin usuario autenticado
        try {
            setError(null);
            setLoading(true);
            try {
                const { data } = await axios.get<Sala[]>(`${API_BASE}/api/sala/todas`);
                setSalas(data);
            } catch (err: any) {
                const status = err?.response?.status;
                if (status === 404) {
                    const { data } = await axios.get<Sala[]>(`${API_BASE}/api/sala`);
                    setSalas(data);
                } else {
                    throw err;
                }
            }
        } catch (_err) {
            setError('No se pudo conectar al backend. Verifica que esté en ejecución en ' + API_BASE);
        } finally {
            setLoading(false);
        }
    };

    // Cargar salas solo cuando hay usuario
    useEffect(() => {
        if (user) cargarSalas();
        else setSalas([]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    // Suscripción WebSocket para cambios en lista de salas (solo con usuario)
    useEffect(() => {
        if (!user) return; // No conectar si no hay usuario
        let client: Client | null = null;
        let active = true;
        const connect = () => {
            const sock = new SockJS(`${API_BASE}/ws`);
            client = new Client({
                webSocketFactory: () => sock as any,
                reconnectDelay: 3000,
                onConnect: () => {
                    client?.subscribe('/topic/salas', (message) => {
                        try {
                            const data: Sala[] = JSON.parse(message.body);
                            if (active) setSalas(data);
                        } catch { }
                    });
                },
                onStompError: () => { },
            });
            client.activate();
        };
        connect();
        return () => {
            active = false;
            client?.deactivate();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    const crearSala = async () => {
        if (!user) {
            alert('Inicia sesión para crear una sala');
            return;
        }
        const nombre = prompt("Nombre de la nueva sala:");
        if (nombre) {
            try {
                const { data } = await axios.post<Sala>(`${API_BASE}/api/sala`, null, { params: { nombre } });
                setSalas(prev => [...prev, data]);
            } catch (_error) {
                setError('Hubo un error al crear la sala.');
            }
        }
    };

    const ocuparSala = async (id: number) => {
        if (!user) {
            alert('Inicia sesión para unirte a una sala');
            return;
        }
        try {
            // Ocupar retorna la Sala actualizada
            const { data: salaActualizada } = await axios.put<Sala>(`${API_BASE}/api/sala/${id}/ocupar`);
            // Persistir sala actual
            localStorage.setItem('bship:currentRoomId', String(id));
            setCurrentRoomId(id);
            // Registrar jugador en la sala para obtener jugadorId y tablero inicial
            const { data: jugador } = await axios.post<Jugador>(`${API_BASE}/api/juego/registrar`, null, { params: { nombre: user.username, salaId: id } });
            localStorage.setItem(`bship:jugadorId:${id}`, String(jugador.id));
            // Navegar a juego
            router.push(`/juego/${id}`);
        } catch (error: any) {
            if (error?.response?.status === 409) {
                setError('La sala ya está llena (2 jugadores).');
            } else {
                setError('Hubo un error al unirse a la sala.');
            }
        }
    };

    const reingresarSala = (id: number) => {
        router.push(`/juego/${id}`);
    };

    const espectarSala = (id: number) => {
        // Navegar sin ocupar sala ni registrar jugador
        router.push(`/juego/${id}?mode=spectator`);
    };

    const liberarSala = async (id: number) => {
        if (!user) { alert('Inicia sesión para liberar una sala'); return; }
        try {
            setLoading(true);
            await axios.put(`${API_BASE}/api/sala/${id}/liberar`);
            if (currentRoomId === id) {
                localStorage.removeItem('bship:currentRoomId');
                // limpiar jugadorId asociado a esa sala
                localStorage.removeItem(`bship:jugadorId:${id}`);
                setCurrentRoomId(null);
            }
            await cargarSalas();
        } catch (_error) {
            setError('No se pudo liberar la sala.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-100px)]">
            {/* Main Content: Rooms */}
            <div className="flex-1 flex flex-col space-y-6 overflow-hidden">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
                            Salas de Batalla
                        </h1>
                        <p className="text-slate-400 text-sm mt-1">Únete a una sala o crea la tuya para comenzar.</p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={cargarSalas}
                            className={`px-4 py-2 rounded-lg border border-slate-700 bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 transition-all ${!user ? 'opacity-50 cursor-not-allowed' : ''}`}
                            disabled={!user}
                        >
                            Refrescar
                        </button>
                        <button
                            onClick={crearSala}
                            className={`px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold shadow-lg shadow-blue-500/20 hover:bg-blue-500 transition-all ${!user ? 'opacity-50 cursor-not-allowed' : ''}`}
                            disabled={!user}
                        >
                            Crear Sala
                        </button>
                    </div>
                </div>

                {!user && (
                    <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-center">
                        Debes iniciar sesión para ver y gestionar las salas.
                    </div>
                )}

                {error && (
                    <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
                        {error}
                    </div>
                )}

                {user && (
                    loading ? (
                        <div className="flex justify-center py-12">
                            <svg className="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 overflow-y-auto pr-2 custom-scrollbar pb-4">
                            {salas.map(sala => {
                                const isMine = !!user && currentRoomId === sala.id;
                                const ocup = sala.ocupacion ?? 0;
                                const espectadores = sala.espectadores ?? 0;
                                const isFull = ocup >= 2;
                                const statusText = isMine ? 'Tu sala' : (sala.disponible ? 'Disponible' : 'Ocupada');
                                const statusColor = isMine ? 'text-blue-400' : (sala.disponible ? 'text-emerald-400' : 'text-red-400');
                                const playerNames = sala.jugadores?.map(j => j.nombre).join(', ') || 'Vacía';

                                return (
                                    <div key={sala.id} className={`glass-card rounded-xl p-5 flex flex-col justify-between group hover:border-blue-500/30 transition-all ${isMine ? 'ring-1 ring-blue-500/50' : ''}`}>
                                        <div className="mb-4">
                                            <div className="flex justify-between items-start mb-2">
                                                <h3 className="text-lg font-semibold text-white group-hover:text-blue-300 transition-colors">{sala.nombre}</h3>
                                                <span className={`text-xs font-medium px-2 py-1 rounded-full bg-slate-800/80 ${statusColor}`}>
                                                    {statusText}
                                                </span>
                                            </div>
                                            <div className="flex flex-col gap-1 text-slate-400 text-sm">
                                                <div className="flex items-center gap-4">
                                                    <div className="flex items-center gap-2">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                                        </svg>
                                                        <span>{ocup}/2 Jugadores</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-purple-400">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                        </svg>
                                                        <span>{espectadores} Espectadores</span>
                                                    </div>
                                                </div>
                                                {ocup > 0 && (
                                                    <div className="text-xs text-slate-500 mt-1">
                                                        Jugadores: <span className="text-slate-300">{playerNames}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex gap-2 mt-auto">
                                            {isMine ? (
                                                <>
                                                    <button
                                                        onClick={() => reingresarSala(sala.id)}
                                                        className="flex-1 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors"
                                                    >
                                                        Reingresar
                                                    </button>
                                                    <button
                                                        onClick={() => liberarSala(sala.id)}
                                                        className="px-3 py-2 rounded-lg bg-red-600/80 hover:bg-red-500 text-white text-sm font-medium transition-colors"
                                                    >
                                                        Salir
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    {sala.disponible ? (
                                                        <button
                                                            disabled={!user}
                                                            onClick={() => ocuparSala(sala.id)}
                                                            className={`flex-1 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors ${!user ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                        >
                                                            Unirse
                                                        </button>
                                                    ) : (
                                                        <button
                                                            disabled
                                                            className="flex-1 px-3 py-2 rounded-lg bg-slate-700 text-slate-400 text-sm font-medium cursor-not-allowed"
                                                        >
                                                            Llena
                                                        </button>
                                                    )}

                                                    <button
                                                        onClick={() => espectarSala(sala.id)}
                                                        className="px-3 py-2 rounded-lg border border-slate-600 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors"
                                                        title="Espectar partida"
                                                    >
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                        </svg>
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                            {salas.length === 0 && (
                                <div className="col-span-full text-center py-12 text-slate-500">
                                    No hay salas activas en este momento. ¡Crea una!
                                </div>
                            )}
                        </div>
                    )
                )}
            </div>

            {/* Sidebar: Leaderboard */}
            <div className="w-full lg:w-80 flex-shrink-0 h-full">
                <Leaderboard />
            </div>
        </div>
    );
};

export default Salas;
