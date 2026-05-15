import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';

interface SOSButtonProps {
  onPress: () => void;
}

export default function SOSButton({ onPress }: SOSButtonProps) {
  const colors = useColors();
  const [isPressed, setIsPressed] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  const handlePressIn = () => {
    setIsPressed(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 0.9, useNativeDriver: true }),
      Animated.timing(progressAnim, { toValue: 1, duration: 2000, useNativeDriver: false })
    ]).start(({ finished }) => {
      if (finished) {
        triggerSOS();
      }
    });
  };

  const handlePressOut = () => {
    setIsPressed(false);
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }),
      Animated.timing(progressAnim, { toValue: 0, duration: 200, useNativeDriver: false })
    ]).start();
  };

  const triggerSOS = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Alert.alert(
      "🚨 ALERTA SOS ENVIADO",
      "Sua localização e dados da corrida foram enviados para a central de segurança e contatos de emergência.",
      [{ text: "OK", style: "destructive" }]
    );
    onPress();
  };

  return (
    <View style={styles.container}>
      <Animated.View 
        style={[
          styles.buttonWrapper, 
          { transform: [{ scale: scaleAnim }] }
        ]}
      >
        <TouchableOpacity
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={1}
          style={[
            styles.button, 
            { backgroundColor: colors.error, shadowColor: colors.error }
          ]}
        >
          <Feather name="shield" size={28} color="#fff" />
          <Text style={styles.buttonText}>SOS</Text>
        </TouchableOpacity>
        
        {isPressed && (
          <View style={styles.progressContainer}>
            <Animated.View 
              style={[
                styles.progressBar, 
                { 
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%']
                  }),
                  backgroundColor: '#fff' 
                }
              ]} 
            />
          </View>
        )}
      </Animated.View>
      {isPressed && (
        <Text style={[styles.instruction, { color: colors.error }]}>Segure por 2 segundos</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 20,
    top: 150, // Abaixo do botão de localização
    alignItems: 'center',
    zIndex: 1000,
  },
  buttonWrapper: {
    alignItems: 'center',
  },
  button: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: -2,
  },
  progressContainer: {
    position: 'absolute',
    bottom: -10,
    width: 60,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
  },
  instruction: {
    marginTop: 15,
    fontSize: 12,
    fontWeight: 'bold',
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
    elevation: 2,
  }
});
