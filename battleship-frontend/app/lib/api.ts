'use client'

import type {
  ChatMessage,
  LobbySnapshot,
  RoomSnapshot,
  SessionUser,
  ShipPlacement,
  ShotResult,
  TableSnapshot,
} from './types'

const configuredApiBase = process.env.NEXT_PUBLIC_API_BASE
export const API_BASE =
  configuredApiBase === undefined ? 'http://localhost:8080' : configuredApiBase.replace(/\/$/, '')
const SESSION_KEY = 'bship:session'

type ApiError = {
  message?: string
}

async function request<T>(path: string, init: RequestInit = {}, token?: string | null): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  const sessionToken = token ?? getStoredSession()?.token
  if (sessionToken) headers.set('X-Session-Token', sessionToken)

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  })
  if (!res.ok) {
    let payload: ApiError = {}
    try {
      payload = await res.json()
    } catch {
      payload = {}
    }
    throw new Error(payload.message || `Solicitud fallida (${res.status})`)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export function getStoredSession(): SessionUser | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(SESSION_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as SessionUser
  } catch {
    window.localStorage.removeItem(SESSION_KEY)
    return null
  }
}

export function saveSession(session: SessionUser | null) {
  if (typeof window === 'undefined') return
  if (session) window.localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  else window.localStorage.removeItem(SESSION_KEY)
  window.dispatchEvent(new Event('bship:session'))
}

export async function ensureSession(): Promise<SessionUser> {
  const stored = getStoredSession()
  if (stored?.token) return stored
  const created = await request<SessionUser>('/api/session/guest', {
    method: 'POST',
    body: JSON.stringify({}),
  }, null)
  saveSession(created)
  return created
}

export async function createGuest(displayName?: string): Promise<SessionUser> {
  const created = await request<SessionUser>('/api/session/guest', {
    method: 'POST',
    body: JSON.stringify({ displayName }),
  }, null)
  saveSession(created)
  return created
}

export async function login(username: string, password: string): Promise<SessionUser> {
  const session = await request<SessionUser>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  }, null)
  saveSession(session)
  return session
}

export async function register(username: string, password: string, passwordConfirm: string): Promise<SessionUser> {
  const session = await request<SessionUser>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password, passwordConfirm }),
  }, null)
  saveSession(session)
  return session
}

export function logout() {
  saveSession(null)
}

export const api = {
  lobby: () => request<LobbySnapshot>('/api/lobby'),
  room: (salaId: number) => request<RoomSnapshot>(`/api/salas/${salaId}`),
  createTable: (salaId: number, name?: string) =>
    request<TableSnapshot>(`/api/salas/${salaId}/mesas`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
  table: (mesaId: number) => request<TableSnapshot>(`/api/mesas/${mesaId}`),
  joinTable: (mesaId: number) => request<TableSnapshot>(`/api/mesas/${mesaId}/join`, { method: 'POST' }),
  leaveTable: (mesaId: number) => request<TableSnapshot>(`/api/mesas/${mesaId}/leave`, { method: 'POST' }),
  sit: (mesaId: number, seat: 'A' | 'B') =>
    request<TableSnapshot>(`/api/mesas/${mesaId}/seat/${seat}/sit`, { method: 'POST' }),
  stand: (mesaId: number) => request<TableSnapshot>(`/api/mesas/${mesaId}/seat/stand`, { method: 'POST' }),
  ready: (mesaId: number) => request<TableSnapshot>(`/api/mesas/${mesaId}/ready`, { method: 'POST' }),
  ships: (mesaId: number, ships: ShipPlacement[]) =>
    request<TableSnapshot>(`/api/mesas/${mesaId}/ships`, {
      method: 'POST',
      body: JSON.stringify({ ships }),
    }),
  shot: (mesaId: number, position: string) =>
    request<ShotResult>(`/api/mesas/${mesaId}/shots`, {
      method: 'POST',
      body: JSON.stringify({ position }),
    }),
  resign: (mesaId: number) => request<TableSnapshot>(`/api/mesas/${mesaId}/resign`, { method: 'POST' }),
  rematch: (mesaId: number) => request<TableSnapshot>(`/api/mesas/${mesaId}/rematch`, { method: 'POST' }),
  chat: (mesaId: number, content: string) =>
    request<ChatMessage>(`/api/mesas/${mesaId}/chat`, {
      method: 'POST',
      body: JSON.stringify({ content, type: 'CHAT' }),
    }),
}
