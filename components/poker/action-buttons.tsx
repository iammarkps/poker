"use client";

import { useState, useCallback } from "react";
import { useGame } from "@/components/game/game-provider";
import { Button } from "@/components/ui/button";
import { BetSlider } from "./bet-slider";
import { TurnTimer } from "./turn-timer";
import type { ActionType } from "@/lib/poker/game-rules";

export function ActionButtons() {
  const {
    room,
    hand,
    myPlayer,
    myPlayerHand,
    isMyTurn,
    sessionId,
    refetch,
    mutate,
  } = useGame();
  const [showRaiseSlider, setShowRaiseSlider] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const applyOptimisticAction = useCallback(
    (action: ActionType, amount?: number) => {
      if (!room || !hand || !myPlayer || !myPlayerHand) return;

      const playerId = myPlayer.id;
      const bigBlind = room.big_blind;

      mutate((prev) => {
        if (!prev.hand) return prev;
        const prevPlayer = prev.players.find((p) => p.id === playerId);
        const prevHand = prev.playerHands.find((ph) => ph.player_id === playerId);
        if (!prevPlayer || !prevHand) return prev;

        const currentBet = prev.hand.current_bet;
        const lastRaise = prev.hand.last_raise || bigBlind;
        const myBet = prevHand.current_bet;
        const chips = prevPlayer.chips;
        const contributed = prevHand.total_contributed ?? prevHand.current_bet;

        let newPot = prev.hand.pot;
        let newCurrentBet = currentBet;
        let newLastRaise = prev.hand.last_raise;
        let newChips = chips;
        let newPlayerBet = myBet;
        let newContribution = contributed;
        let isFolded = prevHand.is_folded;
        let isAllIn = prevHand.is_all_in;
        const hasActed = true;

        switch (action) {
          case "fold":
            isFolded = true;
            break;
          case "check":
            break;
          case "call": {
            if (amount === undefined) return prev;
            const toCall = Math.min(amount, chips);
            newChips -= toCall;
            newPlayerBet += toCall;
            newContribution += toCall;
            newPot += toCall;
            if (newChips === 0) isAllIn = true;
            break;
          }
          case "raise": {
            if (amount === undefined) return prev;
            const raiseAmount = amount - myBet;
            if (raiseAmount < 0) return prev;
            newChips -= raiseAmount;
            newPlayerBet = amount;
            newContribution += raiseAmount;
            newPot += raiseAmount;
            newLastRaise = amount - currentBet;
            newCurrentBet = amount;
            if (newChips === 0) isAllIn = true;
            break;
          }
          case "all_in": {
            const allInAmount = chips;
            newPot += allInAmount;
            newPlayerBet += allInAmount;
            newContribution += allInAmount;
            if (newPlayerBet > newCurrentBet) {
              const raiseIncrement = newPlayerBet - newCurrentBet;
              if (raiseIncrement > 0) {
                newLastRaise = raiseIncrement;
              }
              newCurrentBet = newPlayerBet;
            }
            newChips = 0;
            isAllIn = true;
            break;
          }
        }

        const nextPlayers = prev.players.map((p) =>
          p.id === playerId ? { ...p, chips: newChips } : p
        );
        const nextPlayerHands = prev.playerHands.map((ph) =>
          ph.player_id === playerId
            ? {
                ...ph,
                current_bet: newPlayerBet,
                total_contributed: newContribution,
                has_acted: hasActed,
                is_folded: isFolded,
                is_all_in: isAllIn,
              }
            : ph
        );
        const nextMyPlayerHand =
          nextPlayerHands.find((ph) => ph.player_id === playerId) || null;

        return {
          ...prev,
          hand: {
            ...prev.hand,
            pot: newPot,
            current_bet: newCurrentBet,
            last_raise: newLastRaise ?? lastRaise,
          },
          players: nextPlayers,
          playerHands: nextPlayerHands,
          myPlayerHand: nextMyPlayerHand,
        };
      });
    },
    [hand, myPlayer, myPlayerHand, mutate, room]
  );

  const handleTimeout = useCallback(async () => {
    if (!room || isSubmitting) return;
    setIsSubmitting(true);
    try {
      applyOptimisticAction("fold");
      const res = await fetch(`/api/room/${room.code}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          action: "fold",
        }),
      });
      if (!res.ok) {
        await refetch();
        return;
      }
      void refetch();
    } catch (error) {
      console.error("Auto-fold error:", error);
      await refetch();
    } finally {
      setIsSubmitting(false);
    }
  }, [applyOptimisticAction, room, sessionId, isSubmitting, refetch]);

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

  async function submitAction(action: ActionType, amount?: number) {
    setIsSubmitting(true);
    setShowRaiseSlider(false);

    try {
      applyOptimisticAction(action, amount);
      const res = await fetch(`/api/room/${room!.code}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          action,
          amount,
        }),
      });
      if (!res.ok) {
        await refetch();
        return;
      }
      void refetch();
    } catch (error) {
      console.error("Action error:", error);
      await refetch();
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
