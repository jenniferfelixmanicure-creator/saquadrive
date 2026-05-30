import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { API_URL } from "@/constants/api";

type Step = "email" | "code";

export default function ForgotPasswordScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const codeRefs = useRef<(TextInput | null)[]>([]);
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  async function handleRequestCode() {
    if (!email.trim()) { setError("Digite seu e-mail"); return; }
    setError(""); setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json() as { message?: string; resetCode?: string };
      if (!res.ok) { setError(data.message ?? "Erro ao enviar código"); return; }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep("code");
    } catch {
      setError("Sem conexão. Verifique sua internet e tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword() {
    const fullCode = code.join("");
    if (fullCode.length !== 6) { setError("Digite o código de 6 dígitos"); return; }
    if (!newPassword || newPassword.length < 6) { setError("Nova senha deve ter no mínimo 6 caracteres"); return; }
    if (newPassword !== confirmPassword) { setError("As senhas não coincidem"); return; }
    setError(""); setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), resetCode: fullCode, newPassword }),
      });
      const data = await res.json() as { message?: string };
      if (!res.ok) { setError(data.message ?? "Código inválido ou expirado"); return; }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSuccess(true);
    } catch {
      setError("Sem conexão. Verifique sua internet e tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  function handleCodeChange(text: string, index: number) {
    const cleaned = text.replace(/\D/g, "").slice(-1);
    const next = [...code];
    next[index] = cleaned;
    setCode(next);
    if (cleaned && index < 5) codeRefs.current[index + 1]?.focus();
    if (!cleaned && index > 0) codeRefs.current[index - 1]?.focus();
  }

  function handleCodeKeyPress(key: string, index: number) {
    if (key === "Backspace" && !code[index] && index > 0) {
      codeRefs.current[index - 1]?.focus();
    }
  }

  if (success) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.inner, { paddingTop: topPad + 24, paddingBottom: botPad + 24 }]}>
          <View style={styles.successContainer}>
            <View style={[styles.successIcon, { backgroundColor: colors.primary + "22" }]}>
              <Feather name="check-circle" size={48} color={colors.primary} />
            </View>
            <Text style={[styles.successTitle, { color: colors.foreground }]}>Senha redefinida!</Text>
            <Text style={[styles.successDesc, { color: colors.mutedForeground }]}>
              Sua senha foi alterada com sucesso. Faça login com a nova senha.
            </Text>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: colors.primary, marginTop: 32 }]}
              onPress={() => router.replace("/(auth)/login")}
              activeOpacity={0.85}
            >
              <Text style={[styles.btnText, { color: colors.primaryForeground }]}>Ir para o login</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={[styles.inner, { paddingTop: topPad + 24, paddingBottom: botPad + 24 }]}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => step === "code" ? setStep("email") : router.back()}
            style={[styles.backBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
            activeOpacity={0.7}
          >
            <Feather name="chevron-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.foreground }]}>
            {step === "email" ? "Recuperar senha" : "Nova senha"}
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {step === "email"
              ? "Digite seu e-mail para receber o código de recuperação"
              : `Código enviado para ${email}. Digite abaixo para redefinir sua senha.`}
          </Text>
        </View>

        {step === "email" ? (
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
                returnKeyType="done"
                onSubmitEditing={handleRequestCode}
              />
            </View>

            {error ? (
              <View style={[styles.errorBox, { backgroundColor: colors.destructive + "18", borderColor: colors.destructive + "44" }]}>
                <Feather name="alert-circle" size={14} color={colors.destructive} />
                <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.btn, { backgroundColor: colors.primary, opacity: loading ? 0.85 : 1 }]}
              onPress={handleRequestCode}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#000" />
                : <Text style={[styles.btnText, { color: colors.primaryForeground }]}>Enviar código</Text>}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.form}>
            <View>
              <Text style={[styles.inputLabel, { color: colors.mutedForeground, marginBottom: 12 }]}>
                CÓDIGO DE 6 DÍGITOS
              </Text>
              <View style={styles.codeRow}>
                {code.map((digit, i) => (
                  <TextInput
                    key={i}
                    ref={(r) => { codeRefs.current[i] = r; }}
                    style={[
                      styles.codeBox,
                      {
                        backgroundColor: colors.input,
                        borderColor: digit ? colors.primary : colors.border,
                        color: colors.foreground,
                      },
                    ]}
                    value={digit}
                    onChangeText={(t) => handleCodeChange(t, i)}
                    onKeyPress={({ nativeEvent }) => handleCodeKeyPress(nativeEvent.key, i)}
                    keyboardType="number-pad"
                    maxLength={1}
                    selectTextOnFocus
                  />
                ))}
              </View>
            </View>

            <View style={[styles.inputWrapper, { backgroundColor: colors.input, borderColor: colors.border }]}>
              <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Nova senha</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[styles.input, { color: colors.foreground, flex: 1 }]}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Mínimo 6 caracteres"
                  placeholderTextColor={colors.mutedForeground}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(v => !v)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} activeOpacity={0.7}>
                  <Feather name={showPassword ? "eye-off" : "eye"} size={18} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={[styles.inputWrapper, { backgroundColor: colors.input, borderColor: colors.border }]}>
              <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Confirmar nova senha</Text>
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Repita a senha"
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry={!showPassword}
                returnKeyType="done"
                onSubmitEditing={handleResetPassword}
              />
            </View>

            {error ? (
              <View style={[styles.errorBox, { backgroundColor: colors.destructive + "18", borderColor: colors.destructive + "44" }]}>
                <Feather name="alert-circle" size={14} color={colors.destructive} />
                <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.btn, { backgroundColor: colors.primary, opacity: loading ? 0.85 : 1 }]}
              onPress={handleResetPassword}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#000" />
                : <Text style={[styles.btnText, { color: colors.primaryForeground }]}>Redefinir senha</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.resendBtn} onPress={() => { setStep("email"); setCode(["","","","","",""]); setError(""); }} activeOpacity={0.7}>
              <Text style={[styles.resendText, { color: colors.mutedForeground }]}>
                Não recebeu o código?{" "}
                <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold" }}>Reenviar</Text>
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, paddingHorizontal: 24 },
  header: { marginBottom: 40 },
  backBtn: { marginBottom: 28, width: 40, height: 40, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 32, fontFamily: "Inter_700Bold", letterSpacing: -0.5, marginBottom: 8 },
  subtitle: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 22 },
  form: { gap: 16 },
  inputWrapper: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 },
  inputLabel: { fontSize: 11, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  input: { fontSize: 16, fontFamily: "Inter_400Regular" },
  passwordRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  codeRow: { flexDirection: "row", gap: 10, justifyContent: "center" },
  codeBox: { width: 46, height: 56, borderRadius: 14, borderWidth: 2, textAlign: "center", fontSize: 22, fontFamily: "Inter_700Bold" },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
  errorText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  btn: { borderRadius: 14, height: 54, alignItems: "center", justifyContent: "center", marginTop: 8 },
  btnText: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  resendBtn: { alignItems: "center", paddingVertical: 8 },
  resendText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  successContainer: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  successIcon: { width: 100, height: 100, borderRadius: 50, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  successTitle: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  successDesc: { fontSize: 15, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22, paddingHorizontal: 16 },
});
