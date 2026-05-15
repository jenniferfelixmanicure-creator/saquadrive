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
  };
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [mode, setModeState] = useState<AppMode | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const refreshingRef = useRef(false);

  useEffect(() => { loadSession(); }, []);

  async function loadSession() {
    try {
      const [storedUser, storedToken, storedRefresh, storedMode] = await Promise.all([
        AsyncStorage.getItem(USER_KEY),
        AsyncStorage.getItem(TOKEN_KEY),
        AsyncStorage.getItem(REFRESH_TOKEN_KEY),
        AsyncStorage.getItem(MODE_KEY),
      ]);

      let activeToken = storedToken;

      // Auto-renovar token se estiver expirando em menos de 24h
      if (storedToken && storedRefresh) {
        const expiry = decodeJwtExpiry(storedToken);
        const expiresIn = expiry ? expiry - Date.now() : 0;
        if (expiresIn < 24 * 60 * 60 * 1000) {
          try {
            const res = await fetch(`${API_URL}/api/auth/refresh`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ refreshToken: storedRefresh }),
            });
            if (res.ok) {
              const data = await res.json() as { token: string; refreshToken: string };
              activeToken = data.token;
              await Promise.all([
                AsyncStorage.setItem(TOKEN_KEY, data.token),
                AsyncStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken),
              ]);
              setRefreshToken(data.refreshToken);
            }
          } catch {
            // falha silenciosa — continua com token existente
          }
        } else {
          setRefreshToken(storedRefresh);
        }
      }

      if (storedUser) setUser(JSON.parse(storedUser));
      if (activeToken) setToken(activeToken);
      if (storedMode) setModeState(storedMode as AppMode);
    } catch {
      // ignore storage errors
    } finally {
      setIsLoading(false);
    }
  }

  // Wrapper de fetch que renova o token automaticamente em caso de 401
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
          // Repetir a requisição original com o novo token
          headers["Authorization"] = `Bearer ${data.token}`;
          res = await fetch(`${API_URL}${path}`, { ...options, headers });
        } else {
          // Refresh falhou — deslogar
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
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json() as AuthResponse & { message?: string };
    if (!res.ok) throw new Error(data.message ?? "Erro desconhecido");

    const userData: User = {
      id: data.user.id,
      name: data.user.name,
      email: data.user.email,
      phone: data.user.phone,
      isApproved: data.user.isApproved,
      rgStatus: data.user.rgStatus as User["rgStatus"],
      driverRating: 5.0,
      passengerRating: 5.0,
      totalRides: 0,
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
    setUser(userData);
    setToken(data.token);
  }

  async function register(name: string, email: string, phone: string, password: string) {
    const res = await fetch(`${API_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, phone, password }),
    });
    const data = await res.json() as AuthResponse & { message?: string };
    if (!res.ok) throw new Error(data.message ?? "Erro desconhecido");

    const userData: User = {
      id: data.user.id,
      name: data.user.name,
      email: data.user.email,
      phone: data.user.phone,
      isApproved: data.user.isApproved,
      rgStatus: data.user.rgStatus as User["rgStatus"],
      driverRating: 5.0,
      passengerRating: 5.0,
      totalRides: 0,
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
    setUser(userData);
    setToken(data.token);
  }

  async function logout() {
    await Promise.all([
      AsyncStorage.removeItem(USER_KEY),
      AsyncStorage.removeItem(TOKEN_KEY),
      AsyncStorage.removeItem(REFRESH_TOKEN_KEY),
      AsyncStorage.removeItem(MODE_KEY),
    ]);
    setUser(null);
    setToken(null);
    setRefreshToken(null);
    setModeState(null);
  }

  function setMode(m: AppMode) {
    setModeState(m);
    AsyncStorage.setItem(MODE_KEY, m);
  }

  async function updateUser(updates: Partial<User>) {
    if (!user) return;
    const updated = { ...user, ...updates };
    setUser(updated);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(updated));

    if (token && (updates.name || updates.phone)) {
      try {
        await apiFetch("/api/users/me", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: updates.name, phone: updates.phone }),
        });
      } catch {
        // falha silenciosa
      }
    }
  }

  async function updateUserDocuments(updates: Partial<User>) {
    if (!user) return;
    const updated = { ...user, ...updates };
    setUser(updated);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(updated));
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
