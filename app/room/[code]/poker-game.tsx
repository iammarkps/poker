"use client";

import { useState } from "react";
import { useGame } from "@/components/game/game-provider";
import { PokerTable } from "@/components/poker/table";
import { ActionButtons } from "@/components/poker/action-buttons";
import { Button } from "@/components/ui/button";
import { evaluateHand, HAND_NAMES } from "@/lib/poker/hand-evaluator";

export function PokerGame() {
  const { room, hand, players, playerHands, isHost, sessionId, refetch } = useGame();
  const [isStarting, setIsStarting] = useState(false);

  if (!room || !hand) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-green-900 to-green-950">
        <p className="text-white">Loading game...</p>
      </main>
    );
  }

  const isShowdown = hand.phase === "showdown";

  async function startNextHand() {
    setIsStarting(true);
    try {
      await fetch(`/api/room/${room!.code}/next-hand`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      refetch();
    } catch (error) {
      console.error("Failed to start next hand:", error);
    } finally {
      setIsStarting(false);
    }
  }

  // Get winner info for showdown display
  const getWinnerInfo = () => {
    if (!isShowdown) return null;

    const activePlayers = players.filter((p) => {
      const ph = playerHands.find((h) => h.player_id === p.id);
      return ph && !ph.is_folded;
    });

    if (activePlayers.length === 1) {
      return {
        type: "fold",
        winners: [{ player: activePlayers[0], handName: "Everyone else folded" }],
      };
    }

    const evaluated = activePlayers.map((player) => {
      const ph = playerHands.find((h) => h.player_id === player.id);
      const evalHand = ph ? evaluateHand(ph.hole_cards, hand.community_cards) : null;
      return { player, hand: evalHand };
    });

    const sorted = evaluated
      .filter((e) => e.hand)
      .sort((a, b) => {
        if (!a.hand || !b.hand) return 0;
        if (a.hand.rank !== b.hand.rank) return b.hand.rank - a.hand.rank;
        for (let i = 0; i < Math.min(a.hand.values.length, b.hand.values.length); i++) {
          if (a.hand.values[i] !== b.hand.values[i]) {
            return b.hand.values[i] - a.hand.values[i];
          }
        }
        return 0;
      });

    const winners = sorted.filter(
      (e) => e.hand && sorted[0].hand && e.hand.rank === sorted[0].hand.rank
    );

    return {
      type: "showdown",
      winners: winners.map((w) => ({
        player: w.player,
        handName: w.hand ? HAND_NAMES[w.hand.rank] : "",
      })),
    };
  };

  const winnerInfo = getWinnerInfo();

  return (
    <main className="min-h-screen flex flex-col bg-gradient-to-b from-green-900 to-green-950">
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
            {isHost && (
              <Button
                className="mt-4"
                onClick={startNextHand}
                disabled={isStarting}
              >
                {isStarting ? "Starting..." : "Deal Next Hand"}
              </Button>
            )}
            {!isHost && (
              <p className="text-white/60 text-sm mt-2">
                Waiting for host to deal next hand...
              </p>
            )}
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
