import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, FlatList, Modal, RefreshControl,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { API_URL } from "@/constants/api";

type Tab = "pending" | "drivers" | "users" | "taxas" | "promos";

type Driver = {
  id: string; name: string; email: string; vehicleModel?: string; vehiclePlate?: string;
  rgStatus?: string; cnhStatus?: string; crlvStatus?: string; isApproved?: boolean;
};

type User = {
  id: string; name: string; email: string; role?: string; totalRides?: number;
  suspended?: boolean; cancellationFeeOwed?: number;
};

type Stats = { totalUsers: number; totalRides: number; pendingDrivers: number; totalRevenue?: number; suspendedUsers?: number };

type PromoCode = {
  id: number; code: string; description?: string; discountType: string;
  discountValue: number; isActive: boolean; maxUses?: number; usedCount: number; expiresAt?: string;
};

type SuspendedUser = {
  id: string; name: string; email: string; phone?: string;
  cancellationFeeOwed: number; suspended: boolean; totalRides?: number;
};

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function StatusBadge({ status }: { status?: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    approved: { bg: "#16a34a22", text: "#16a34a", label: "OK" },
    rejected: { bg: "#dc262622", text: "#dc2626", label: "Rej" },
    pending: { bg: "#d9770622", text: "#d97706", label: "Pend" },
  };
  const s = map[status ?? "pending"] ?? map.pending;
  return <View style={[styles.badge, { backgroundColor: s.bg }]}><Text style={[styles.badgeText, { color: s.text }]}>{s.label}</Text></View>;
}

export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const topPad = insets.top;

  const [secret, setSecret] = useState<string | null>(null);
  const [secretInput, setSecretInput] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [tab, setTab] = useState<Tab>("pending");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [pendingDrivers, setPendingDrivers] = useState<Driver[]>([]);
  const [allDrivers, setAllDrivers] = useState<Driver[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [suspendedUsers, setSuspendedUsers] = useState<SuspendedUser[]>([]);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);

  // Promo modal
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoDesc, setPromoDesc] = useState("");
  const [promoType, setPromoType] = useState<"fixed" | "percent">("fixed");
  const [promoValue, setPromoValue] = useState("");
  const [promoMaxUses, setPromoMaxUses] = useState("");
  const [promoSaving, setPromoSaving] = useState(false);

  async function handleLogin() {
    setLoginLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/stats`, { headers: { "x-admin-secret": secretInput } });
      if (res.ok) { setSecret(secretInput); await fetchData(secretInput); }
      else Alert.alert("Erro", "Senha incorreta");
    } catch { Alert.alert("Erro", "Não foi possível conectar"); }
    finally { setLoginLoading(false); }
  }

  async function fetchData(s: string) {
    setLoading(true);
    try {
      const h = { "x-admin-secret": s };
      const [statsRes, pendRes, allDRes, usersRes, taxasRes, promosRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/stats`, { headers: h }),
        fetch(`${API_URL}/api/admin/drivers/pending`, { headers: h }),
        fetch(`${API_URL}/api/admin/drivers/all`, { headers: h }),
        fetch(`${API_URL}/api/admin/users`, { headers: h }),
        fetch(`${API_URL}/api/admin/cancellation-fees`, { headers: h }),
        fetch(`${API_URL}/api/admin/promo-codes`, { headers: h }),
      ]);
      if (statsRes.ok) setStats(await statsRes.json() as Stats);
      if (pendRes.ok) setPendingDrivers(await pendRes.json() as Driver[]);
      if (allDRes.ok) setAllDrivers(await allDRes.json() as Driver[]);
      if (usersRes.ok) setAllUsers(await usersRes.json() as User[]);
      if (taxasRes.ok) setSuspendedUsers(await taxasRes.json() as SuspendedUser[]);
      if (promosRes.ok) setPromoCodes(await promosRes.json() as PromoCode[]);
    } finally { setLoading(false); setRefreshing(false); }
  }

  function handleLogout() { setSecret(null); setSecretInput(""); }

  async function handleReleaseSuspension(userId: string, name: string) {
    Alert.alert("Liberar conta", `Liberar suspensão de ${name} e zerar taxa?`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Liberar", onPress: async () => {
        const res = await fetch(`${API_URL}/api/admin/users/${userId}/release-suspension`, { method: "POST", headers: { "x-admin-secret": secret! } });
        if (res.ok) { setSuspendedUsers((prev) => prev.filter((u) => u.id !== userId)); Alert.alert("Sucesso", "Suspensão liberada."); }
        else Alert.alert("Erro", "Não foi possível liberar.");
      }},
    ]);
  }

  async function handleTogglePromo(id: number, current: boolean) {
    const res = await fetch(`${API_URL}/api/admin/promo-codes/${id}`, { method: "PATCH", headers: { "x-admin-secret": secret!, "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !current }) });
    if (res.ok) { const updated = await res.json() as PromoCode; setPromoCodes((prev) => prev.map((p) => p.id === id ? updated : p)); }
  }

  async function handleDeletePromo(id: number, code: string) {
    Alert.alert("Deletar", `Deletar o código ${code}?`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Deletar", style: "destructive", onPress: async () => {
        const res = await fetch(`${API_URL}/api/admin/promo-codes/${id}`, { method: "DELETE", headers: { "x-admin-secret": secret! } });
        if (res.ok) setPromoCodes((prev) => prev.filter((p) => p.id !== id));
      }},
    ]);
  }

  async function handleCreatePromo() {
    if (!promoCode.trim() || !promoValue) { Alert.alert("Erro", "Preencha código e valor"); return; }
    setPromoSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/promo-codes`, {
        method: "POST",
        headers: { "x-admin-secret": secret!, "Content-Type": "application/json" },
        body: JSON.stringify({ code: promoCode.trim().toUpperCase(), description: promoDesc || undefined, discountType: promoType, discountValue: Number(promoValue), maxUses: promoMaxUses ? Number(promoMaxUses) : undefined }),
      });
      const data = await res.json() as PromoCode & { message?: string };
      if (!res.ok) { Alert.alert("Erro", data.message ?? "Falha ao criar"); return; }
      setPromoCodes((prev) => [data, ...prev]);
      setShowPromoModal(false); setPromoCode(""); setPromoDesc(""); setPromoValue(""); setPromoMaxUses("");
    } finally { setPromoSaving(false); }
  }

  if (!secret) {
    return (
      <View style={[styles.loginContainer, { paddingTop: topPad }]}>
        <View style={styles.loginCard}>
          <View style={[styles.loginIcon, { backgroundColor: "#6366f122" }]}><Feather name="shield" size={32} color="#6366f1" /></View>
          <Text style={styles.loginTitle}>Admin</Text>
          <Text style={styles.loginSubtitle}>Zerorisco — Área Restrita</Text>
          <TextInput style={styles.loginInput} value={secretInput} onChangeText={setSecretInput} placeholder="Senha de administrador" placeholderTextColor="#6b7280" secureTextEntry autoCapitalize="none" returnKeyType="done" onSubmitEditing={handleLogin} />
          <TouchableOpacity style={[styles.loginBtn, loginLoading && { opacity: 0.7 }]} onPress={handleLogin} disabled={loginLoading} activeOpacity={0.85}>
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
      <TouchableOpacity style={styles.card} activeOpacity={0.8} onPress={() => router.push({ pathname: "/(admin)/driver-review", params: { driverId: String(item.id), adminSecret: secret! } })}>
        <View style={[styles.cardAvatar, { backgroundColor: allApproved ? "#16a34a22" : anyRejected ? "#dc262622" : "#6366f122" }]}>
          <Text style={[styles.cardAvatarText, { color: allApproved ? "#16a34a" : anyRejected ? "#dc2626" : "#6366f1" }]}>{item.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}</Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardName}>{item.name}</Text>
          <Text style={styles.cardSub}>{[item.vehicleModel, item.vehiclePlate].filter(Boolean).join(" · ") || item.email}</Text>
          <View style={styles.docBadges}>
            {(["RG", "CNH", "CRLV"] as const).map((doc, i) => {
              const status = i === 0 ? item.rgStatus : i === 1 ? item.cnhStatus : item.crlvStatus;
              return (<View key={doc} style={styles.docBadgeRow}><Text style={styles.docBadgeLabel}>{doc}</Text><StatusBadge status={status} /></View>);
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
      <TouchableOpacity style={styles.card} activeOpacity={0.8} onPress={() => router.push({ pathname: "/(admin)/user-detail", params: { userId: String(item.id), adminSecret: secret! } })}>
        <View style={[styles.cardAvatar, { backgroundColor: roleColor + "22" }]}>
          <Text style={[styles.cardAvatarText, { color: roleColor }]}>{item.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}</Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardName}>{item.name}</Text>
          <Text style={styles.cardSub}>{item.email}</Text>
          <View style={styles.userMeta}>
            <View style={[styles.userRoleBadge, { backgroundColor: roleColor + "22" }]}><Text style={[styles.userRoleText, { color: roleColor }]}>{roleLabel}</Text></View>
            <Text style={styles.userStatText}>{item.totalRides ?? 0} corridas</Text>
            {item.suspended && <View style={styles.suspendedBadge}><Text style={styles.suspendedBadgeText}>SUSPENSO</Text></View>}
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
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}><Feather name="log-out" size={18} color="#dc2626" /></TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <View style={styles.center}><ActivityIndicator color="#6366f1" size="large" /></View>
      ) : (
        <FlatList
          data={
            tab === "users" ? allUsers :
            tab === "taxas" ? suspendedUsers :
            tab === "promos" ? promoCodes :
            displayedDrivers
          }
          keyExtractor={(item) => String((item as { id: string | number }).id)}
          renderItem={
            tab === "users" ? renderUser :
            tab === "taxas" ? ({ item }) => {
              const u = item as SuspendedUser;
              return (
                <View style={styles.taxaCard}>
                  <View style={[styles.cardAvatar, { backgroundColor: "#dc262622" }]}>
                    <Text style={[styles.cardAvatarText, { color: "#dc2626" }]}>{u.name.slice(0, 2).toUpperCase()}</Text>
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardName}>{u.name}</Text>
                    <Text style={styles.cardSub}>{u.email}</Text>
                    <Text style={styles.taxaValue}>Taxa pendente: R$ {(u.cancellationFeeOwed ?? 0).toFixed(2)}</Text>
                  </View>
                  {u.suspended && (
                    <TouchableOpacity style={styles.releaseBtn} onPress={() => handleReleaseSuspension(u.id, u.name)} activeOpacity={0.85}>
                      <Text style={styles.releaseBtnText}>Liberar</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            } :
            tab === "promos" ? ({ item }) => {
              const p = item as PromoCode;
              const discount = p.discountType === "percent" ? `${p.discountValue}%` : `R$ ${p.discountValue.toFixed(2)}`;
              return (
                <View style={styles.promoCard}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={styles.promoCodeText}>{p.code}</Text>
                      <View style={[styles.promoBadge, { backgroundColor: p.isActive ? "#16a34a22" : "#64748b22" }]}>
                        <Text style={[styles.promoBadgeText, { color: p.isActive ? "#16a34a" : "#64748b" }]}>{p.isActive ? "Ativo" : "Inativo"}</Text>
                      </View>
                    </View>
                    {p.description ? <Text style={styles.promoDesc}>{p.description}</Text> : null}
                    <Text style={styles.promoMeta}>Desconto: {discount} · Usos: {p.usedCount}{p.maxUses ? `/${p.maxUses}` : ""}</Text>
                  </View>
                  <View style={{ flexDirection: "column", gap: 8 }}>
                    <TouchableOpacity style={[styles.promoToggle, { backgroundColor: p.isActive ? "#64748b22" : "#16a34a22" }]} onPress={() => handleTogglePromo(p.id, p.isActive)} activeOpacity={0.8}>
                      <Text style={[styles.promoToggleText, { color: p.isActive ? "#64748b" : "#16a34a" }]}>{p.isActive ? "Pausar" : "Ativar"}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.promoDelete} onPress={() => handleDeletePromo(p.id, p.code)} activeOpacity={0.8}>
                      <Feather name="trash-2" size={14} color="#dc2626" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            } :
            renderDriver
          }
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(secret!); }} tintColor="#6366f1" />}
          ListHeaderComponent={
            <View>
              {stats && (
                <View style={styles.statsGrid}>
                  <StatCard label="Usuários" value={Number(stats.totalUsers)} color="#6366f1" />
                  <StatCard label="Motoristas" value={allDrivers.length} color="#0ea5e9" />
                  <StatCard label="Pendentes" value={Number(stats.pendingDrivers)} color="#d97706" />
                  <StatCard label="Corridas" value={Number(stats.totalRides)} color="#16a34a" />
                  {(stats.suspendedUsers ?? 0) > 0 && <StatCard label="Suspensos" value={Number(stats.suspendedUsers)} color="#dc2626" />}
                </View>
              )}
              {/* Abas */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: 16, marginTop: 16, marginBottom: 8 }}>
                <View style={{ flexDirection: "row", backgroundColor: "#1e293b", borderRadius: 10, padding: 4, gap: 2 }}>
                  {([
                    { key: "pending", label: `Pendentes (${pendingDrivers.length})` },
                    { key: "drivers", label: `Motoristas (${allDrivers.length})` },
                    { key: "users", label: `Usuários (${allUsers.length})` },
                    { key: "taxas", label: `Taxas (${suspendedUsers.length})` },
                    { key: "promos", label: `Promoções (${promoCodes.length})` },
                  ] as { key: Tab; label: string }[]).map((t) => (
                    <TouchableOpacity key={t.key} style={[styles.tabBtn, tab === t.key && styles.tabBtnActive]} onPress={() => setTab(t.key)}>
                      <Text style={[styles.tabBtnText, tab === t.key && styles.tabBtnTextActive]}>{t.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              {/* Botão criar promo */}
              {tab === "promos" && (
                <TouchableOpacity style={styles.createPromoBtn} onPress={() => setShowPromoModal(true)} activeOpacity={0.85}>
                  <Feather name="plus" size={16} color="#fff" />
                  <Text style={styles.createPromoBtnText}>Novo código promocional</Text>
                </TouchableOpacity>
              )}

              {/* Empty state */}
              {((tab === "users" && allUsers.length === 0) || (tab === "taxas" && suspendedUsers.length === 0) || (tab === "promos" && promoCodes.length === 0) || (tab !== "users" && tab !== "taxas" && tab !== "promos" && displayedDrivers.length === 0)) && (
                <View style={styles.emptyState}>
                  <Feather name="inbox" size={40} color="#334155" />
                  <Text style={styles.emptyText}>
                    {tab === "pending" ? "Nenhum motorista pendente" : tab === "drivers" ? "Nenhum motorista" : tab === "users" ? "Nenhum usuário" : tab === "taxas" ? "Nenhuma conta suspensa" : "Nenhum código cadastrado"}
                  </Text>
                </View>
              )}
            </View>
          }
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Modal criar promo */}
      <Modal visible={showPromoModal} transparent animationType="slide" onRequestClose={() => setShowPromoModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Novo Código Promocional</Text>
            <TextInput style={styles.modalInput} value={promoCode} onChangeText={(t) => setPromoCode(t.toUpperCase())} placeholder="Código (ex: PROMO10)" placeholderTextColor="#6b7280" autoCapitalize="characters" />
            <TextInput style={styles.modalInput} value={promoDesc} onChangeText={setPromoDesc} placeholder="Descrição (opcional)" placeholderTextColor="#6b7280" />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity style={[styles.typeBtn, promoType === "fixed" && styles.typeBtnActive]} onPress={() => setPromoType("fixed")} activeOpacity={0.85}>
                <Text style={[styles.typeBtnText, promoType === "fixed" && { color: "#fff" }]}>Fixo (R$)</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.typeBtn, promoType === "percent" && styles.typeBtnActive]} onPress={() => setPromoType("percent")} activeOpacity={0.85}>
                <Text style={[styles.typeBtnText, promoType === "percent" && { color: "#fff" }]}>Percentual (%)</Text>
              </TouchableOpacity>
            </View>
            <TextInput style={styles.modalInput} value={promoValue} onChangeText={setPromoValue} placeholder={promoType === "fixed" ? "Valor (ex: 5.00)" : "Percentual (ex: 10)"} placeholderTextColor="#6b7280" keyboardType="numeric" />
            <TextInput style={styles.modalInput} value={promoMaxUses} onChangeText={setPromoMaxUses} placeholder="Máx. usos (deixe vazio = ilimitado)" placeholderTextColor="#6b7280" keyboardType="numeric" />
            <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowPromoModal(false)} activeOpacity={0.7}>
                <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#94a3b8" }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalSaveBtn, promoSaving && { opacity: 0.7 }]} onPress={handleCreatePromo} disabled={promoSaving} activeOpacity={0.85}>
                {promoSaving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.modalSaveText}>Criar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0f172a" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 16, paddingTop: 12, borderBottomWidth: 1, borderBottomColor: "#1e293b" },
  headerTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#f8fafc" },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6b7280", marginTop: 2 },
  logoutBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: "#dc262611", alignItems: "center", justifyContent: "center" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 },
  statCard: { flex: 1, minWidth: "44%", backgroundColor: "#1e293b", borderRadius: 12, padding: 14, borderLeftWidth: 3 },
  statValue: { fontSize: 26, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#94a3b8", marginTop: 2 },
  tabBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, alignItems: "center" },
  tabBtnActive: { backgroundColor: "#6366f1" },
  tabBtnText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#64748b" },
  tabBtnTextActive: { color: "#fff" },
  emptyState: { alignItems: "center", paddingVertical: 48, gap: 12 },
  emptyText: { fontSize: 15, fontFamily: "Inter_500Medium", color: "#6b7280" },
  card: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginBottom: 10, backgroundColor: "#1e293b", borderRadius: 14, padding: 14, gap: 12 },
  taxaCard: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginBottom: 10, backgroundColor: "#1e293b", borderRadius: 14, padding: 14, gap: 12 },
  cardAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  cardAvatarText: { fontSize: 17, fontFamily: "Inter_700Bold" },
  cardInfo: { flex: 1, gap: 4 },
  cardName: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#f1f5f9" },
  cardSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#94a3b8" },
  taxaValue: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#dc2626" },
  releaseBtn: { backgroundColor: "#16a34a", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  releaseBtnText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#fff" },
  docBadges: { flexDirection: "row", gap: 8, marginTop: 4, flexWrap: "wrap" },
  docBadgeRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  docBadgeLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#64748b" },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  badgeText: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  userMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  userRoleBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  userRoleText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  userStatText: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#64748b" },
  suspendedBadge: { backgroundColor: "#dc262622", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  suspendedBadgeText: { fontSize: 9, fontFamily: "Inter_700Bold", color: "#dc2626", letterSpacing: 0.5 },
  promoCard: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginBottom: 10, backgroundColor: "#1e293b", borderRadius: 14, padding: 14, gap: 12 },
  promoCodeText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#f1f5f9", letterSpacing: 1 },
  promoBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  promoBadgeText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  promoDesc: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#94a3b8", marginTop: 2 },
  promoMeta: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#64748b", marginTop: 4 },
  promoToggle: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, alignItems: "center" },
  promoToggleText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  promoDelete: { width: 32, height: 32, alignItems: "center", justifyContent: "center", backgroundColor: "#dc262611", borderRadius: 8 },
  createPromoBtn: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, marginBottom: 10, backgroundColor: "#6366f1", borderRadius: 12, padding: 14 },
  createPromoBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff", flex: 1 },
  loginContainer: { flex: 1, backgroundColor: "#0f172a", alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  loginCard: { width: "100%", maxWidth: 360, backgroundColor: "#1e293b", borderRadius: 20, padding: 28, alignItems: "center", gap: 12 },
  loginIcon: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  loginTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#f8fafc" },
  loginSubtitle: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#6b7280", marginBottom: 8 },
  loginInput: { width: "100%", height: 50, borderRadius: 12, backgroundColor: "#0f172a", borderWidth: 1, borderColor: "#334155", paddingHorizontal: 16, fontSize: 15, fontFamily: "Inter_400Regular", color: "#f1f5f9" },
  loginBtn: { width: "100%", height: 50, borderRadius: 12, backgroundColor: "#6366f1", alignItems: "center", justifyContent: "center" },
  loginBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.8)", alignItems: "center", justifyContent: "center", padding: 24 },
  modalCard: { width: "100%", backgroundColor: "#1e293b", borderRadius: 20, padding: 24, gap: 12 },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#f1f5f9", marginBottom: 4 },
  modalInput: { height: 48, borderRadius: 10, backgroundColor: "#0f172a", borderWidth: 1, borderColor: "#334155", paddingHorizontal: 14, fontSize: 14, fontFamily: "Inter_400Regular", color: "#f1f5f9" },
  typeBtn: { flex: 1, height: 42, borderRadius: 10, borderWidth: 1, borderColor: "#334155", alignItems: "center", justifyContent: "center" },
  typeBtnActive: { backgroundColor: "#6366f1", borderColor: "#6366f1" },
  typeBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#64748b" },
  modalCancelBtn: { flex: 1, height: 48, borderRadius: 12, borderWidth: 1, borderColor: "#334155", alignItems: "center", justifyContent: "center" },
  modalSaveBtn: { flex: 1, height: 48, borderRadius: 12, backgroundColor: "#6366f1", alignItems: "center", justifyContent: "center" },
  modalSaveText: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#fff" },
});
