"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { createGuest, login, register } from "../lib/api";
import type { SessionUser } from "../lib/types";
import {
  ErrorState,
  GameBadge,
  GameButton as NightlyButton,
  GameCard,
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

const heroEyebrow = <GameBadge tone="accent">Nightly public table</GameBadge>;
const heroTitle = <>Battle<wbr />ship protocol</>;
const heroStats = (
  <div className="grid max-w-2xl grid-cols-3 gap-3">
    <GameScore label="Board" value="10x10" />
    <GameScore label="Fleet" value="10" />
    <GameScore label="Mode" value="Live" />
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
      copy="Una mesa publica, rating competitivo y partidas clasicas 10x10 bajo una identidad visual lista para todos los juegos de Nightly."
      stats={heroStats}
    >
      <div className="grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
        <AuthPreview />
        <GamePanel title={mode === "login" ? "Iniciar sesion" : mode === "register" ? "Registro simple" : "Entrar como invitado"} eyebrow="access node" className="nightly-scanline">
          <div className="grid grid-cols-3 rounded-night-sm border border-white/10 bg-[#090909]/70 p-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setMode(tab.key);
                  setError(null);
                }}
                className={cn(
                  "rounded-night-sm px-3 py-2 font-mono text-xs font-semibold uppercase tracking-[0.15em] transition-all duration-200 ease-night",
                  mode === tab.key ? "bg-night-accent text-[#111409]" : "text-night-muted hover:bg-white/[0.04] hover:text-night-text",
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

function AuthPreview() {
  const cells = Array.from({ length: 36 }, (_, index) => index);

  return (
    <GameCard className="nightly-scanline hidden min-h-[420px] overflow-hidden p-5 lg:block" tone="accent">
      <div className="flex items-center justify-between border-b border-white/10 pb-3 font-mono text-[0.64rem] uppercase tracking-[0.2em] text-night-faint">
        <span>asset explorer</span>
        <span>ng-battle-01</span>
      </div>
      <div className="mt-8 grid grid-cols-6 gap-2">
        {cells.map((cell) => (
          <div
            key={cell}
            className={cn(
              "aspect-square rounded-night-sm border border-white/10 bg-white/[0.03]",
              cell % 7 === 0 && "bg-night-accent/20 border-night-accent/40",
              cell % 11 === 0 && "translate-y-2",
            )}
          />
        ))}
      </div>
      <div className="mt-10 space-y-3">
        <div className="font-display text-5xl uppercase leading-none text-night-accent">&lt;play /&gt;</div>
        <p className="max-w-xs font-mono text-xs leading-5 text-night-muted">
          Public lobby, private boards, real-time invalidation and rematch flow.
        </p>
      </div>
      <div className="absolute bottom-5 right-5 h-24 w-24 rounded-full border border-night-accent/20 bg-night-accent/10 blur-xl" />
    </GameCard>
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
      <span className="font-mono text-[0.68rem] uppercase tracking-[0.18em]">{label}</span>
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
