"use client";

import { useState, useEffect } from "react";

interface SessionTimerProps {
  startTime?: Date;
}

export function SessionTimer({ startTime }: SessionTimerProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = startTime || new Date();

    const interval = setInterval(() => {
      const now = new Date();
      const diff = Math.floor((now.getTime() - start.getTime()) / 1000);
      setElapsed(diff);
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);
  const seconds = elapsed % 60;

  const format = (n: number) => n.toString().padStart(2, "0");

  return (
    <div className="bg-gray-900/80 backdrop-blur px-3 py-1.5 rounded-lg text-white text-sm font-mono">
      {hours > 0 ? `${format(hours)}:` : ""}
      {format(minutes)}:{format(seconds)}
    </div>
  );
}
