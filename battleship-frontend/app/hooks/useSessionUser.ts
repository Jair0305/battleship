"use client";

import { useMemo, useSyncExternalStore } from "react";
import { getStoredSession } from "../lib/api";
import type { SessionUser } from "../lib/types";

function subscribeSession(listener: () => void) {
  window.addEventListener("bship:session", listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener("bship:session", listener);
    window.removeEventListener("storage", listener);
  };
}

function sessionSnapshot() {
  if (typeof window === "undefined") return null;
  const session = getStoredSession();
  return session ? JSON.stringify(session) : null;
}

function serverSessionSnapshot() {
  return null;
}

export function useSessionUser() {
  const raw = useSyncExternalStore(subscribeSession, sessionSnapshot, serverSessionSnapshot);

  return useMemo<SessionUser | null>(() => {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as SessionUser;
      return parsed.guest || parsed.token ? parsed : null;
    } catch {
      return null;
    }
  }, [raw]);
}
