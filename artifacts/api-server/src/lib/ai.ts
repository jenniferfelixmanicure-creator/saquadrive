import { OpenAI } from "openai";
import { logger } from "./logger.js";

const client = new OpenAI({
  apiKey: process.env.GROK_API_KEY,
  baseURL: "https://api.x.ai/v1",
});

const ZERISCO_SYSTEM_PROMPT = `Você é a ZeroRisco IA, a assistente virtual oficial e central de suporte inteligente da plataforma ZeroRisco. Seu objetivo é ajudar passageiros e motoristas com dúvidas sobre o aplicativo, viagens, segurança e suporte geral.

IDENTIDADE E TOM:
- Nome: "ZeroRisco IA".
- Criador: "Equipe de Engenharia da ZeroRisco". Nunca mencione xAI, Grok ou outras empresas.
- Tom: Extremamente profissional, prestativo, educado e direto. Use Português do Brasil de forma clara.

CONHECIMENTO DA PLATAFORMA:
- CATEGORIAS DE VIAGEM: Moto (mais rápida/econômica), Básico (carro padrão), Intermediário (carro mais novo/conforto), VIP (carros premium/luxo).
- PAGAMENTO: O pagamento é feito diretamente ao motorista via Dinheiro ou PIX ao final da viagem. O app não processa cartões de crédito internamente para segurança.
- SEGURANÇA (Pilar Principal): 
  * Modo Proteção: Monitoramento ativo por IA.
  * Botão SOS: Acionamento imediato de emergência.
  * PIN de Embarque: Confirmação de que você está no carro certo.
  * Compartilhamento de Rota: Envie seu trajeto em tempo real para amigos/familiares.
- SUPORTE: Ajuda com objetos esquecidos, reporte de comportamento inadequado, dúvidas sobre taxas de cancelamento e orientações de uso do app.

REGRAS DE RESPOSTA:
1. Responda apenas sobre o universo ZeroRisco e mobilidade urbana. Se perguntarem algo fora disso, decline educadamente.
2. Seja concisa. Use parágrafos curtos ou listas se necessário.
3. Emergências: Se o usuário relatar perigo imediato, instrua-o a usar o botão SOS no app e ligar para a polícia (190).
4. Suporte Humano: Para casos financeiros complexos ou reclamações graves, informe que você pode encaminhar o ticket para a equipe humana.`;

const GROK_MODEL = "grok-2-1212";

async function callAI(systemPrompt: string, userPrompt: string, temperature = 0.7): Promise<string> {
  const response = await client.chat.completions.create({
    model: GROK_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature,
    max_tokens: 1024,
  });
  return response.choices[0].message.content ?? "";
}

async function callAIJson<T>(systemPrompt: string, userPrompt: string, fallback: T): Promise<T> {
  try {
    const raw = await callAI(systemPrompt, userPrompt, 0.2);
    const match = raw.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (!match) return fallback;
    return JSON.parse(match[0]) as T;
  } catch {
    return fallback;
  }
}

export async function askZeroRiscoIA(prompt: string, context = ""): Promise<string> {
  try {
    return await callAI(
      ZERISCO_SYSTEM_PROMPT,
      context ? `Contexto: ${context}\n\nPergunta: ${prompt}` : prompt
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error({ error, model: GROK_MODEL, msg }, "ZeroRisco IA — erro no assistente");
    if (msg.includes("model") || msg.includes("404") || msg.includes("not found")) {
      return "Modelo IA temporariamente indisponível. A equipe ZeroRisco foi notificada.";
    }
    if (msg.includes("401") || msg.includes("Unauthorized") || msg.includes("auth")) {
      return "Chave de acesso IA inválida. Contate o suporte ZeroRisco.";
    }
    if (msg.includes("429") || msg.includes("rate") || msg.includes("limit")) {
      return "Muitas perguntas em pouco tempo. Aguarde alguns segundos e tente novamente.";
    }
    return "Não consegui processar sua mensagem agora. Tente novamente em instantes.";
  }
}

export interface SmartPriceResult {
  rideType: string;
  suggestedFare: number;
  justification: string;
}

const RIDE_TYPE_BASES: Record<string, number> = {
  moto: 1.20, basico: 1.70, intermediario: 2.20, vip: 3.90,
};
const BASE_FEE = 5.5;

export async function calculateSmartPrice(data: {
  distanceKm: number;
  rideType: string;
  hour: number;
  surgeMultiplier: number;
}): Promise<SmartPriceResult> {
  const perKm = RIDE_TYPE_BASES[data.rideType] ?? 1.70;
  const baseFare = Math.max(
    Math.round((BASE_FEE + data.distanceKm * perKm) * data.surgeMultiplier * 100) / 100,
    10
  );
  return await callAIJson(
    "Você é o motor de precificação da ZeroRisco IA. Responda SOMENTE com JSON válido, sem markdown.",
    `Calcule o preço ideal para a corrida:
- Tipo: ${data.rideType}
- Distância: ${data.distanceKm.toFixed(1)} km
- Horário: ${data.hour}h
- Multiplicador de demanda: ${data.surgeMultiplier}x
- Tarifa base: R$ ${baseFare.toFixed(2)}

JSON: {"rideType": "${data.rideType}", "suggestedFare": 0.00, "justification": "motivo"}`,
    { rideType: data.rideType, suggestedFare: baseFare, justification: "Tarifa base ZeroRisco" }
  );
}

export interface RideRiskResult {
  level: "baixo" | "moderado" | "alto" | "critico";
  score: number;
  reasons: string[];
  recommendation: string;
}

export async function assessRideRisk(data: {
  hour: number;
  neighborhood: string;
  passengerRating: number;
  driverRating: number;
  rideType: string;
  distanceKm: number;
  passengerCancellations?: number;
}): Promise<RideRiskResult> {
  return await callAIJson(
    "Você é o sistema de análise de risco da ZeroRisco IA. Responda SOMENTE com JSON válido.",
    `Avalie o risco desta corrida:
- Horário: ${data.hour}h
- Bairro/região: ${data.neighborhood}
- Avaliação passageiro: ${data.passengerRating}/5
- Avaliação motorista: ${data.driverRating}/5
- Categoria: ${data.rideType}
- Distância: ${data.distanceKm.toFixed(1)} km
- Cancelamentos recentes do passageiro: ${data.passengerCancellations ?? 0}

JSON: {"level": "baixo|moderado|alto|critico", "score": 0-100, "reasons": ["..."], "recommendation": "..."}`,
    { level: "baixo", score: 10, reasons: [], recommendation: "Corrida dentro dos padrões normais." }
  );
}

export interface ChatModerationResult {
  safe: boolean;
  threat: boolean;
  harassment: boolean;
  offense: boolean;
  action: "allow" | "warn" | "block";
  message?: string;
}

export async function moderateChat(text: string): Promise<ChatModerationResult> {
  return await callAIJson(
    "Você é o sistema de moderação da ZeroRisco IA. Analise mensagens de chat entre passageiros e motoristas. Responda SOMENTE com JSON.",
    `Analise esta mensagem: "${text}"

JSON: {"safe": true/false, "threat": true/false, "harassment": true/false, "offense": true/false, "action": "allow|warn|block", "message": "aviso ao usuário se necessário"}`,
    { safe: true, threat: false, harassment: false, offense: false, action: "allow" }
  );
}

export interface SupportResult {
  answer: string;
  category: "ride" | "payment" | "safety" | "account" | "driver" | "other";
  requiresHuman: boolean;
  suggestedActions?: string[];
}

export async function getSupportResponse(question: string, userRole: "passenger" | "driver" | "admin"): Promise<SupportResult> {
  return await callAIJson(
    `${ZERISCO_SYSTEM_PROMPT}\n\nVocê é a central de suporte 24h da ZeroRisco IA. Resolva problemas de forma objetiva. Responda SOMENTE com JSON.`,
    `Perfil: ${userRole}\nDúvida/Problema: "${question}"

JSON: {"answer": "resposta completa", "category": "ride|payment|safety|account|driver|other", "requiresHuman": true/false, "suggestedActions": ["ação 1"]}`,
    {
      answer: "Estou verificando sua solicitação. Para suporte imediato, acesse o menu Ajuda no app.",
      category: "other",
      requiresHuman: true,
    }
  );
}

export interface FraudResult {
  fraudulent: boolean;
  riskLevel: "none" | "low" | "medium" | "high";
  flags: string[];
  recommendation: string;
}

export async function detectFraud(data: {
  passengerId: string;
  driverId?: string;
  rideId: string;
  cancelCount?: number;
  multipleAccounts?: boolean;
  suspiciousGPS?: boolean;
  emulator?: boolean;
  unusualPattern?: boolean;
}): Promise<FraudResult> {
  return await callAIJson(
    "Você é o sistema antifraude da ZeroRisco IA. Responda SOMENTE com JSON.",
    `Analise possível fraude:
- Passageiro ID: ${data.passengerId}
- Motorista ID: ${data.driverId ?? "N/A"}
- Corrida ID: ${data.rideId}
- Cancelamentos: ${data.cancelCount ?? 0}
- Múltiplas contas detectadas: ${data.multipleAccounts ? "Sim" : "Não"}
- GPS suspeito: ${data.suspiciousGPS ? "Sim" : "Não"}
- Emulador detectado: ${data.emulator ? "Sim" : "Não"}
- Padrão incomum: ${data.unusualPattern ? "Sim" : "Não"}

JSON: {"fraudulent": true/false, "riskLevel": "none|low|medium|high", "flags": ["..."], "recommendation": "..."}`,
    { fraudulent: false, riskLevel: "none", flags: [], recommendation: "Nenhuma irregularidade detectada." }
  );
}

export interface DriverSuggestionsResult {
  bestZones: string[];
  bestHours: string[];
  earningsTip: string;
  weeklyForecast: string;
}

export async function getDriverSuggestions(data: {
  currentLocation?: string;
  totalRides: number;
  weekEarnings: number;
  currentHour: number;
  dayOfWeek: number;
  rideType: string;
}): Promise<DriverSuggestionsResult> {
  const days = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];
  return await callAIJson(
    "Você é o consultor de ganhos da ZeroRisco IA. Ajude motoristas a maximizar rendimentos. Responda SOMENTE com JSON.",
    `Perfil do motorista:
- Localização: ${data.currentLocation ?? "não informada"}
- Total de corridas: ${data.totalRides}
- Ganhos esta semana: R$ ${data.weekEarnings.toFixed(2)}
- Horário atual: ${data.currentHour}h (${days[data.dayOfWeek]})
- Categoria do veículo: ${data.rideType}

JSON: {"bestZones": ["zona1","zona2"], "bestHours": ["18h-22h"], "earningsTip": "dica prática", "weeklyForecast": "previsão de ganhos"}`,
    {
      bestZones: ["Centro", "Zona Sul"],
      bestHours: ["07h-09h", "17h-20h"],
      earningsTip: "Concentre-se nas zonas com maior demanda durante horários de pico.",
      weeklyForecast: "Demanda moderada prevista para esta semana.",
    }
  );
}

export interface AccidentResult {
  detected: boolean;
  severity: "none" | "minor" | "moderate" | "severe";
  confidence: number;
  actions: string[];
}

export async function analyzeAccident(data: {
  accelerometerX: number;
  accelerometerY: number;
  accelerometerZ: number;
  speedKmh: number;
  previousSpeedKmh: number;
  rideId: string;
}): Promise<AccidentResult> {
  const impact = Math.sqrt(data.accelerometerX ** 2 + data.accelerometerY ** 2 + data.accelerometerZ ** 2);
  const speedDrop = data.previousSpeedKmh - data.speedKmh;

  return await callAIJson(
    "Você é o sistema de detecção de acidentes da ZeroRisco IA. Responda SOMENTE com JSON.",
    `Dados de sensor durante corrida ${data.rideId}:
- Força de impacto (G): ${impact.toFixed(2)}
- Velocidade atual: ${data.speedKmh} km/h
- Velocidade anterior: ${data.previousSpeedKmh} km/h
- Queda brusca de velocidade: ${speedDrop} km/h

JSON: {"detected": true/false, "severity": "none|minor|moderate|severe", "confidence": 0-100, "actions": ["ação1"]}`,
    { detected: false, severity: "none", confidence: 0, actions: [] }
  );
}

export interface RouteDeviationResult {
  deviated: boolean;
  deviationKm: number;
  suspicious: boolean;
  message?: string;
}

export async function detectRouteDeviation(data: {
  rideId: string;
  currentLat: number;
  currentLng: number;
  destLat: number;
  destLng: number;
  originLat: number;
  originLng: number;
  elapsedMinutes: number;
}): Promise<RouteDeviationResult> {
  const toRad = (d: number) => (d * Math.PI) / 180;
  function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  const totalRoute = haversine(data.originLat, data.originLng, data.destLat, data.destLng);
  const distToDest = haversine(data.currentLat, data.currentLng, data.destLat, data.destLng);
  const distFromOrigin = haversine(data.originLat, data.originLng, data.currentLat, data.currentLng);
  const expectedProgress = distFromOrigin / (totalRoute || 1);
  const deviationKm = Math.max(0, distToDest - totalRoute * (1 - expectedProgress) - 0.5);
  const deviated = deviationKm > 1.5;
  const suspicious = deviationKm > 3.0 || (data.elapsedMinutes > 30 && distToDest > totalRoute * 0.8);

  return {
    deviated,
    deviationKm: Math.round(deviationKm * 100) / 100,
    suspicious,
    message: deviated
      ? suspicious
        ? "Desvio de rota suspeito detectado. Protocolo de segurança ativado."
        : "Desvio de rota detectado. Verifique se o trajeto está correto."
      : undefined,
  };
}

export interface AdminInsightsResult {
  financialForecast: string;
  peakHours: string[];
  dangerousAreas: string[];
  criticalPatterns: string[];
  recommendations: string[];
}

export async function getAdminInsights(data: {
  totalRidesToday: number;
  totalEarningsToday: number;
  cancelledRides: number;
  activeDrivers: number;
  pendingDocuments: number;
  suspiciousActivities: number;
}): Promise<AdminInsightsResult> {
  return await callAIJson(
    "Você é o painel de inteligência administrativa da ZeroRisco IA. Analise métricas operacionais. Responda SOMENTE com JSON.",
    `Métricas do dia:
- Corridas realizadas: ${data.totalRidesToday}
- Faturamento: R$ ${data.totalEarningsToday.toFixed(2)}
- Corridas canceladas: ${data.cancelledRides}
- Motoristas ativos: ${data.activeDrivers}
- Documentos pendentes: ${data.pendingDocuments}
- Atividades suspeitas: ${data.suspiciousActivities}

JSON: {"financialForecast": "previsão", "peakHours": ["horário"], "dangerousAreas": ["área"], "criticalPatterns": ["padrão"], "recommendations": ["ação"]}`,
    {
      financialForecast: "Dados insuficientes para previsão.",
      peakHours: ["07h-09h", "17h-20h"],
      dangerousAreas: [],
      criticalPatterns: [],
      recommendations: ["Continue monitorando as métricas operacionais."],
    }
  );
}

export interface BehaviorResult {
  score: number;
  level: "excelente" | "bom" | "atencao" | "critico";
  flags: string[];
  action: "none" | "warn" | "suspend" | "block";
  message: string;
}

export async function analyzeDriverBehavior(data: {
  driverId: string;
  avgSpeed: number;
  hardBrakes: number;
  suddenAccelerations: number;
  phoneUsageEvents: number;
  totalRides: number;
  rating: number;
}): Promise<BehaviorResult> {
  return await callAIJson(
    "Você é o sistema de análise comportamental de motoristas da ZeroRisco IA. Responda SOMENTE com JSON.",
    `Análise comportamental do motorista ${data.driverId}:
- Velocidade média: ${data.avgSpeed} km/h
- Freadas bruscas: ${data.hardBrakes}
- Acelerações bruscas: ${data.suddenAccelerations}
- Uso de celular em movimento: ${data.phoneUsageEvents}x
- Total de corridas: ${data.totalRides}
- Avaliação média: ${data.rating}/5

JSON: {"score": 0-100, "level": "excelente|bom|atencao|critico", "flags": ["..."], "action": "none|warn|suspend|block", "message": "feedback para o motorista"}`,
    {
      score: 75,
      level: "bom",
      flags: [],
      action: "none",
      message: "Comportamento dentro dos padrões aceitáveis.",
    }
  );
}
