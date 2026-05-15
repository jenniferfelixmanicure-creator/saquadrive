import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Stack } from 'expo-router';
import { useColors } from '@/hooks/useColors';

export default function TermsOfUseScreen() {
  const colors = useColors();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: 'Termos de Uso', headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.foreground }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.heading, { color: colors.foreground }]}>Termos de Uso do ZeroRisco</Text>
        <Text style={[styles.paragraph, { color: colors.mutedForeground }]}>
          Bem-vindo ao ZeroRisco! Ao utilizar nosso aplicativo, você concorda com os seguintes termos e condições. Por favor, leia-os atentamente.
        </Text>
        
        <Text style={[styles.subheading, { color: colors.foreground }]}>1. Aceitação dos Termos</Text>
        <Text style={[styles.paragraph, { color: colors.mutedForeground }]}>
          Ao acessar ou usar o aplicativo ZeroRisco, você concorda em cumprir e estar vinculado a estes Termos de Uso e à nossa Política de Privacidade. Se você não concorda com qualquer parte destes termos, não utilize o aplicativo.
        </Text>

        <Text style={[styles.subheading, { color: colors.foreground }]}>2. Serviços Oferecidos</Text>
        <Text style={[styles.paragraph, { color: colors.mutedForeground }]}>
          O ZeroRisco é uma plataforma de mobilidade urbana que conecta passageiros a motoristas independentes para serviços de transporte em Saquarema, RJ. Não somos uma empresa de transporte, mas sim um facilitador tecnológico.
        </Text>

        <Text style={[styles.subheading, { color: colors.foreground }]}>3. Cadastro e Conta</Text>
        <Text style={[styles.paragraph, { color: colors.mutedForeground }]}>
          Para utilizar os serviços do ZeroRisco, você deve criar uma conta e fornecer informações precisas e completas. Você é responsável por manter a confidencialidade de suas credenciais de login e por todas as atividades que ocorrem em sua conta.
        </Text>

        <Text style={[styles.subheading, { color: colors.foreground }]}>4. Conduta do Usuário</Text>
        <Text style={[styles.paragraph, { color: colors.mutedForeground }]}>
          Você concorda em usar o aplicativo de forma responsável e respeitosa, tanto com outros usuários quanto com os motoristas. Qualquer conduta inadequada, ilegal ou que viole estes termos pode resultar na suspensão ou encerramento de sua conta.
        </Text>

        <Text style={[styles.subheading, { color: colors.foreground }]}>5. Pagamentos</Text>
        <Text style={[styles.paragraph, { color: colors.mutedForeground }]}>
          Os pagamentos pelas corridas são processados através do aplicativo. As tarifas são calculadas com base na distância, tempo e tipo de serviço. Você concorda em pagar todas as taxas e impostos aplicáveis.
        </Text>

        <Text style={[styles.subheading, { color: colors.foreground }]}>6. Privacidade</Text>
        <Text style={[styles.paragraph, { color: colors.mutedForeground }]}>
          Sua privacidade é importante para nós. Nossa Política de Privacidade detalha como coletamos, usamos e protegemos suas informações pessoais. Ao usar o aplicativo, você concorda com as práticas descritas em nossa Política de Privacidade.
        </Text>

        <Text style={[styles.subheading, { color: colors.foreground }]}>7. Limitação de Responsabilidade</Text>
        <Text style={[styles.paragraph, { color: colors.mutedForeground }]}>
          O ZeroRisco não se responsabiliza por quaisquer danos diretos, indiretos, incidentais, especiais ou consequenciais resultantes do uso ou da incapacidade de usar o aplicativo ou os serviços.
        </Text>

        <Text style={[styles.subheading, { color: colors.foreground }]}>8. Alterações nos Termos</Text>
        <Text style={[styles.paragraph, { color: colors.mutedForeground }]}>
          Reservamo-nos o direito de modificar estes Termos de Uso a qualquer momento. As alterações entrarão em vigor imediatamente após a publicação no aplicativo. Seu uso continuado do aplicativo após as modificações constitui sua aceitação dos novos termos.
        </Text>

        <Text style={[styles.subheading, { color: colors.foreground }]}>9. Contato</Text>
        <Text style={[styles.paragraph, { color: colors.mutedForeground }]}>
          Se tiver alguma dúvida sobre estes Termos de Uso, entre em contato conosco através do suporte disponível no aplicativo.
        </Text>

        <Text style={[styles.paragraph, { color: colors.mutedForeground, marginTop: 20 }]}>
          Última atualização: 14 de maio de 2026.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  heading: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  subheading: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 10,
  },
});
