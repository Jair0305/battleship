"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createGuest, getStoredSession, logout } from "../lib/api";
import type { SessionUser } from "../lib/types";

export default function Header() {
  const [session, setSession] = useState<SessionUser | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const load = () => setSession(getStoredSession());
    load();
    window.addEventListener("bship:session", load);
    window.addEventListener("storage", load);
    return () => {
      window.removeEventListener("bship:session", load);
      window.removeEventListener("storage", load);
    };
  }, []);

  const enterAsGuest = async () => {
    setBusy(true);
    try {
      setSession(await createGuest());
    } finally {
      setBusy(false);
    }
  };

  const signOut = () => {
    logout();
    setSession(null);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-800 bg-slate-950/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 text-xl font-bold text-cyan-200">
          <span className="grid h-8 w-8 place-items-center rounded border border-cyan-500/40 bg-cyan-500/10 text-sm">
            BS
          </span>
          Battleship
        </Link>

        <nav className="flex items-center gap-3">
          {session ? (
            <>
              <div className="hidden text-right text-sm sm:block">
                <div className="text-slate-200">{session.displayName}</div>
                <div className="text-xs text-slate-500">
                  {session.guest ? "Invitado" : `Rating ${session.rating ?? 1200}`}
                </div>
              </div>
              {!session.guest && (
                <span className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs text-amber-200">
                  {session.wins ?? 0}W / {session.losses ?? 0}L
                </span>
              )}
              <button
                onClick={signOut}
                className="rounded border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800"
              >
                Salir
              </button>
            </>
          ) : (
            <>
              <button
                onClick={enterAsGuest}
                disabled={busy}
                className="rounded bg-cyan-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-60"
              >
                {busy ? "Entrando..." : "Invitado"}
              </button>
              <Link href="/login" className="text-sm text-slate-300 transition hover:text-white">
                Iniciar sesion
              </Link>
              <Link
                href="/register"
                className="rounded border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800"
              >
                Registro
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
