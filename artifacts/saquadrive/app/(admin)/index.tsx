import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { API_URL } from "@/constants/api";

const ADMIN_KEY = "saquadrive_admin_secret";

type Stats = {
  totalUsers: number;
  pendingDrivers: number;
  totalRides: number;
  totalRevenue: number;
};

type Driver = {
  id: number;
  name: string;
  email: string;
  phone: string;
  isApproved: boolean | null;
  rgStatus: string | null;
  cnhStatus: string | null;
  crlvStatus: string | null;
  vehiclePlate: string | null;
  vehicleModel: string | null;
  vehicleType: string | null;
  profilePhotoUrl: string | null;
  driverRating: number | null;
  totalRides: number | null;
  createdAt: string | null;
};

type User = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  isApproved: boolean | null;
  totalRides: number | null;
  passengerRating: number | null;
  driverRating: number | null;
  createdAt: string | null;
};

function StatusBadge({ status }: { status: string | null }) {
  const label = status === "approved" ? "aprovado" : status === "rejected" ? "rejeitado" : "pendente";
  const bg = status === "approved" ? "#16a34a22" : status === "rejected" ? "#dc262622" : "#d9770622";
  const color = status === "approved" ? "#16a34a" : status === "rejected" ? "#dc2626" : "#d97706";
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color }]}>{label.toUpperCase()}</Text>
    </View>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [secret, setSecret] = useState<string | null>(null);
  const [secretInput, setSecretInput] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [checkingStorage, setCheckingStorage] = useState(true);

  const [stats, setStats] = useState<Stats | null>(null);
  const [pendingDrivers, setPendingDrivers] = useState<Driver[]>([]);
  const [allDrivers, setAllDrivers] = useState<Driver[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<"pending" | "drivers" | "users">("pending");

  useEffect(() => {
    AsyncStorage.getItem(ADMIN_KEY).then((val) => {
      if (val) setSecret(val);
      setCheckingStorage(false);
    });
  }, []);

  const fetchData = useCallback(async (adminSecret: string) => {
    setLoading(true);
    try {
      const headers = { "x-admin-secret": adminSecret };
      const [statsRes, pendingRes, allRes, usersRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/stats`, { headers }),
        fetch(`${API_URL}/api/admin/drivers/pending`, { headers }),
        fetch(`${API_URL}/api/admin/drivers/all`, { headers }),
        fetch(`${API_URL}/api/admin/users`, { headers }),
      ]);

      if (statsRes.status === 401) {
        await AsyncStorage.removeItem(ADMIN_KEY);
        setSecret(null);
        Alert.alert("Acesso negado", "Senha admin inválida.");
        return;
      }

      const statsData = await statsRes.json() as Stats;
      const pendingData = await pendingRes.json() as Driver[];
      const allData = await allRes.json() as Driver[];
      const usersData = await usersRes.json() as User[];

      setStats(statsData);
      setPendingDrivers(Array.isArray(pendingData) ? pendingData : []);
      setAllDrivers(Array.isArray(allData) ? allData : []);
      setAllUsers(Array.isArray(usersData) ? usersData : []);
    } catch {
      Alert.alert("Erro", "Não foi possível carregar dados.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (secret) fetchData(secret);
  }, [secret, fetchData]);

  async function handleLogin() {
    if (!secretInput.trim()) return;
    setLoginLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/stats`, {
        headers: { "x-admin-secret": secretInput.trim() },
      });
      if (res.status === 401) { Alert.alert("Acesso negado", "Senha incorreta."); return; }
      await AsyncStorage.setItem(ADMIN_KEY, secretInput.trim());
      setSecret(secretInput.trim());
    } catch {
      Alert.alert("Erro", "Não foi possível conectar ao servidor.");
    } finally {
      setLoginLoading(false);
    }
  }

  function handleLogout() {
    Alert.alert("Sair do painel admin", "Confirma?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Sair", style: "destructive", onPress: async () => {
        await AsyncStorage.removeItem(ADMIN_KEY);
        setSecret(null); setSecretInput("");
      }},
    ]);
  }

  if (checkingStorage) return <View style={styles.center}><ActivityIndicator color="#6366f1" size="large" /></View>;

  if (!secret) {
    return (
      <View style={[styles.loginContainer, { paddingTop: topPad + 24 }]}>
        <View style={styles.loginCard}>
          <View style={[styles.loginIcon, { backgroundColor: "#6366f122" }]}>
            <Feather name="shield" size={32} color="#6366f1" />
          </View>
          <Text style={styles.loginTitle}>Painel Admin</Text>
          <Text style={styles.loginSubtitle}>Zerorisco — Área Restrita</Text>
          <TextInput
            style={styles.loginInput}
            value={secretInput}
            onChangeText={setSecretInput}
            placeholder="Senha de administrador"
            placeholderTextColor="#6b7280"
            secureTextEntry autoCapitalize="none" returnKeyType="done"
            onSubmitEditing={handleLogin}
          />
          <TouchableOpacity
            style={[styles.loginBtn, loginLoading && { opacity: 0.7 }]}
            onPress={handleLogin} disabled={loginLoading} activeOpacity={0.85}
          >
            {loginLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginBtnText}>Entrar</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
            <Text style={{ color: "#6b7280", fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" }}>Voltar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  function renderDriver({ item }: { item: Driver }) {
    const allApproved = item.cnhStatus === "approved" && item.crlvStatus === "approved" && item.rgStatus === "approved";
    const anyRejected = item.cnhStatus === "rejected" || item.crlvStatus === "rejected" || item.rgStatus === "rejected";
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.8}
        onPress={() => router.push({ pathname: "/(admin)/driver-review", params: { driverId: String(item.id), adminSecret: secret! } })}
      >
        <View style={[styles.cardAvatar, { backgroundColor: allApproved ? "#16a34a22" : anyRejected ? "#dc262622" : "#6366f122" }]}>
          <Text style={[styles.cardAvatarText, { color: allApproved ? "#16a34a" : anyRejected ? "#dc2626" : "#6366f1" }]}>
            {item.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
          </Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardName}>{item.name}</Text>
          <Text style={styles.cardSub}>
            {[item.vehicleModel, item.vehiclePlate].filter(Boolean).join(" · ") || item.email}
          </Text>
          <View style={styles.docBadges}>
            {(["RG", "CNH", "CRLV"] as const).map((doc, i) => {
              const status = i === 0 ? item.rgStatus : i === 1 ? item.cnhStatus : item.crlvStatus;
              return (
                <View key={doc} style={styles.docBadgeRow}>
                  <Text style={styles.docBadgeLabel}>{doc}</Text>
                  <StatusBadge status={status} />
                </View>
              );
            })}
          </View>
        </View>
        <Feather name="chevron-right" size={18} color="#6b7280" />
      </TouchableOpacity>
    );
  }

  function renderUser({ item }: { item: User }) {
    const roleLabel = item.role === "driver" ? "Motorista" : item.role === "admin" ? "Admin" : "Passageiro";
    const roleColor = item.role === "driver" ? "#0ea5e9" : item.role === "admin" ? "#6366f1" : "#16a34a";
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.8}
        onPress={() => router.push({ pathname: "/(admin)/user-detail", params: { userId: String(item.id), adminSecret: secret! } })}
      >
        <View style={[styles.cardAvatar, { backgroundColor: roleColor + "22" }]}>
          <Text style={[styles.cardAvatarText, { color: roleColor }]}>
            {item.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
          </Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardName}>{item.name}</Text>
          <Text style={styles.cardSub}>{item.email}</Text>
          <View style={styles.userMeta}>
            <View style={[styles.userRoleBadge, { backgroundColor: roleColor + "22" }]}>
              <Text style={[styles.userRoleText, { color: roleColor }]}>{roleLabel}</Text>
            </View>
            <Text style={styles.userStatText}>{item.totalRides ?? 0} corridas</Text>
          </View>
        </View>
        <Feather name="chevron-right" size={18} color="#6b7280" />
      </TouchableOpacity>
    );
  }

  const displayedDrivers = tab === "pending" ? pendingDrivers : allDrivers;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Painel Admin</Text>
          <Text style={styles.headerSub}>Zerorisco</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Feather name="log-out" size={18} color="#dc2626" />
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <View style={styles.center}><ActivityIndicator color="#6366f1" size="large" /></View>
      ) : (
        <FlatList
          data={tab === "users" ? allUsers : displayedDrivers}
          keyExtractor={(item) => String(item.id)}
          renderItem={tab === "users" ? renderUser : renderDriver}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchData(secret!); }}
              tintColor="#6366f1"
            />
          }
          ListHeaderComponent={
            <View>
              {stats && (
                <View style={styles.statsGrid}>
                  <StatCard label="Usuários" value={Number(stats.totalUsers)} color="#6366f1" />
                  <StatCard label="Motoristas" value={allDrivers.length} color="#0ea5e9" />
                  <StatCard label="Pendentes" value={Number(stats.pendingDrivers)} color="#d97706" />
                  <StatCard label="Corridas" value={Number(stats.totalRides)} color="#16a34a" />
                </View>
              )}
              <View style={styles.tabs}>
                <TouchableOpacity style={[styles.tabBtn, tab === "pending" && styles.tabBtnActive]} onPress={() => setTab("pending")}>
                  <Text style={[styles.tabBtnText, tab === "pending" && styles.tabBtnTextActive]}>
                    Pendentes ({pendingDrivers.length})
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tabBtn, tab === "drivers" && styles.tabBtnActive]} onPress={() => setTab("drivers")}>
                  <Text style={[styles.tabBtnText, tab === "drivers" && styles.tabBtnTextActive]}>
                    Motoristas ({allDrivers.length})
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tabBtn, tab === "users" && styles.tabBtnActive]} onPress={() => setTab("users")}>
                  <Text style={[styles.tabBtnText, tab === "users" && styles.tabBtnTextActive]}>
                    Usuários ({allUsers.length})
                  </Text>
                </TouchableOpacity>
              </View>
              {((tab === "users" && allUsers.length === 0) || (tab !== "users" && displayedDrivers.length === 0)) && (
                <View style={styles.emptyState}>
                  <Feather name="inbox" size={40} color="#334155" />
                  <Text style={styles.emptyText}>
                    {tab === "pending" ? "Nenhum motorista pendente" : tab === "drivers" ? "Nenhum motorista" : "Nenhum usuário"}
                  </Text>
                </View>
              )}
            </View>
          }
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0f172a" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingBottom: 16, paddingTop: 12,
    borderBottomWidth: 1, borderBottomColor: "#1e293b",
  },
  headerTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#f8fafc" },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6b7280", marginTop: 2 },
  logoutBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: "#dc262611", alignItems: "center", justifyContent: "center" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 },
  statCard: { flex: 1, minWidth: "44%", backgroundColor: "#1e293b", borderRadius: 12, padding: 14, borderLeftWidth: 3 },
  statValue: { fontSize: 26, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#94a3b8", marginTop: 2 },
  tabs: { flexDirection: "row", marginHorizontal: 16, marginTop: 16, marginBottom: 8, backgroundColor: "#1e293b", borderRadius: 10, padding: 4 },
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  tabBtnActive: { backgroundColor: "#6366f1" },
  tabBtnText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#64748b" },
  tabBtnTextActive: { color: "#fff" },
  emptyState: { alignItems: "center", paddingVertical: 48, gap: 12 },
  emptyText: { fontSize: 15, fontFamily: "Inter_500Medium", color: "#6b7280" },
  card: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: 16, marginBottom: 10,
    backgroundColor: "#1e293b", borderRadius: 14, padding: 14, gap: 12,
  },
  cardAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  cardAvatarText: { fontSize: 17, fontFamily: "Inter_700Bold" },
  cardInfo: { flex: 1, gap: 4 },
  cardName: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#f1f5f9" },
  cardSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#94a3b8" },
  docBadges: { flexDirection: "row", gap: 8, marginTop: 4, flexWrap: "wrap" },
  docBadgeRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  docBadgeLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#64748b" },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  badgeText: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  userMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  userRoleBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  userRoleText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  userStatText: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#64748b" },
  loginContainer: { flex: 1, backgroundColor: "#0f172a", alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  loginCard: { width: "100%", maxWidth: 360, backgroundColor: "#1e293b", borderRadius: 20, padding: 28, alignItems: "center", gap: 12 },
  loginIcon: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  loginTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#f8fafc" },
  loginSubtitle: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#6b7280", marginBottom: 8 },
  loginInput: { width: "100%", height: 50, borderRadius: 12, backgroundColor: "#0f172a", borderWidth: 1, borderColor: "#334155", paddingHorizontal: 16, fontSize: 15, fontFamily: "Inter_400Regular", color: "#f1f5f9" },
  loginBtn: { width: "100%", height: 50, borderRadius: 12, backgroundColor: "#6366f1", alignItems: "center", justifyContent: "center" },
  loginBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
});
