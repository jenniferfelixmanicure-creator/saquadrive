import React, { createContext, useContext, useEffect, useState } from "react";
  import { API_URL, SOCKET_PATH } from "@/constants/api";
  import { useAuth } from "./AuthContext";

  type SocketContextType = {
    socket: unknown | null;
    connected: boolean;
  };

  const SocketContext = createContext<SocketContextType>({ socket: null, connected: false });

  export function SocketProvider({ children }: { children: React.ReactNode }) {
    const { token } = useAuth();
    const [socket, setSocket] = useState<unknown | null>(null);
    const [connected, setConnected] = useState(false);

    useEffect(() => {
      let s: { disconnect?: () => void; on?: (e: string, cb: (...a: unknown[]) => void) => void } | null = null;

      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { io } = require("socket.io-client") as { io: (url: string, opts: Record<string, unknown>) => typeof s };
        s = io(API_URL, {
          path: SOCKET_PATH,
          transports: ["websocket", "polling"],
          reconnectionAttempts: 10,
          reconnectionDelay: 3000,
          auth: token ? { token } : undefined,
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
    }, [token]);

    return (
      <SocketContext.Provider value={{ socket, connected }}>
        {children}
      </SocketContext.Provider>
    );
  }

  export const useSocket = () => useContext(SocketContext);
  