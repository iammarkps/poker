"use client";

interface PotDisplayProps {
  pot: number;
  currentBet?: number;
  myBet?: number;
}

export function PotDisplay({ pot, currentBet, myBet }: PotDisplayProps) {
  const toCall = currentBet && myBet !== undefined ? currentBet - myBet : 0;
  // Pot odds calculation: if you call, the pot will be pot + toCall
  // But to show the full picture: 2*B + P where B is the call amount, P is current pot
  const effectivePot = toCall > 0 ? pot + 2 * toCall : pot;

  return (
    <div className="text-center space-y-1">
      <div className="text-white text-lg font-bold">Pot: {pot}</div>
      {currentBet !== undefined && currentBet > 0 && (
        <>
          <div className="text-green-300 text-sm">Current Bet: {currentBet}</div>
          {toCall > 0 && (
            <div className="text-yellow-300 text-xs">
              Effective Pot: {effectivePot}
            </div>
          )}
        </>
      )}
    </div>
  );
}
