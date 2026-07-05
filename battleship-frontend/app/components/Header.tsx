"use client";

import Link from "next/link";
import { logout } from "../lib/api";
import { useSessionUser } from "../hooks/useSessionUser";

function signOut() {
  logout();
}

export default function Header() {
  const session = useSessionUser();

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
                type="button"
                onClick={signOut}
                className="rounded border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800"
              >
                Salir
              </button>
            </>
          ) : (
            <>
              <Link href="/" className="text-sm text-slate-300 transition hover:text-white">
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
