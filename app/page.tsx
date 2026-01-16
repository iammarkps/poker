"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreateRoomForm } from "@/components/lobby/create-room-form";
import { JoinRoomForm } from "@/components/lobby/join-room-form";

export default function HomePage() {
  const [mode, setMode] = useState<"select" | "create" | "join">("select");

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-green-900 to-green-950">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Texas Hold&apos;em</CardTitle>
          <CardDescription>Play poker with friends</CardDescription>
        </CardHeader>
        <CardContent>
          {mode === "select" && (
            <div className="space-y-3">
              <Button className="w-full" size="lg" onClick={() => setMode("create")}>
                Create Room
              </Button>
              <Button className="w-full" size="lg" variant="outline" onClick={() => setMode("join")}>
                Join Room
              </Button>
            </div>
          )}

          {mode === "create" && (
            <div className="space-y-4">
              <CreateRoomForm />
              <Button variant="ghost" className="w-full" onClick={() => setMode("select")}>
                Back
              </Button>
            </div>
          )}

          {mode === "join" && (
            <div className="space-y-4">
              <JoinRoomForm />
              <Button variant="ghost" className="w-full" onClick={() => setMode("select")}>
                Back
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
