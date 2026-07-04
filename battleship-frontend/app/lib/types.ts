export type SessionUser = {
  id: number
  token: string
  displayName: string
  guest: boolean
  usuarioId: number | null
  rating: number | null
  gamesPlayed: number | null
  wins: number | null
  losses: number | null
}

export type SeatSnapshot = {
  seat: 'A' | 'B'
  jugadorId: number | null
  displayName: string | null
  guest: boolean
  rating: number | null
  ready: boolean
  occupied: boolean
}

export type ShotSnapshot = {
  atacanteId: number
  defensorId: number
  posicion: string
  acierto: boolean
  resultado: string
  barcoHundido: string | null
  ts: string
}

export type PrivateMatchView = {
  role: 'PLAYER'
  mySeat: 'A' | 'B'
  myJugadorId: number
  ownShips: Record<string, string>
  ownReceivedShots: Record<string, CellShot>
  targetShots: Record<string, CellShot>
  ownShipsPlaced: boolean
  opponentShipsPlaced: boolean
  revealedShips: Record<string, Record<string, string>>
  history: ShotSnapshot[]
}

export type SpectatorMatchView = {
  players: Record<string, string>
  publicShots: Record<string, Record<string, CellShot>>
  revealedShips: Record<string, Record<string, string>>
  history: ShotSnapshot[]
}

export type TableSnapshot = {
  id: number
  salaId: number
  salaNombre: string
  nombre: string
  estado: GameState
  seatA: SeatSnapshot
  seatB: SeatSnapshot
  spectators: number
  partidaId: number | null
  turnoActualJugadorId: number | null
  ganadorId: number | null
  rematchA: boolean
  rematchB: boolean
  privateView: PrivateMatchView | null
  spectatorView: SpectatorMatchView | null
}

export type RoomSnapshot = {
  id: number
  nombre: string
  disponible: boolean
  onlinePlayers: number
  spectators: number
  mesas: TableSnapshot[]
}

export type LobbySnapshot = {
  salas: RoomSnapshot[]
  onlinePlayers: SessionUser[]
}

export type ShipPlacement = {
  key: ShipKey
  name: string
  size: number
  orientation: Orientation
  cells: string[]
}

export type ShotResult = {
  mesaId: number
  partidaId: number
  atacanteId: number
  defensorId: number
  position: string
  result: 'MISS' | 'HIT' | 'SUNK' | 'WIN'
  hit: boolean
  sunkShip: string | null
  winnerId: number | null
  nextTurnJugadorId: number | null
}

export type ChatMessage = {
  sender: string
  content: string
  type: string
  receivedAt: string
}

export type GameState =
  | 'WAITING_FOR_PLAYERS'
  | 'PLAYERS_SEATED'
  | 'PLACING_SHIPS'
  | 'READY_TO_START'
  | 'IN_PROGRESS'
  | 'FINISHED'
  | 'ABANDONED'
  | 'CANCELLED'
  | 'CREADA'
  | 'EN_CURSO'
  | 'FINALIZADA'
  | 'CANCELADA'

export type Orientation = 'H' | 'V'
export type ShipKey = 'carrier' | 'battleship' | 'cruiser' | 'submarine' | 'destroyer'
export type CellShot = 'MISS' | 'HIT' | 'SUNK'

export const BOARD_SIZE = 10

export const FLEET: Array<{ key: ShipKey; name: string; size: number }> = [
  { key: 'carrier', name: 'Portaaviones', size: 5 },
  { key: 'battleship', name: 'Acorazado', size: 4 },
  { key: 'cruiser', name: 'Crucero', size: 3 },
  { key: 'submarine', name: 'Submarino', size: 3 },
  { key: 'destroyer', name: 'Destructor', size: 2 },
]
