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
    jugador1?: { id: number; nombre: string; } | null;
    jugador2?: { id: number; nombre: string; } | null;
    espectadores?: number;
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

    // New state for rematch and game over
    const [rematchRequestJ1, setRematchRequestJ1] = useState(false);
    const [rematchRequestJ2, setRematchRequestJ2] = useState(false);
    const [ganadorId, setGanadorId] = useState<number | null>(null);
    const [estadoPartida, setEstadoPartida] = useState<string>('');
    const [rematchDeadline, setRematchDeadline] = useState<number | null>(null);

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
    const [scoreDetails, setScoreDetails] = useState<any>(null);
    const [hoveredCell, setHoveredCell] = useState<string | null>(null);
    const [oponenteBarcos, setOponenteBarcos] = useState<Record<string, boolean>>({});

    // Detect which hit cells belong to fully sunk ships
    const sunkCells = useMemo(() => {
        const sunk = new Set<string>();
        const hitCells = Object.entries(myShots).filter(([, v]) => v).map(([k]) => k);
        if (hitCells.length === 0) return sunk;

        // If we have the opponent's ship map (game finished), compute exactly
        if (Object.keys(oponenteBarcos).length > 0) {
            // Group ship positions into ships by flood-fill adjacency
            const shipCells = Object.entries(oponenteBarcos).filter(([, v]) => v).map(([k]) => k);
            const visited = new Set<string>();
            const groups: string[][] = [];

            const getAdjacent = (key: string): string[] => {
                const row = key.charCodeAt(0) - 'A'.charCodeAt(0);
                const col = parseInt(key.slice(1), 10) - 1;
                const adj: string[] = [];
                if (row > 0) adj.push(`${String.fromCharCode('A'.charCodeAt(0) + row - 1)}${col + 1}`);
                if (row < BOARD_SIZE - 1) adj.push(`${String.fromCharCode('A'.charCodeAt(0) + row + 1)}${col + 1}`);
                if (col > 0) adj.push(`${String.fromCharCode('A'.charCodeAt(0) + row)}${col}`);
                if (col < BOARD_SIZE - 1) adj.push(`${String.fromCharCode('A'.charCodeAt(0) + row)}${col + 2}`);
                return adj;
            };

            for (const cell of shipCells) {
                if (visited.has(cell)) continue;
                const group: string[] = [];
                const stack = [cell];
                while (stack.length > 0) {
                    const c = stack.pop()!;
                    if (visited.has(c)) continue;
                    if (!shipCells.includes(c)) continue;
                    visited.add(c);
                    group.push(c);
                    for (const adj of getAdjacent(c)) {
                        if (!visited.has(adj) && shipCells.includes(adj)) {
                            stack.push(adj);
                        }
                    }
                }
                if (group.length > 0) groups.push(group);
            }

            // A ship group is sunk if ALL its cells have been hit
            for (const group of groups) {
                const allHit = group.every(c => myShots[c] === true);
                if (allHit) {
                    group.forEach(c => sunk.add(c));
                }
            }
        } else {
            // During play: use hit tracking to detect sunk ships
            // We know standard ship sizes: [4, 3, 3, 2, 2, 2, 1, 1, 1, 1]
            const hitSet = new Set(hitCells);
            const visited = new Set<string>();

            const getAdjacent = (key: string): string[] => {
                const row = key.charCodeAt(0) - 'A'.charCodeAt(0);
                const col = parseInt(key.slice(1), 10) - 1;
                const adj: string[] = [];
                if (row > 0) adj.push(`${String.fromCharCode('A'.charCodeAt(0) + row - 1)}${col + 1}`);
                if (row < BOARD_SIZE - 1) adj.push(`${String.fromCharCode('A'.charCodeAt(0) + row + 1)}${col + 1}`);
                if (col > 0) adj.push(`${String.fromCharCode('A'.charCodeAt(0) + row)}${col}`);
                if (col < BOARD_SIZE - 1) adj.push(`${String.fromCharCode('A'.charCodeAt(0) + row)}${col + 2}`);
                return adj;
            };

            // Group contiguous hit cells
            const groups: string[][] = [];
            for (const cell of hitCells) {
                if (visited.has(cell)) continue;
                const group: string[] = [];
                const stack = [cell];
                while (stack.length > 0) {
                    const c = stack.pop()!;
                    if (visited.has(c)) continue;
                    if (!hitSet.has(c)) continue;
                    visited.add(c);
                    group.push(c);
                    for (const adj of getAdjacent(c)) {
                        if (!visited.has(adj) && hitSet.has(adj)) {
                            stack.push(adj);
                        }
                    }
                }
                if (group.length > 0) groups.push(group);
            }

            // Check if the group is a valid ship (aligned in a line, matching a ship size)
            const shipSizes = [4, 3, 3, 2, 2, 2, 1, 1, 1, 1];
            const usedSizes: number[] = [];

            // Check each group is aligned (same row or same col) and matches a ship size
            for (const group of groups) {
                if (group.length === 0) continue;
                // Check alignment
                const rows = group.map(c => c.charCodeAt(0));
                const cols = group.map(c => parseInt(c.slice(1), 10));
                const sameRow = rows.every(r => r === rows[0]);
                const sameCol = cols.every(c => c === cols[0]);
                if (!sameRow && !sameCol) continue; // Not a valid ship shape

                // Check if ALL surrounding cells (beyond the line) have been probed (miss or no ship)
                // For size-1 ships, they're always "sunk" if hit
                if (group.length === 1) {
                    // Check if all 4 adjacent cells have been shot (miss) or are out of bounds
                    const adj = getAdjacent(group[0]);
                    const bordered = adj.every(a => {
                        // Out of bounds or was shot as miss, or not a hit
                        return myShots[a] !== undefined && myShots[a] === false || !hitSet.has(a);
                    });
                    // Actually for size 1, just check if it's surrounded by non-hits
                    const noAdjacentHits = adj.every(a => !hitSet.has(a));
                    if (noAdjacentHits && shipSizes.filter(s => s === 1).length > usedSizes.filter(s => s === 1).length) {
                        usedSizes.push(1);
                        group.forEach(c => sunk.add(c));
                    }
                } else {
                    // For longer ships, check if both ends are capped by miss/OOB
                    const sorted = [...group].sort((a, b) => {
                        if (sameRow) return parseInt(a.slice(1), 10) - parseInt(b.slice(1), 10);
                        return a.charCodeAt(0) - b.charCodeAt(0);
                    });
                    const first = sorted[0];
                    const last = sorted[sorted.length - 1];
                    const fRow = first.charCodeAt(0) - 'A'.charCodeAt(0);
                    const fCol = parseInt(first.slice(1), 10) - 1;
                    const lRow = last.charCodeAt(0) - 'A'.charCodeAt(0);
                    const lCol = parseInt(last.slice(1), 10) - 1;

                    let beforeKey: string | null = null;
                    let afterKey: string | null = null;

                    if (sameRow) {
                        if (fCol > 0) beforeKey = `${String.fromCharCode('A'.charCodeAt(0) + fRow)}${fCol}`;
                        if (lCol < BOARD_SIZE - 1) afterKey = `${String.fromCharCode('A'.charCodeAt(0) + lRow)}${lCol + 2}`;
                    } else {
                        if (fRow > 0) beforeKey = `${String.fromCharCode('A'.charCodeAt(0) + fRow - 1)}${fCol + 1}`;
                        if (lRow < BOARD_SIZE - 1) afterKey = `${String.fromCharCode('A'.charCodeAt(0) + lRow + 1)}${lCol + 1}`;
                    }

                    // Both ends must be capped (miss, OOB, or edge of board)
                    const beforeCapped = beforeKey === null || (myShots[beforeKey] !== undefined && !myShots[beforeKey]);
                    const afterCapped = afterKey === null || (myShots[afterKey] !== undefined && !myShots[afterKey]);

                    if (beforeCapped && afterCapped && shipSizes.includes(group.length)) {
                        group.forEach(c => sunk.add(c));
                    }
                }
            }
        }
        return sunk;
    }, [myShots, oponenteBarcos]);

    useEffect(() => {
        if (estadoPartida === 'FINALIZADA' && partidaId && jugadorId) {
            axios.get(`${API_BASE}/api/ranking/partida/${partidaId}/jugador/${jugadorId}`)
                .then(res => setScoreDetails(res.data))
                .catch(err => console.error("Error fetching score:", err));
        } else {
            setScoreDetails(null);
        }
    }, [estadoPartida, partidaId, jugadorId]);

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
        if (!params?.id) return;

        if (isSpectator) {
            // Registrar entrada de espectador
            axios.put(`${API_BASE}/api/sala/${params.id}/entrarEspectador`).catch(() => { });

            const handleUnload = () => {
                navigator.sendBeacon(`${API_BASE}/api/sala/${params.id}/salirEspectador`);
            };
            window.addEventListener('beforeunload', handleUnload);
            return () => {
                window.removeEventListener('beforeunload', handleUnload);
                axios.put(`${API_BASE}/api/sala/${params.id}/salirEspectador`).catch(() => { });
            };
        } else if (jugadorId) {
            const handleBeforeUnload = () => {
                // Solo liberar si NO ha empezado la partida o si explícitamente se quiere salir (manejado en salirSala)
                // Si recarga la página, NO liberar para permitir reconexión
                // navigator.sendBeacon(`${API_BASE}/api/sala/${params.id}/liberar`); 
            };
            window.addEventListener('beforeunload', handleBeforeUnload);
            return () => window.removeEventListener('beforeunload', handleBeforeUnload);
        }
    }, [isSpectator, jugadorId, params?.id]);

    const refreshEstado = useCallback(async (pid?: number | null) => {
        const p = pid ?? partidaId;
        if (!p) return;
        try {
            const paramsReq = jugadorId ? { jugadorId } : {};
            const { data } = await axios.get(`${API_BASE}/api/partidas/${p}/estado`, { params: paramsReq });

            setTurnoId(data.turnoActualJugadorId ?? null);
            setGanadorId(data.ganadorId ?? null);
            setEstadoPartida(data.estado || '');
            setRematchRequestJ1(!!data.rematchRequestJ1);
            setRematchRequestJ2(!!data.rematchRequestJ2);
            setRematchDeadline(data.rematchDeadline ?? null);

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

                // Capture opponent's ship positions (only returned when game is finished)
                if (data.oponenteBarcos) {
                    setOponenteBarcos(data.oponenteBarcos);
                }
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
                    setStarted(true);
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
                        setStarted(true);
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
            // Always fetch sala info to update seats
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
    }, [params?.id]);

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
                    // Ignore legacy JuegoService estado
                });
                client.subscribe(`/topic/sala/${params.id}/chat`, (msg: IMessage) => {
                    try {
                        const body = JSON.parse(msg.body);
                        setChatHistory(prev => [...prev, { ...body, receivedAt: Date.now() }]);
                    } catch { }
                });
                // NEW: Subscribe to generic events (rematch, game start, seat changes)
                client.subscribe(`/topic/sala/${params.id}/evento`, () => {
                    // Update room state (seats)
                    axios.get<Sala[]>(`${API_BASE}/api/sala/todas`).then(({ data }) => {
                        const encontrada = data.find(s => String(s.id) === String(params.id));
                        if (encontrada) setSala(encontrada);
                    }).catch(() => { });

                    // Always try to find the active game for this sala
                    axios.get(`${API_BASE}/api/partidas/sala/${params.id}/activa`).then(({ data: activeData }) => {
                        const pid = (activeData && (activeData.id ?? activeData.partidaId)) || null;
                        if (pid) {
                            setStarted(true);
                            setPartidaId((prevPid: number | null) => {
                                if (prevPid !== null && prevPid !== pid) {
                                    // New game started (rematch!) — reset all game state
                                    setEstadoPartida('');
                                    setGanadorId(null);
                                    setRematchRequestJ1(false);
                                    setRematchRequestJ2(false);
                                    setRematchDeadline(null);
                                    setPreparado(false);
                                    setStarted(true);
                                    setPlaced([]);
                                    setMyShots({});
                                    setReceivedShots({});
                                    setFeed([]);
                                    setScoreDetails(null);
                                }
                                return pid;
                            });
                            refreshEstado(pid).catch(() => { });
                        }
                    }).catch(() => { });

                    // Ignore legacy update
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
        // Legacy fetch removed
    }, [params?.id, wsConectado]);

    const [spectatorName, setSpectatorName] = useState<string>('');

    useEffect(() => {
        if (isSpectator) {
            let name = localStorage.getItem('bship:spectatorName');
            if (!name) {
                name = `Espectador ${Math.floor(Math.random() * 10000)}`;
                localStorage.setItem('bship:spectatorName', name);
            }
            setSpectatorName(name);
        }
    }, [isSpectator]);

    const sendChat = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!chatMsg.trim()) return;

        let senderName = (jugadorId && jugadoresMap[jugadorId]) || (isSpectator ? spectatorName : `Jugador ${jugadorId}`);

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
            try { await axios.put(`${API_BASE}/api/sala/${params.id}/salirEspectador`); } catch { }
            router.push('/');
            return;
        }
        try {
            setLoading(true);
            // If player is in a seat, liberate it first
            if (miPuesto !== 0) {
                await axios.put(`${API_BASE}/api/sala/${params.id}/puesto/${miPuesto}/liberar`);
            }
            // Also liberate via jugadorId for legacy cleanup
            if (jugadorId) {
                await axios.put(`${API_BASE}/api/sala/${params.id}/liberar`, null, {
                    params: { jugadorId }
                });
            }
            localStorage.removeItem(`bship:jugadorId:${params.id}`);
            localStorage.removeItem(`bship:partidaId:${params.id}`);
            localStorage.removeItem('bship:currentRoomId');
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

    const ocuparPuesto = async (puesto: number) => {
        if (!jugadorId) return;
        try {
            await axios.put(`${API_BASE}/api/sala/${params.id}/puesto/${puesto}/ocupar`, null, {
                params: { jugadorId }
            });
            // The event subscription will refresh the UI
        } catch (e) {
            setError('No se pudo ocupar el puesto');
        }
    };

    const liberarPuesto = async (puesto: number) => {
        try {
            await axios.put(`${API_BASE}/api/sala/${params.id}/puesto/${puesto}/liberar`);
            // The event subscription will refresh the UI
        } catch (e) {
            setError('No se pudo liberar el puesto');
        }
    };

    const solicitarRevancha = async () => {
        if (!partidaId || !jugadorId) return;
        try {
            await axios.post(`${API_BASE}/api/partidas/${partidaId}/revancha`, null, {
                params: { jugadorId }
            });
        } catch (e) {
            setError('Error al solicitar revancha');
        }
    };

    const rechazarRevancha = async () => {
        if (!partidaId || !jugadorId) return;
        try {
            await axios.post(`${API_BASE}/api/partidas/${partidaId}/revancha/rechazar`, null, {
                params: { jugadorId }
            });
            // Reset local game state
            setEstadoPartida('');
            setGanadorId(null);
            setRematchRequestJ1(false);
            setRematchRequestJ2(false);
            setRematchDeadline(null);
            setPreparado(false);
            setStarted(false);
            setPlaced([]);
            setMyShots({});
            setReceivedShots({});
            setFeed([]);
        } catch (e) {
            setError('Error al rechazar revancha');
        }
    };

    const remainingSec = deadline ? Math.max(0, Math.floor((deadline - now) / 1000)) : null;
    const rematchSec = rematchDeadline ? Math.max(0, Math.floor((rematchDeadline - now) / 1000)) : null;

    // Helper to determine if I am in a seat
    const miPuesto = useMemo(() => {
        if (!sala || !jugadorId) return 0;
        if (sala.jugador1?.id === jugadorId) return 1;
        if (sala.jugador2?.id === jugadorId) return 2;
        return 0;
    }, [sala, jugadorId]);

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

                {/* Seat Selection UI (if not started and not playing) */}
                {!started && !isSpectator && (
                    <div className="mb-8 grid grid-cols-2 gap-4 max-w-2xl mx-auto">
                        {[1, 2].map(puesto => {
                            const ocupante = puesto === 1 ? sala?.jugador1 : sala?.jugador2;
                            const esMio = miPuesto === puesto;
                            return (
                                <div key={puesto} className={`p-6 rounded-xl border-2 ${esMio ? 'border-blue-500 bg-blue-500/10' : 'border-slate-700 bg-slate-800/50'} flex flex-col items-center gap-4`}>
                                    <div className="text-xl font-bold">Puesto {puesto}</div>
                                    {ocupante ? (
                                        <div className="flex flex-col items-center">
                                            <div className="w-12 h-12 rounded-full bg-slate-600 flex items-center justify-center mb-2">
                                                <span className="text-xl">👤</span>
                                            </div>
                                            <span className="font-medium">{ocupante.nombre}</span>
                                            {esMio && (
                                                <button onClick={() => liberarPuesto(puesto)} className="mt-2 text-xs text-red-400 hover:text-red-300">
                                                    Levantarse
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => ocuparPuesto(puesto)}
                                            disabled={miPuesto !== 0}
                                            className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Sentarse
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

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
                                disabled={started || miPuesto === 0}
                                className="px-6 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-500/20 transition-all transform hover:scale-105 disabled:opacity-50 disabled:transform-none"
                            >
                                {started ? 'Preparación en curso' : miPuesto === 0 ? 'Elige un puesto primero' : '¡Estoy Listo!'}
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
                                                    if (receivedShots[key] !== undefined) {
                                                        if (isShip) isHit = true;
                                                        else isMiss = true;
                                                    }
                                                }

                                                const hasLeft = cIdx > 0 && isShip && (isSpectator ? tablerosPublicos[Object.keys(tablerosPublicos)[0] as any]?.[`${f}${colLabels[cIdx - 1]}`] : misBarcosMap[`${f}${colLabels[cIdx - 1]}`] || placedCells.has(`${f}${colLabels[cIdx - 1]}`));
                                                const hasRight = cIdx < colLabels.length - 1 && isShip && (isSpectator ? tablerosPublicos[Object.keys(tablerosPublicos)[0] as any]?.[`${f}${colLabels[cIdx + 1]}`] : misBarcosMap[`${f}${colLabels[cIdx + 1]}`] || placedCells.has(`${f}${colLabels[cIdx + 1]}`));
                                                const hasTop = rIdx > 0 && isShip && (isSpectator ? tablerosPublicos[Object.keys(tablerosPublicos)[0] as any]?.[`${filaLabels[rIdx - 1]}${c}`] : misBarcosMap[`${filaLabels[rIdx - 1]}${c}`] || placedCells.has(`${filaLabels[rIdx - 1]}${c}`));
                                                const hasBottom = rIdx < filaLabels.length - 1 && isShip && (isSpectator ? tablerosPublicos[Object.keys(tablerosPublicos)[0] as any]?.[`${filaLabels[rIdx + 1]}${c}`] : misBarcosMap[`${filaLabels[rIdx + 1]}${c}`] || placedCells.has(`${filaLabels[rIdx + 1]}${c}`));

                                                let shipRounded = 'rounded-sm';
                                                if (isShip) {
                                                    if (!hasLeft && hasRight && !hasTop && !hasBottom) shipRounded = 'rounded-l-full rounded-r-md';
                                                    else if (hasLeft && !hasRight && !hasTop && !hasBottom) shipRounded = 'rounded-r-full rounded-l-md';
                                                    else if (!hasTop && hasBottom && !hasLeft && !hasRight) shipRounded = 'rounded-t-full rounded-b-md';
                                                    else if (hasTop && !hasBottom && !hasLeft && !hasRight) shipRounded = 'rounded-b-full rounded-t-md';
                                                    else if (hasLeft && hasRight && !hasTop && !hasBottom) shipRounded = 'rounded-none border-y border-blue-400 bg-gradient-to-r from-blue-500 to-blue-500';
                                                    else if (hasTop && hasBottom && !hasLeft && !hasRight) shipRounded = 'rounded-none border-x border-blue-400 bg-gradient-to-b from-blue-500 to-blue-500';
                                                    else if (!hasTop && !hasBottom && !hasLeft && !hasRight) shipRounded = 'rounded-full border-2 border-blue-400 bg-blue-500';
                                                }

                                                return (
                                                    <button
                                                        key={key}
                                                        type="button"
                                                        onClick={() => !isSpectator && !preparado && placeSelectedShip(key)}
                                                        onContextMenu={(e) => { e.preventDefault(); !isSpectator && !preparado && setOrientation(o => (o === 'H' ? 'V' : 'H')); }}
                                                        className={`w-8 h-8 flex items-center justify-center text-sm transition-all duration-300 relative
                                                            ${isShip ? `${shipRounded} bg-gradient-to-br from-blue-400 to-blue-600 shadow-[0_0_8px_rgba(59,130,246,0.6)] border border-blue-300/50` : 'bg-slate-800/60 hover:bg-slate-700/80 rounded-sm'}
                                                            ${!isSpectator && !preparado ? 'cursor-crosshair hover:scale-105' : 'cursor-default'}
                                                        `}
                                                        title={key}
                                                    >
                                                        {isHit && <span className="absolute inset-0 flex items-center justify-center text-red-500 font-black text-xl animate-bounce drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]">✕</span>}
                                                        {isMiss && <div className="w-3 h-3 rounded-full bg-slate-300 shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)]" />}
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
                                        {filaLabels.map((f, fIdx) => (
                                            <Fragment key={`erow-${f}`}>
                                                <div key={`er-${f}`} className="text-center text-xs font-medium text-slate-400 py-2 px-1">{f}</div>
                                                {colLabels.map((cStr, cIdx) => {
                                                    const cNum = Number(cStr);
                                                    const key = `${f}${cStr}`;
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

                                                    const isHoveredRow = hoveredCell && hoveredCell.startsWith(f);
                                                    const isHoveredCol = hoveredCell && hoveredCell.endsWith(String(cStr));
                                                    const isCrosshair = isHoveredRow || isHoveredCol;

                                                    const isSunk = sunkCells.has(key);
                                                    const isSunkShip = isSunk && oponenteBarcos && oponenteBarcos[key];

                                                    const hasLeft = cIdx > 0 && isSunkShip && oponenteBarcos[`${f}${colLabels[cIdx - 1]}`];
                                                    const hasRight = cIdx < colLabels.length - 1 && isSunkShip && oponenteBarcos[`${f}${colLabels[cIdx + 1]}`];
                                                    const hasTop = fIdx > 0 && isSunkShip && oponenteBarcos[`${filaLabels[fIdx - 1]}${cStr}`];
                                                    const hasBottom = fIdx < filaLabels.length - 1 && isSunkShip && oponenteBarcos[`${filaLabels[fIdx + 1]}${cStr}`];

                                                    let shipRounded = 'rounded-sm';
                                                    if (isSunkShip) {
                                                        if (!hasLeft && hasRight && !hasTop && !hasBottom) shipRounded = 'rounded-l-full rounded-r-md';
                                                        else if (hasLeft && !hasRight && !hasTop && !hasBottom) shipRounded = 'rounded-r-full rounded-l-md';
                                                        else if (!hasTop && hasBottom && !hasLeft && !hasRight) shipRounded = 'rounded-t-full rounded-b-md';
                                                        else if (hasTop && !hasBottom && !hasLeft && !hasRight) shipRounded = 'rounded-b-full rounded-t-md';
                                                        else if (hasLeft && hasRight && !hasTop && !hasBottom) shipRounded = 'rounded-none border-y border-orange-400 bg-gradient-to-r from-orange-500 to-orange-500';
                                                        else if (hasTop && hasBottom && !hasLeft && !hasRight) shipRounded = 'rounded-none border-x border-orange-400 bg-gradient-to-b from-orange-500 to-orange-500';
                                                        else if (!hasTop && !hasBottom && !hasLeft && !hasRight) shipRounded = 'rounded-full border-2 border-orange-400 bg-orange-500';
                                                    }

                                                    return (
                                                        <button
                                                            key={`e-${key}`}
                                                            type="button"
                                                            onClick={() => !isSpectator && shootAt(key)}
                                                            onMouseEnter={() => setHoveredCell(key)}
                                                            onMouseLeave={() => setHoveredCell(null)}
                                                            disabled={isSpectator || !esMiTurno || !oponenteListo || shot !== undefined}
                                                            className={`w-8 h-8 flex items-center justify-center text-sm transition-all duration-200 relative
                                                                ${isSelected ? 'ring-2 ring-red-500 z-10' : ''}
                                                                ${shot === undefined ? (isCrosshair ? 'bg-slate-700' : 'bg-slate-800/50 hover:bg-slate-700') : ''}
                                                                ${isSunkShip ? `${shipRounded} bg-gradient-to-br from-orange-500 to-red-600 shadow-[0_0_12px_rgba(249,115,22,0.8)] border border-orange-300` : ''}
                                                                ${shot === true && !isSunkShip ? 'bg-red-500/20' : ''}
                                                                ${shot === false ? 'bg-slate-800/80' : ''}
                                                                ${!isSpectator && esMiTurno && oponenteListo && shot === undefined ? 'cursor-crosshair' : 'cursor-default'}
                                                            `}
                                                            title={isSunk ? `${key} - ¡HUNDIDO!` : key}
                                                        >
                                                            {shot === true && isSunk && (
                                                                <span className="absolute inset-0 flex items-center justify-center text-orange-400 font-bold text-base">🔥</span>
                                                            )}
                                                            {shot === true && !isSunk && (
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
                                const isMe = msg.sender === ((jugadorId && jugadoresMap[jugadorId]) || (isSpectator ? spectatorName : `Jugador ${jugadorId}`));
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

                {/* Game Over / Rematch UI */}
                {
                    estadoPartida === 'FINALIZADA' && miPuesto !== 0 && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                            <div className="bg-slate-900 border border-slate-700 p-8 rounded-2xl max-w-md w-full text-center space-y-6 shadow-2xl">
                                <h2 className="text-4xl font-black text-white mb-2">
                                    {ganadorId === jugadorId ? '¡VICTORIA!' : 'DERROTA'}
                                </h2>
                                <div className="text-slate-400">
                                    {ganadorId === jugadorId ? 'Has dominado los mares.' : 'Mejor suerte la próxima vez.'}
                                </div>

                                {scoreDetails && (
                                    <div className="bg-slate-800/50 rounded-lg p-4 text-sm space-y-2 text-left">
                                        <div className="flex justify-between">
                                            <span className="text-slate-400">Puntos Base</span>
                                            <span className="font-bold text-white">{scoreDetails.puntosBase}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-400">Precisión</span>
                                            <span className="font-bold text-blue-400">+{scoreDetails.puntosPrecision}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-400">Barcos Hundidos</span>
                                            <span className="font-bold text-red-400">+{scoreDetails.puntosBarcos}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-400">Supervivencia</span>
                                            <span className="font-bold text-green-400">+{scoreDetails.puntosSupervivencia}</span>
                                        </div>
                                        {scoreDetails.puntosRacha > 0 && (
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">Racha de Victorias</span>
                                                <span className="font-bold text-yellow-400">+{scoreDetails.puntosRacha}</span>
                                            </div>
                                        )}
                                        <div className="border-t border-slate-700 pt-2 mt-2 flex justify-between text-lg">
                                            <span className="font-bold text-slate-200">Total PR</span>
                                            <span className="font-bold text-white">{scoreDetails.total}</span>
                                        </div>
                                    </div>
                                )}
                                {rematchSec !== null && rematchSec > 0 && (
                                    <div className="text-2xl font-bold text-yellow-400 animate-pulse">
                                        Revancha expira en: {rematchSec}s
                                    </div>
                                )}

                                {/* Show opponent rematch request */}
                                {((miPuesto === 1 && rematchRequestJ2) || (miPuesto === 2 && rematchRequestJ1)) && (
                                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
                                        <div className="text-emerald-400 font-bold mb-2">¡Tu oponente quiere revancha!</div>
                                        <div className="flex gap-3">
                                            <button
                                                onClick={solicitarRevancha}
                                                className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all"
                                            >
                                                Aceptar
                                            </button>
                                            <button
                                                onClick={rechazarRevancha}
                                                className="flex-1 py-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all"
                                            >
                                                Rechazar
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <div className="flex flex-col gap-3">
                                    {!isSpectator && (
                                        <>
                                            {/* Show solicitar revancha button only if opponent hasn't requested yet */}
                                            {!((miPuesto === 1 && rematchRequestJ2) || (miPuesto === 2 && rematchRequestJ1)) && (
                                                <button
                                                    onClick={solicitarRevancha}
                                                    disabled={(rematchRequestJ1 && miPuesto === 1) || (rematchRequestJ2 && miPuesto === 2)}
                                                    className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all transform hover:scale-105 disabled:opacity-50 disabled:transform-none"
                                                >
                                                    {(miPuesto === 1 && rematchRequestJ1) || (miPuesto === 2 && rematchRequestJ2)
                                                        ? 'Esperando oponente...'
                                                        : 'Solicitar Revancha'}
                                                </button>
                                            )}
                                            <button
                                                onClick={rechazarRevancha}
                                                className="w-full py-3 rounded-lg border border-slate-600 hover:bg-slate-800 text-slate-300 font-medium transition-colors"
                                            >
                                                Dejar Puesto
                                            </button>
                                        </>
                                    )}
                                    <button
                                        onClick={salirSala}
                                        className="w-full py-2 text-slate-500 hover:text-slate-400 text-sm"
                                    >
                                        Volver al Menú
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                }

            </div >
        </div >
    );
}
