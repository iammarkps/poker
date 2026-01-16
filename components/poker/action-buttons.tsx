"use client";

import { useState } from "react";
import { useGame } from "@/components/game/game-provider";
import { Button } from "@/components/ui/button";
import { BetSlider } from "./bet-slider";

export function ActionButtons() {
  const { room, hand, myPlayer, myPlayerHand, isMyTurn, sessionId } = useGame();
  const [showRaiseSlider, setShowRaiseSlider] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!room || !hand || !myPlayer || !myPlayerHand) {
    return null;
  }

  // Don't show actions if not my turn or already folded
  if (!isMyTurn || myPlayerHand.is_folded || myPlayerHand.is_all_in) {
    return (
      <div className="text-center text-white/60">
        {myPlayerHand.is_folded
          ? "You folded"
          : myPlayerHand.is_all_in
          ? "You're all in"
          : "Waiting for your turn..."}
      </div>
    );
  }

  const currentBet = hand.current_bet;
  const myBet = myPlayerHand.current_bet;
  const toCall = currentBet - myBet;
  const canCheck = toCall === 0;
  const minRaise = currentBet + room.big_blind;
  const maxBet = myPlayer.chips;

  async function submitAction(action: string, amount?: number) {
    setIsSubmitting(true);
    setShowRaiseSlider(false);

    try {
      await fetch(`/api/room/${room!.code}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          action,
          amount,
        }),
      });
    } catch (error) {
      console.error("Action error:", error);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (showRaiseSlider) {
    return (
      <BetSlider
        minBet={minRaise}
        maxBet={maxBet}
        currentBet={hand.pot}
        onBet={(amount) => submitAction("raise", amount)}
        onCancel={() => setShowRaiseSlider(false)}
      />
    );
  }

  return (
    <div className="flex gap-3 justify-center max-w-md mx-auto">
      <Button
        variant="destructive"
        size="lg"
        className="flex-1"
        onClick={() => submitAction("fold")}
        disabled={isSubmitting}
      >
        Fold
      </Button>

      {canCheck ? (
        <Button
          variant="secondary"
          size="lg"
          className="flex-1"
          onClick={() => submitAction("check")}
          disabled={isSubmitting}
        >
          Check
        </Button>
      ) : (
        <Button
          variant="secondary"
          size="lg"
          className="flex-1"
          onClick={() => submitAction("call")}
          disabled={isSubmitting || toCall > maxBet}
        >
          Call {Math.min(toCall, maxBet)}
        </Button>
      )}

      {maxBet > minRaise ? (
        <Button
          size="lg"
          className="flex-1"
          onClick={() => setShowRaiseSlider(true)}
          disabled={isSubmitting}
        >
          Raise
        </Button>
      ) : (
        <Button
          size="lg"
          className="flex-1"
          onClick={() => submitAction("all_in", maxBet)}
          disabled={isSubmitting}
        >
          All In ({maxBet})
        </Button>
      )}
    </div>
  );
}
