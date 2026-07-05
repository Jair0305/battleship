"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { login } from "../lib/api";
import { ErrorState, GameButton, GamePanel, gameButtonClassName } from "../components/nightly/primitives";

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
    <div className="mx-auto grid min-h-[calc(100dvh-180px)] max-w-md place-items-center py-10">
      <GamePanel title="Iniciar sesion" eyebrow="access node" className="w-full nightly-scanline">
        <p className="text-sm leading-6 text-night-muted">Entra con tu cuenta para conservar rating e historial competitivo.</p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <Field label="Usuario" value={username} onChange={setUsername} autoComplete="username" />
          <Field label="Contrasena" type="password" value={password} onChange={setPassword} autoComplete="current-password" />
          {error && <ErrorState body={error} />}
          <GameButton type="submit" disabled={loading} className="w-full">
            {loading ? "Entrando..." : "Entrar"}
          </GameButton>
        </form>
        <div className="mt-4 text-center text-sm text-night-muted">
          No tienes cuenta?{" "}
          <Link href="/register" className={gameButtonClassName("ghost", "sm")}>
            Registrate
          </Link>
        </div>
      </GamePanel>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block text-sm text-night-muted">
      <span className="font-mono text-[0.68rem] uppercase tracking-[0.18em]">{label}</span>
      <input
        type={type}
        className="nightly-input mt-2"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        required
      />
    </label>
  );
}
