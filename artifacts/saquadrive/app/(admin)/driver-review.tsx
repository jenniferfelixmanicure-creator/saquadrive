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
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { API_URL } from "@/constants/api";

const ADMIN_KEY = "saquadrive_admin_secret";

type DriverDetail = {
  id: number;
  name: string;
  email: string;
  phone: string;
  isApproved: boolean | null;
  rgStatus: string | null;
  cnhStatus: string | null;
  crlvStatus: string | null;
  rgUrl: string | null;
  cnhUrl: string | null;
  crlvUrl: string | null;
  vehiclePlate: string | null;
  vehicleModel: string | null;
  vehicleType: string | null;
  vehicleColor: string | null;
  vehicleYear: number | null;
  profilePhotoUrl: string | null;
  driverRating: number | null;
  totalRides: number | null;
  createdAt: string | null;
};

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
  const fullUrl = docUrl ? (docUrl.startsWith("http") ? docUrl : `${API_URL}${docUrl}`) : null;

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
  const params = useLocalSearchParams<{ driverId: string; adminSecret: string }>();

  const driverId = params.driverId;

  const [adminSecret, setAdminSecret] = useState<string>(params.adminSecret ?? "");
  const [data, setData] = useState<DriverDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [globalLoading, setGlobalLoading] = useState(false);

  const [editingVehicle, setEditingVehicle] = useState(false);
  const [vehicleForm, setVehicleForm] = useState({
    vehicleModel: "", vehiclePlate: "", vehicleColor: "",
    vehicleType: "car", vehicleYear: "",
  });
  const [vehicleSaving, setVehicleSaving] = useState(false);

  useEffect(() => {
    if (!adminSecret) {
      AsyncStorage.getItem(ADMIN_KEY).then((v) => { if (v) setAdminSecret(v); });
    }
  }, [adminSecret]);

  function startVehicleEdit() {
    if (!data) return;
    setVehicleForm({
      vehicleModel: data.vehicleModel ?? "",
      vehiclePlate: data.vehiclePlate ?? "",
      vehicleColor: data.vehicleColor ?? "",
      vehicleType: data.vehicleType ?? "car",
      vehicleYear: data.vehicleYear ? String(data.vehicleYear) : "",
    });
    setEditingVehicle(true);
  }

  async function handleSaveVehicle() {
    setVehicleSaving(true);
    try {
      const payload: Record<string, string | number> = {};
      if (vehicleForm.vehicleModel.trim()) payload.vehicleModel = vehicleForm.vehicleModel.trim();
      if (vehicleForm.vehiclePlate.trim()) payload.vehiclePlate = vehicleForm.vehiclePlate.trim().toUpperCase();
      if (vehicleForm.vehicleColor.trim()) payload.vehicleColor = vehicleForm.vehicleColor.trim();
      if (vehicleForm.vehicleType) payload.vehicleType = vehicleForm.vehicleType;
      const year = parseInt(vehicleForm.vehicleYear);
      if (!isNaN(year) && year > 1900) payload.vehicleYear = year;

      const res = await fetch(`${API_URL}/api/admin/drivers/${driverId}/vehicle`, {
        method: "PATCH",
        headers: { "x-admin-secret": adminSecret, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json() as { message?: string };
      if (!res.ok) {
        Alert.alert("Erro", json.message ?? "Não foi possível salvar.");
        return;
      }
      Alert.alert("Salvo!", "Dados do veículo atualizados com sucesso.");
      setEditingVehicle(false);
      await fetchDriver();
    } catch {
      Alert.alert("Erro", "Falha de conexão.");
    } finally {
      setVehicleSaving(false);
    }
  }

  const fetchDriver = useCallback(async () => {
    if (!adminSecret) return;
    setLoading(true);
    try {
      const headers = { "x-admin-secret": adminSecret };
      const res = await fetch(`${API_URL}/api/admin/drivers/all`, { headers });
      const all = await res.json() as DriverDetail[];
      const found = all.find((d) => String(d.id) === driverId);
      if (found) setData(found);
    } catch {
      Alert.alert("Erro", "Não foi possível carregar dados do motorista.");
    } finally {
      setLoading(false);
    }
  }, [adminSecret, driverId]);

  useEffect(() => { fetchDriver(); }, [fetchDriver]);

  async function handleDocStatus(
    field: "rgStatus" | "cnhStatus" | "crlvStatus",
    status: "approved" | "rejected",
    label: string,
  ) {
    const key = `${field}-${status}`;
    setActionLoading(key);
    try {
      const res = await fetch(`${API_URL}/api/admin/drivers/${driverId}/approve`, {
        method: "PATCH",
        headers: { "x-admin-secret": adminSecret, "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: status }),
      });
      const json = await res.json() as { message?: string };
      Alert.alert("Sucesso", json.message ?? label);
      await fetchDriver();
    } catch {
      Alert.alert("Erro", "Não foi possível executar a ação.");
    } finally {
      setActionLoading(null);
    }
  }

  async function callApi(path: string, method = "POST") {
    const res = await fetch(`${API_URL}${path}`, {
      method,
      headers: { "x-admin-secret": adminSecret, "Content-Type": "application/json" },
    });
    return res.json() as Promise<{ message?: string }>;
  }

  async function handleApproveAll() {
    Alert.alert("Aprovar tudo", `Aprovar todos os documentos e liberar o motorista ${data?.name}?`, [
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
    Alert.alert("Rejeitar motorista", `Rejeitar ${data?.name} e bloquear acesso?`, [
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

  const allApproved = data?.cnhStatus === "approved" && data?.crlvStatus === "approved" && data?.rgStatus === "approved";

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
              {data.profilePhotoUrl ? (
                <Image
                  source={{ uri: data.profilePhotoUrl.startsWith("/uploads/") ? `${API_URL}${data.profilePhotoUrl}` : data.profilePhotoUrl }}
                  style={styles.avatarImage}
                />
              ) : (
                <Text style={[styles.avatarText, { color: allApproved ? "#16a34a" : "#6366f1" }]}>
                  {data.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                </Text>
              )}
            </View>
            <View style={{ gap: 4 }}>
              <Text style={styles.profileName}>{data.name}</Text>
              <Text style={styles.profileSub}>{data.email}</Text>
              <Text style={styles.profileSub}>{data.phone}</Text>
            </View>
          </View>

          <View style={styles.vehicleCard}>
            <View style={styles.vehicleCardHeader}>
              <Text style={styles.sectionTitle}>VEÍCULO</Text>
              {!editingVehicle && (
                <TouchableOpacity style={styles.editVehicleBtn} onPress={startVehicleEdit} activeOpacity={0.8}>
                  <Feather name="edit-2" size={13} color="#6366f1" />
                  <Text style={styles.editVehicleBtnText}>Editar</Text>
                </TouchableOpacity>
              )}
            </View>

            {editingVehicle ? (
              <View style={{ gap: 10 }}>
                <View style={styles.vehicleRow}>
                  <View style={{ flex: 2 }}>
                    <Text style={styles.vehicleLabel}>MODELO</Text>
                    <TextInput
                      style={styles.vehicleInput}
                      value={vehicleForm.vehicleModel}
                      onChangeText={(v) => setVehicleForm(f => ({ ...f, vehicleModel: v }))}
                      placeholder="Ex: Fiat Uno 2020"
                      placeholderTextColor="#475569"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.vehicleLabel}>PLACA</Text>
                    <TextInput
                      style={styles.vehicleInput}
                      value={vehicleForm.vehiclePlate}
                      onChangeText={(v) => setVehicleForm(f => ({ ...f, vehiclePlate: v.toUpperCase() }))}
                      placeholder="ABC1D23"
                      placeholderTextColor="#475569"
                      autoCapitalize="characters"
                      maxLength={8}
                    />
                  </View>
                </View>

                <View style={styles.vehicleRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.vehicleLabel}>COR</Text>
                    <TextInput
                      style={styles.vehicleInput}
                      value={vehicleForm.vehicleColor}
                      onChangeText={(v) => setVehicleForm(f => ({ ...f, vehicleColor: v }))}
                      placeholder="Ex: Branco"
                      placeholderTextColor="#475569"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.vehicleLabel}>ANO</Text>
                    <TextInput
                      style={styles.vehicleInput}
                      value={vehicleForm.vehicleYear}
                      onChangeText={(v) => setVehicleForm(f => ({ ...f, vehicleYear: v }))}
                      placeholder="2022"
                      placeholderTextColor="#475569"
                      keyboardType="numeric"
                      maxLength={4}
                    />
                  </View>
                </View>

                <View>
                  <Text style={styles.vehicleLabel}>TIPO</Text>
                  <View style={styles.vehicleTypeRow}>
                    <TouchableOpacity
                      style={[styles.typeBtn, vehicleForm.vehicleType === "car" && styles.typeBtnActive]}
                      onPress={() => setVehicleForm(f => ({ ...f, vehicleType: "car" }))}
                      activeOpacity={0.8}
                    >
                      <Feather name="truck" size={14} color={vehicleForm.vehicleType === "car" ? "#fff" : "#64748b"} />
                      <Text style={[styles.typeBtnText, vehicleForm.vehicleType === "car" && styles.typeBtnTextActive]}>Carro</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.typeBtn, vehicleForm.vehicleType === "moto" && styles.typeBtnActive]}
                      onPress={() => setVehicleForm(f => ({ ...f, vehicleType: "moto" }))}
                      activeOpacity={0.8}
                    >
                      <Feather name="zap" size={14} color={vehicleForm.vehicleType === "moto" ? "#fff" : "#64748b"} />
                      <Text style={[styles.typeBtnText, vehicleForm.vehicleType === "moto" && styles.typeBtnTextActive]}>Moto</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.vehicleSaveRow}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.approveBtn, { flex: 1 }, vehicleSaving && { opacity: 0.6 }]}
                    onPress={handleSaveVehicle}
                    disabled={vehicleSaving}
                    activeOpacity={0.85}
                  >
                    {vehicleSaving
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <><Feather name="save" size={15} color="#fff" /><Text style={styles.actionBtnText}>Salvar veículo</Text></>
                    }
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { flex: 1, backgroundColor: "#334155" }]}
                    onPress={() => setEditingVehicle(false)}
                    disabled={vehicleSaving}
                    activeOpacity={0.85}
                  >
                    <Feather name="x" size={15} color="#94a3b8" />
                    <Text style={[styles.actionBtnText, { color: "#94a3b8" }]}>Cancelar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <>
                <View style={styles.vehicleRow}>
                  <View style={styles.vehicleField}>
                    <Text style={styles.vehicleLabel}>Modelo</Text>
                    <Text style={styles.vehicleValue}>{data.vehicleModel || "—"}</Text>
                  </View>
                  <View style={styles.vehicleField}>
                    <Text style={styles.vehicleLabel}>Placa</Text>
                    <Text style={styles.vehicleValue}>{data.vehiclePlate || "—"}</Text>
                  </View>
                  <View style={styles.vehicleField}>
                    <Text style={styles.vehicleLabel}>Tipo</Text>
                    <Text style={styles.vehicleValue}>{data.vehicleType === "moto" ? "Moto" : data.vehicleType === "car" ? "Carro" : "—"}</Text>
                  </View>
                </View>
                <View style={styles.vehicleRow}>
                  <View style={styles.vehicleField}>
                    <Text style={styles.vehicleLabel}>Cor</Text>
                    <Text style={styles.vehicleValue}>{data.vehicleColor || "—"}</Text>
                  </View>
                  <View style={styles.vehicleField}>
                    <Text style={styles.vehicleLabel}>Ano</Text>
                    <Text style={styles.vehicleValue}>{data.vehicleYear ?? "—"}</Text>
                  </View>
                  <View style={styles.vehicleField}>
                    <Text style={styles.vehicleLabel}>Corridas</Text>
                    <Text style={styles.vehicleValue}>{data.totalRides ?? 0}</Text>
                  </View>
                </View>
              </>
            )}
          </View>

          <Text style={[styles.sectionTitle, { paddingHorizontal: 4, marginTop: 8 }]}>DOCUMENTOS</Text>

          <DocCard
            title="RG — Documento de Identidade"
            subtitle="Exigido para todos os motoristas"
            status={data.rgStatus}
            docUrl={data.rgUrl}
            loading={actionLoading === "rgStatus-approved" || actionLoading === "rgStatus-rejected"}
            onApprove={() => handleDocStatus("rgStatus", "approved", "RG aprovado.")}
            onReject={() => handleDocStatus("rgStatus", "rejected", "RG rejeitado.")}
          />

          <DocCard
            title="CNH — Carteira de Habilitação"
            subtitle="Exigida para motoristas"
            status={data.cnhStatus}
            docUrl={data.cnhUrl}
            loading={actionLoading === "cnhStatus-approved" || actionLoading === "cnhStatus-rejected"}
            onApprove={() => handleDocStatus("cnhStatus", "approved", "CNH aprovada.")}
            onReject={() => handleDocStatus("cnhStatus", "rejected", "CNH rejeitada.")}
          />

          <DocCard
            title="CRLV — Documento do Veículo"
            subtitle="Certificado de registro e licenciamento"
            status={data.crlvStatus}
            docUrl={data.crlvUrl}
            loading={actionLoading === "crlvStatus-approved" || actionLoading === "crlvStatus-rejected"}
            onApprove={() => handleDocStatus("crlvStatus", "approved", "CRLV aprovado.")}
            onReject={() => handleDocStatus("crlvStatus", "rejected", "CRLV rejeitado.")}
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
  vehicleCardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  editVehicleBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "#6366f111", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
  },
  editVehicleBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#6366f1" },
  sectionTitle: {
    fontSize: 11, fontFamily: "Inter_700Bold",
    color: "#475569", letterSpacing: 0.8, textTransform: "uppercase",
  },
  vehicleRow: { flexDirection: "row", gap: 12 },
  vehicleField: { flex: 1, gap: 2 },
  vehicleLabel: { fontSize: 10, fontFamily: "Inter_500Medium", color: "#64748b", textTransform: "uppercase", marginBottom: 4 },
  vehicleValue: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#e2e8f0" },
  vehicleInput: {
    backgroundColor: "#0f172a", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8,
    fontSize: 14, fontFamily: "Inter_400Regular", color: "#f1f5f9",
    borderWidth: 1, borderColor: "#334155",
  },
  vehicleTypeRow: { flexDirection: "row", gap: 8, marginTop: 2 },
  typeBtn: {
    flex: 1, height: 38, borderRadius: 8, flexDirection: "row",
    alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: "#0f172a", borderWidth: 1, borderColor: "#334155",
  },
  typeBtnActive: { backgroundColor: "#6366f1", borderColor: "#6366f1" },
  typeBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#64748b" },
  typeBtnTextActive: { color: "#fff" },
  vehicleSaveRow: { flexDirection: "row", gap: 10, marginTop: 4 },

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
