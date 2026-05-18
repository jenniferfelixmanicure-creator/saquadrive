import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Socket } from "socket.io-client";

import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { API_URL } from "@/constants/api";

export type ChatMessage = {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  rideId: string;
  myId: string;
  myName: string;
  otherName: string;
  socket: Socket | null;
  messages: ChatMessage[];
  onNewMessage: (msg: ChatMessage) => void;
};

const QUICK_REPLIES = [
  "Já estou saindo!",
  "Estou a caminho.",
  "Aguarde um momento.",
  "Chego em 2 minutos.",
  "Ok, obrigado!",
];

export default function RideChat({ visible, onClose, rideId, myId, myName, otherName, socket, messages, onNewMessage }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [text, setText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const listRef = useRef<FlatList>(null);
  const slideAnim = useRef(new Animated.Value(600)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }).start();
      // Carregar histórico de mensagens do servidor ao abrir o chat
      if (!historyLoaded && rideId && token) {
        loadChatHistory();
      }
    } else {
      Animated.timing(slideAnim, { toValue: 600, duration: 200, useNativeDriver: true }).start();
    }
  }, [visible]);

  async function loadChatHistory() {
    try {
      const res = await fetch(`${API_URL}/api/rides/${rideId}/chat`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const history = await res.json() as ChatMessage[];
      // Adicionar mensagens do histórico que ainda não estão na lista
      const existingIds = new Set(messages.map((m) => m.id));
      for (const msg of history) {
        if (!existingIds.has(msg.id)) {
          onNewMessage(msg);
        }
      }
      setHistoryLoaded(true);
    } catch {
      // falha silenciosa — o chat funciona mesmo sem histórico
    }
  }

  useEffect(() => {
    if (messages.length > 0 && visible) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages, visible]);

  function sendMessage(msgText: string, type: "text" | "audio" = "text") {
    const trimmed = msgText.trim();
    if (type === "text" && !trimmed) return;
    if (!rideId) return;

    const msg: ChatMessage = {
      id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
      senderId: myId,
      senderName: myName,
      text: type === "audio" ? "🎵 Mensagem de áudio" : trimmed,
      timestamp: Date.now(),
    };

    onNewMessage(msg);
    if (socket) {
      socket.emit("chat:send", { rideId, senderId: myId, senderName: myName, text: msg.text, msgId: msg.id, type });
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (type === "text") setText("");
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
  }

  function handleAudioPress() {
    if (isRecording) {
      setIsRecording(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      sendMessage("audio_mock_payload", "audio");
    } else {
      setIsRecording(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }

  function formatTime(ts: number) {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  }

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              paddingBottom: insets.bottom + 8,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={[styles.headerAvatar, { backgroundColor: colors.secondary }]}>
              <Text style={styles.headerAvatarText}>{(otherName ?? "")[0]?.toUpperCase() ?? "?"}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.headerName, { color: colors.foreground }]}>{otherName}</Text>
              <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>Chat da corrida</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.muted }]}>
              <Feather name="x" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          {/* Messages */}
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={styles.messageList}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Feather name="message-circle" size={32} color={colors.border} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  Diga olá para {(otherName ?? "você").split(" ")[0]}!
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const isMine = item.senderId === myId;
              return (
                <View style={[styles.msgRow, isMine ? styles.msgRowRight : styles.msgRowLeft]}>
                  <View
                    style={[
                      styles.bubble,
                      isMine
                        ? { backgroundColor: colors.primary }
                        : { backgroundColor: colors.muted, borderColor: colors.border, borderWidth: 1 },
                    ]}
                  >
                    <Text style={[styles.bubbleText, { color: isMine ? "#fff" : colors.foreground }]}>
                      {item.text}
                    </Text>
                    <Text style={[styles.bubbleTime, { color: isMine ? "rgba(255,255,255,0.6)" : colors.mutedForeground }]}>
                      {formatTime(item.timestamp)}
                    </Text>
                  </View>
                </View>
              );
            }}
          />

          {/* Quick replies */}
          <FlatList
            horizontal
            data={QUICK_REPLIES}
            keyExtractor={(q) => q}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickList}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.quickChip, { backgroundColor: colors.muted, borderColor: colors.border }]}
                onPress={() => sendMessage(item)}
                activeOpacity={0.7}
              >
                <Text style={[styles.quickText, { color: colors.foreground }]}>{item}</Text>
              </TouchableOpacity>
            )}
          />

          {/* Input */}
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
            <View style={[styles.inputRow, { borderTopColor: colors.border }]}>
              <TextInput
                style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
                placeholder="Mensagem..."
                placeholderTextColor={colors.mutedForeground}
                value={text}
                onChangeText={setText}
                multiline
                maxLength={200}
                returnKeyType="send"
                onSubmitEditing={() => sendMessage(text)}
              />
              {text.trim() ? (
                <TouchableOpacity
                  style={[styles.sendBtn, { backgroundColor: colors.primary }]}
                  onPress={() => sendMessage(text)}
                  activeOpacity={0.8}
                >
                  <Feather name="send" size={18} color="#fff" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.sendBtn, { backgroundColor: isRecording ? "#ff4444" : colors.muted }]}
                  onPress={handleAudioPress}
                  activeOpacity={0.8}
                >
                  <Feather name={isRecording ? "mic-off" : "mic"} size={18} color={isRecording ? "#fff" : colors.mutedForeground} />
                </TouchableOpacity>
              )}
            </View>
          </KeyboardAvoidingView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, maxHeight: "75%", minHeight: 420 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderBottomWidth: 1 },
  headerAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  headerAvatarText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
  headerName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular" },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  messageList: { padding: 16, gap: 8, flexGrow: 1 },
  emptyBox: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 32 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  msgRow: { marginBottom: 6 },
  msgRowRight: { alignItems: "flex-end" },
  msgRowLeft: { alignItems: "flex-start" },
  bubble: { maxWidth: "78%", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 9, gap: 2 },
  bubbleText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  bubbleTime: { fontSize: 10, fontFamily: "Inter_400Regular", alignSelf: "flex-end" },
  quickList: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  quickChip: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 7 },
  quickText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 10, padding: 12, borderTopWidth: 1 },
  input: { flex: 1, borderRadius: 20, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, fontFamily: "Inter_400Regular", maxHeight: 96 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
});
