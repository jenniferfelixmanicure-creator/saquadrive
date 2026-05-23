import React, { useEffect, useRef, useState } from "react";
import {
  Animated, Easing, StyleSheet, Text, View,
} from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";

const G = "#00FF88";
const G2 = "#00C4FF";
const CARD = "rgba(0,255,136,0.06)";
const BORDER = "rgba(0,255,136,0.18)";

function useLoop(anim: Animated.Value, toValue: number, duration: number, back = true) {
  useEffect(() => {
    const seq = back
      ? Animated.sequence([
          Animated.timing(anim, { toValue, duration, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
          Animated.timing(anim, { toValue: 1, duration, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        ])
      : Animated.timing(anim, { toValue, duration, useNativeDriver: true, easing: Easing.linear });
    Animated.loop(seq).start();
    return () => anim.stopAnimation();
  }, []);
}

function SparkLine({ points, color, w, h }: { points: number[]; color: string; w: number; h: number }) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const xs = points.map((_, i) => (i / (points.length - 1)) * w);
  const ys = points.map((v) => h - ((v - min) / range) * (h - 4) - 2);

  return (
    <View style={{ width: w, height: h, position: "relative" }}>
      {points.slice(0, -1).map((_, i) => {
        const x1 = xs[i], y1 = ys[i], x2 = xs[i + 1], y2 = ys[i + 1];
        const dx = x2 - x1, dy = y2 - y1;
        const len = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        return (
          <View
            key={i}
            style={{
              position: "absolute",
              left: x1,
              top: y1,
              width: len,
              height: 1.5,
              backgroundColor: color,
              opacity: 0.85,
              transformOrigin: "0 50%",
              transform: [{ rotate: `${angle}deg` }],
            }}
          />
        );
      })}
      {/* Fill glow under last point */}
      <View style={{ position: "absolute", left: xs[xs.length - 1] - 3, top: ys[ys.length - 1] - 3, width: 6, height: 6, borderRadius: 3, backgroundColor: color, opacity: 0.9 }} />
    </View>
  );
}

export default function MonitoringBanner() {
  const shieldPulse = useRef(new Animated.Value(1)).current;
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const ring3 = useRef(new Animated.Value(0)).current;
  const ecgX = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0.4)).current;
  const dotBlink = useRef(new Animated.Value(1)).current;

  const [threats, setThreats] = useState(125);
  const [pct, setPct] = useState(20);
  const [bars, setBars] = useState([18, 30, 22, 42, 28, 38, 50]);
  const [traffic, setTraffic] = useState([28, 40, 33, 55, 38, 50, 45]);

  useLoop(shieldPulse, 1.07, 1100);
  useLoop(glowAnim, 1, 1600);
  useLoop(dotBlink, 0.2, 600);

  useEffect(() => {
    const makeRing = (a: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(a, { toValue: 1, duration: 2000, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
          Animated.timing(a, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      );
    makeRing(ring1, 0).start();
    makeRing(ring2, 660).start();
    makeRing(ring3, 1320).start();

    Animated.loop(
      Animated.timing(ecgX, { toValue: 1, duration: 1800, useNativeDriver: true, easing: Easing.linear })
    ).start();

    let t = 125, p = 20;
    const ci = setInterval(() => {
      t = Math.min(128, t + 1);
      p = Math.min(23, p + 1);
      setThreats(t);
      setPct(p);
      if (t >= 128 && p >= 23) clearInterval(ci);
    }, 500);

    const bi = setInterval(() => {
      setBars((prev) =>
        prev.map((b) => Math.max(10, Math.min(60, b + (Math.random() - 0.5) * 14)))
      );
    }, 1100);

    const ti = setInterval(() => {
      setTraffic((prev) => {
        const next = Math.max(18, Math.min(72, prev[prev.length - 1] + (Math.random() - 0.45) * 16));
        return [...prev.slice(1), next];
      });
    }, 900);

    const bumpTimer = setInterval(() => {
      setThreats((v) => (Math.random() > 0.65 ? v + 1 : v));
    }, 7000);

    return () => {
      clearInterval(ci); clearInterval(bi); clearInterval(ti); clearInterval(bumpTimer);
      ring1.stopAnimation(); ring2.stopAnimation(); ring3.stopAnimation();
      ecgX.stopAnimation(); glowAnim.stopAnimation(); dotBlink.stopAnimation();
    };
  }, []);

  const ringScale = (a: Animated.Value, max: number) =>
    a.interpolate({ inputRange: [0, 1], outputRange: [1, max] });
  const ringOp = (a: Animated.Value) =>
    a.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0.75, 0.4, 0] });
  const ecgTx = ecgX.interpolate({ inputRange: [0, 1], outputRange: [-50, 50] });
  const shieldGlow = glowAnim.interpolate({ inputRange: [0, 1], outputRange: ["rgba(0,255,136,0.10)", "rgba(0,255,136,0.28)"] });

  return (
    <View style={styles.root}>
      {/* ── Stat cards row ── */}
      <View style={styles.statRow}>
        {/* Traffic card */}
        <View style={styles.statCard}>
          <Text style={styles.statTitle}>TRÁFEGO DE DADOS</Text>
          <View style={styles.dotRow}>
            <Animated.View style={[styles.statusDot, { opacity: dotBlink }]} />
            <Text style={styles.dotLabel}>SEGURO</Text>
          </View>
          <SparkLine points={traffic} color={G} w={90} h={32} />
        </View>

        {/* Threats card */}
        <View style={styles.statCard}>
          <Text style={styles.statTitle}>AMEAÇAS BLOQUEADAS</Text>
          <Text style={styles.statSub}>Últimas 24h</Text>
          <View style={styles.threatRow}>
            <Text style={styles.threatNum}>{threats}</Text>
            <Text style={styles.threatPct}>+{pct}%</Text>
          </View>
          <View style={styles.barChart}>
            {bars.map((h, i) => (
              <View
                key={i}
                style={[
                  styles.bar,
                  {
                    height: h * 0.5,
                    backgroundColor: i >= bars.length - 2 ? G : G + "66",
                  },
                ]}
              />
            ))}
          </View>
        </View>
      </View>

      {/* ── Shield section ── */}
      <View style={styles.shieldSection}>
        {/* Rings */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {[
            { a: ring1, s: 2.0, c: G },
            { a: ring2, s: 2.6, c: G2 },
            { a: ring3, s: 3.1, c: G },
          ].map(({ a, s, c }, i) => (
            <Animated.View
              key={i}
              style={[
                styles.ring,
                { borderColor: c, opacity: ringOp(a), transform: [{ scale: ringScale(a, s) }] },
              ]}
            />
          ))}
        </View>

        {/* Shield */}
        <Animated.View style={{ transform: [{ scale: shieldPulse }] }}>
          <Animated.View style={[styles.shieldOuter, { backgroundColor: shieldGlow }]}>
            <View style={styles.shieldInner}>
              <Feather name="shield" size={32} color={G} style={styles.shieldBg} />
              <Text style={styles.shieldZ}>Z</Text>
            </View>
          </Animated.View>
        </Animated.View>

        {/* MONITORANDO */}
        <Animated.Text style={[styles.monitorText, { opacity: glowAnim }]}>
          MONITORANDO
        </Animated.Text>

        {/* ECG line */}
        <View style={styles.ecgWrap}>
          <View style={styles.ecgLine} />
          <Animated.View style={[styles.ecgPulse, { transform: [{ translateX: ecgTx }] }]}>
            <Text style={styles.ecgChar}>∿</Text>
          </Animated.View>
        </View>
      </View>

      {/* ── Feature strip ── */}
      <View style={styles.featureRow}>
        {[
          { icon: "brain", label: "IA ATIVA", desc: "Análise em\ntempo real" },
          { icon: "map-pin", label: "GPS SEGURO", desc: "Localização\nprotegida" },
          { icon: "lock", label: "CRIPTOGRAFADO", desc: "Dados com\ncriptografia" },
        ].map((f, i) => (
          <View key={i} style={styles.featureCard}>
            <View style={styles.featureIconBox}>
              <Feather name={f.icon as any} size={15} color={G} />
            </View>
            <Text style={styles.featureLabel}>{f.label}</Text>
            <Text style={styles.featureDesc}>{f.desc}</Text>
            <View style={styles.dotRow}>
              <View style={[styles.statusDot, { width: 5, height: 5, borderRadius: 3 }]} />
              <Text style={styles.activeTxt}>ATIVO</Text>
            </View>
          </View>
        ))}
      </View>

      {/* ── Footer bar ── */}
      <View style={styles.footer}>
        <View style={styles.percentBox}>
          <Text style={styles.percentTxt}>100%</Text>
        </View>
        <View style={styles.levelBlock}>
          <Text style={styles.levelLabel}>NÍVEL DE PROTEÇÃO</Text>
          <Text style={styles.levelValue}>MÁXIMO</Text>
          <View style={styles.segRow}>
            {[...Array(7)].map((_, i) => (
              <View key={i} style={styles.seg} />
            ))}
          </View>
        </View>
        <View style={styles.versionBlock}>
          <Text style={styles.versionLabel}>SISTEMA</Text>
          <Text style={styles.versionValue}>ATUALIZADO</Text>
          <Text style={styles.versionNum}>Versão 3.2.7</Text>
        </View>
        <View style={styles.shieldSmall}>
          <Feather name="shield" size={16} color={G} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: "100%", gap: 8 },

  /* stat row */
  statRow: { flexDirection: "row", gap: 8 },
  statCard: { flex: 1, backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 12, padding: 8, gap: 3 },
  statTitle: { fontSize: 9, fontFamily: "Inter_700Bold", color: G, letterSpacing: 0.8 },
  statSub: { fontSize: 8, fontFamily: "Inter_400Regular", color: "rgba(0,255,136,0.5)" },
  dotRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: G, shadowColor: G, shadowOpacity: 0.9, shadowRadius: 4, elevation: 3 },
  dotLabel: { fontSize: 8, fontFamily: "Inter_700Bold", color: G },
  threatRow: { flexDirection: "row", alignItems: "baseline", gap: 5 },
  threatNum: { fontSize: 24, fontFamily: "Inter_700Bold", color: "#fff" },
  threatPct: { fontSize: 11, fontFamily: "Inter_700Bold", color: G },
  barChart: { flexDirection: "row", alignItems: "flex-end", gap: 3, height: 32, marginTop: 2 },
  bar: { flex: 1, borderRadius: 2 },

  /* shield section */
  shieldSection: { alignItems: "center", gap: 4, paddingVertical: 4 },
  ring: { position: "absolute", alignSelf: "center", top: "50%", width: 72, height: 72, borderRadius: 36, borderWidth: 1.5, marginTop: -36 },
  shieldOuter: { width: 72, height: 72, borderRadius: 36, borderWidth: 1.5, borderColor: G + "66", alignItems: "center", justifyContent: "center", shadowColor: G, shadowOpacity: 0.7, shadowRadius: 14, elevation: 10 },
  shieldInner: { alignItems: "center", justifyContent: "center", position: "relative" },
  shieldBg: { position: "absolute", opacity: 0.2 },
  shieldZ: { fontSize: 26, fontFamily: "Inter_700Bold", color: G, textShadowColor: G, textShadowRadius: 10 },
  monitorText: { fontSize: 13, fontFamily: "Inter_700Bold", color: G, letterSpacing: 4, textShadowColor: G, textShadowRadius: 8 },
  ecgWrap: { width: 120, height: 16, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  ecgLine: { position: "absolute", left: 0, right: 0, height: 1, backgroundColor: G + "40" },
  ecgPulse: { position: "absolute" },
  ecgChar: { fontSize: 18, color: G, lineHeight: 18, textShadowColor: G, textShadowRadius: 6 },

  /* features */
  featureRow: { flexDirection: "row", gap: 6 },
  featureCard: { flex: 1, backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 12, padding: 8, alignItems: "center", gap: 3 },
  featureIconBox: { width: 30, height: 30, borderRadius: 8, backgroundColor: "rgba(0,255,136,0.12)", borderWidth: 1, borderColor: BORDER, alignItems: "center", justifyContent: "center" },
  featureLabel: { fontSize: 8, fontFamily: "Inter_700Bold", color: G, textAlign: "center", letterSpacing: 0.3 },
  featureDesc: { fontSize: 8, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.5)", textAlign: "center", lineHeight: 11 },
  activeTxt: { fontSize: 8, fontFamily: "Inter_700Bold", color: G },

  /* footer */
  footer: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 12, padding: 8 },
  percentBox: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: G, alignItems: "center", justifyContent: "center", shadowColor: G, shadowOpacity: 0.5, shadowRadius: 6 },
  percentTxt: { fontSize: 9, fontFamily: "Inter_700Bold", color: G },
  levelBlock: { flex: 1, gap: 2 },
  levelLabel: { fontSize: 8, fontFamily: "Inter_700Bold", color: "rgba(255,255,255,0.5)", letterSpacing: 0.5 },
  levelValue: { fontSize: 13, fontFamily: "Inter_700Bold", color: G },
  segRow: { flexDirection: "row", gap: 3 },
  seg: { flex: 1, height: 4, borderRadius: 2, backgroundColor: G },
  versionBlock: { alignItems: "center", gap: 1 },
  versionLabel: { fontSize: 7, fontFamily: "Inter_700Bold", color: "rgba(255,255,255,0.4)", letterSpacing: 0.5 },
  versionValue: { fontSize: 10, fontFamily: "Inter_700Bold", color: G },
  versionNum: { fontSize: 7, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.4)" },
  shieldSmall: { width: 32, height: 32, borderRadius: 8, borderWidth: 1, borderColor: G + "44", alignItems: "center", justifyContent: "center" },
});
