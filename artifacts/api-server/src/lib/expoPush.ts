import { Expo, type ExpoPushMessage } from "expo-server-sdk";
import { logger } from "./logger.js";

const expo = new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN });

export async function sendPushNotification(
  expoPushToken: string | null | undefined,
  title: string,
  body: string,
  data: Record<string, unknown> = {}
): Promise<void> {
  if (!expoPushToken) return;

  if (!Expo.isExpoPushToken(expoPushToken)) {
    logger.warn({ expoPushToken }, "Token Expo inválido, notificação ignorada");
    return;
  }

  const message: ExpoPushMessage = {
    to: expoPushToken,
    sound: "default",
    title,
    body,
    data,
    priority: "high",
    channelId: "default",
  };

  try {
    const chunks = expo.chunkPushNotifications([message]);
    for (const chunk of chunks) {
      const receipts = await expo.sendPushNotificationsAsync(chunk);
      for (const receipt of receipts) {
        if (receipt.status === "error") {
          logger.error({ receipt }, "Erro ao enviar push notification");
        }
      }
    }
  } catch (err) {
    logger.error({ err }, "Falha ao enviar push notification");
  }
}

export async function sendSuspensionNotification(
  expoPushToken: string | null | undefined,
  cancellationFee: number
): Promise<void> {
  const feeStr = cancellationFee.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  await sendPushNotification(
    expoPushToken,
    "Conta Suspensa",
    `Sua conta foi suspensa devido ao cancelamento tardio de uma corrida. Taxa devida: ${feeStr}. Entre em contato com o suporte para regularizar.`,
    { type: "suspension", cancellationFee }
  );
}
