"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { login } from "../lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username, password);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesion");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-96px)] max-w-md items-center px-4">
      <form onSubmit={onSubmit} className="glass-card w-full rounded-lg p-6">
        <h1 className="text-2xl font-bold text-white">Iniciar sesion</h1>
        <p className="mt-1 text-sm text-slate-400">Entra con tu cuenta para conservar rating e historial.</p>

        <label className="mt-6 block text-sm text-slate-300">
          Usuario
          <input
            className="mt-2 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-cyan-500"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />
        </label>

        <label className="mt-4 block text-sm text-slate-300">
          Contrasena
          <input
            type="password"
            className="mt-2 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-cyan-500"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>

        {error && <div className="mt-4 rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}

        <button
          disabled={loading}
          className="mt-6 w-full rounded bg-cyan-600 px-4 py-2 font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-60"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>

        <div className="mt-4 text-center text-sm text-slate-400">
          No tienes cuenta?{" "}
          <Link href="/register" className="text-cyan-300 hover:text-cyan-200">
            Registrate
          </Link>
        </div>
      </form>
    </div>
  );
}
