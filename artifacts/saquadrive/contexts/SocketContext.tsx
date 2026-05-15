import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { API_URL, SOCKET_PATH } from "@/constants/api";
import { useAuth } from "./AuthContext";

type SocketContextType = {
  socket: Socket | null;
  connected: boolean;
};

const SocketContext = createContext<SocketContextType>({ socket: null, connected: false });

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const s = io(API_URL, {
      path: SOCKET_PATH,
      transports: ["websocket", "polling"],
      reconnectionAttempts: 15,
      reconnectionDelay: 2000,
      auth: token ? { token } : undefined,
      timeout: 10000,
    });

    s.on("connect", () => {
      setConnected(true);
    });
    s.on("disconnect", () => {
      setConnected(false);
    });
    s.on("connect_error", (err) => {
      console.warn("[Socket] Erro:", err.message);
    });

    setSocket(s);

    return () => {
      s.disconnect();
      setSocket(null);
      setConnected(false);
    };
  }, [token]);

  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);
