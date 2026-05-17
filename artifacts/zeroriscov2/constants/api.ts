// URL da API em produção. Em desenvolvimento no Replit, EXPO_PUBLIC_API_URL
// pode ser sobrescrito via variável de ambiente no dev server.
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "https://saquadrive.onrender.com";

export const SOCKET_PATH = "/api/socket.io";
