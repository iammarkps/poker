"use client";

import { useSyncExternalStore } from "react";
import { getSessionId } from "@/lib/session";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getSnapshot() {
  return getSessionId();
}

function getServerSnapshot() {
  return null;
}

export function useSession() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
