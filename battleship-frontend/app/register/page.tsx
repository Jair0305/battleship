"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { register } from "../lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (password !== passwordConfirm) {
      setError("Las contrasenas no coinciden");
      return;
    }
    setLoading(true);
    try {
      await register(username, password, passwordConfirm);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la cuenta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-96px)] max-w-md items-center px-4">
      <form onSubmit={onSubmit} className="glass-card w-full rounded-lg p-6">
        <h1 className="text-2xl font-bold text-white">Crear cuenta</h1>
        <p className="mt-1 text-sm text-slate-400">La cuenta registrada participa en rating Elo.</p>

        <label className="mt-6 block text-sm text-slate-300">
          Usuario
          <input
            className="mt-2 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-emerald-500"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />
        </label>

        <label className="mt-4 block text-sm text-slate-300">
          Contrasena
          <input
            type="password"
            className="mt-2 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-emerald-500"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>

        <label className="mt-4 block text-sm text-slate-300">
          Confirmar contrasena
          <input
            type="password"
            className="mt-2 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-emerald-500"
            value={passwordConfirm}
            onChange={(event) => setPasswordConfirm(event.target.value)}
            required
          />
        </label>

        {error && <div className="mt-4 rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}

        <button
          disabled={loading}
          className="mt-6 w-full rounded bg-emerald-600 px-4 py-2 font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60"
        >
          {loading ? "Creando..." : "Crear cuenta"}
        </button>

        <div className="mt-4 text-center text-sm text-slate-400">
          Ya tienes cuenta?{" "}
          <Link href="/login" className="text-emerald-300 hover:text-emerald-200">
            Inicia sesion
          </Link>
        </div>
      </form>
    </div>
  );
}
