"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface BetSliderProps {
  minBet: number;
  maxBet: number;
  currentBet: number;
  smallBlind?: number;
  facingBet?: boolean;
  onBet: (amount: number) => void;
  onCancel: () => void;
}

export function BetSlider({
  minBet,
  maxBet,
  currentBet,
  smallBlind = 10,
  facingBet = true,
  onBet,
  onCancel,
}: BetSliderProps) {
  const [amount, setAmount] = useState(minBet);

  // When facing a bet (post-flop), use 33%, 50%, 100%, ALL IN
  // Otherwise use Min, 1/2 Pot, Pot, All In
  const presetAmounts = facingBet
    ? [
        { label: "33%", value: Math.max(Math.floor(currentBet * 0.33), minBet) },
        { label: "50%", value: Math.max(Math.floor(currentBet * 0.5), minBet) },
        { label: "100%", value: Math.max(currentBet, minBet) },
        { label: "All In", value: maxBet },
      ]
    : [
        { label: "Min", value: minBet },
        { label: "1/2 Pot", value: Math.max(Math.floor(currentBet / 2), minBet) },
        { label: "Pot", value: Math.max(currentBet, minBet) },
        { label: "All In", value: maxBet },
      ];

  return (
    <div className="bg-gray-900 rounded-lg p-4 space-y-4 w-full max-w-md mx-auto">
      <div className="flex gap-2">
        {presetAmounts.map((preset) => (
          <Button
            key={preset.label}
            variant="outline"
            size="sm"
            className="flex-1 text-xs"
            onClick={() => setAmount(Math.min(preset.value, maxBet))}
            disabled={preset.value > maxBet}
          >
            {preset.label}
          </Button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <input
          type="range"
          min={minBet}
          max={maxBet}
          step={smallBlind}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
        />
        <Input
          type="number"
          value={amount}
          onChange={(e) => {
            const val = Number(e.target.value);
            if (val >= minBet && val <= maxBet) {
              // Round to nearest small blind
              const rounded = Math.round(val / smallBlind) * smallBlind;
              setAmount(Math.max(minBet, Math.min(rounded, maxBet)));
            }
          }}
          className="w-20 text-center"
          min={minBet}
          max={maxBet}
          step={smallBlind}
        />
      </div>

      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button className="flex-1" onClick={() => onBet(amount)}>
          Raise to {amount}
        </Button>
      </div>
    </div>
  );
}
