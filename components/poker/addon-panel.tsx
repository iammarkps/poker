"use client";

import { useState, useEffect } from "react";
import { useGame } from "@/components/game/game-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

interface AddonRequestWithName {
  id: string;
  player_id: string;
  amount: number;
  status: string;
  playerName: string;
}

export function AddonPanel() {
  const { room, myPlayer, isHost, sessionId } = useGame();
  const [amount, setAmount] = useState<number>(0);
  const [isRequesting, setIsRequesting] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<AddonRequestWithName[]>([]);
  const [myPendingRequest, setMyPendingRequest] = useState<boolean>(false);
  const [showPanel, setShowPanel] = useState(false);

  useEffect(() => {
    if (!room || !sessionId) return;

    setAmount(room.starting_chips);

    const supabase = createClient();
    let isActive = true;

    // Fetch pending requests
    const fetchRequests = async () => {
      try {
        const { data: requests, error } = await supabase
          .from("addon_requests")
          .select("*")
          .eq("room_id", room.id)
          .eq("status", "pending");

        if (!isActive) return;

        if (error) {
          throw error;
        }

        const playerIds = requests?.map((r) => r.player_id) || [];
        let playersMap = new Map<string, string>();

        if (playerIds.length > 0) {
          const { data: players } = await supabase
            .from("players")
            .select("id, name")
            .in("id", playerIds);
          playersMap = new Map((players || []).map((p) => [p.id, p.name]));
        }

        const requestsWithNames = (requests || []).map((r) => ({
          ...r,
          playerName: playersMap.get(r.player_id) || "Unknown",
        }));

        setPendingRequests(requestsWithNames);
        if (myPlayer) {
          const myRequest = requestsWithNames.find(
            (r) => r.player_id === myPlayer.id
          );
          setMyPendingRequest(!!myRequest);
        }
      } catch (error) {
        console.error("Failed to fetch add-on requests:", error);
      }
    };

    void fetchRequests();

    const channel = supabase
      .channel(`addon:${room.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "addon_requests",
          filter: `room_id=eq.${room.id}`,
        },
        () => {
          fetchRequests();
        }
      )
      .subscribe();

    return () => {
      isActive = false;
      supabase.removeChannel(channel);
    };
  }, [room, sessionId, myPlayer]);

  if (!room || !myPlayer) return null;

  async function requestAddon() {
    if (!room || amount <= 0) return;
    setIsRequesting(true);

    try {
      const res = await fetch(`/api/room/${room.code}/addon`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, amount }),
      });

      if (res.ok) {
        setMyPendingRequest(true);
      }
    } catch (error) {
      console.error("Add-on request error:", error);
    } finally {
      setIsRequesting(false);
    }
  }

  async function handleRequest(requestId: string, approve: boolean) {
    if (!room) return;

    try {
      await fetch(`/api/room/${room.code}/addon`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, requestId, approve }),
      });

      // Remove from list
      setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));
    } catch (error) {
      console.error("Handle request error:", error);
    }
  }

  return (
    <div className="absolute top-4 left-4 z-10">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowPanel(!showPanel)}
        className="bg-gray-900/80 backdrop-blur text-white border-gray-700"
      >
        {isHost && pendingRequests.length > 0
          ? `Add-on (${pendingRequests.length})`
          : "Add-on"}
      </Button>

      {showPanel && (
        <div className="absolute top-10 left-0 bg-gray-900/95 backdrop-blur rounded-lg p-4 min-w-64 border border-gray-700">
          {isHost && pendingRequests.length > 0 && (
            <div className="mb-4">
              <h4 className="text-white font-semibold mb-2">Pending Requests</h4>
              <div className="space-y-2">
                {pendingRequests.map((request) => (
                  <div
                    key={request.id}
                    className="flex items-center justify-between bg-gray-800 rounded p-2"
                  >
                    <div className="text-white text-sm">
                      <span className="font-medium">{request.playerName}</span>
                      <span className="text-gray-400 ml-2">+{request.amount}</span>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleRequest(request.id, true)}
                      >
                        ✓
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleRequest(request.id, false)}
                      >
                        ✗
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h4 className="text-white font-semibold mb-2">Request Add-on</h4>
            {myPendingRequest ? (
              <p className="text-yellow-300 text-sm">
                Waiting for host approval...
              </p>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="w-24"
                    min={1}
                  />
                  <Button
                    onClick={requestAddon}
                    disabled={isRequesting || amount <= 0}
                    size="sm"
                  >
                    {isRequesting ? "..." : "Request"}
                  </Button>
                </div>
                <p className="text-gray-400 text-xs">
                  Current chips: {myPlayer.chips}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
