import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

type NotifItem = {
  key: string;
  icon: keyof typeof Feather.glyphMap;
  title: string;
  desc: string;
};

const NOTIF_ITEMS: NotifItem[] = [
  { key: "ride_found", icon: "navigation", title: "Motorista encontrado", desc: "Quando um motorista aceitar sua corrida" },
  { key: "ride_arrived", icon: "map-pin", title: "Motorista chegou", desc: "Quando o motorista chegar ao local de embarque" },
  { key: "ride_started", icon: "play-circle", title: "Corrida iniciada", desc: "Quando a corrida começar" },
  { key: "ride_completed", icon: "check-circle", title: "Corrida finalizada", desc: "Quando a corrida for concluída" },
  { key: "ride_cancelled", icon: "x-circle", title: "Corrida cancelada", desc: "Se uma corrida for cancelada" },
  { key: "chat_message", icon: "message-circle", title: "Mensagem do motorista", desc: "Novas mensagens no chat da corrida" },
  { key: "promotions", icon: "tag", title: "Promoções", desc: "Ofertas especiais e descontos" },
];

export default function NotificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [prefs, setPrefs] = useState<Record<string, boolean>>({
    ride_found: true,
    ride_arrived: true,
    ride_started: true,
    ride_completed: true,
    ride_cancelled: true,
    chat_message: true,
    promotions: false,
  });

  function toggle(key: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Notificações</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>
        <View style={[styles.infoBanner, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "44" }]}>
          <Feather name="bell" size={16} color={colors.primary} />
          <Text style={[styles.infoText, { color: colors.primary }]}>
            Ative as notificações para não perder nenhuma atualização das suas corridas.
          </Text>
        </View>

        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>CORRIDAS</Text>
          {NOTIF_ITEMS.filter((i) => i.key !== "promotions").map((item, idx, arr) => (
            <View
              key={item.key}
              style={[styles.row, { borderBottomColor: colors.border, borderBottomWidth: idx < arr.length - 1 ? 1 : 0 }]}
            >
              <View style={[styles.iconBox, { backgroundColor: colors.muted }]}>
                <Feather name={item.icon} size={17} color={colors.foreground} />
              </View>
              <View style={styles.rowText}>
                <Text style={[styles.rowTitle, { color: colors.foreground }]}>{item.title}</Text>
                <Text style={[styles.rowDesc, { color: colors.mutedForeground }]}>{item.desc}</Text>
              </View>
              <Switch
                value={prefs[item.key]}
                onValueChange={() => toggle(item.key)}
                trackColor={{ false: colors.muted, true: colors.primary + "88" }}
                thumbColor={prefs[item.key] ? colors.primary : colors.mutedForeground}
              />
            </View>
          ))}
        </View>

        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>MARKETING</Text>
          {NOTIF_ITEMS.filter((i) => i.key === "promotions").map((item) => (
            <View key={item.key} style={styles.row}>
              <View style={[styles.iconBox, { backgroundColor: colors.muted }]}>
                <Feather name={item.icon} size={17} color={colors.foreground} />
              </View>
              <View style={styles.rowText}>
                <Text style={[styles.rowTitle, { color: colors.foreground }]}>{item.title}</Text>
                <Text style={[styles.rowDesc, { color: colors.mutedForeground }]}>{item.desc}</Text>
              </View>
              <Switch
                value={prefs[item.key]}
                onValueChange={() => toggle(item.key)}
                trackColor={{ false: colors.muted, true: colors.primary + "88" }}
                thumbColor={prefs[item.key] ? colors.primary : colors.mutedForeground}
              />
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1,
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  content: { padding: 16, gap: 16 },
  infoBanner: {
    flexDirection: "row", gap: 10, alignItems: "flex-start",
    borderRadius: 14, borderWidth: 1, padding: 14,
  },
  infoText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  section: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  sectionTitle: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.8, textTransform: "uppercase", padding: 14, paddingBottom: 8 },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, gap: 12 },
  iconBox: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  rowDesc: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
});
