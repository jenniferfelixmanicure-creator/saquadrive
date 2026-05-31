import { Feather } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import type { NavStep } from "@/lib/google-maps";

type Props = {
  step: NavStep | null;
  nextStep?: NavStep | null;
  distanceToStep: number;       // metros até a próxima manobra
  totalRemaining: number;       // metros totais restantes
  durationRemaining: number;    // segundos totais restantes
  onClose?: () => void;
};

function formatDist(meters: number): string {
  if (meters < 50)   return "Agora";
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatETA(seconds: number): string {
  const min = Math.ceil(seconds / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}

export default function NavigationOverlay({
  step,
  nextStep,
  distanceToStep,
  totalRemaining,
  durationRemaining,
  onClose,
}: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(-120)).current;

  // Slide in on mount
  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 0,
      tension: 80,
      friction: 12,
      useNativeDriver: true,
    }).start();
  }, []);

  // Pulse when close to maneuver
  useEffect(() => {
    if (distanceToStep < 80) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 350, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [distanceToStep < 80]);

  if (!step) return null;

  const isImminent = distanceToStep < 80;
  const iconColor = isImminent ? "#FF9500" : "#00C4FF";
  const bgColor = isImminent ? "rgba(255,149,0,0.18)" : "rgba(0,196,255,0.15)";

  return (
    <Animated.View
      style={[
        styles.container,
        { paddingTop: insets.top + 8, transform: [{ translateY: slideAnim }] },
      ]}
    >
      {/* Main instruction card */}
      <View style={[styles.card, { backgroundColor: "rgba(8,12,16,0.95)", borderColor: "rgba(255,255,255,0.08)" }]}>
        <View style={styles.row}>
          {/* Maneuver icon */}
          <Animated.View
            style={[styles.iconBox, { backgroundColor: bgColor, transform: [{ scale: pulseAnim }] }]}
          >
            <Feather
              name={step.maneuverIcon as keyof typeof Feather.glyphMap}
              size={28}
              color={iconColor}
            />
          </Animated.View>

          {/* Instruction */}
          <View style={styles.instructionBlock}>
            <Text style={styles.distText}>{formatDist(distanceToStep)}</Text>
            <Text style={styles.instrText} numberOfLines={2}>
              {step.instruction}
            </Text>
            {step.streetName ? (
              <Text style={styles.streetText} numberOfLines={1}>
                {step.streetName}
              </Text>
            ) : null}
          </View>

          {/* Close button */}
          {onClose && (
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="x" size={16} color="rgba(255,255,255,0.4)" />
            </TouchableOpacity>
          )}
        </View>

        {/* Bottom row: total remaining + ETA + next step preview */}
        <View style={[styles.bottomRow, { borderTopColor: "rgba(255,255,255,0.06)" }]}>
          <View style={styles.etaBlock}>
            <Feather name="clock" size={12} color="rgba(255,255,255,0.4)" />
            <Text style={styles.etaText}>{formatETA(durationRemaining)}</Text>
          </View>
          <View style={styles.separator} />
          <View style={styles.etaBlock}>
            <Feather name="map" size={12} color="rgba(255,255,255,0.4)" />
            <Text style={styles.etaText}>{formatDist(totalRemaining)}</Text>
          </View>
          {nextStep && (
            <>
              <View style={styles.separator} />
              <View style={styles.etaBlock}>
                <Feather
                  name={nextStep.maneuverIcon as keyof typeof Feather.glyphMap}
                  size={12}
                  color="rgba(255,255,255,0.35)"
                />
                <Text style={[styles.etaText, { color: "rgba(255,255,255,0.35)" }]} numberOfLines={1}>
                  depois: {nextStep.instruction}
                </Text>
              </View>
            </>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    zIndex: 100,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    gap: 14,
  },
  iconBox: {
    width: 58,
    height: 58,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  instructionBlock: {
    flex: 1,
    gap: 2,
  },
  distText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#00C4FF",
    letterSpacing: 0.3,
  },
  instrText: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
    letterSpacing: -0.3,
    lineHeight: 22,
  },
  streetText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.45)",
  },
  closeBtn: {
    padding: 4,
    alignSelf: "flex-start",
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    gap: 10,
  },
  etaBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flex: 1,
    minWidth: 0,
  },
  etaText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.5)",
    flexShrink: 1,
  },
  separator: {
    width: 1,
    height: 14,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
});
