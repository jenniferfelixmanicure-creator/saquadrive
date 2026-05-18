import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { API_URL } from "@/constants/api";

const ADMIN_KEY = "saquadrive_admin_secret";

type UserDetail = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  isApproved: boolean | null;
  profilePhotoUrl: string | null;
  totalRides: number | null;
  driverRating: number | null;
  passengerRating: number | null;
  rgStatus: string | null;
  cnhStatus: string | null;
  crlvStatus: string | null;
  vehiclePlate: string | null;
  vehicleModel: string | null;
  vehicleType: string | null;
  vehicleColor: string | null;
  vehicleYear: number | null;
  subscriptionActive: boolean | null;
  subscriptionExpiresAt: string | null;
  createdAt: string | null;
};

function InfoRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value ?? "—"}</Text>
    </View>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  const label = status === "approved" ? "Aprovado" : status === "rejected" ? "Rejeitado" : "Pendente";
  const bg = status === "approved" ? "#16a34a22" : status === "rejected" ? "#dc262622" : "#d9770622";
  const color = status === "approved" ? "#16a34a" : status === "rejected" ? "#dc2626" : "#d97706";
  const icon = status === "approved" ? "check-circle" : status === "rejected" ? "x-circle" : "clock";
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Feather name={icon as "check-circle"} size={11} color={color} />
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

export default function UserDetailScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const params = useLocalSearchParams<{ userId: string; adminSecret: string }>();
  const [adminSecret, setAdminSecret] = useState(params.adminSecret ?? "");
  const [data, setData] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!adminSecret) {
      AsyncStorage.getItem(ADMIN_KEY).then((v) => { if (v) setAdminSecret(v); });
    }
  }, [adminSecret]);

  const fetchUser = useCallback(async () => {
    if (!adminSecret) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/users`, {
        headers: { "x-admin-secret": adminSecret },
      });
      const all = await res.json() as UserDetail[];
      const found = all.find((u) => String(u.id) === String(params.userId));
      if (found) setData(found);
      else Alert.alert("Erro", "Usuário não encontrado.");
    } catch {
      Alert.alert("Erro", "Não foi possível carregar dados.");
    } finally {
      setLoading(false);
    }
  }, [adminSecret, params.userId]);

  useEffect(() => { if (adminSecret) fetchUser(); }, [fetchUser, adminSecret]);

  const roleLabel = data?.role === "driver" ? "Motorista" : data?.role === "admin" ? "Admin" : "Passageiro";
  const roleColor = data?.role === "driver" ? "#0ea5e9" : data?.role === "admin" ? "#6366f1" : "#16a34a";
  const initials = (data?.name ?? "U").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  const joinedAt = data?.createdAt ? new Date(data.createdAt).toLocaleDateString("pt-BR") : "—";

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#f1f5f9" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Detalhes do Usuário</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#6366f1" size="large" />
        </View>
      ) : !data ? (
        <View style={styles.center}>
          <Feather name="user-x" size={40} color="#475569" />
          <Text style={styles.emptyText}>Usuário não encontrado</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Profile card */}
          <View style={styles.profileCard}>
            <View style={[styles.avatar, { backgroundColor: roleColor + "22" }]}>
              {data.profilePhotoUrl ? (
                <Image
                  source={{ uri: data.profilePhotoUrl.startsWith("/uploads/") ? `${API_URL}${data.profilePhotoUrl}` : data.profilePhotoUrl }}
                  style={styles.avatarImg}
                />
              ) : (
                <Text style={[styles.avatarText, { color: roleColor }]}>{initials}</Text>
              )}
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={styles.profileName}>{data.name}</Text>
              <View style={[styles.roleBadge, { backgroundColor: roleColor + "22" }]}>
                <Feather name={data.role === "driver" ? "truck" : data.role === "admin" ? "shield" : "user"} size={12} color={roleColor} />
                <Text style={[styles.roleText, { color: roleColor }]}>{roleLabel}</Text>
              </View>
              <Text style={styles.profileSub}>Membro desde {joinedAt}</Text>
            </View>
          </View>

          {/* Contact info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>INFORMAÇÕES DE CONTATO</Text>
            <InfoRow label="E-mail" value={data.email} />
            <InfoRow label="Telefone" value={data.phone} />
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={[styles.statBox, { borderColor: "#6366f133" }]}>
              <Text style={[styles.statValue, { color: "#6366f1" }]}>{data.totalRides ?? 0}</Text>
              <Text style={styles.statLabel}>Corridas</Text>
            </View>
            <View style={[styles.statBox, { borderColor: "#f59e0b33" }]}>
              <Text style={[styles.statValue, { color: "#f59e0b" }]}>{Number(data.passengerRating ?? 5).toFixed(1)}</Text>
              <Text style={styles.statLabel}>Nota passageiro</Text>
            </View>
            {data.role === "driver" && (
              <View style={[styles.statBox, { borderColor: "#0ea5e933" }]}>
                <Text style={[styles.statValue, { color: "#0ea5e9" }]}>{Number(data.driverRating ?? 5).toFixed(1)}</Text>
                <Text style={styles.statLabel}>Nota motorista</Text>
              </View>
            )}
          </View>

          {/* Driver-specific: vehicle + documents */}
          {data.role === "driver" && (
            <>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>VEÍCULO</Text>
                <View style={styles.vehicleGrid}>
                  <View style={styles.vehicleCell}>
                    <Text style={styles.vehicleLabel}>Modelo</Text>
                    <Text style={styles.vehicleValue}>{data.vehicleModel || "—"}</Text>
                  </View>
                  <View style={styles.vehicleCell}>
                    <Text style={styles.vehicleLabel}>Placa</Text>
                    <Text style={styles.vehicleValue}>{data.vehiclePlate || "—"}</Text>
                  </View>
                  <View style={styles.vehicleCell}>
                    <Text style={styles.vehicleLabel}>Tipo</Text>
                    <Text style={styles.vehicleValue}>
                      {data.vehicleType === "moto" ? "Moto" : data.vehicleType === "car" ? "Carro" : "—"}
                    </Text>
                  </View>
                  <View style={styles.vehicleCell}>
                    <Text style={styles.vehicleLabel}>Cor</Text>
                    <Text style={styles.vehicleValue}>{data.vehicleColor || "—"}</Text>
                  </View>
                  <View style={styles.vehicleCell}>
                    <Text style={styles.vehicleLabel}>Ano</Text>
                    <Text style={styles.vehicleValue}>{data.vehicleYear ?? "—"}</Text>
                  </View>
                  <View style={styles.vehicleCell}>
                    <Text style={styles.vehicleLabel}>Status</Text>
                    <Text style={[styles.vehicleValue, { color: data.isApproved ? "#16a34a" : "#d97706" }]}>
                      {data.isApproved ? "Aprovado" : "Pendente"}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>DOCUMENTOS</Text>
                <View style={styles.docRow}>
                  <View style={styles.docItem}>
                    <Text style={styles.docLabel}>RG</Text>
                    <StatusBadge status={data.rgStatus} />
                  </View>
                  <View style={styles.docItem}>
                    <Text style={styles.docLabel}>CNH</Text>
                    <StatusBadge status={data.cnhStatus} />
                  </View>
                  <View style={styles.docItem}>
                    <Text style={styles.docLabel}>CRLV</Text>
                    <StatusBadge status={data.crlvStatus} />
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.reviewBtn}
                  onPress={() => router.push({ pathname: "/(admin)/driver-review", params: { driverId: String(data.id), adminSecret } })}
                  activeOpacity={0.85}
                >
                  <Feather name="file-text" size={16} color="#fff" />
                  <Text style={styles.reviewBtnText}>Revisar documentos completo</Text>
                  <Feather name="chevron-right" size={16} color="#fff" />
                </TouchableOpacity>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>ASSINATURA</Text>
                <View style={styles.subscriptionRow}>
                  <View style={[styles.subBadge, { backgroundColor: data.subscriptionActive ? "#16a34a22" : "#dc262622" }]}>
                    <Feather name={data.subscriptionActive ? "check-circle" : "x-circle"} size={14} color={data.subscriptionActive ? "#16a34a" : "#dc2626"} />
                    <Text style={[styles.subBadgeText, { color: data.subscriptionActive ? "#16a34a" : "#dc2626" }]}>
                      {data.subscriptionActive ? "Ativa" : "Inativa"}
                    </Text>
                  </View>
                  {data.subscriptionExpiresAt && (
                    <Text style={styles.subExpiry}>
                      Expira: {new Date(data.subscriptionExpiresAt).toLocaleDateString("pt-BR")}
                    </Text>
                  )}
                </View>
              </View>
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyText: { fontSize: 15, fontFamily: "Inter_500Medium", color: "#475569" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 14, paddingTop: 10,
    borderBottomWidth: 1, borderBottomColor: "#1e293b",
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#f1f5f9" },
  content: { padding: 16, gap: 14 },
  profileCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: "#1e293b", borderRadius: 16, padding: 16,
  },
  avatar: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  avatarImg: { width: 64, height: 64, borderRadius: 32 },
  avatarText: { fontSize: 22, fontFamily: "Inter_700Bold" },
  profileName: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#f1f5f9" },
  profileSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#64748b" },
  roleBadge: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  roleText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  section: { backgroundColor: "#1e293b", borderRadius: 14, padding: 16, gap: 12 },
  sectionTitle: { fontSize: 11, fontFamily: "Inter_700Bold", color: "#475569", letterSpacing: 0.8, textTransform: "uppercase" },
  infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 },
  infoLabel: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#64748b" },
  infoValue: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#e2e8f0", maxWidth: "60%", textAlign: "right" },
  statsRow: { flexDirection: "row", gap: 10 },
  statBox: { flex: 1, backgroundColor: "#1e293b", borderRadius: 12, padding: 14, alignItems: "center", borderWidth: 1, gap: 4 },
  statValue: { fontSize: 22, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#64748b", textAlign: "center" },
  vehicleGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  vehicleCell: { width: "30%", gap: 3 },
  vehicleLabel: { fontSize: 10, fontFamily: "Inter_500Medium", color: "#64748b", textTransform: "uppercase" },
  vehicleValue: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#e2e8f0" },
  docRow: { flexDirection: "row", gap: 10 },
  docItem: { flex: 1, alignItems: "center", gap: 6 },
  docLabel: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#94a3b8" },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  reviewBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#6366f1", borderRadius: 12, height: 46,
  },
  reviewBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff", flex: 1, textAlign: "center" },
  subscriptionRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  subBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  subBadgeText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  subExpiry: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#64748b" },
});
