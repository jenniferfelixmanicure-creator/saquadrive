import { Feather } from "@expo/vector-icons";
import { reloadAppAsync } from "expo";
import React, { useState } from "react";
import {
  Clipboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type ErrorFallbackProps = {
  error: Error;
  resetError: () => void;
};

export function ErrorFallback({ error, resetError }: ErrorFallbackProps) {
  const insets = useSafeAreaInsets();
  const [copied, setCopied] = useState(false);

  const handleRestart = async () => {
    try {
      await reloadAppAsync();
    } catch {
      resetError();
    }
  };

  const errorText =
    `Erro: ${error.message}\n\n` +
    `Plataforma: ${Platform.OS} ${Platform.Version}\n\n` +
    (error.stack ? `Stack:\n${error.stack}` : "");

  const handleCopy = () => {
    Clipboard.setString(errorText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 },
      ]}
    >
      {/* Cabeçalho */}
      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <Feather name="alert-triangle" size={28} color="#FF3B30" />
        </View>
        <Text style={styles.title}>O app encontrou um problema</Text>
        <Text style={styles.subtitle}>
          Copie o erro abaixo e envie para o suporte, ou tente reiniciar.
        </Text>
      </View>

      {/* Caixa do erro — sempre visível */}
      <ScrollView
        style={styles.errorBox}
        contentContainerStyle={styles.errorBoxContent}
        showsVerticalScrollIndicator
      >
        <Text selectable style={styles.errorText}>
          {errorText}
        </Text>
      </ScrollView>

      {/* Botões */}
      <View style={styles.actions}>
        <Pressable
          onPress={handleCopy}
          style={({ pressed }) => [
            styles.btnSecondary,
            { opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Feather
            name={copied ? "check" : "copy"}
            size={16}
            color="#00C4FF"
            style={{ marginRight: 8 }}
          />
          <Text style={styles.btnSecondaryText}>
            {copied ? "Copiado!" : "Copiar erro"}
          </Text>
        </Pressable>

        <Pressable
          onPress={handleRestart}
          style={({ pressed }) => [
            styles.btnPrimary,
            { opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Feather
            name="refresh-cw"
            size={16}
            color="#000"
            style={{ marginRight: 8 }}
          />
          <Text style={styles.btnPrimaryText}>Reiniciar app</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0D0D0D",
    paddingHorizontal: 20,
    gap: 16,
  },
  header: {
    alignItems: "center",
    gap: 10,
    paddingTop: 8,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,59,48,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
    lineHeight: 18,
  },
  errorBox: {
    flex: 1,
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,59,48,0.25)",
  },
  errorBoxContent: {
    padding: 14,
  },
  errorText: {
    fontSize: 11,
    color: "#FF6B6B",
    fontFamily: Platform.select({ android: "monospace", ios: "Menlo", default: "monospace" }),
    lineHeight: 17,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
  },
  btnSecondary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#00C4FF",
    backgroundColor: "rgba(0,196,255,0.08)",
  },
  btnSecondaryText: {
    color: "#00C4FF",
    fontSize: 14,
    fontWeight: "600",
  },
  btnPrimary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: "#00C4FF",
  },
  btnPrimaryText: {
    color: "#000000",
    fontSize: 14,
    fontWeight: "700",
  },
});
