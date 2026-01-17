"use client";

interface PotDisplayProps {
  pot: number;
  currentBet?: number;
  myBet?: number;
}

export function PotDisplay({ pot, currentBet, myBet }: PotDisplayProps) {
  const toCall = currentBet && myBet !== undefined ? currentBet - myBet : 0;
  // Effective pot = what you're playing for if you call
  // pot already includes opponent's bet, so total = pot + your call
  const effectivePot = pot + toCall;
  // Pot odds: you risk toCall to win effectivePot
  const potOdds = toCall > 0 ? (effectivePot / toCall).toFixed(1) : null;

  return (
    <div className="text-center space-y-1">
      <div className="text-white text-lg font-bold">Pot: {pot}</div>
      {currentBet !== undefined && currentBet > 0 && (
        <>
          <div className="text-green-300 text-sm">To Call: {toCall}</div>
          {toCall > 0 && (
            <div className="text-yellow-300 text-xs">
              Pot if call: {effectivePot} ({potOdds}:1 odds)
            </div>
          )}
        </>
      )}
    </div>
  );
}
