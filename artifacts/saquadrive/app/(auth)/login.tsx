import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { AppMode } from "@/contexts/AuthContext";

function decodeJwtRole(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.role ?? null;
  } catch {
    return null;
  }
}

export default function LoginScreen() {
  const { login, setMode } = useAuth();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ mode: AppMode }>();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      setError("Preencha todos os campos");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await login(email.trim(), password);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      let role: string | null = null;
      try {
        const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
        const savedToken = await AsyncStorage.getItem("zerorisco_token");
        if (savedToken) role = decodeJwtRole(savedToken);
      } catch {}

      if (role === "admin") {
        router.replace("/(admin)");
        return;
      }

      const mode = params.mode ?? "passenger";
      setMode(mode);
      if (mode === "driver") {
        router.replace("/(driver)");
      } else {
        router.replace("/(passenger)");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao fazer login. Tente novamente.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={[styles.inner, { paddingTop: topPad + 24, paddingBottom: botPad + 24 }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={[styles.backArrow, { color: colors.primary }]}>←</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.foreground }]}>Entrar</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Bem-vindo de volta ao Zerorisco
          </Text>
        </View>

        <View style={styles.form}>
          <View style={[styles.inputWrapper, { backgroundColor: colors.input, borderColor: colors.border }]}>
            <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>E-mail</Text>
            <TextInput
              style={[styles.input, { color: colors.foreground }]}
              value={email}
              onChangeText={setEmail}
              placeholder="seu@email.com"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={[styles.inputWrapper, { backgroundColor: colors.input, borderColor: colors.border }]}>
            <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Senha</Text>
            <TextInput
              style={[styles.input, { color: colors.foreground }]}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.mutedForeground}
              secureTextEntry
            />
          </View>

          {error ? (
            <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text>
          ) : null}

          <TouchableOpacity
            style={[styles.loginBtn, { backgroundColor: colors.primary }]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={[styles.loginBtnText, { color: colors.primaryForeground }]}>
                Entrar
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.forgotBtn}
            onPress={() => {
              Alert.alert(
                "Recuperação de Senha",
                "Para redefinir sua senha, entre em contato com o suporte pelo WhatsApp ou e-mail informado no cadastro.",
                [{ text: "Entendi", style: "default" }]
              );
            }}
          >
            <Text style={[styles.forgotText, { color: colors.mutedForeground }]}>
              Esqueceu a senha?
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
            Não tem conta?{" "}
          </Text>
          <TouchableOpacity
            onPress={() =>
              router.push({ pathname: "/(auth)/register", params: { mode: params.mode } })
            }
          >
            <Text style={[styles.footerLink, { color: colors.primary }]}>Criar conta</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, paddingHorizontal: 24 },
  header: { marginBottom: 40 },
  backBtn: { marginBottom: 24 },
  backArrow: { fontSize: 28 },
  title: {
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  form: { gap: 16 },
  inputWrapper: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  inputLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  input: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
  error: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  loginBtn: {
    borderRadius: 14,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  loginBtnText: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
  forgotBtn: { alignItems: "center", paddingVertical: 8 },
  forgotText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: "auto" },
  footerText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  footerLink: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
