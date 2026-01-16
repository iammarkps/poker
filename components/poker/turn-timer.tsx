"use client";

import { useState, useEffect, useCallback } from "react";
import { useGame } from "@/components/game/game-provider";

const TURN_TIME = 30; // 30 seconds per turn

interface TurnTimerProps {
  onTimeout: () => void;
}

export function TurnTimer({ onTimeout }: TurnTimerProps) {
  const { hand, myPlayer, isMyTurn } = useGame();
  const [timeLeft, setTimeLeft] = useState(TURN_TIME);
  const [usingTimeBank, setUsingTimeBank] = useState(false);

  const handleTimeout = useCallback(() => {
    onTimeout();
  }, [onTimeout]);

  useEffect(() => {
    if (!isMyTurn || !hand || hand.phase === "showdown") {
      const resetId = setTimeout(() => {
        setTimeLeft(TURN_TIME);
        setUsingTimeBank(false);
      }, 0);
      return () => clearTimeout(resetId);
    }

    const turnStart = hand.turn_start_time
      ? new Date(hand.turn_start_time).getTime()
      : Date.now();

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.floor((now - turnStart) / 1000);
      const remaining = TURN_TIME - elapsed;

      if (remaining <= 0) {
        // Start using time bank
        const timeBankUsed = Math.abs(remaining);
        const timeBank = myPlayer?.time_bank || 0;

        if (timeBankUsed >= timeBank) {
          // Time's up - auto fold
          clearInterval(interval);
          handleTimeout();
          return;
        }

        setUsingTimeBank(true);
        setTimeLeft(timeBank - timeBankUsed);
      } else {
        setUsingTimeBank(false);
        setTimeLeft(remaining);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isMyTurn, hand, myPlayer?.time_bank, handleTimeout]);

  if (!isMyTurn || !hand || hand.phase === "showdown") {
    return null;
  }

  const percentage = usingTimeBank
    ? (timeLeft / (myPlayer?.time_bank || 3)) * 100
    : (timeLeft / TURN_TIME) * 100;

  return (
    <div className="w-full max-w-md mx-auto mb-2">
      <div className="flex justify-between text-xs text-white/70 mb-1">
        <span>{usingTimeBank ? "TIME BANK" : "TIME LEFT"}</span>
        <span>
          {timeLeft}s {usingTimeBank && `(+${myPlayer?.time_bank || 0}s bank)`}
        </span>
      </div>
      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-100 ${
            usingTimeBank
              ? "bg-orange-500"
              : timeLeft <= 5
              ? "bg-red-500"
              : timeLeft <= 10
              ? "bg-yellow-500"
              : "bg-green-500"
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
