const SESSION_KEY = "poker_session_id";

export function getSessionId(): string {
  if (typeof window === "undefined") {
    throw new Error("getSessionId can only be called on the client");
  }

  let sessionId = localStorage.getItem(SESSION_KEY);

  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, sessionId);
  }

  return sessionId;
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SESSION_KEY);
}
