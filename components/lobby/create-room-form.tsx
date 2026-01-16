"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/hooks/use-session";

export function CreateRoomForm() {
  const router = useRouter();
  const sessionId = useSession();
  const [name, setName] = useState("");
  const [startingChips, setStartingChips] = useState("1000");
  const [smallBlind, setSmallBlind] = useState("10");
  const [bigBlind, setBigBlind] = useState("20");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!sessionId || !name.trim()) return;

    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/room/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          name: name.trim(),
          startingChips: parseInt(startingChips),
          smallBlind: parseInt(smallBlind),
          bigBlind: parseInt(bigBlind),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create room");
        return;
      }

      router.push(`/room/${data.code}`);
    } catch {
      setError("Failed to create room");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Your Name</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter your name"
          required
          maxLength={20}
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label htmlFor="startingChips">Starting Chips</Label>
          <Input
            id="startingChips"
            type="number"
            value={startingChips}
            onChange={(e) => setStartingChips(e.target.value)}
            min="100"
            max="100000"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="smallBlind">Small Blind</Label>
          <Input
            id="smallBlind"
            type="number"
            value={smallBlind}
            onChange={(e) => setSmallBlind(e.target.value)}
            min="1"
            max="1000"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bigBlind">Big Blind</Label>
          <Input
            id="bigBlind"
            type="number"
            value={bigBlind}
            onChange={(e) => setBigBlind(e.target.value)}
            min="2"
            max="2000"
          />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" className="w-full" disabled={isLoading || !sessionId}>
        {isLoading ? "Creating..." : "Create Room"}
      </Button>
    </form>
  );
}
