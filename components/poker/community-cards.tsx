"use client";

import { PlayingCard } from "./playing-card";

interface CommunityCardsProps {
  cards: string[];
}

export function CommunityCards({ cards }: CommunityCardsProps) {
  // Always show 5 card slots
  const displayCards = [...cards];
  while (displayCards.length < 5) {
    displayCards.push("");
  }

  return (
    <div className="flex gap-2 justify-center">
      {displayCards.map((card, index) => (
        <PlayingCard key={index} card={card || undefined} faceDown={!card} size="lg" />
      ))}
    </div>
  );
}
