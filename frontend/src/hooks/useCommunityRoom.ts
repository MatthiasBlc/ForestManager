import { useEffect } from "react";
import { useSocket } from "../contexts/SocketContext";

export function useCommunityRoom(communityId: string | undefined) {
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket || !communityId) return;

    socket.emit("join:community", communityId);
    return () => {
      socket.emit("leave:community", communityId);
    };
  }, [socket, communityId]);
}
