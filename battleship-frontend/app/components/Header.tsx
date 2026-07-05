"use client";

import Link from "next/link";
import { logout } from "../lib/api";
import { useSessionUser } from "../hooks/useSessionUser";
import { GameButton, GameNavbar, GameScore, gameButtonClassName } from "./nightly/primitives";

function signOut() {
  logout();
}

export default function Header() {
  const session = useSessionUser();

  return (
    <GameNavbar statusText="Battleship classic 10x10">
      {session ? (
        <>
          <div className="hidden items-center gap-4 sm:flex">
            <div className="text-right">
              <div className="max-w-36 truncate font-mono text-sm text-night-text">{session.displayName}</div>
              <div className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-night-faint">
                {session.guest ? "Invitado" : "Registrado"}
              </div>
            </div>
            {!session.guest && <GameScore label="Rating" value={session.rating ?? 1200} />}
          </div>
          <GameButton variant="secondary" size="sm" onClick={signOut}>
            Salir
          </GameButton>
        </>
      ) : (
        <>
          <Link href="/" className={gameButtonClassName("ghost", "sm")}>
            Entrar
          </Link>
          <Link href="/register" className={gameButtonClassName("secondary", "sm")}>
            Registro
          </Link>
        </>
      )}
    </GameNavbar>
  );
}
