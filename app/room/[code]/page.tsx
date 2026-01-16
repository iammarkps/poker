import { GameProvider } from "@/components/game/game-provider";
import { RoomContent } from "./room-content";

interface RoomPageProps {
  params: Promise<{ code: string }>;
}

export default async function RoomPage({ params }: RoomPageProps) {
  const { code } = await params;

  return (
    <GameProvider roomCode={code.toUpperCase()}>
      <RoomContent />
    </GameProvider>
  );
}
