import { useEffect, useState } from "react";
import { joinCommunity, joinCommunityAck, leaveCommunity, onRoomError, offRoomError } from "../lib/socket";

export function useCommunityRoom(communityId: string | undefined) {
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    if (!communityId) return;
    let mounted = true;
    setJoinError(null);
    setJoined(false);

    // Attempt ack-based join for immediate feedback
    joinCommunityAck(communityId)
      .then((res) => {
        if (!mounted) return;
        if (res.ok) setJoined(true);
        else if (res.error === "join-denied") setJoinError("You don’t have access to this community.");
      })
      .catch(() => {
        // Fallback to fire-and-forget join
        joinCommunity(communityId);
      });

    const roomErrHandler = (err: any) => {
      if (err?.communityId === communityId && err?.type === "join-denied") {
        setJoinError("You don’t have access to this community.");
        setJoined(false);
      }
    };

    onRoomError(roomErrHandler);

    return () => {
      mounted = false;
      try { offRoomError(roomErrHandler); } catch {}
      try { if (communityId) leaveCommunity(communityId); } catch {}
    };
  }, [communityId]);

  return { joinError, joined } as const;
}