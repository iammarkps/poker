"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export function usePresence(roomCode: string, sessionId: string | null, playerId: string | null) {
  useEffect(() => {
    if (!sessionId || !playerId) return;

    const supabase = createClient();

    // Update player as connected
    supabase
      .from("players")
      .update({ is_connected: true })
      .eq("id", playerId)
      .then();

    // Set up presence channel
    const channel = supabase.channel(`presence:${roomCode}`, {
      config: {
        presence: {
          key: sessionId,
        },
      },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        console.log("Presence state:", state);
      })
      .on("presence", { event: "join" }, ({ key }) => {
        console.log("User joined:", key);
      })
      .on("presence", { event: "leave" }, ({ key }) => {
        console.log("User left:", key);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            sessionId,
            playerId,
            online_at: new Date().toISOString(),
          });
        }
      });

    // Handle tab close / navigation away
    const handleBeforeUnload = () => {
      supabase
        .from("players")
        .update({ is_connected: false })
        .eq("id", playerId)
        .then();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      handleBeforeUnload();
      supabase.removeChannel(channel);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [roomCode, sessionId, playerId]);
}
