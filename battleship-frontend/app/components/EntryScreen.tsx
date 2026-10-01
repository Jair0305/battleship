"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { createGuest, login, register } from "../lib/api";
import { BOARD_SIZE, FLEET, type SessionUser } from "../lib/types";
import {
  ErrorState,
  GameBadge,
  GameButton as NightlyButton,
  GameHero,
  GamePanel,
  GameScore,
  cn,
} from "./nightly/primitives";

type AuthMode = "login" | "register" | "guest";

const tabs: Array<{ key: AuthMode; label: string }> = [
  { key: "login", label: "Entrar" },
  { key: "register", label: "Registro" },
  { key: "guest", label: "Invitado" },
];

// Real fleet composition grouped by hull size, derived from the shared rules.
const fleetClasses = Array.from(
  FLEET.reduce((groups, ship) => {
    const current = groups.get(ship.size);
    groups.set(ship.size, { name: current?.name ?? ship.name.replace(/\s+\d+$/, ""), size: ship.size, count: (current?.count ?? 0) + 1 });
    return groups;
  }, new Map<number, { name: string; size: number; count: number }>()).values(),
).sort((a, b) => b.size - a.size);

const heroEyebrow = <GameBadge tone="accent">Nightly Games / mesa publica</GameBadge>;
const heroTitle = <>Battle<wbr />ship</>;
const heroStats = (
  <div className="max-w-xl space-y-6">
    <div className="grid grid-cols-3 gap-3">
      <GameScore label="Tablero" value={`${BOARD_SIZE}x${BOARD_SIZE}`} />
      <GameScore label="Flota" value={FLEET.length} tone="signal" />
      <GameScore label="Modo" value="En vivo" tone="neutral" />
    </div>
    <dl className="grid gap-px overflow-hidden rounded-night-sm border border-night-signal/20 bg-white/[0.06] sm:grid-cols-2">
      {fleetClasses.map((ship) => (
        <div key={ship.size} className="flex items-center justify-between gap-3 bg-[#0d0e0f] px-3 py-2.5">
          <dt className="min-w-0 truncate font-mono text-[0.65rem] uppercase tracking-[0.14em] text-night-muted">
            {ship.name} <span className="text-night-faint">x{ship.count}</span>
          </dt>
          <dd className="flex gap-1" aria-label={`${ship.size} casillas`}>
            {Array.from({ length: ship.size }, (_, index) => (
              <span key={index} className="h-2.5 w-2.5 border border-night-signal/50 bg-night-signal/20" />
            ))}
          </dd>
        </div>
      ))}
    </dl>
  </div>
);

export default function EntryScreen({ onAuthenticated }: { onAuthenticated?: (session: SessionUser) => void }) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [guestName, setGuestName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitLogin = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!username.trim() || !password) {
      setError("Usuario y contrasena requeridos");
      return;
    }
    setLoading(true);
    try {
      const session = await login(username.trim(), password);
      onAuthenticated?.(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesion");
    } finally {
      setLoading(false);
    }
  };

  const submitRegister = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!username.trim() || !password) {
      setError("Usuario y contrasena requeridos");
      return;
    }
    if (password !== passwordConfirm) {
      setError("Las contrasenas no coinciden");
      return;
    }
    setLoading(true);
    try {
      const session = await register(username.trim(), password, passwordConfirm);
      onAuthenticated?.(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la cuenta");
    } finally {
      setLoading(false);
    }
  };

  const submitGuest = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const session = await createGuest(guestName.trim() || undefined);
      onAuthenticated?.(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo entrar como invitado");
    } finally {
      setLoading(false);
    }
  };

  const form = mode === "login"
    ? (
      <form onSubmit={submitLogin} className="space-y-4">
        <Field label="Usuario" value={username} onChange={setUsername} autoComplete="username" />
        <Field label="Contrasena" type="password" value={password} onChange={setPassword} autoComplete="current-password" />
        <PrimaryButton loading={loading} label="Entrar" loadingLabel="Entrando..." />
      </form>
    )
    : mode === "register"
      ? (
        <form onSubmit={submitRegister} className="space-y-4">
          <Field label="Usuario" value={username} onChange={setUsername} autoComplete="username" />
          <Field label="Contrasena" type="password" value={password} onChange={setPassword} autoComplete="new-password" />
          <Field label="Repetir contrasena" type="password" value={passwordConfirm} onChange={setPasswordConfirm} autoComplete="new-password" />
          <PrimaryButton loading={loading} label="Crear cuenta" loadingLabel="Creando..." />
        </form>
      )
      : (
        <form onSubmit={submitGuest} className="space-y-4">
          <Field label="Nombre de invitado" value={guestName} onChange={setGuestName} autoComplete="nickname" placeholder="Opcional" />
          <PrimaryButton loading={loading} label="Entrar como invitado" loadingLabel="Entrando..." />
        </form>
      );

  return (
    <GameHero
      eyebrow={heroEyebrow}
      title={heroTitle}
      stats={heroStats}
    >
      <div className="mx-auto w-full max-w-lg lg:mr-0">
        <GamePanel title={mode === "login" ? "Iniciar sesion" : mode === "register" ? "Registro simple" : "Entrar como invitado"} eyebrow="Acceso" className="nightly-frame-strong">
          <div className="grid grid-cols-3 gap-1 rounded-night-sm border border-white/10 bg-[#0b0b0a] p-1" role="group" aria-label="Tipo de acceso">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                aria-pressed={mode === tab.key}
                onClick={() => {
                  setMode(tab.key);
                  setError(null);
                }}
                className={cn(
                  "nightly-segment min-h-10 rounded-night-sm px-3 py-2 font-mono text-xs font-semibold uppercase tracking-[0.12em]",
                  mode === tab.key ? "bg-night-accent text-night-accent-ink" : "text-night-muted hover:bg-white/[0.05] hover:text-night-text",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <p className="mt-5 text-sm leading-6 text-night-muted">
            {mode === "register" ? "Usuario, contrasena y confirmacion. Nada mas." : mode === "guest" ? "Sin rating, listo para una partida rapida." : "Usa tu usuario y contrasena para conservar rating."}
          </p>

          {error && <div className="mt-4"><ErrorState body={error} /></div>}

          <div className="mt-5">{form}</div>
        </GamePanel>
      </div>
    </GameHero>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm text-night-muted">
      <span className="font-mono text-[0.65rem] uppercase tracking-[0.17em]">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className="nightly-input mt-2"
      />
    </label>
  );
}

function PrimaryButton({
  loading,
  label,
  loadingLabel,
}: {
  loading: boolean;
  label: string;
  loadingLabel: string;
}) {
  return (
    <NightlyButton type="submit" disabled={loading} className="w-full">
      {loading ? loadingLabel : label}
    </NightlyButton>
  );
}
