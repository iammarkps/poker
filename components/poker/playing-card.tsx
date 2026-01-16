"use client";

import { cn } from "@/lib/utils";

interface PlayingCardProps {
  card?: string; // e.g., "As", "Kh", "2c", "Td"
  faceDown?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SUIT_SYMBOLS: Record<string, string> = {
  s: "\u2660", // spades
  h: "\u2665", // hearts
  d: "\u2666", // diamonds
  c: "\u2663", // clubs
};

const SUIT_COLORS: Record<string, string> = {
  s: "text-gray-900",
  h: "text-red-600",
  d: "text-red-600",
  c: "text-gray-900",
};

const SIZE_CLASSES = {
  sm: "w-8 h-12 text-xs",
  md: "w-12 h-18 text-sm",
  lg: "w-16 h-24 text-base",
};

export function PlayingCard({
  card,
  faceDown = false,
  size = "md",
  className,
}: PlayingCardProps) {
  if (faceDown || !card) {
    return (
      <div
        className={cn(
          "rounded-md border-2 border-gray-300 bg-gradient-to-br from-blue-600 to-blue-800 shadow-md flex items-center justify-center",
          SIZE_CLASSES[size],
          className
        )}
      >
        <div className="w-3/4 h-3/4 border border-blue-400 rounded-sm opacity-50" />
      </div>
    );
  }

  const rank = card.slice(0, -1);
  const suit = card.slice(-1).toLowerCase();
  const suitSymbol = SUIT_SYMBOLS[suit] || "";
  const suitColor = SUIT_COLORS[suit] || "text-gray-900";

  return (
    <div
      className={cn(
        "rounded-md border border-gray-300 bg-white shadow-md flex flex-col items-center justify-center font-bold",
        SIZE_CLASSES[size],
        suitColor,
        className
      )}
    >
      <span className="leading-none">{rank}</span>
      <span className="leading-none">{suitSymbol}</span>
    </div>
  );
}
