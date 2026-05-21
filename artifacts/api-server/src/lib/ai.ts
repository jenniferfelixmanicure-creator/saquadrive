import { OpenAI } from "openai";
import { logger } from "./logger.js";

const client = new OpenAI({
  apiKey: process.env.GROK_API_KEY,
  baseURL: "https://api.x.ai/v1",
});

const SAQUADRIVE_SYSTEM_PROMPT = `Você é a Inteligência Artificial oficial da plataforma SaquaDrive, um aplicativo de mobilidade urbana.
Sua missão é ser prestativa, eficiente e manter total fidelidade à marca SaquaDrive.

DIRETRIZES DE PERSONALIDADE:
1. Nunca mencione que você é um modelo de linguagem, Grok, OpenAI ou qualquer outra empresa. Você é a "IA SaquaDrive".
2. Use um tom profissional, mas acolhedor (Português do Brasil).
3. Se perguntarem sobre sua origem, você foi desenvolvida pela equipe de engenharia da SaquaDrive.

DIRETRIZES TÉCNICAS (ATENDIMENTO):
- Ajude passageiros e motoristas com dúvidas sobre corridas, pagamentos (Dinheiro/PIX direto) e segurança.
- Explique as categorias disponíveis: Moto, Básico, Intermediário e VIP.
- Se houver um conflito, sugira o acionamento do suporte humano.

DIRETRIZES TÉCNICAS (PRECIFICAÇÃO):
- Ao calcular preços, considere: Distância, Tempo, Clima e Demanda.
- O objetivo é um preço justo que garanta que o motorista aceite a corrida rapidamente.`;

export async function askSaquaDrive(prompt: string, context: string = ""): Promise<string> {
  try {
    const response = await client.chat.completions.create({
      model: "grok-beta",
      messages: [
        { role: "system", content: SAQUADRIVE_SYSTEM_PROMPT },
        { role: "user", content: `Contexto Atual: ${context}\n\nPergunta/Comando: ${prompt}` },
      ],
      temperature: 0.7,
    });
    return response.choices[0].message.content ?? "Desculpe, não consegui processar sua mensagem.";
  } catch (error) {
    logger.error({ error }, "Erro ao consultar IA SaquaDrive");
    return "Desculpe, estou processando algumas informações. Posso te ajudar com outra coisa?";
  }
}

export interface RideTypePriceResult {
  rideType: string;
  suggestedFare: number;
  justification: string;
}

const RIDE_TYPE_BASES: Record<string, number> = {
  moto: 1.20,
  basico: 1.70,
  intermediario: 2.20,
  vip: 3.90,
};
const BASE_FEE = 5.5;

export async function calculateSmartPrice(data: {
  distanceKm: number;
  rideType: string;
  hour: number;
  surgeMultiplier: number;
}): Promise<RideTypePriceResult> {
  const perKm = RIDE_TYPE_BASES[data.rideType] ?? 1.70;
  const baseFare = Math.max(Math.round((BASE_FEE + data.distanceKm * perKm) * data.surgeMultiplier * 100) / 100, 10);

  const prompt = `Calcule o preço final sugerido para uma corrida:

Dados:
- Tipo: ${data.rideType}
- Distância: ${data.distanceKm.toFixed(1)} km
- Horário: ${data.hour}h
- Multiplicador de demanda: ${data.surgeMultiplier}x
- Tarifa base calculada: R$ ${baseFare.toFixed(2)}

Responda APENAS com JSON válido, sem markdown:
{"rideType": "${data.rideType}", "suggestedFare": 12.50, "justification": "motivo curto"}`;

  try {
    const response = await client.chat.completions.create({
      model: "grok-beta",
      messages: [
        { role: "system", content: "Você é o motor de precificação da IA SaquaDrive. Responda SOMENTE com JSON válido, sem markdown." },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
    });

    const raw = response.choices[0].message.content ?? "{}";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("JSON não encontrado na resposta da IA");
    return JSON.parse(jsonMatch[0]) as RideTypePriceResult;
  } catch (error) {
    logger.error({ error }, "IA falhou na precificação — usando tarifa base");
    return {
      rideType: data.rideType,
      suggestedFare: baseFare,
      justification: "Tarifa base SaquaDrive",
    };
  }
}
