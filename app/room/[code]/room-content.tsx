"use client";

import { useGame } from "@/components/game/game-provider";
import { Lobby } from "./lobby";
import { PokerGame } from "./poker-game";

export function RoomContent() {
  const { room, isLoading, error } = useGame();

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-green-900 to-green-950">
        <p className="text-white text-lg">Loading...</p>
      </main>
    );
  }

  if (error || !room) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-green-900 to-green-950">
        <div className="text-center text-white">
          <p className="text-lg">{error || "Room not found"}</p>
          <a href="/" className="text-green-300 hover:underline mt-2 inline-block">
            Go back home
          </a>
        </div>
      </main>
    );
  }

  if (room.status === "waiting") {
    return <Lobby />;
  }

  return <PokerGame />;
}
