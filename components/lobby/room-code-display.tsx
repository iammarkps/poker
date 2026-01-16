"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";

interface RoomCodeDisplayProps {
  code: string;
}

export function RoomCodeDisplay({ code }: RoomCodeDisplayProps) {
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center gap-2 p-4 bg-muted rounded-lg">
      <div className="flex-1">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">Room Code</p>
        <p className="text-3xl font-mono font-bold tracking-widest">{code}</p>
      </div>
      <Button variant="outline" size="icon" onClick={copyCode}>
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      </Button>
    </div>
  );
}
