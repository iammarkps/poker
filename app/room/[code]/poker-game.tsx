"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useGame } from "@/components/game/game-provider";
import { PokerTable } from "@/components/poker/table";
import { ActionButtons } from "@/components/poker/action-buttons";
import { HAND_NAMES, type HandRank } from "@/lib/poker/hand-evaluator";
import { SessionTimer } from "@/components/poker/session-timer";
import { AddonPanel } from "@/components/poker/addon-panel";

export function PokerGame() {
  const { room, hand, players, isHost, sessionId, refetch, winnerInfo: contextWinnerInfo } = useGame();
  const [isStarting, setIsStarting] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const autoNextHandRef = useRef(false);

  const isShowdown = hand?.phase === "showdown";

  // Memoize winner display info based on context data (must be before early return)
  const winnerInfo = useMemo(() => {
    if (!isShowdown || !contextWinnerInfo) return null;

    const winners = contextWinnerInfo.winners
      .map((w) => {
        const player = players.find((p) => p.id === w.playerId);
        if (!player) return null;
        return {
          player,
          handName: w.handRank !== undefined ? HAND_NAMES[w.handRank as HandRank] : w.handName || "",
        };
      })
      .filter((w): w is { player: typeof players[number]; handName: string } => w !== null);

    return {
      type: contextWinnerInfo.type,
      winners,
    };
  }, [isShowdown, contextWinnerInfo, players]);

  // Auto next hand after 3 seconds at showdown (host only)
  useEffect(() => {
    if (!isShowdown || !isHost || isStarting || autoNextHandRef.current) {
      return;
    }

    autoNextHandRef.current = true;
    setCountdown(3);

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    countdownRef.current = setTimeout(async () => {
      if (!room) return;
      setIsStarting(true);
      try {
        await fetch(`/api/room/${room.code}/next-hand`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        refetch();
      } catch (error) {
        console.error("Failed to start next hand:", error);
      } finally {
        setIsStarting(false);
        autoNextHandRef.current = false;
      }
    }, 3000);

    return () => {
      clearInterval(interval);
      if (countdownRef.current) {
        clearTimeout(countdownRef.current);
      }
    };
  }, [isShowdown, isHost, isStarting, room, sessionId, refetch]);

  // Reset autoNextHandRef when leaving showdown
  useEffect(() => {
    if (!isShowdown) {
      autoNextHandRef.current = false;
      setCountdown(null);
    }
  }, [isShowdown]);

  if (!room || !hand) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-green-900 to-green-950">
        <p className="text-white">Loading game...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col bg-gradient-to-b from-green-900 to-green-950 relative">
      {/* Add-on panel at top left */}
      <AddonPanel />

      {/* Session timer at top right */}
      <div className="absolute top-4 right-4 z-10">
        <SessionTimer />
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <PokerTable />
      </div>

      {isShowdown && winnerInfo && (
        <div className="px-4 pb-2">
          <div className="bg-yellow-500/20 border border-yellow-500 rounded-lg p-4 max-w-md mx-auto text-center">
            <p className="text-yellow-300 font-bold text-lg">
              {winnerInfo.winners.length > 1 ? "Winners:" : "Winner:"}
            </p>
            {winnerInfo.winners.map((w, i) => (
              <p key={i} className="text-white">
                {w.player.name} - {w.handName}
              </p>
            ))}
            <p className="text-white/60 text-sm mt-2">
              {isStarting
                ? "Dealing..."
                : countdown !== null
                ? `Next hand in ${countdown}s...`
                : "Preparing next hand..."}
            </p>
          </div>
        </div>
      )}

      {!isShowdown && (
        <div className="p-4">
          <ActionButtons />
        </div>
      )}
    </main>
  );
}
