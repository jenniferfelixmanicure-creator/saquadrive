import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  ActivityIndicator, Platform, ScrollView,
} from "react-native";
import { router } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import * as ImagePicker from "expo-image-picker";
import { Feather } from "@expo/vector-icons";
import { API_URL } from "@/constants/api";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type DocType = "rg" | "cnh" | "crlv";

export default function UploadDocumentsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, token, updateUserDocuments } = useAuth();
  const [loading, setLoading] = useState<DocType | null>(null);
  const [rgUri, setRgUri] = useState<string | null>(user?.rgUrl ?? null);
  const [cnhUri, setCnhUri] = useState<string | null>(user?.cnhUrl ?? null);
  const [crlvUri, setCrlvUri] = useState<string | null>(user?.crlvUrl ?? null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  async function pickAndUpload(docType: DocType) {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permissão necessária", "Permita o acesso à galeria para enviar documentos.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const uri = result.assets[0].uri;
    if (docType === "rg") setRgUri(uri);
    else if (docType === "cnh") setCnhUri(uri);
    else setCrlvUri(uri);

    setLoading(docType);
    try {
      const formData = new FormData();
      const filename = uri.split("/").pop() ?? `${docType}.jpg`;
      const ext = filename.split(".").pop() ?? "jpg";
      formData.append("file", { uri, name: filename, type: `image/${ext}` } as unknown as Blob);

      let endpoint = "";
      if (docType === "rg") endpoint = `/api/documents/upload-rg`;
      else if (docType === "cnh") endpoint = `/api/documents/upload-cnh`;
      else endpoint = `/api/documents/upload-crlv`;

      const res = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        Alert.alert("Enviado!", data.message ?? "Documento enviado para análise.");
        const update: Partial<typeof user> = {};
        if (docType === "rg") { update.rgStatus = "pending"; update.rgUrl = uri; }
        else if (docType === "cnh") { update.cnhStatus = "pending"; update.cnhUrl = uri; }
        else { update.crlvStatus = "pending"; update.crlvUrl = uri; }
        await updateUserDocuments(update);
      } else {
        Alert.alert("Erro", data.message ?? "Falha ao enviar documento.");
      }
    } catch (err) {
      Alert.alert("Erro", "Falha ao enviar documento. Tente novamente.");
    } finally {
      setLoading(null);
    }
  }

  function DocCard({
    type, label, uri, status,
  }: { type: DocType; label: string; uri: string | null; status?: string }) {
    const statusColor =
      status === "approved" ? colors.success :
      status === "rejected" ? colors.destructive :
      status === "pending" ? "#FFD60A" : colors.mutedForeground;

    const statusLabel =
      status === "approved" ? "Aprovado" :
      status === "rejected" ? "Rejeitado" :
      status === "pending" ? "Em análise" : "Não enviado";

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => pickAndUpload(type)}
        activeOpacity={0.8}
        disabled={loading !== null}
      >
        <View style={[styles.cardIcon, { backgroundColor: colors.muted }]}>
          <Feather name="file-text" size={24} color={colors.primary} />
        </View>
        <View style={styles.cardInfo}>
          <Text style={[styles.cardLabel, { color: colors.foreground }]}>{label}</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
          {uri && (
            <Text style={[styles.fileText, { color: colors.mutedForeground }]} numberOfLines={1}>
              {uri.split("/").pop()}
            </Text>
          )}
        </View>
        {loading === type ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Feather name={uri ? "refresh-cw" : "upload"} size={20} color={colors.mutedForeground} />
        )}
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Feather name="arrow-left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>Documentos</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Envie seus documentos para verificação. Após aprovação, sua conta será liberada.
        </Text>

        <DocCard type="cnh" label="CNH (Carteira de Habilitação)" uri={cnhUri} status={user?.cnhStatus} />
        <DocCard type="crlv" label="CRLV (Documento do Veículo)" uri={crlvUri} status={user?.crlvStatus} />

        <View style={[styles.infoBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="info" size={16} color={colors.mutedForeground} />
          <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
            Documentos aprovados em até 24h úteis. Envie arquivos nítidos e legíveis.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingBottom: 16 },
  back: { padding: 4 },
  title: { fontSize: 22, fontFamily: "Inter_700Bold" },
  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 14 },
  subtitle: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20, marginBottom: 8 },
  card: {
    flexDirection: "row", alignItems: "center", gap: 14,
    borderRadius: 14, borderWidth: 1, padding: 16,
  },
  cardIcon: { width: 48, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  cardInfo: { flex: 1 },
  cardLabel: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 4 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  fileText: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  infoBox: {
    flexDirection: "row", gap: 10, borderRadius: 12,
    borderWidth: 1, padding: 14, marginTop: 8,
  },
  infoText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
});
