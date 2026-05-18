import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Alert, Linking, Modal } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';

interface SOSButtonProps {
  onPress: () => void;
}

export default function SOSButton({ onPress }: SOSButtonProps) {
  const colors = useColors();
  const [isPressed, setIsPressed] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  const handlePressIn = () => {
    setIsPressed(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    animRef.current = Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 0.9, useNativeDriver: true }),
      Animated.timing(progressAnim, { toValue: 1, duration: 2000, useNativeDriver: false }),
    ]);
    animRef.current.start(({ finished }) => {
      if (finished) triggerSOS();
    });
  };

  const handlePressOut = () => {
    if (isPressed) {
      setIsPressed(false);
      animRef.current?.stop();
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }),
        Animated.timing(progressAnim, { toValue: 0, duration: 200, useNativeDriver: false }),
      ]).start();
    }
  };

  const triggerSOS = () => {
    setIsPressed(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    onPress();
    setShowModal(true);
  };

  function callNumber(number: string, label: string) {
    setShowModal(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Linking.openURL(`tel:${number}`).catch(() =>
      Alert.alert('Erro', `Não foi possível ligar para ${label} (${number}). Disque manualmente.`)
    );
  }

  return (
    <>
      <View style={styles.container}>
        <Animated.View style={[styles.buttonWrapper, { transform: [{ scale: scaleAnim }] }]}>
          <TouchableOpacity
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            activeOpacity={1}
            style={[styles.button, { backgroundColor: colors.error, shadowColor: colors.error }]}
          >
            <Feather name="shield" size={24} color="#fff" />
            <Text style={styles.buttonText}>SOS</Text>
          </TouchableOpacity>
          {isPressed && (
            <View style={styles.progressContainer}>
              <Animated.View
                style={[styles.progressBar, {
                  width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                  backgroundColor: '#fff',
                }]}
              />
            </View>
          )}
        </Animated.View>
        {isPressed && (
          <Text style={[styles.instruction, { color: colors.error }]}>Segure 2s…</Text>
        )}
      </View>

      <Modal visible={showModal} transparent animationType="fade" onRequestClose={() => setShowModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Feather name="alert-triangle" size={28} color="#FF3B30" />
              <Text style={styles.modalTitle}>SOS — Emergência</Text>
            </View>
            <Text style={styles.modalDesc}>
              Alerta enviado para a central. Selecione o serviço de emergência:
            </Text>
            <TouchableOpacity style={[styles.emergencyBtn, { backgroundColor: '#1C3A8A' }]} onPress={() => callNumber('190', 'Polícia')} activeOpacity={0.85}>
              <Feather name="shield" size={20} color="#fff" />
              <View style={styles.emergencyInfo}>
                <Text style={styles.emergencyLabel}>Polícia Militar</Text>
                <Text style={styles.emergencyNumber}>190</Text>
              </View>
              <Feather name="phone-call" size={18} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.emergencyBtn, { backgroundColor: '#C0392B' }]} onPress={() => callNumber('192', 'SAMU')} activeOpacity={0.85}>
              <Feather name="heart" size={20} color="#fff" />
              <View style={styles.emergencyInfo}>
                <Text style={styles.emergencyLabel}>SAMU — Ambulância</Text>
                <Text style={styles.emergencyNumber}>192</Text>
              </View>
              <Feather name="phone-call" size={18} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.emergencyBtn, { backgroundColor: '#E67E22' }]} onPress={() => callNumber('193', 'Bombeiros')} activeOpacity={0.85}>
              <Feather name="wind" size={20} color="#fff" />
              <View style={styles.emergencyInfo}>
                <Text style={styles.emergencyLabel}>Corpo de Bombeiros</Text>
                <Text style={styles.emergencyNumber}>193</Text>
              </View>
              <Feather name="phone-call" size={18} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowModal(false)} activeOpacity={0.7}>
              <Text style={styles.closeBtnText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', right: 16, top: 150, alignItems: 'center', zIndex: 1000 },
  buttonWrapper: { alignItems: 'center' },
  button: {
    width: 58, height: 58, borderRadius: 29,
    justifyContent: 'center', alignItems: 'center',
    elevation: 8, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 5,
  },
  buttonText: { color: '#fff', fontSize: 10, fontWeight: 'bold', marginTop: -2 },
  progressContainer: {
    position: 'absolute', bottom: -10, width: 58, height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2, overflow: 'hidden',
  },
  progressBar: { height: '100%' },
  instruction: {
    marginTop: 14, fontSize: 11, fontWeight: 'bold',
    backgroundColor: '#fff', paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 5, elevation: 2,
  },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modalCard: { width: '100%', backgroundColor: '#1a1a2e', borderRadius: 20, padding: 24, gap: 12 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  modalTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', color: '#fff' },
  modalDesc: { fontSize: 14, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.7)', lineHeight: 20 },
  emergencyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 16, borderRadius: 14,
  },
  emergencyInfo: { flex: 1 },
  emergencyLabel: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#fff' },
  emergencyNumber: { fontSize: 22, fontFamily: 'Inter_700Bold', color: '#fff', letterSpacing: 2 },
  closeBtn: { alignItems: 'center', paddingVertical: 12, marginTop: 4 },
  closeBtnText: { fontSize: 14, fontFamily: 'Inter_500Medium', color: 'rgba(255,255,255,0.5)' },
});
