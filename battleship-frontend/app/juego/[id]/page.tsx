"use client";
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, Fragment, useCallback } from 'react';
import axios from 'axios';
import SockJS from 'sockjs-client';
import { Client as StompClient, IMessage } from '@stomp/stompjs';

axios.defaults.withCredentials = true;

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8080';
const BOARD_SIZE = Number(process.env.NEXT_PUBLIC_BOARD_SIZE || 12);

interface Sala {
    id: number;
    nombre: string;
    disponible: boolean;
    ocupacion?: number;
}

interface WSDisparoMsg {
    jugadorId: number;
    posicion: string;
    acierto: boolean;
    ts?: number;
}

type Orientation = 'H' | 'V';
interface ShipDef { key: string; name: string; size: number; }
interface ShipPlaced extends ShipDef { cells: string[]; orientation: Orientation; }

const SHIPS: ShipDef[] = [
    { key: 'battleship', name: 'Acorazado', size: 4 },
    { key: 'cruiser1', name: 'Crucero 1', size: 3 },
    { key: 'cruiser2', name: 'Crucero 2', size: 3 },
    { key: 'submarine1', name: 'Submarino 1', size: 2 },
    { key: 'submarine2', name: 'Submarino 2', size: 2 },
    { key: 'submarine3', name: 'Submarino 3', size: 2 },
    { key: 'destroyer1', name: 'Destructor 1', size: 1 },
    { key: 'destroyer2', name: 'Destructor 2', size: 1 },
    { key: 'destroyer3', name: 'Destructor 3', size: 1 },
    { key: 'destroyer4', name: 'Destructor 4', size: 1 },
];

interface EstadoSalaMsg {
    salaId: number;
    readyCount: number;
    started: boolean;
    startAt?: number | null;
    deadline?: number | null;
}

export default function TableroPage() {
    const params = useParams<{ id: string }>();
    const router = useRouter();
    const searchParams = useSearchParams();
    const isSpectator = searchParams.get('mode') === 'spectator';

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sala, setSala] = useState<Sala | null>(null);
    const [esperando, setEsperando] = useState(true);
    const [posicionDisparo, setPosicionDisparo] = useState('A1');
    const [resultado, setResultado] = useState<string | null>(null);
    const [preparado, setPreparado] = useState(false);
    const [wsConectado, setWsConectado] = useState(false);
    const [feed, setFeed] = useState<WSDisparoMsg[]>([]);
    const [oponenteListo, setOponenteListo] = useState(false);

    const [myShots, setMyShots] = useState<Record<string, boolean>>({});
    const [receivedShots, setReceivedShots] = useState<Record<string, boolean>>({});

    const [readyCount, setReadyCount] = useState(0);
    const [started, setStarted] = useState(false);
    const [deadline, setDeadline] = useState<number | null>(null);
    const [now, setNow] = useState<number>(Date.now());

    const [misBarcosMap, setMisBarcosMap] = useState<Record<string, boolean>>({});
    const [turnoId, setTurnoId] = useState<number | null>(null);
    const [partidaId, setPartidaId] = useState<number | null>(() => {
        try {
            const raw = typeof window !== 'undefined' ? localStorage.getItem(`bship:partidaId:${params.id}`) : null;
            return raw ? Number(raw) : null;
        } catch { return null; }
    });

    const [jugadorId, setJugadorId] = useState<number | null>(() => {
        if (isSpectator) return null;
        try {
            const raw = typeof window !== 'undefined' ? localStorage.getItem(`bship:jugadorId:${params.id}`) : null;
            return raw ? Number(raw) : null;
        } catch { return null; }
    });

    const [jugadoresMap, setJugadoresMap] = useState<Record<number, string>>({});
    const [tablerosPublicos, setTablerosPublicos] = useState<Record<number, Record<string, boolean>>>({});

    const [chatMsg, setChatMsg] = useState('');
    const [chatHistory, setChatHistory] = useState<{ sender: string, content: string, receivedAt: number }[]>([]);
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatHistory]);

    useEffect(() => {
        if (isSpectator) return;
        try {
            const raw = typeof window !== 'undefined' ? localStorage.getItem(`bship:jugadorId:${params.id}`) : null;
            setJugadorId(raw ? Number(raw) : null);
        } catch { }
    }, [params?.id, isSpectator]);

    const esMiTurno = useMemo(() => !!jugadorId && !!turnoId && jugadorId === turnoId, [jugadorId, turnoId]);

    const stompRef = useRef<StompClient | null>(null);

    const filaLabels = useMemo(() => Array.from({ length: BOARD_SIZE }, (_, i) => String.fromCharCode('A'.charCodeAt(0) + i)), []);
    const colLabels = useMemo(() => Array.from({ length: BOARD_SIZE }, (_, i) => i + 1), []);

    const [selectedShipKey, setSelectedShipKey] = useState<string>(SHIPS[0].key);
    const [orientation, setOrientation] = useState<Orientation>('H');
    const [placed, setPlaced] = useState<ShipPlaced[]>([]);
    const placedCells = useMemo(() => {
        const s = new Set<string>();
        placed.forEach(p => p.cells.forEach(c => s.add(c)));
        return s;
    }, [placed]);
    const selectedShipDef = useMemo(() => SHIPS.find(s => s.key === selectedShipKey) || null, [selectedShipKey]);

    const inBounds = useCallback((rowIdx: number, colIdx: number) => rowIdx >= 0 && rowIdx < BOARD_SIZE && colIdx >= 0 && colIdx < BOARD_SIZE, []);
    const keyAt = useCallback((rowIdx: number, colIdx: number) => `${filaLabels[rowIdx]}${colLabels[colIdx]}`, [filaLabels, colLabels]);

    const parseKey = (key: string) => {
        const rowLetter = key.charAt(0);
        const rowIdx = rowLetter.charCodeAt(0) - 'A'.charCodeAt(0);
        const col = parseInt(key.slice(1), 10);
        const colIdx = col - 1;
        return { rowIdx, colIdx };
    };

    const canPlaceAt = (rowIdx: number, colIdx: number, size: number, orient: Orientation): string[] | null => {
        const cells: string[] = [];
        for (let i = 0; i < size; i++) {
            const r = orient === 'H' ? rowIdx : rowIdx + i;
            const c = orient === 'H' ? colIdx + i : colIdx;
            if (!inBounds(r, c)) return null;
            const k = keyAt(r, c);
            if (placedCells.has(k)) return null;
            cells.push(k);
        }
        return cells;
    };

    const placeSelectedShip = (startKey: string) => {
        if (isSpectator) return;
        if (preparado || !started) return;
        const def = selectedShipDef;
        if (!def) return;
        if (placed.some(p => p.key === def.key)) {
            setError('Ese barco ya fue colocado. Quítalo antes de reubicar.');
            return;
        }
        const { rowIdx, colIdx } = parseKey(startKey);
        const cells = canPlaceAt(rowIdx, colIdx, def.size, orientation);
        if (!cells) {
            setError('No se puede colocar ahí: fuera de límites o se superpone.');
            return;
        }
        setError(null);
        setPlaced(prev => [...prev, { ...def, cells, orientation }]);
        const pending = SHIPS.find(s => !placed.some(p => p.key === s.key) && s.key !== def.key);
        if (pending) setSelectedShipKey(pending.key);
    };

    const removeShip = (key: string) => {
        if (isSpectator) return;
        if (preparado || !started) return;
        setPlaced(prev => prev.filter(p => p.key !== key));
    };

    const limpiarColocacion = () => {
        if (isSpectator) return;
        if (preparado || !started) return;
        setPlaced([]);
        setSelectedShipKey(SHIPS[0].key);
        setOrientation('H');
        setError(null);
    };

    const marcarListo = async () => {
        if (isSpectator) return;
        if (!jugadorId) {
            setError('No se encontró tu jugadorId.');
            return;
        }
        try {
            const { data } = await axios.post<EstadoSalaMsg>(`${API_BASE}/api/juego/ready/${jugadorId}`);
            setReadyCount(data.readyCount || 0);
            setStarted(Boolean(data.started));
            setDeadline(data.deadline ?? null);
            if (data.started && data.deadline) {
                setPlaced([]);
                setPreparado(false);
                setError(null);
            }
        } catch {
            setError('No se pudo marcar listo');
        }
    };

    const autoFillMissingShips = useCallback((): ShipPlaced[] => {
        let currentPlaced = placed.slice();
        const used = new Set<string>();
        currentPlaced.forEach(p => p.cells.forEach(c => used.add(c)));

        const missing = SHIPS.filter(s => !currentPlaced.some(p => p.key === s.key));
        const rnd = (n: number) => Math.floor(Math.random() * n);

        for (const def of missing) {
            let placedShip: ShipPlaced | null = null;
            for (let attempts = 0; attempts < 500 && !placedShip; attempts++) {
                const orient: Orientation = rnd(2) === 0 ? 'H' : 'V';
                const rowIdx = rnd(BOARD_SIZE);
                const colIdx = rnd(BOARD_SIZE);
                const cells: string[] = [];
                let ok = true;
                for (let i = 0; i < def.size; i++) {
                    const r = orient === 'H' ? rowIdx : rowIdx + i;
                    const c = orient === 'H' ? colIdx + i : colIdx;
                    const k = keyAt(r, c);
                    if (!inBounds(r, c) || used.has(k)) { ok = false; break; }
                    cells.push(k);
                }
                if (ok) {
                    placedShip = { ...def, cells, orientation: orient };
                    currentPlaced.push(placedShip);
                    cells.forEach(c => used.add(c));
                }
            }
        }
        return currentPlaced;
    }, [placed, inBounds, keyAt]);

    const prepararTableroWith = useCallback(async (placements: ShipPlaced[]) => {
        if (isSpectator) return;
        if (!jugadorId || !partidaId) return;
        const allPlaced = SHIPS.every(s => placements.some(p => p.key === s.key));
        if (!allPlaced) return;
        try {
            const posiciones: Record<string, boolean> = {};
            placements.forEach(p => p.cells.forEach(k => posiciones[k] = true));
            await axios.post(`${API_BASE}/api/partidas/${partidaId}/tablero/${jugadorId}`, posiciones);
            setPreparado(true);
        } catch { }
    }, [isSpectator, jugadorId, partidaId]);

    useEffect(() => {
        if (isSpectator || !jugadorId) return;
        const handleBeforeUnload = () => {
            navigator.sendBeacon(`${API_BASE}/api/sala/${params.id}/liberar`);
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isSpectator, jugadorId, params?.id]);

    const refreshEstado = useCallback(async (pid?: number | null) => {
        const p = pid ?? partidaId;
        if (!p) return;
        try {
            const paramsReq = jugadorId ? { jugadorId } : {};
            const { data } = await axios.get(`${API_BASE}/api/partidas/${p}/estado`, { params: paramsReq });

            setTurnoId(data.turnoActualJugadorId ?? null);

            if (data.jugadores) {
                setJugadoresMap(data.jugadores);
            }

            if (isSpectator) {
                if (data.tablerosPublicos) {
                    setTablerosPublicos(data.tablerosPublicos);
                }
                setStarted(true);
            } else {
                const mb: Record<string, boolean> = data.misBarcos || {};
                setMisBarcosMap(mb);
                setOponenteListo(!!data.oponenteListo);

                const mr: Record<string, boolean> = data.misImpactosRecibidos || {};
                setReceivedShots(mr);

                const hasBarcos = Object.keys(mb).length > 0;
                if (hasBarcos) {
                    setPreparado(true);
                    setStarted(true);
                }
                const hist: Array<any> = Array.isArray(data.historial) ? data.historial : [];
                const mine: Record<string, boolean> = {};
                for (const h of hist) {
                    if (h && h.atacanteId === jugadorId && typeof h.posicion === 'string') {
                        mine[h.posicion] = !!h.acierto;
                    }
                }
                setMyShots(mine);
            }
        } catch { }
    }, [partidaId, jugadorId, isSpectator]);

    useEffect(() => {
        const fetchActive = async () => {
            if (!params?.id) return;
            if (!isSpectator && !jugadorId) return;

            try {
                const { data } = await axios.get(`${API_BASE}/api/partidas/sala/${params.id}/activa`);
                const pid = (data && (data.id ?? data.partidaId)) || null;
                if (pid) {
                    setPartidaId(pid);
                    if (!isSpectator) {
                        try { if (typeof window !== 'undefined') localStorage.setItem(`bship:partidaId:${params.id}`, String(pid)); } catch { }
                    }
                    await refreshEstado(pid);
                }
            } catch { }
        };
        fetchActive();
    }, [params?.id, jugadorId, isSpectator, refreshEstado]);

    useEffect(() => {
        if (started && !partidaId) {
            const fetchActive = async () => {
                try {
                    const { data } = await axios.get(`${API_BASE}/api/partidas/sala/${params.id}/activa`);
                    const pid = (data && (data.id ?? data.partidaId)) || null;
                    if (pid) {
                        setPartidaId(pid);
                        if (!isSpectator) {
                            try { if (typeof window !== 'undefined') localStorage.setItem(`bship:partidaId:${params.id}`, String(pid)); } catch { }
                        }
                        await refreshEstado(pid);
                    }
                } catch { }
            };
            fetchActive();
        }
    }, [started, partidaId, params?.id, isSpectator, refreshEstado]);

    useEffect(() => {
        if (!params?.id) return;

        let stop = false;

        const fetchSala = async () => {
            if (started) return;
            try {
                const { data } = await axios.get<Sala[]>(`${API_BASE}/api/sala/todas`);
                const encontrada = data.find(s => String(s.id) === String(params.id));
                if (encontrada) {
                    setSala(encontrada);
                    const ocup = encontrada.ocupacion ?? 0;
                    setEsperando(ocup < 2);
                }
            } catch (e) { }
        };

        fetchSala();
        const intId = setInterval(() => {
            if (!stop) fetchSala();
        }, 2000);

        return () => {
            stop = true;
            clearInterval(intId);
        };
    }, [params?.id, started]);

    useEffect(() => {
        if (!params?.id) return;

        const client = new StompClient({
            webSocketFactory: () => new SockJS(`${API_BASE}/ws`),
            reconnectDelay: 3000,
            onConnect: () => {
                setWsConectado(true);
                client.subscribe(`/topic/sala/${params.id}/resultados`, (msg: IMessage) => {
                    try {
                        const body = JSON.parse(msg.body) as WSDisparoMsg;
                        setFeed(prev => [body, ...prev].slice(0, 20));
                        if (jugadorId && body.jugadorId === jugadorId) {
                            setResultado(body.acierto ? '¡Acierto!' : 'Agua');
                            setMyShots(prev => ({ ...prev, [body.posicion]: body.acierto }));
                        }
                        refreshEstado().catch(() => { });
                    } catch { }
                });
                client.subscribe(`/topic/sala/${params.id}/estado`, (msg: IMessage) => {
                    try {
                        const body = JSON.parse(msg.body) as EstadoSalaMsg;
                        setReadyCount(body.readyCount || 0);
                        setStarted(Boolean(body.started));
                        setDeadline(body.deadline ?? null);
                    } catch { }
                });
                client.subscribe(`/topic/sala/${params.id}/chat`, (msg: IMessage) => {
                    try {
                        const body = JSON.parse(msg.body);
                        setChatHistory(prev => [...prev, { ...body, receivedAt: Date.now() }]);
                    } catch { }
                });
            },
            onStompError: () => setWsConectado(false),
            onWebSocketClose: () => setWsConectado(false),
        });

        stompRef.current = client;
        client.activate();

        return () => {
            client.deactivate();
            stompRef.current = null;
        };
    }, [jugadorId, params?.id, refreshEstado]);

    useEffect(() => {
        const fetchEstado = async () => {
            if (!params?.id) return;
            try {
                const { data } = await axios.get(`${API_BASE}/api/juego/estado/${params.id}`);
                setReadyCount(data.readyCount || 0);
                setStarted(Boolean(data.started));
                setDeadline(data.deadline ?? null);
            } catch { }
        };
        fetchEstado();
    }, [params?.id, wsConectado]);

    const sendChat = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!chatMsg.trim()) return;

        let senderName = (jugadorId && jugadoresMap[jugadorId]) || (isSpectator ? 'Espectador' : `Jugador ${jugadorId}`);
        if (isSpectator) {
            const storedUser = localStorage.getItem('bship:user');
            if (storedUser) {
                try {
                    const u = JSON.parse(storedUser);
                    senderName = u.username;
                } catch { }
            }
        }

        try {
            await axios.post(`${API_BASE}/api/chat/${params.id}`, {
                sender: senderName,
                content: chatMsg,
                type: 'CHAT'
            });
            setChatMsg('');
        } catch { }
    };

    useEffect(() => {
        if (!deadline) return;
        const t = setInterval(() => setNow(Date.now()), 250);
        return () => clearInterval(t);
    }, [deadline]);

    useEffect(() => {
        if (isSpectator) return;
        if (!started || !deadline) return;
        if (preparado) return;
        if (Date.now() < deadline) return;
        const newPlaced = autoFillMissingShips();
        if (newPlaced) {
            setPlaced(newPlaced);
            prepararTableroWith(newPlaced);
        }
    }, [started, deadline, preparado, now, isSpectator, autoFillMissingShips, prepararTableroWith]);

    useEffect(() => {
        if (isSpectator) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'r' || e.key === 'R') {
                setOrientation(o => (o === 'H' ? 'V' : 'H'));
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isSpectator]);

    const salirSala = async () => {
        if (isSpectator) {
            router.push('/');
            return;
        }
        try {
            setLoading(true);
            await axios.put(`${API_BASE}/api/sala/${params.id}/liberar`);
            localStorage.removeItem(`bship:jugadorId:${params.id}`);
            router.push('/');
        } catch (err: any) {
            setError(err?.response?.data?.message || 'No se pudo salir de la sala');
        } finally {
            setLoading(false);
        }
    };

    const prepararTablero = async () => {
        if (isSpectator) return;
        if (!jugadorId) {
            setError('No se encontró tu jugadorId. Vuelve a entrar a la sala.');
            return;
        }
        if (!partidaId) {
            try {
                const { data } = await axios.get(`${API_BASE}/api/partidas/sala/${params.id}/activa`);
                const pid = (data && (data.id ?? data.partidaId)) || null;
                if (pid) setPartidaId(pid);
                else {
                    setError('No se encontró la partida activa. Intenta recargar.');
                    return;
                }
            } catch {
                setError('Error al buscar partida activa.');
                return;
            }
        }

        const pid = partidaId;
        const allPlaced = SHIPS.every(s => placed.some(p => p.key === s.key));
        if (!allPlaced) {
            setError('Debes colocar todos los barcos antes de guardar.');
            return;
        }
        try {
            setError(null);
            setLoading(true);
            const posiciones: Record<string, boolean> = {};
            placed.forEach(p => p.cells.forEach(k => posiciones[k] = true));
            await axios.post(`${API_BASE}/api/partidas/${pid}/tablero/${jugadorId}`, posiciones);
            setPreparado(true);
        } catch (err: any) {
            setError('No se pudo preparar el tablero');
        } finally {
            setLoading(false);
        }
    };


    const realizarDisparo = async () => {
        if (isSpectator) return;
        if (!jugadorId) {
            setError('No se encontró tu jugadorId. Vuelve a entrar a la sala.');
            return;
        }
        if (!partidaId) {
            setError('No se encontró la partida activa.');
            return;
        }
        if (!preparado) {
            setError('Primero guarda tu tablero');
            return;
        }
        if (!oponenteListo) {
            setError('Esperando a que el oponente coloque sus barcos');
            return;
        }
        if (!esMiTurno) {
            setError('No es tu turno');
            return;
        }
        setResultado(null);

        const client = stompRef.current;
        if (client && wsConectado) {
            try {
                client.publish({ destination: '/app/juego/disparo', body: JSON.stringify({ jugadorId, posicion: posicionDisparo }) });
                setTimeout(() => { refreshEstado().catch(() => { }); }, 100);
                return;
            } catch { }
        }

        try {
            setLoading(true);
            const { data } = await axios.post<boolean>(`${API_BASE}/api/partidas/${partidaId}/disparar`, null, {
                params: { atacanteId: jugadorId, posicion: posicionDisparo }
            });
            setResultado(data ? '¡Acierto!' : 'Agua');
            setMyShots(prev => ({ ...prev, [posicionDisparo]: !!data }));
            await refreshEstado();
        } catch (err: any) {
            setError(err?.response?.data?.message || 'No se pudo realizar el disparo');
        } finally {
            setLoading(false);
        }
    };

    const shootAt = async (key: string) => {
        if (isSpectator) return;
        if (!jugadorId) {
            setError('No se encontró tu jugadorId.');
            return;
        }
        if (!preparado) {
            setError('Primero guarda tu tablero');
            return;
        }
        if (!oponenteListo) {
            setError('Esperando a que el oponente coloque sus barcos');
            return;
        }
        if (!esMiTurno) {
            setError('No es tu turno');
            return;
        }
        setError(null);
        setPosicionDisparo(key);
    };



    const remainingSec = deadline ? Math.max(0, Math.floor((deadline - now) / 1000)) : null;

    return (
        <div className="min-h-screen bg-slate-950 text-slate-50 p-4 md:p-8 font-sans">
            <div className="max-w-7xl mx-auto space-y-8">

                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <div>
                        <h1 className="text-4xl font-extrabold bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
                            {sala ? sala.nombre : 'Batalla Naval'}
                        </h1>
                        <div className="flex items-center gap-3 mt-2 text-slate-400">
                            <span className="flex items-center gap-1 bg-slate-800/50 px-3 py-1 rounded-full text-xs font-medium">
                                <span className={`w-2 h-2 rounded-full ${wsConectado ? 'bg-emerald-400' : 'bg-red-400'}`}></span>
                                {wsConectado ? 'Conectado' : 'Desconectado'}
                            </span>
                            {isSpectator && (
                                <span className="bg-purple-500/20 text-purple-300 px-3 py-1 rounded-full text-xs font-medium">
                                    Modo Espectador
                                </span>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={salirSala}
                        className="px-4 py-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all text-sm font-medium"
                    >
                        Salir de la Sala
                    </button>
                </div>

                {!started && !isSpectator && (
                    <div className="glass-card rounded-xl p-8 text-center space-y-6 max-w-2xl mx-auto">
                        <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-10 h-10 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-bold text-white">Sala de Espera</h2>
                        <p className="text-slate-400">
                            Esperando a que ambos jugadores estén listos para comenzar la batalla.
                        </p>
                        <div className="flex flex-col items-center gap-4">
                            <button
                                onClick={marcarListo}
                                disabled={started}
                                className="px-6 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-500/20 transition-all transform hover:scale-105 disabled:opacity-50 disabled:transform-none"
                            >
                                {started ? 'Preparación en curso' : '¡Estoy Listo!'}
                            </button>
                            <div className="text-slate-300">
                                Jugadores listos: <span className="font-bold text-white">{readyCount}/2</span>
                            </div>
                        </div>
                        {started && (
                            <div className="text-xl font-bold text-purple-400 animate-pulse">
                                Tiempo restante: {remainingSec}s
                            </div>
                        )}
                    </div>
                )}

                {error && (
                    <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
                        {error}
                    </div>
                )}

                {(!esperando && started) || isSpectator ? (
                    <div className="grid lg:grid-cols-2 gap-8">
                        <div className="glass-card rounded-xl p-6 space-y-4">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-bold text-white">
                                    {isSpectator ? (jugadoresMap[Object.keys(tablerosPublicos)[0] as any] || 'Jugador 1') : 'Mi Flota'}
                                </h2>
                                {!isSpectator && !preparado && remainingSec != null && (
                                    <span className="text-sm font-mono text-purple-400">{remainingSec}s</span>
                                )}
                            </div>

                            {!isSpectator && !preparado && (
                                <div className="bg-slate-800/50 rounded-lg p-4 mb-4 space-y-4">
                                    <div className="flex flex-wrap gap-4 items-center">
                                        <select
                                            value={selectedShipKey}
                                            onChange={e => setSelectedShipKey(e.target.value)}
                                            className="bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                        >
                                            {SHIPS.map(s => (
                                                <option key={s.key} value={s.key} disabled={placed.some(p => p.key === s.key)}>
                                                    {s.name} ({s.size}) {placed.some(p => p.key === s.key) ? '✓' : ''}
                                                </option>
                                            ))}
                                        </select>

                                        <button
                                            type="button"
                                            onClick={() => setOrientation(o => (o === 'H' ? 'V' : 'H'))}
                                            className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm text-white transition-colors"
                                        >
                                            Rotar: {orientation === 'H' ? 'Horizontal' : 'Vertical'} (R)
                                        </button>

                                        <button
                                            type="button"
                                            disabled={placed.length === 0}
                                            onClick={limpiarColocacion}
                                            className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm text-white transition-colors disabled:opacity-50"
                                        >
                                            Limpiar
                                        </button>
                                    </div>

                                    <button
                                        disabled={loading || placed.length < SHIPS.length}
                                        onClick={prepararTablero}
                                        className="w-full py-2 rounded bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Confirmar Posiciones
                                    </button>
                                </div>
                            )}

                            <div className="overflow-auto flex justify-center">
                                <div className="inline-grid gap-[1px] bg-slate-700/50 p-1 rounded border border-slate-700" style={{ gridTemplateColumns: `repeat(${colLabels.length + 1}, minmax(32px, 1fr))` }}>
                                    <div />
                                    {colLabels.map(c => (
                                        <div key={`h${c}`} className="text-center text-xs font-medium text-slate-400 py-2">{c}</div>
                                    ))}
                                    {filaLabels.map((f, rIdx) => (
                                        <Fragment key={`row-${f}`}>
                                            <div key={`r-${f}`} className="text-center text-xs font-medium text-slate-400 py-2 px-1">{f}</div>
                                            {colLabels.map((c, cIdx) => {
                                                const key = `${f}${c}`;
                                                let isShip = false;
                                                let isHit = false;
                                                let isMiss = false;

                                                if (isSpectator) {
                                                    const p1Id = Object.keys(tablerosPublicos)[0] as unknown as number;
                                                    const board = tablerosPublicos[p1Id];
                                                    if (board) {
                                                        const val = board[key];
                                                        if (val !== undefined) {
                                                            if (val === true) { isHit = true; isShip = true; }
                                                            else { isMiss = true; }
                                                        }
                                                    }
                                                } else {
                                                    isShip = !!misBarcosMap[key] || placedCells.has(key);
                                                    if (receivedShots[key]) {
                                                        if (isShip) isHit = true;
                                                        else isMiss = true;
                                                    }
                                                }

                                                return (
                                                    <button
                                                        key={key}
                                                        type="button"
                                                        onClick={() => !isSpectator && !preparado && placeSelectedShip(key)}
                                                        onContextMenu={(e) => { e.preventDefault(); !isSpectator && !preparado && setOrientation(o => (o === 'H' ? 'V' : 'H')); }}
                                                        className={`w-8 h-8 flex items-center justify-center text-sm transition-all duration-200 relative
                                                            ${isShip ? 'bg-blue-500/80 shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'bg-slate-800/50 hover:bg-slate-700'}
                                                            ${!isSpectator && !preparado ? 'cursor-pointer' : 'cursor-default'}
                                                        `}
                                                        title={key}
                                                    >
                                                        {isHit && <span className="absolute inset-0 flex items-center justify-center text-red-500 font-bold text-lg animate-bounce">✕</span>}
                                                        {isMiss && <div className="w-2 h-2 rounded-full bg-slate-400" />}
                                                    </button>
                                                );
                                            })}
                                        </Fragment>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {(preparado || isSpectator) && (
                            <div className="glass-card rounded-xl p-6 space-y-4">
                                <div className="flex justify-between items-center mb-4">
                                    <h2 className="text-xl font-bold text-white">
                                        {isSpectator ? (jugadoresMap[Object.keys(tablerosPublicos)[1] as any] || 'Jugador 2') : 'Radar Enemigo'}
                                    </h2>
                                    {!isSpectator && esMiTurno && oponenteListo && (
                                        <span className="px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-sm font-bold animate-pulse">
                                            ¡Tu Turno!
                                        </span>
                                    )}
                                    {!isSpectator && (!esMiTurno || !oponenteListo) && (
                                        <span className="px-3 py-1 rounded-full bg-slate-700 text-slate-400 text-sm">
                                            {!oponenteListo ? 'Esperando oponente...' : 'Turno del oponente'}
                                        </span>
                                    )}
                                </div>

                                {!isSpectator && (
                                    <div className="bg-slate-800/50 rounded-lg p-4 mb-4 flex gap-4 items-center">
                                        <input
                                            value={posicionDisparo}
                                            onChange={e => setPosicionDisparo(e.target.value.toUpperCase())}
                                            className="bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white w-24 text-center font-mono uppercase focus:ring-2 focus:ring-red-500 outline-none"
                                            maxLength={3}
                                        />
                                        <button
                                            disabled={loading || !esMiTurno || !oponenteListo}
                                            onClick={realizarDisparo}
                                            className="flex-1 py-2 rounded bg-red-600 hover:bg-red-500 text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-red-600/20"
                                        >
                                            FUEGO
                                        </button>
                                    </div>
                                )}

                                <div className="overflow-auto flex justify-center">
                                    <div className="inline-grid gap-[1px] bg-slate-700/50 p-1 rounded border border-slate-700" style={{ gridTemplateColumns: `repeat(${colLabels.length + 1}, minmax(32px, 1fr))` }}>
                                        <div />
                                        {colLabels.map(c => (
                                            <div key={`eh${c}`} className="text-center text-xs font-medium text-slate-400 py-2">{c}</div>
                                        ))}
                                        {filaLabels.map((f) => (
                                            <Fragment key={`erow-${f}`}>
                                                <div key={`er-${f}`} className="text-center text-xs font-medium text-slate-400 py-2 px-1">{f}</div>
                                                {colLabels.map((c) => {
                                                    const key = `${f}${c}`;
                                                    let shot: boolean | undefined;
                                                    let isSelected = false;

                                                    if (isSpectator) {
                                                        const p2Id = Object.keys(tablerosPublicos)[1] as unknown as number;
                                                        const board = tablerosPublicos[p2Id];
                                                        if (board) {
                                                            const val = board[key];
                                                            if (val !== undefined) shot = val;
                                                        }
                                                    } else {
                                                        shot = myShots[key];
                                                        isSelected = posicionDisparo === key;
                                                    }

                                                    return (
                                                        <button
                                                            key={`e-${key}`}
                                                            type="button"
                                                            onClick={() => !isSpectator && shootAt(key)}
                                                            disabled={isSpectator || !esMiTurno || !oponenteListo}
                                                            className={`w-8 h-8 flex items-center justify-center text-sm transition-all duration-200 relative
                                                                ${isSelected ? 'ring-2 ring-red-500 z-10' : ''}
                                                                ${shot === undefined ? 'bg-slate-800/50 hover:bg-slate-700' : ''}
                                                                ${shot === true ? 'bg-red-500/20' : ''}
                                                                ${shot === false ? 'bg-slate-800/80' : ''}
                                                                ${!isSpectator && esMiTurno && oponenteListo ? 'cursor-crosshair' : 'cursor-default'}
                                                            `}
                                                            title={key}
                                                        >
                                                            {shot === true && (
                                                                <span className="absolute inset-0 flex items-center justify-center text-red-500 font-bold text-lg animate-bounce">✕</span>
                                                            )}
                                                            {shot === false && (
                                                                <div className="w-2 h-2 rounded-full bg-slate-500" />
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </Fragment>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    !isSpectator && !started && !esperando && (
                        <div className="text-center text-slate-400 mt-8">
                            Esperando a que ambos jugadores estén listos...
                        </div>
                    )
                )}

                <div className="grid lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2">
                        {feed.length > 0 && (
                            <div className="glass-card rounded-xl p-4 mt-8">
                                <h3 className="text-sm font-bold text-slate-300 mb-2 uppercase tracking-wider">Registro de Batalla</h3>
                                <div className="h-32 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                                    {feed.map((f, idx) => (
                                        <div key={idx} className="text-sm flex items-center gap-2">
                                            <span className="text-slate-500 font-mono text-xs">
                                                {f.ts ? new Date(f.ts).toLocaleTimeString() : new Date().toLocaleTimeString()}
                                            </span>
                                            <span className={f.acierto ? 'text-red-400' : 'text-blue-400'}>
                                                {jugadoresMap[f.jugadorId] || `Jugador ${f.jugadorId}`} disparó a <span className="font-bold">{f.posicion}</span>:
                                                {f.acierto ? ' ¡IMPACTO CONFIRMADO!' : ' Agua'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="glass-card rounded-xl p-4 flex flex-col h-80 mt-8 lg:mt-0">
                        <h3 className="text-sm font-bold text-slate-300 mb-2 uppercase tracking-wider flex justify-between items-center">
                            <span>Chat de Sala</span>
                            <span className="text-xs text-slate-500 font-normal normal-case">
                                {wsConectado ? 'En línea' : 'Desconectado'}
                            </span>
                        </h3>
                        <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar mb-3 bg-slate-900/30 rounded-lg p-3">
                            {chatHistory.length === 0 && (
                                <div className="text-center text-slate-500 text-sm italic mt-4">
                                    No hay mensajes aún. ¡Saluda!
                                </div>
                            )}
                            {chatHistory.map((msg, idx) => {
                                const isMe = msg.sender === ((jugadorId && jugadoresMap[jugadorId]) || (isSpectator ? 'Espectador' : `Jugador ${jugadorId}`));
                                return (
                                    <div key={idx} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                        <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${isMe ? 'bg-blue-600/20 text-blue-100 rounded-tr-none' : 'bg-slate-700/50 text-slate-200 rounded-tl-none'}`}>
                                            {!isMe && <span className="block text-xs font-bold text-blue-400 mb-0.5">{msg.sender}</span>}
                                            {msg.content}
                                        </div>
                                        <span className="text-[10px] text-slate-500 mt-1 px-1">
                                            {new Date(msg.receivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                );
                            })}
                            <div ref={chatEndRef} />
                        </div>
                        <form onSubmit={sendChat} className="flex gap-2">
                            <input
                                className="flex-1 bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-slate-500"
                                placeholder="Escribe un mensaje..."
                                value={chatMsg}
                                onChange={e => setChatMsg(e.target.value)}
                            />
                            <button
                                type="submit"
                                disabled={!chatMsg.trim()}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Enviar
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
