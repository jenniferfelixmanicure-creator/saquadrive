import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";

const NEON = "#00C4FF";
const NEON_GREEN = "#00FF88";

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function AIMonitoringPopup({ visible, onClose }: Props) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const shieldPulse = useRef(new Animated.Value(1)).current;

  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const ring3 = useRef(new Animated.Value(0)).current;
  const ring1Opacity = useRef(new Animated.Value(0.8)).current;
  const ring2Opacity = useRef(new Animated.Value(0.8)).current;
  const ring3Opacity = useRef(new Animated.Value(0.8)).current;

  const glowAnim = useRef(new Animated.Value(0)).current;
  const autoCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 60,
          friction: 8,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(shieldPulse, { toValue: 1.08, duration: 800, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
          Animated.timing(shieldPulse, { toValue: 1, duration: 800, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        ])
      ).start();

      Animated.loop(
        Animated.timing(glowAnim, { toValue: 1, duration: 1500, useNativeDriver: false, easing: Easing.inOut(Easing.ease) })
      ).start();

      function makeRing(scale: Animated.Value, opacity: Animated.Value, delay: number) {
        return Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.parallel([
              Animated.timing(scale, { toValue: 1, duration: 2000, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
              Animated.timing(opacity, { toValue: 0, duration: 2000, useNativeDriver: true }),
            ]),
            Animated.parallel([
              Animated.timing(scale, { toValue: 0, duration: 0, useNativeDriver: true }),
              Animated.timing(opacity, { toValue: 0.8, duration: 0, useNativeDriver: true }),
            ]),
          ])
        );
      }

      makeRing(ring1, ring1Opacity, 0).start();
      makeRing(ring2, ring2Opacity, 660).start();
      makeRing(ring3, ring3Opacity, 1320).start();

      autoCloseTimer.current = setTimeout(() => {
        handleClose();
      }, 3800);
    } else {
      if (autoCloseTimer.current) clearTimeout(autoCloseTimer.current);
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);
      shieldPulse.stopAnimation(); shieldPulse.setValue(1);
      glowAnim.stopAnimation(); glowAnim.setValue(0);
      ring1.stopAnimation(); ring1.setValue(0); ring1Opacity.setValue(0.8);
      ring2.stopAnimation(); ring2.setValue(0); ring2Opacity.setValue(0.8);
      ring3.stopAnimation(); ring3.setValue(0); ring3Opacity.setValue(0.8);
    }

    return () => {
      if (autoCloseTimer.current) clearTimeout(autoCloseTimer.current);
    };
  }, [visible]);

  function handleClose() {
    if (autoCloseTimer.current) clearTimeout(autoCloseTimer.current);
    Animated.parallel([
      Animated.timing(scaleAnim, { toValue: 0.85, duration: 200, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => onClose());
  }

  const ringScale = (anim: Animated.Value) =>
    anim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] });

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      <Animated.View style={[styles.overlay, { opacity: opacityAnim }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={handleClose} activeOpacity={1} />

        <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>

          {/* Anéis neon pulsando */}
          <View style={styles.ringsContainer} pointerEvents="none">
            {[{ s: ring1, o: ring1Opacity }, { s: ring2, o: ring2Opacity }, { s: ring3, o: ring3Opacity }].map(({ s, o }, i) => (
              <Animated.View
                key={i}
                style={[
                  styles.ring,
                  {
                    borderColor: i === 1 ? NEON_GREEN : NEON,
                    opacity: o,
                    transform: [{ scale: ringScale(s) }],
                  },
                ]}
              />
            ))}
          </View>

          {/* Shield com logo */}
          <Animated.View style={[styles.shieldWrapper, { transform: [{ scale: shieldPulse }] }]}>
            <View style={styles.shieldOuter}>
              <View style={styles.shieldInner}>
                <Feather name="shield" size={48} color={NEON} style={styles.shieldIcon} />
                <Image
                  source={require("@/assets/images/zerorisco_logo_futuristic.png")}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>
            </View>
          </Animated.View>

          {/* Textos */}
          <View style={styles.textBlock}>
            <Text style={styles.aiLabel}>ZeroRisco IA</Text>
            <Text style={styles.title}>Viagem sendo Monitorada.</Text>
            <Text style={styles.subtitle}>Sua segurança está ativa em tempo real</Text>
          </View>

          {/* Indicador de status */}
          <View style={styles.statusRow}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>Monitoramento ativo</Text>
          </View>

          {/* Botão fechar */}
          <TouchableOpacity style={styles.closeBtn} onPress={handleClose} activeOpacity={0.8}>
            <Text style={styles.closeBtnText}>Entendido</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    width: 280,
    backgroundColor: "#111111",
    borderRadius: 140,
    alignItems: "center",
    paddingTop: 48,
    paddingBottom: 36,
    paddingHorizontal: 32,
    borderWidth: 2,
    borderColor: NEON,
    shadowColor: NEON,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 30,
    elevation: 20,
    overflow: "hidden",
  },
  ringsContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    borderWidth: 2,
  },
  shieldWrapper: {
    marginBottom: 20,
  },
  shieldOuter: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "rgba(0,196,255,0.10)",
    borderWidth: 2,
    borderColor: "rgba(0,196,255,0.4)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: NEON,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 16,
    elevation: 12,
  },
  shieldInner: {
    alignItems: "center",
    justifyContent: "center",
  },
  shieldIcon: {
    position: "absolute",
    opacity: 0.25,
  },
  logo: {
    width: 64,
    height: 64,
  },
  textBlock: {
    alignItems: "center",
    gap: 6,
    marginBottom: 18,
  },
  aiLabel: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: NEON,
    letterSpacing: 3,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
    textAlign: "center",
    lineHeight: 24,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#888888",
    textAlign: "center",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 24,
    backgroundColor: "rgba(0,255,136,0.08)",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "rgba(0,255,136,0.2)",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: NEON_GREEN,
    shadowColor: NEON_GREEN,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 4,
  },
  statusText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: NEON_GREEN,
  },
  closeBtn: {
    backgroundColor: "rgba(0,196,255,0.15)",
    borderRadius: 24,
    paddingHorizontal: 36,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "rgba(0,196,255,0.4)",
  },
  closeBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: NEON,
  },
});
