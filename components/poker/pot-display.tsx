"use client";

interface PotDisplayProps {
  pot: number;
  currentBet?: number;
}

export function PotDisplay({ pot, currentBet }: PotDisplayProps) {
  return (
    <div className="text-center space-y-1">
      <div className="text-white text-lg font-bold">Pot: {pot}</div>
      {currentBet !== undefined && currentBet > 0 && (
        <div className="text-green-300 text-sm">Current Bet: {currentBet}</div>
      )}
    </div>
  );
}
