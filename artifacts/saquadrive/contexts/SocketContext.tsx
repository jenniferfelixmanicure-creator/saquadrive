import React, { createContext, useContext, useEffect, useRef, useState } from "react";
  import { API_URL, SOCKET_PATH } from "@/constants/api";
  import { useAuth } from "./AuthContext";

  type SocketContextType = {
    socket: unknown | null;
    connected: boolean;
  };

  const SocketContext = createContext<SocketContextType>({ socket: null, connected: false });

  export function SocketProvider({ children }: { children: React.ReactNode }) {
    const { token } = useAuth();
    const tokenRef = useRef<string | null>(token);
    const [socket, setSocket] = useState<unknown | null>(null);
    const [connected, setConnected] = useState(false);

    tokenRef.current = token;

    const isLoggedIn = !!token;

    useEffect(() => {
      let s: { disconnect?: () => void; on?: (e: string, cb: (...a: unknown[]) => void) => void; auth?: Record<string, string> } | null = null;

      if (!isLoggedIn) {
        setSocket(null);
        setConnected(false);
        return;
      }

      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { io } = require("socket.io-client") as { io: (url: string, opts: Record<string, unknown>) => typeof s };
        s = io(API_URL, {
          path: SOCKET_PATH,
          transports: ["websocket", "polling"],
          reconnectionAttempts: 10,
          reconnectionDelay: 3000,
          auth: { token: tokenRef.current ?? "" },
          timeout: 10000,
        });

        s?.on?.("connect", () => setConnected(true));
        s?.on?.("disconnect", () => setConnected(false));
        s?.on?.("connect_error", (err: unknown) => {
          console.warn("[Socket] Erro de conexão:", (err as Error)?.message ?? err);
        });

        setSocket(s);
      } catch (err) {
        console.warn("[Socket] Falha ao inicializar socket.io:", (err as Error)?.message ?? err);
      }

      return () => {
        try { s?.disconnect?.(); } catch {}
        setSocket(null);
        setConnected(false);
      };
    }, [isLoggedIn]);

    useEffect(() => {
      if (socket && token) {
        (socket as { auth: Record<string, string> }).auth = { token };
      }
    }, [socket, token]);

    return (
      <SocketContext.Provider value={{ socket, connected }}>
        {children}
      </SocketContext.Provider>
    );
  }

  export const useSocket = () => useContext(SocketContext);
  