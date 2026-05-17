import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
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

type DriverDetail = {
  driver: {
    id: number;
    userId: number;
    cnhStatus: string | null;
    cnhUrl: string | null;
    crlvStatus: string | null;
    crlvUrl: string | null;
    vehiclePlate: string;
    vehicleModel: string;
    vehicleType: string;
    vehicleColor: string | null;
    vehicleYear: number | null;
    rating: string | null;
    totalRides: number | null;
    isApproved: boolean | null;
    createdAt: string | null;
  };
  user: {
    id: number;
    name: string;
    email: string;
    phone: string;
    rgStatus: string | null;
    rgUrl: string | null;
    profilePhotoUrl: string | null;
  };
};

type DocStatus = "pending" | "approved" | "rejected" | null;

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

type DocCardProps = {
  title: string;
  subtitle: string;
  status: string | null;
  docUrl: string | null;
  onApprove: () => void;
  onReject: () => void;
  loading: boolean;
};

function DocCard({ title, subtitle, status, docUrl, onApprove, onReject, loading }: DocCardProps) {
  const [imgVisible, setImgVisible] = useState(false);
  const fullUrl = docUrl ? `${API_URL}${docUrl}` : null;

  return (
    <View style={styles.docCard}>
      <View style={styles.docCardHeader}>
        <View style={{ gap: 2 }}>
          <Text style={styles.docTitle}>{title}</Text>
          <Text style={styles.docSubtitle}>{subtitle}</Text>
        </View>
        <StatusBadge status={status} />
      </View>

      {fullUrl && (
        <>
          <TouchableOpacity
            style={styles.viewDocBtn}
            onPress={() => setImgVisible(true)}
            activeOpacity={0.8}
          >
            <Feather name="eye" size={15} color="#0ea5e9" />
            <Text style={styles.viewDocText}>Ver documento</Text>
          </TouchableOpacity>

          <Modal visible={imgVisible} transparent animationType="fade">
            <View style={styles.modalOverlay}>
              <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setImgVisible(false)} />
              <View style={styles.modalContent}>
                <Image
                  source={{ uri: fullUrl }}
                  style={styles.docImage}
                  resizeMode="contain"
                />
                <TouchableOpacity
                  style={styles.modalClose}
                  onPress={() => setImgVisible(false)}
                >
                  <Feather name="x" size={20} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.openExternalBtn}
                  onPress={() => Linking.openURL(fullUrl)}
                >
                  <Feather name="external-link" size={14} color="#fff" />
                  <Text style={styles.openExternalText}>Abrir externamente</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </>
      )}

      {!fullUrl && (
        <View style={styles.noDocBox}>
          <Feather name="upload" size={18} color="#475569" />
          <Text style={styles.noDocText}>Documento não enviado</Text>
        </View>
      )}

      {status !== "approved" && status !== "rejected" && (
        <View style={styles.docActions}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.approveBtn, loading && { opacity: 0.6 }]}
            onPress={onApprove}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Feather name="check" size={15} color="#fff" />
                <Text style={styles.actionBtnText}>Aprovar</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.rejectBtn, loading && { opacity: 0.6 }]}
            onPress={onReject}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Feather name="x" size={15} color="#fff" />
                <Text style={styles.actionBtnText}>Rejeitar</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {(status === "approved" || status === "rejected") && (
        <TouchableOpacity
          style={[styles.actionBtn, status === "approved" ? styles.rejectBtn : styles.approveBtn, { alignSelf: "flex-start" }]}
          onPress={status === "approved" ? onReject : onApprove}
          disabled={loading}
          activeOpacity={0.85}
        >
          <Feather name={status === "approved" ? "x" : "check"} size={14} color="#fff" />
          <Text style={styles.actionBtnText}>{status === "approved" ? "Reverter aprovação" : "Reverter rejeição"}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function DriverReviewScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const params = useLocalSearchParams<{ driverId: string; userId: string; adminSecret: string }>();

  const driverId = params.driverId;
  const userId = params.userId;

  const [adminSecret, setAdminSecret] = useState<string>(params.adminSecret ?? "");
  const [data, setData] = useState<DriverDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [globalLoading, setGlobalLoading] = useState(false);

  useEffect(() => {
    if (!adminSecret) {
      AsyncStorage.getItem(ADMIN_KEY).then((v) => { if (v) setAdminSecret(v); });
    }
  }, [adminSecret]);

  const fetchDriver = useCallback(async () => {
    if (!adminSecret) return;
    setLoading(true);
    try {
      const headers = { "x-admin-secret": adminSecret };
      const res = await fetch(`${API_URL}/api/admin/drivers/all`, { headers });
      const all = await res.json() as DriverDetail[];
      const found = all.find((d) => String(d.driver.id) === driverId && String(d.user.id) === userId);
      if (found) setData(found);
    } catch {
      Alert.alert("Erro", "Não foi possível carregar dados do motorista.");
    } finally {
      setLoading(false);
    }
  }, [adminSecret, driverId, userId]);

  useEffect(() => { fetchDriver(); }, [fetchDriver]);

  async function callApi(path: string, method = "POST", body?: object) {
    const res = await fetch(`${API_URL}${path}`, {
      method,
      headers: { "x-admin-secret": adminSecret, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    return res.json() as Promise<{ message?: string }>;
  }

  async function handleDoc(action: string, label: string) {
    setActionLoading(action);
    try {
      const data = await callApi(`/api/admin/${action}`);
      Alert.alert("Sucesso", data.message ?? label);
      await fetchDriver();
    } catch {
      Alert.alert("Erro", "Não foi possível executar a ação.");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleApproveAll() {
    Alert.alert("Aprovar tudo", `Aprovar todos os documentos e liberar o motorista ${data?.user.name}?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Aprovar tudo",
        onPress: async () => {
          setGlobalLoading(true);
          try {
            await callApi(`/api/admin/drivers/${driverId}/approve`);
            Alert.alert("Motorista aprovado!", "O motorista agora pode aceitar corridas.");
            await fetchDriver();
          } catch {
            Alert.alert("Erro", "Não foi possível aprovar o motorista.");
          } finally {
            setGlobalLoading(false);
          }
        },
      },
    ]);
  }

  async function handleRejectAll() {
    Alert.alert("Rejeitar motorista", `Rejeitar ${data?.user.name} e bloquear acesso?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Rejeitar",
        style: "destructive",
        onPress: async () => {
          setGlobalLoading(true);
          try {
            await callApi(`/api/admin/drivers/${driverId}/reject`);
            Alert.alert("Motorista rejeitado.", "O motorista foi bloqueado.");
            await fetchDriver();
          } catch {
            Alert.alert("Erro", "Não foi possível rejeitar o motorista.");
          } finally {
            setGlobalLoading(false);
          }
        },
      },
    ]);
  }

  const d = data?.driver;
  const u = data?.user;
  const allApproved = d?.cnhStatus === "approved" && d?.crlvStatus === "approved" && u?.rgStatus === "approved";

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#f1f5f9" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Análise do Motorista</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#6366f1" size="large" />
        </View>
      ) : !data ? (
        <View style={styles.center}>
          <Text style={{ color: "#94a3b8", fontFamily: "Inter_400Regular" }}>Motorista não encontrado.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.profileCard}>
            <View style={[styles.avatar, { backgroundColor: allApproved ? "#16a34a22" : "#6366f122" }]}>
              {u!.profilePhotoUrl ? (
                <Image
                  source={{ uri: u!.profilePhotoUrl.startsWith("/uploads/") ? `${API_URL}${u!.profilePhotoUrl}` : u!.profilePhotoUrl }}
                  style={styles.avatarImage}
                />
              ) : (
                <Text style={[styles.avatarText, { color: allApproved ? "#16a34a" : "#6366f1" }]}>
                  {u!.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                </Text>
              )}
            </View>
            <View style={{ gap: 4 }}>
              <Text style={styles.profileName}>{u!.name}</Text>
              <Text style={styles.profileSub}>{u!.email}</Text>
              <Text style={styles.profileSub}>{u!.phone}</Text>
            </View>
          </View>

          <View style={styles.vehicleCard}>
            <Text style={styles.sectionTitle}>VEÍCULO</Text>
            <View style={styles.vehicleRow}>
              <View style={styles.vehicleField}>
                <Text style={styles.vehicleLabel}>Modelo</Text>
                <Text style={styles.vehicleValue}>{d!.vehicleModel || "—"}</Text>
              </View>
              <View style={styles.vehicleField}>
                <Text style={styles.vehicleLabel}>Placa</Text>
                <Text style={styles.vehicleValue}>{d!.vehiclePlate || "—"}</Text>
              </View>
              <View style={styles.vehicleField}>
                <Text style={styles.vehicleLabel}>Tipo</Text>
                <Text style={styles.vehicleValue}>{d!.vehicleType || "—"}</Text>
              </View>
            </View>
            <View style={styles.vehicleRow}>
              <View style={styles.vehicleField}>
                <Text style={styles.vehicleLabel}>Cor</Text>
                <Text style={styles.vehicleValue}>{d!.vehicleColor || "—"}</Text>
              </View>
              <View style={styles.vehicleField}>
                <Text style={styles.vehicleLabel}>Ano</Text>
                <Text style={styles.vehicleValue}>{d!.vehicleYear ?? "—"}</Text>
              </View>
              <View style={styles.vehicleField}>
                <Text style={styles.vehicleLabel}>Corridas</Text>
                <Text style={styles.vehicleValue}>{d!.totalRides ?? 0}</Text>
              </View>
            </View>
          </View>

          <Text style={[styles.sectionTitle, { paddingHorizontal: 4, marginTop: 8 }]}>DOCUMENTOS</Text>

          <DocCard
            title="RG — Documento de Identidade"
            subtitle="Exigido para todos os motoristas"
            status={u!.rgStatus}
            docUrl={u!.rgUrl}
            loading={actionLoading === `rg-approve` || actionLoading === `rg-reject`}
            onApprove={() => handleDoc(`users/${userId}/approve-rg`, "RG aprovado.")}
            onReject={() => handleDoc(`users/${userId}/reject-rg`, "RG rejeitado.")}
          />

          <DocCard
            title="CNH — Carteira de Habilitação"
            subtitle="Exigida para motoristas"
            status={d!.cnhStatus}
            docUrl={d!.cnhUrl}
            loading={actionLoading === `cnh-approve` || actionLoading === `cnh-reject`}
            onApprove={() => handleDoc(`drivers/${driverId}/approve-cnh`, "CNH aprovada.")}
            onReject={() => handleDoc(`drivers/${driverId}/reject-cnh`, "CNH rejeitada.")}
          />

          <DocCard
            title="CRLV — Documento do Veículo"
            subtitle="Certificado de registro e licenciamento"
            status={d!.crlvStatus}
            docUrl={d!.crlvUrl}
            loading={actionLoading === `crlv-approve` || actionLoading === `crlv-reject`}
            onApprove={() => handleDoc(`drivers/${driverId}/approve-crlv`, "CRLV aprovado.")}
            onReject={() => handleDoc(`drivers/${driverId}/reject-crlv`, "CRLV rejeitado.")}
          />

          <View style={styles.globalActions}>
            <TouchableOpacity
              style={[styles.globalBtn, styles.globalApprove, globalLoading && { opacity: 0.6 }]}
              onPress={handleApproveAll}
              disabled={globalLoading}
              activeOpacity={0.85}
            >
              {globalLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Feather name="check-circle" size={18} color="#fff" />
                  <Text style={styles.globalBtnText}>Aprovar motorista completo</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.globalBtn, styles.globalReject, globalLoading && { opacity: 0.6 }]}
              onPress={handleRejectAll}
              disabled={globalLoading}
              activeOpacity={0.85}
            >
              {globalLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Feather name="x-circle" size={18} color="#fff" />
                  <Text style={styles.globalBtnText}>Rejeitar e bloquear</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 14, paddingTop: 10,
    borderBottomWidth: 1, borderBottomColor: "#1e293b",
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#f1f5f9" },

  content: { padding: 16, gap: 14 },

  profileCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#1e293b", borderRadius: 14, padding: 16, gap: 14,
  },
  avatar: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center" },
  avatarImage: { width: 60, height: 60, borderRadius: 30 },
  avatarText: { fontSize: 20, fontFamily: "Inter_700Bold" },
  profileName: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#f1f5f9" },
  profileSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#94a3b8" },

  vehicleCard: { backgroundColor: "#1e293b", borderRadius: 14, padding: 16, gap: 12 },
  sectionTitle: {
    fontSize: 11, fontFamily: "Inter_700Bold",
    color: "#475569", letterSpacing: 0.8, textTransform: "uppercase",
  },
  vehicleRow: { flexDirection: "row", gap: 12 },
  vehicleField: { flex: 1, gap: 2 },
  vehicleLabel: { fontSize: 10, fontFamily: "Inter_500Medium", color: "#64748b", textTransform: "uppercase" },
  vehicleValue: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#e2e8f0" },

  docCard: { backgroundColor: "#1e293b", borderRadius: 14, padding: 16, gap: 12 },
  docCardHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  docTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#f1f5f9" },
  docSubtitle: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#64748b" },

  badge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontFamily: "Inter_700Bold" },

  viewDocBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#0ea5e911", paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 8, alignSelf: "flex-start",
  },
  viewDocText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#0ea5e9" },

  noDocBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#0f172a", borderRadius: 8, padding: 12,
  },
  noDocText: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#475569" },

  docActions: { flexDirection: "row", gap: 10 },
  actionBtn: {
    flex: 1, height: 40, borderRadius: 10,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
  },
  approveBtn: { backgroundColor: "#16a34a" },
  rejectBtn: { backgroundColor: "#dc2626" },
  actionBtnText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#fff" },

  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.92)",
    alignItems: "center", justifyContent: "center",
  },
  modalContent: { width: "90%", maxHeight: "85%", position: "relative" },
  docImage: { width: "100%", height: 500, borderRadius: 12 },
  modalClose: {
    position: "absolute", top: -14, right: -14,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "#1e293b", alignItems: "center", justifyContent: "center",
  },
  openExternalBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    marginTop: 12, paddingVertical: 10, backgroundColor: "#1e293b", borderRadius: 10,
  },
  openExternalText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff" },

  globalActions: { gap: 10, marginTop: 4 },
  globalBtn: {
    height: 52, borderRadius: 14,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
  },
  globalApprove: { backgroundColor: "#16a34a" },
  globalReject: { backgroundColor: "#dc2626" },
  globalBtnText: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#fff" },
});
