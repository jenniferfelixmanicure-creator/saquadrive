import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { API_URL } from "@/constants/api";

export default function EditProfileScreen() {
  const colors = useColors();
  const { user, apiFetch, updateUser, updateUserDocuments } = useAuth();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [loading, setLoading] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const initials = name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "U";

  async function handlePickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permissão necessária", "Precisamos de acesso à sua galeria para escolher uma foto.");
      return;
    }

    Alert.alert("Foto de perfil", "Escolha uma opção", [
      {
        text: "Galeria",
        onPress: async () => {
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          });
          if (!result.canceled && result.assets[0]) {
            await uploadPhoto(result.assets[0]);
          }
        },
      },
      {
        text: "Câmera",
        onPress: async () => {
          const camStatus = await ImagePicker.requestCameraPermissionsAsync();
          if (camStatus.status !== "granted") {
            Alert.alert("Permissão necessária", "Precisamos de acesso à câmera.");
            return;
          }
          const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          });
          if (!result.canceled && result.assets[0]) {
            await uploadPhoto(result.assets[0]);
          }
        },
      },
      { text: "Cancelar", style: "cancel" },
    ]);
  }

  async function uploadPhoto(asset: ImagePicker.ImagePickerAsset) {
    setPhotoLoading(true);
    try {
      const filename = asset.uri.split("/").pop() ?? "photo.jpg";
      const ext = filename.split(".").pop()?.toLowerCase() ?? "jpg";
      const mimeType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";

      const formData = new FormData();
      formData.append("file", { uri: asset.uri, name: filename, type: mimeType } as unknown as Blob);

      const res = await apiFetch("/api/documents/upload-profile-photo", {
        method: "POST",
        body: formData,
      });

      const data = await res.json() as { url?: string; message?: string };
      if (!res.ok) throw new Error(data.message ?? "Erro ao enviar foto");

      await updateUserDocuments({ profilePhotoUrl: data.url });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      Alert.alert("Erro", err instanceof Error ? err.message : "Não foi possível atualizar a foto.");
    } finally {
      setPhotoLoading(false);
    }
  }

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert("Atenção", "O nome não pode estar vazio.");
      return;
    }
    if (!phone.trim()) {
      Alert.alert("Atenção", "O telefone não pode estar vazio.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    try {
      await updateUser({ name: name.trim(), phone: phone.trim() });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Erro", "Não foi possível salvar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  const photoUri = user?.profilePhotoUrl
    ? user.profilePhotoUrl.startsWith("/uploads/")
      ? `${API_URL}${user.profilePhotoUrl}`
      : user.profilePhotoUrl
    : null;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Editar perfil</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={handlePickPhoto} activeOpacity={0.8} style={styles.avatarWrapper}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.avatarImage} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            )}
            {photoLoading ? (
              <View style={[styles.avatarOverlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
                <ActivityIndicator color="#fff" />
              </View>
            ) : (
              <View style={[styles.cameraBtn, { backgroundColor: colors.primary }]}>
                <Feather name="camera" size={14} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
          <Text style={[styles.photoHint, { color: colors.mutedForeground }]}>Toque para alterar a foto</Text>
        </View>

        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>INFORMAÇÕES PESSOAIS</Text>

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Nome completo</Text>
            <TextInput
              style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              value={name}
              onChangeText={setName}
              placeholder="Seu nome"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="words"
              returnKeyType="next"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Telefone</Text>
            <TextInput
              style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              value={phone}
              onChangeText={setPhone}
              placeholder="(21) 99999-9999"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="phone-pad"
              returnKeyType="done"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>E-mail</Text>
            <TextInput
              style={[styles.input, { color: colors.mutedForeground, borderColor: colors.border, backgroundColor: colors.muted }]}
              value={user?.email ?? ""}
              editable={false}
              placeholder="E-mail"
              placeholderTextColor={colors.mutedForeground}
            />
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>O e-mail não pode ser alterado</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: saved ? colors.success : colors.primary }]}
          onPress={handleSave}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Feather name={saved ? "check" : "save"} size={18} color="#fff" />
              <Text style={styles.saveBtnText}>{saved ? "Salvo!" : "Salvar alterações"}</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  content: { padding: 16, gap: 16 },
  avatarSection: { alignItems: "center", paddingVertical: 20, gap: 8 },
  avatarWrapper: { position: "relative", width: 88, height: 88 },
  avatar: { width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center" },
  avatarImage: { width: 88, height: 88, borderRadius: 44 },
  avatarText: { fontSize: 30, fontFamily: "Inter_700Bold", color: "#fff" },
  avatarOverlay: {
    position: "absolute", top: 0, left: 0, width: 88, height: 88,
    borderRadius: 44, alignItems: "center", justifyContent: "center",
  },
  cameraBtn: {
    position: "absolute", bottom: 0, right: 0,
    width: 28, height: 28, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#fff",
  },
  photoHint: { fontSize: 12, fontFamily: "Inter_400Regular" },
  section: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 16 },
  sectionTitle: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.8, textTransform: "uppercase" },
  fieldGroup: { gap: 6 },
  label: { fontSize: 13, fontFamily: "Inter_500Medium" },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  hint: { fontSize: 11, fontFamily: "Inter_400Regular" },
  saveBtn: {
    height: 52,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  saveBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
});
