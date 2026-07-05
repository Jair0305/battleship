"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { createGuest, login, register } from "../lib/api";
import type { SessionUser } from "../lib/types";

type AuthMode = "login" | "register" | "guest";

const tabs: Array<{ key: AuthMode; label: string }> = [
  { key: "login", label: "Entrar" },
  { key: "register", label: "Registro" },
  { key: "guest", label: "Invitado" },
];

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
    <main className="min-h-[calc(100vh-64px)] bg-[url('/grid.svg')] bg-center px-4 py-8">
      <div className="mx-auto grid min-h-[calc(100vh-128px)] max-w-5xl items-center gap-6 lg:grid-cols-[1fr_420px]">
        <section className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-sm text-cyan-100">
            Battleship publico
          </div>
          <h1 className="max-w-2xl text-4xl font-bold text-white md:text-5xl">Entra para jugar una mesa</h1>
          <p className="max-w-xl text-sm leading-6 text-slate-300">
            Cuenta registrada para rating, o invitado para jugar rapido. La mesa arranca cuando los dos jugadores esten listos.
          </p>
        </section>

        <section className="glass-card rounded-lg p-5">
          <div className="grid grid-cols-3 rounded border border-slate-800 bg-slate-950/70 p-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setMode(tab.key);
                  setError(null);
                }}
                className={`rounded px-3 py-2 text-sm font-semibold transition ${
                  mode === tab.key ? "bg-cyan-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="mt-5">
            <h2 className="text-xl font-semibold text-white">
              {mode === "login" ? "Iniciar sesion" : mode === "register" ? "Registro simple" : "Entrar como invitado"}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              {mode === "register" ? "Usuario, contrasena y confirmacion. Nada mas." : mode === "guest" ? "Sin rating, listo para jugar." : "Usa tu usuario y contrasena."}
            </p>
          </div>

          {error && <div className="mt-4 rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}

          <div className="mt-5">{form}</div>
        </section>
      </div>
    </main>
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
    <label className="block text-sm text-slate-300">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className="mt-2 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-500"
      />
    </label>
  );
}

function PrimaryButton({ loading, label, loadingLabel }: { loading: boolean; label: string; loadingLabel: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full rounded bg-cyan-600 px-4 py-2 font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-60"
    >
      {loading ? loadingLabel : label}
    </button>
  );
}
