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

const configuredApiBase = process.env.NEXT_PUBLIC_API_BASE?.trim()

export function getApiBase() {
  if (configuredApiBase) return configuredApiBase.replace(/\/$/, '')
  if (typeof window !== 'undefined') {
    const { hostname, protocol } = window.location
    if (protocol === 'https:' || hostname !== 'localhost') return ''
  }
  return 'http://localhost:8080'
}

export const API_BASE = getApiBase()

export function apiUrl(path: string) {
  const base = getApiBase()
  return base ? `${base}${path}` : path
}

export function realtimeUrl(path = '/ws') {
  const base = getApiBase()
  if (!base) {
    if (typeof window === 'undefined') return path
    return new URL(path, window.location.origin).toString()
  }

  const url = new URL(path, base)
  if (typeof window !== 'undefined' && window.location.protocol === 'https:' && url.protocol === 'http:') {
    url.protocol = 'https:'
  }
  return url.toString()
}
const SESSION_KEY = 'bship:session'
let guestSession: SessionUser | null = null

type ApiError = {
  message?: string
}

async function request<T>(path: string, init: RequestInit = {}, token?: string | null): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  const sessionToken = token ?? getStoredSession()?.token
  if (sessionToken) headers.set('X-Session-Token', sessionToken)

  const res = await fetch(apiUrl(path), {
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
    if (res.status === 401) saveSession(null)
    throw new Error(payload.message || `Solicitud fallida (${res.status})`)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export function getStoredSession(): SessionUser | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(SESSION_KEY)
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as SessionUser
      if (parsed.guest) {
        window.localStorage.removeItem(SESSION_KEY)
      } else {
        return parsed
      }
    } catch {
      window.localStorage.removeItem(SESSION_KEY)
    }
  }
  return guestSession
}

export function saveSession(session: SessionUser | null) {
  if (typeof window === 'undefined') return
  if (session?.guest) {
    window.localStorage.removeItem(SESSION_KEY)
    guestSession = session
  } else if (session) {
    guestSession = null
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } else {
    guestSession = null
    window.localStorage.removeItem(SESSION_KEY)
  }
  window.dispatchEvent(new Event('bship:session'))
}

export async function ensureSession(): Promise<SessionUser> {
  const stored = getStoredSession()
  if (stored?.token) return stored
  throw new Error('Inicia sesion para jugar')
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
