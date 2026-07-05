"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { SessionUser } from "../lib/types";

const SESSION_KEY = "bship:session";

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
  return window.localStorage.getItem(SESSION_KEY);
}

function serverSessionSnapshot() {
  return null;
}

export function useSessionUser() {
  const raw = useSyncExternalStore(subscribeSession, sessionSnapshot, serverSessionSnapshot);

  return useMemo<SessionUser | null>(() => {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as SessionUser;
    } catch {
      return null;
    }
  }, [raw]);
}
