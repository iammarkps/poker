"use client";

import { lazy, Suspense } from "react";
import Link from "next/link";
import { useGame } from "@/components/game/game-provider";
import { Lobby } from "./lobby";

const PokerGame = lazy(() =>
  import("./poker-game").then((mod) => ({ default: mod.PokerGame }))
);

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
          <Link href="/" className="text-green-300 hover:underline mt-2 inline-block">
            Go back home
          </Link>
        </div>
      </main>
    );
  }

  if (room.status === "waiting") {
    return <Lobby />;
  }

  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-green-900 to-green-950">
          <p className="text-white text-lg">Loading game...</p>
        </main>
      }
    >
      <PokerGame />
    </Suspense>
  );
}
