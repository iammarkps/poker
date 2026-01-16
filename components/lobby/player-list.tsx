"use client";

import { Badge } from "@/components/ui/badge";
import type { Player } from "@/lib/supabase/types";

interface PlayerListProps {
  players: Player[];
  hostSessionId: string;
  currentSessionId: string | null;
}

export function PlayerList({ players, hostSessionId, currentSessionId }: PlayerListProps) {
  const sortedPlayers = [...players].sort((a, b) => (a.seat ?? 0) - (b.seat ?? 0));

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Players ({players.length}/9)
      </p>
      <ul className="space-y-2">
        {sortedPlayers.map((player) => (
          <li
            key={player.id}
            className="flex items-center justify-between p-3 bg-muted rounded-lg"
          >
            <div className="flex items-center gap-2">
              <span
                className={`size-2 rounded-full ${
                  player.is_connected ? "bg-green-500" : "bg-gray-400"
                }`}
              />
              <span className="font-medium">
                {player.name}
                {player.session_id === currentSessionId && " (You)"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {player.session_id === hostSessionId && (
                <Badge variant="secondary">Host</Badge>
              )}
              <span className="text-sm text-muted-foreground">
                Seat {(player.seat ?? 0) + 1}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
