import React, { useEffect, useRef } from "react";
import { Animated, Easing, Image, StyleSheet, Text, View } from "react-native";

const G = "#00FF88";

export default function MonitoringBanner() {
  const pulse = useRef(new Animated.Value(1)).current;
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const glow  = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.1, duration: 1100, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(pulse, { toValue: 1,   duration: 1100, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1,   duration: 1300, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
        Animated.timing(glow, { toValue: 0.35, duration: 1300, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
      ])
    ).start();

    const makeRing = (a: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(a, { toValue: 1, duration: 2000, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
          Animated.timing(a, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      );
    makeRing(ring1, 0).start();
    makeRing(ring2, 900).start();

    return () => {
      pulse.stopAnimation();
      glow.stopAnimation();
      ring1.stopAnimation();
      ring2.stopAnimation();
    };
  }, []);

  const ringStyle = (a: Animated.Value) => ({
    opacity: a.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0.55, 0.25, 0] }),
    transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] }) }],
  });

  return (
    <View style={styles.card}>
      {/* Logo + anéis */}
      <View style={styles.logoWrap}>
        {[ring1, ring2].map((r, i) => (
          <Animated.View key={i} style={[styles.ring, ringStyle(r)]} />
        ))}
        <Animated.View style={{ transform: [{ scale: pulse }] }}>
          <Image
            source={require("@/assets/images/zerorisco_logo_futuristic.png")}
            style={styles.logo}
            resizeMode="contain"
          />
        </Animated.View>
      </View>

      {/* Textos */}
      <Animated.Text style={[styles.label1, { opacity: glow }]}>
        IA Monitorando
      </Animated.Text>
      <Text style={styles.label2}>100% Seguro</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: "center",
    alignItems: "center",
    backgroundColor: "rgba(10,18,10,0.92)",
    borderWidth: 1,
    borderColor: "rgba(0,255,136,0.3)",
    borderRadius: 20,
    paddingHorizontal: 28,
    paddingVertical: 16,
    gap: 6,
    shadowColor: G,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  logoWrap: {
    width: 72,
    height: 72,
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    position: "absolute",
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1.5,
    borderColor: G,
  },
  logo: {
    width: 52,
    height: 52,
  },
  label1: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: G,
    letterSpacing: 0.8,
    textShadowColor: G,
    textShadowRadius: 6,
  },
  label2: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "rgba(0,255,136,0.55)",
  },
});
