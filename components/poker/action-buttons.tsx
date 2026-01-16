"use client";

import { useState, useCallback } from "react";
import { useGame } from "@/components/game/game-provider";
import { Button } from "@/components/ui/button";
import { BetSlider } from "./bet-slider";
import { TurnTimer } from "./turn-timer";

export function ActionButtons() {
  const { room, hand, myPlayer, myPlayerHand, isMyTurn, sessionId } = useGame();
  const [showRaiseSlider, setShowRaiseSlider] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleTimeout = useCallback(async () => {
    if (!room || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await fetch(`/api/room/${room.code}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          action: "fold",
        }),
      });
    } catch (error) {
      console.error("Auto-fold error:", error);
    } finally {
      setIsSubmitting(false);
    }
  }, [room, sessionId, isSubmitting]);

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
  const lastRaise = hand.last_raise || room.big_blind;
  const minRaise = currentBet + lastRaise;
  const maxBet = myPlayer.chips;
  const maxRaise = myPlayer.chips + myBet; // Total bet amount when going all-in

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

  // Check if we're facing a bet (post-flop only for percentage buttons)
  const facingBet = hand.phase !== "preflop" && currentBet > 0;

  if (showRaiseSlider) {
    return (
      <div>
        <TurnTimer onTimeout={handleTimeout} />
        <BetSlider
          minBet={minRaise}
          maxBet={maxRaise}
          currentBet={hand.pot}
          smallBlind={room.small_blind}
          facingBet={facingBet}
          onBet={(amount) => submitAction("raise", amount)}
          onCancel={() => setShowRaiseSlider(false)}
        />
      </div>
    );
  }

  return (
    <div>
      <TurnTimer onTimeout={handleTimeout} />
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
          onClick={() => submitAction("call", Math.min(toCall, maxBet))}
          disabled={isSubmitting || toCall > maxBet}
        >
          Call {Math.min(toCall, maxBet)}
        </Button>
      )}

      {maxRaise > minRaise ? (
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
    </div>
  );
}
