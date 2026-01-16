"use client";

import { useEffect, useState } from "react";
import { getSessionId } from "@/lib/session";

export function useSession() {
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    setSessionId(getSessionId());
  }, []);

  return sessionId;
}
