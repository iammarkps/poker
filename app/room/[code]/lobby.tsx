"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useGame } from "@/components/game/game-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RoomCodeDisplay } from "@/components/lobby/room-code-display";
import { PlayerList } from "@/components/lobby/player-list";

export function Lobby() {
  const router = useRouter();
  const { room, players, isHost, sessionId, refetch } = useGame();
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState("");

  if (!room) return null;

  async function startGame() {
    if (!room) return;
    setIsStarting(true);
    setError("");

    try {
      const res = await fetch(`/api/room/${room.code}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to start game");
        return;
      }

      refetch();
    } catch {
      setError("Failed to start game");
    } finally {
      setIsStarting(false);
    }
  }

  function leaveRoom() {
    router.push("/");
  }

  const canStart = isHost && players.length >= 2;

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-green-900 to-green-950">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Waiting for Players</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <RoomCodeDisplay code={room.code} />

          <div className="text-sm text-muted-foreground space-y-1">
            <p>Blinds: {room.small_blind}/{room.big_blind}</p>
            <p>Starting Chips: {room.starting_chips}</p>
          </div>

          <PlayerList
            players={players}
            hostSessionId={room.host_session_id}
            currentSessionId={sessionId}
          />

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="space-y-2">
            {isHost ? (
              <Button
                className="w-full"
                size="lg"
                onClick={startGame}
                disabled={!canStart || isStarting}
              >
                {isStarting
                  ? "Starting..."
                  : players.length < 2
                  ? "Need at least 2 players"
                  : "Start Game"}
              </Button>
            ) : (
              <p className="text-center text-muted-foreground">
                Waiting for host to start...
              </p>
            )}
            <Button variant="ghost" className="w-full" onClick={leaveRoom}>
              Leave Room
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
