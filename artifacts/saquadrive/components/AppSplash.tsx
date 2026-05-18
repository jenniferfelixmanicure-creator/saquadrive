import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";

export default function AppSplash() {
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.85)).current;
  const sloganOpacity = useRef(new Animated.Value(0)).current;
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    // Logo entra com fade + scale
    Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1, duration: 600, useNativeDriver: true,
        easing: Easing.out(Easing.ease),
      }),
      Animated.timing(logoScale, {
        toValue: 1, duration: 600, useNativeDriver: true,
        easing: Easing.out(Easing.back(1.2)),
      }),
    ]).start();

    // Slogan aparece depois do logo
    Animated.sequence([
      Animated.delay(400),
      Animated.timing(sloganOpacity, {
        toValue: 1, duration: 500, useNativeDriver: true,
        easing: Easing.out(Easing.ease),
      }),
    ]).start();

    // Dots de loading pulsando em cascata
    const pulse = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0.3, duration: 400, useNativeDriver: true }),
          Animated.delay(400),
        ])
      );
    pulse(dot1, 0).start();
    pulse(dot2, 200).start();
    pulse(dot3, 400).start();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.center}>
        <Animated.View style={{ opacity: logoOpacity, transform: [{ scale: logoScale }] }}>
          <Text style={styles.logo}>ZeroRisco</Text>
        </Animated.View>
        <Animated.View style={{ opacity: sloganOpacity }}>
          <Text style={styles.slogan}>Sua segurança em primeiro lugar</Text>
        </Animated.View>
      </View>

      <View style={styles.dotsRow}>
        {[dot1, dot2, dot3].map((d, i) => (
          <Animated.View key={i} style={[styles.dot, { opacity: d }]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0D0D0D",
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    alignItems: "center",
    gap: 12,
  },
  logo: {
    fontSize: 48,
    fontWeight: "900",
    color: "#00C4FF",
    letterSpacing: -1,
  },
  slogan: {
    fontSize: 15,
    color: "rgba(255,255,255,0.55)",
    letterSpacing: 0.3,
    textAlign: "center",
  },
  dotsRow: {
    position: "absolute",
    bottom: 80,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#00C4FF",
  },
});
