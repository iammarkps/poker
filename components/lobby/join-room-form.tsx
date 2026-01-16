"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/hooks/use-session";

export function JoinRoomForm() {
  const router = useRouter();
  const sessionId = useSession();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!sessionId || !name.trim() || !code.trim()) return;

    setIsLoading(true);
    setError("");

    const roomCode = code.trim().toUpperCase();

    try {
      const res = await fetch(`/api/room/${roomCode}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          name: name.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to join room");
        return;
      }

      router.push(`/room/${roomCode}`);
    } catch {
      setError("Failed to join room");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="join-name">Your Name</Label>
        <Input
          id="join-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter your name"
          required
          maxLength={20}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="code">Room Code</Label>
        <Input
          id="code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Enter 6-character code"
          required
          maxLength={6}
          className="uppercase tracking-widest text-center font-mono text-lg"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" className="w-full" disabled={isLoading || !sessionId}>
        {isLoading ? "Joining..." : "Join Room"}
      </Button>
    </form>
  );
}
