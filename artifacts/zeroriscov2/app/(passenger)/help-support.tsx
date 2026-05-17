import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Platform } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/AuthContext';
import { Feather } from '@expo/vector-icons';

export default function HelpSupportScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const router = useRouter();

  const SUPPORT_NUMBER = "5521978670637";
  const SUPPORT_MESSAGE = `Olá! Sou o ${user?.name || 'Usuário'} e preciso de suporte no app ZeroRisco.`;

  const handleOpenWhatsApp = () => {
    const url = `whatsapp://send?phone=${SUPPORT_NUMBER}&text=${encodeURIComponent(SUPPORT_MESSAGE)}`;
    
    Linking.canOpenURL(url).then(supported => {
      if (supported) {
        return Linking.openURL(url);
      } else {
        // Fallback para link web se o app não estiver instalado
        const webUrl = `https://wa.me/${SUPPORT_NUMBER}?text=${encodeURIComponent(SUPPORT_MESSAGE)}`;
        return Linking.openURL(webUrl);
      }
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen 
        options={{ 
          title: 'Ajuda e Suporte', 
          headerStyle: { backgroundColor: colors.background }, 
          headerTintColor: colors.foreground,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 10 }}>
              <Feather name="arrow-left" size={24} color={colors.foreground} />
            </TouchableOpacity>
          )
        }} 
      />
      
      <View style={styles.content}>
        <View style={[styles.iconContainer, { backgroundColor: colors.card }]}>
          <Feather name="headphones" size={60} color={colors.primary} />
        </View>
        
        <Text style={[styles.title, { color: colors.foreground }]}>Como podemos ajudar?</Text>
        
        <Text style={[styles.description, { color: colors.mutedForeground }]}>
          Nossa equipe de suporte está disponível para resolver qualquer dúvida ou problema com suas corridas.
        </Text>

        <TouchableOpacity 
          style={[styles.whatsappButton, { backgroundColor: '#25D366' }]} 
          onPress={handleOpenWhatsApp}
          activeOpacity={0.8}
        >
          <Feather name="message-circle" size={24} color="#fff" />
          <Text style={styles.buttonText}>Falar no WhatsApp</Text>
        </TouchableOpacity>

        <View style={[styles.infoBox, { backgroundColor: colors.card }]}>
          <Text style={[styles.infoTitle, { color: colors.foreground }]}>Atendimento Local</Text>
          <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
            Segunda a Sábado: 08:00 às 22:00{"\n"}
            Domingos e Feriados: 09:00 às 18:00
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 15,
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
  },
  whatsappButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 30,
    width: '100%',
    gap: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  infoBox: {
    marginTop: 40,
    padding: 20,
    borderRadius: 15,
    width: '100%',
    alignItems: 'center',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
