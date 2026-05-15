import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

interface SubscriptionLockProps {
  expiresAt?: string;
}

export default function SubscriptionLock({ expiresAt }: SubscriptionLockProps) {
  const colors = useColors();
  const SUPPORT_NUMBER = "5521978670637";
  const MESSAGE = "Olá! Minha mensalidade do ZeroRisco venceu e gostaria de renovar para continuar trabalhando.";

  const handleRenew = () => {
    const url = `https://wa.me/${SUPPORT_NUMBER}?text=${encodeURIComponent(MESSAGE)}`;
    Linking.openURL(url);
  };

  return (
    <View style={[styles.container, { backgroundColor: 'rgba(0,0,0,0.85)' }]}>
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <View style={[styles.iconContainer, { backgroundColor: colors.error + '22' }]}>
          <Feather name="lock" size={50} color={colors.error} />
        </View>
        
        <Text style={[styles.title, { color: colors.foreground }]}>Acesso Bloqueado</Text>
        
        <Text style={[styles.description, { color: colors.mutedForeground }]}>
          Sua mensalidade do ZeroRisco venceu{expiresAt ? ` em ${new Date(expiresAt).toLocaleDateString()}` : ''}. 
          Para continuar recebendo corridas e lucrando, realize a renovação agora.
        </Text>

        <TouchableOpacity 
          style={[styles.button, { backgroundColor: colors.primary }]} 
          onPress={handleRenew}
        >
          <Text style={styles.buttonText}>Renovar Mensalidade</Text>
          <Feather name="external-link" size={18} color="#fff" />
        </TouchableOpacity>

        <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
          O ZeroRisco não cobra comissão por corrida. Sua mensalidade garante o uso ilimitado da plataforma.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    padding: 20,
  },
  card: {
    width: '100%',
    padding: 30,
    borderRadius: 25,
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 25,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 25,
    borderRadius: 15,
    width: '100%',
    gap: 10,
    marginBottom: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  footerText: {
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
