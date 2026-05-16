import AsyncStorage from "@react-native-async-storage/async-storage";
  import React, { createContext, useContext, useEffect, useRef, useState } from "react";
  import { API_URL } from "@/constants/api";

  export type AppMode = "passenger" | "driver";

  export type User = {
    id: string;
    name: string;
    email: string;
    phone: string;
    mode?: AppMode;
    driverRating?: number;
    passengerRating?: number;
    totalRides?: number;
    rgStatus?: "pending" | "approved" | "rejected";
    rgUrl?: string;
    cnhStatus?: "pending" | "approved" | "rejected";
    cnhUrl?: string;
    crlvStatus?: "pending" | "approved" | "rejected";
    crlvUrl?: string;
    vehiclePlate?: string;
    vehicleModel?: string;
    vehicleYear?: number;
    vehicleType?: "car" | "moto";
    isApproved?: boolean;
    subscriptionActive?: boolean;
    subscriptionExpiresAt?: string;
    profilePhotoUrl?: string;
  };

  type AuthContextType = {
    user: User | null;
    token: string | null;
    mode: AppMode | null;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (name: string, email: string, phone: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    setMode: (mode: AppMode) => void;
    updateUser: (updates: Partial<User>) => Promise<void>;
    updateUserDocuments: (updates: Partial<User>) => Promise<void>;
    apiFetch: (path: string, options?: RequestInit) => Promise<Response>;
  };

  const AuthContext = createContext<AuthContextType>({} as AuthContextType);

  const USER_KEY = "zerorisco_user";
  const TOKEN_KEY = "zerorisco_token";
  const REFRESH_TOKEN_KEY = "zerorisco_refresh_token";
  const MODE_KEY = "zerorisco_mode";

  function decodeJwtExpiry(token: string): number | null {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload.exp ? payload.exp * 1000 : null;
    } catch {
      return null;
    }
  }

  function fetchWithTimeout(url: string, opts: RequestInit, ms = 8000): Promise<Response> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(timer));
  }

  /** Executa uma promise com timeout absoluto. Nunca rejeita — retorna null se falhar ou timeout. */
  function withHardTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
    return Promise.race([
      promise.catch(() => null),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
    ]);
  }

  type AuthResponse = {
    token: string;
    refreshToken?: string;
    user: {
      id: string;
      name: string;
      email: string;
      phone: string;
      isApproved: boolean;
      rgStatus: string;
      profilePhotoUrl?: string;
    };
  };

  export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [refreshToken, setRefreshToken] = useState<string | null>(null);
    const [mode, setModeState] = useState<AppMode | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const refreshingRef = useRef(false);

    useEffect(() => {
      // Hard timeout: se loadSession travar por qualquer motivo, libera o app em 5s
      const giveUp = setTimeout(() => setIsLoading(false), 5000);
      loadSession().finally(() => {
        clearTimeout(giveUp);
        setIsLoading(false);
      });
    }, []);

    async function loadSession() {
      // Acorda o servidor Render — fire-and-forget com timeout CURTO (3s) para não bloquear o boot
      fetchWithTimeout(`${API_URL}/api/healthz`, {}, 3000).catch(() => {});

      try {
        const [storedUser, storedToken, storedRefresh, storedMode] = await Promise.all([
          AsyncStorage.getItem(USER_KEY),
          AsyncStorage.getItem(TOKEN_KEY),
          AsyncStorage.getItem(REFRESH_TOKEN_KEY),
          AsyncStorage.getItem(MODE_KEY),
        ]);

        let activeToken = storedToken;

        if (storedToken && storedRefresh) {
          const expiry = decodeJwtExpiry(storedToken);
          const expiresIn = expiry ? expiry - Date.now() : 0;

          if (expiresIn < 24 * 60 * 60 * 1000) {
            // Tenta renovar token com hard-timeout de 4.5s
            const refreshResult = await withHardTimeout(
              fetchWithTimeout(`${API_URL}/api/auth/refresh`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ refreshToken: storedRefresh }),
              }, 4000),
              4500
            );

            if (refreshResult && refreshResult.ok) {
              try {
                const data = await refreshResult.json() as { token: string; refreshToken: string };
                activeToken = data.token;
                await Promise.all([
                  AsyncStorage.setItem(TOKEN_KEY, data.token),
                  AsyncStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken),
                ]);
                setRefreshToken(data.refreshToken);
              } catch {}
            } else if (refreshResult && (refreshResult.status === 401 || refreshResult.status === 403)) {
              await Promise.all([
                AsyncStorage.removeItem(TOKEN_KEY),
                AsyncStorage.removeItem(REFRESH_TOKEN_KEY),
                AsyncStorage.removeItem(USER_KEY),
                AsyncStorage.removeItem(MODE_KEY),
              ]).catch(() => {});
              activeToken = null;
            } else if (!refreshResult && expiresIn <= 0) {
              activeToken = null;
            } else {
              setRefreshToken(storedRefresh ?? null);
            }
          } else {
            setRefreshToken(storedRefresh);
          }
        }

        if (storedUser) { try { setUser(JSON.parse(storedUser)); } catch {} }
        if (activeToken) setToken(activeToken);
        if (storedMode) setModeState(storedMode as AppMode);
      } catch {
        // Ignora erros de storage — app abre sem sessão
      }
    }

    async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
      const headers: Record<string, string> = {
        ...(options.headers as Record<string, string> ?? {}),
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      let res = await fetch(`${API_URL}${path}`, { ...options, headers });

      if (res.status === 401 && refreshToken && !refreshingRef.current) {
        refreshingRef.current = true;
        try {
          const refreshRes = await fetch(`${API_URL}/api/auth/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken }),
          });
          if (refreshRes.ok) {
            const data = await refreshRes.json() as { token: string; refreshToken: string };
            setToken(data.token);
            setRefreshToken(data.refreshToken);
            await Promise.all([
              AsyncStorage.setItem(TOKEN_KEY, data.token),
              AsyncStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken),
            ]);
            headers["Authorization"] = `Bearer ${data.token}`;
            res = await fetch(`${API_URL}${path}`, { ...options, headers });
          } else {
            await logout();
          }
        } catch {
          await logout();
        } finally {
          refreshingRef.current = false;
        }
      }

      return res;
    }

    async function login(email: string, password: string) {
      const res = await fetchWithTimeout(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      }, 15000);
      const data = await res.json() as AuthResponse & { message?: string };
      if (!res.ok) throw new Error(data.message ?? "Erro desconhecido");

      const userData: User = {
        id: data.user.id,
        name: data.user.name,
        email: data.user.email,
        phone: data.user.phone,
        isApproved: data.user.isApproved,
        rgStatus: data.user.rgStatus as User["rgStatus"],
        passengerRating: 5.0,
        profilePhotoUrl: data.user.profilePhotoUrl,
      };

      const saves = [
        AsyncStorage.setItem(USER_KEY, JSON.stringify(userData)),
        AsyncStorage.setItem(TOKEN_KEY, data.token),
      ];
      if (data.refreshToken) {
        saves.push(AsyncStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken));
        setRefreshToken(data.refreshToken);
      }
      await Promise.all(saves);
      try {
        const profileRes = await fetchWithTimeout(`${API_URL}/api/users/me`, {
          headers: { Authorization: `Bearer ${data.token}` },
        }, 8000);
        if (profileRes.ok) {
          const profile = await profileRes.json() as Partial<User>;
          Object.assign(userData, {
            driverRating: profile.driverRating,
            totalRides: profile.totalRides,
            cnhStatus: profile.cnhStatus,
            crlvStatus: profile.crlvStatus,
            rgStatus: profile.rgStatus ?? userData.rgStatus,
            vehiclePlate: profile.vehiclePlate,
            vehicleModel: profile.vehicleModel,
          });
          await AsyncStorage.setItem(USER_KEY, JSON.stringify(userData));
        }
      } catch { /* silencioso */ }
      setUser(userData);
      setToken(data.token);
    }

    async function register(name: string, email: string, phone: string, password: string) {
      const res = await fetchWithTimeout(`${API_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, password }),
      }, 15000);
      const data = await res.json() as AuthResponse & { message?: string };
      if (!res.ok) throw new Error(data.message ?? "Erro desconhecido");

      const userData: User = {
        id: data.user.id,
        name: data.user.name,
        email: data.user.email,
        phone: data.user.phone,
        isApproved: data.user.isApproved,
        rgStatus: data.user.rgStatus as User["rgStatus"],
        passengerRating: 5.0,
        profilePhotoUrl: data.user.profilePhotoUrl,
      };

      const saves = [
        AsyncStorage.setItem(USER_KEY, JSON.stringify(userData)),
        AsyncStorage.setItem(TOKEN_KEY, data.token),
      ];
      if (data.refreshToken) {
        saves.push(AsyncStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken));
        setRefreshToken(data.refreshToken);
      }
      await Promise.all(saves);
      try {
        const profileRes = await fetchWithTimeout(`${API_URL}/api/users/me`, {
          headers: { Authorization: `Bearer ${data.token}` },
        }, 8000);
        if (profileRes.ok) {
          const profile = await profileRes.json() as Partial<User>;
          Object.assign(userData, {
            driverRating: profile.driverRating,
            totalRides: profile.totalRides,
            cnhStatus: profile.cnhStatus,
            crlvStatus: profile.crlvStatus,
            rgStatus: profile.rgStatus ?? userData.rgStatus,
            vehiclePlate: profile.vehiclePlate,
            vehicleModel: profile.vehicleModel,
          });
          await AsyncStorage.setItem(USER_KEY, JSON.stringify(userData));
        }
      } catch { /* silencioso */ }
      setUser(userData);
      setToken(data.token);
    }

    async function logout() {
      await Promise.all([
        AsyncStorage.removeItem(USER_KEY),
        AsyncStorage.removeItem(TOKEN_KEY),
        AsyncStorage.removeItem(REFRESH_TOKEN_KEY),
        AsyncStorage.removeItem(MODE_KEY),
      ]).catch(() => {});
      setUser(null);
      setToken(null);
      setRefreshToken(null);
      setModeState(null);
    }

    function setMode(m: AppMode) {
      setModeState(m);
      AsyncStorage.setItem(MODE_KEY, m).catch(() => {});
    }

    async function updateUser(updates: Partial<User>) {
      if (!user) return;
      const updated = { ...user, ...updates };
      setUser(updated);
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(updated)).catch(() => {});
      if (token && (updates.name || updates.phone)) {
        try {
          await apiFetch("/api/users/me", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: updates.name, phone: updates.phone }),
          });
        } catch {}
      }
    }

    async function updateUserDocuments(updates: Partial<User>) {
      if (!user) return;
      const updated = { ...user, ...updates };
      setUser(updated);
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(updated)).catch(() => {});
    }

    return (
      <AuthContext.Provider
        value={{ user, token, mode, isLoading, login, register, logout, setMode, updateUser, updateUserDocuments, apiFetch }}
      >
        {children}
      </AuthContext.Provider>
    );
  }

  export const useAuth = () => useContext(AuthContext);
  