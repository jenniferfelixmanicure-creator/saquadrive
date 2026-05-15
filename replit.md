# ZeroRisco

App de transporte seguro em Saquarema — conecta passageiros e motoristas com corridas em tempo real, chat, SOS e verificação de documentos.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — roda o API server (porta 8080)
- `pnpm run typecheck` — typecheck completo em todos os pacotes
- `pnpm run build` — typecheck + build de todos os pacotes
- `pnpm --filter @workspace/api-spec run codegen` — regenera hooks e schemas Zod a partir do OpenAPI spec
- `pnpm --filter @workspace/db run push` — aplica mudanças do schema no banco (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Mobile: Expo (React Native) + Expo Router, pacote `@workspace/zerorisco`
- API: Express 5, pacote `@workspace/api-server` (slug interno: saquadrive)
- DB: PostgreSQL + Drizzle ORM
- Realtime: Socket.io
- Mapa: MapLibre + OpenFreeMap (nativo), Leaflet (web)
- Geocoding/Rotas: Nominatim + OSRM (gratuitos, sem chave)
- Validação: Zod (`zod/v4`), `drizzle-zod`
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/saquadrive/` — app mobile Expo (`@workspace/zerorisco`)
- `artifacts/api-server/` — backend Express (`@workspace/api-server`)
- `lib/db/` — schemas Drizzle (users, drivers, rides, ratings, chatMessages)
- `lib/api-spec/openapi.yaml` — contrato OpenAPI
- `lib/api-client-react/` — hooks gerados pelo Orval
- `artifacts/saquadrive/constants/colors.ts` — design tokens (tema escuro azul/cyan)
- `artifacts/saquadrive/lib/google-maps.ts` — geocoding via Nominatim + OSRM

## Architecture decisions

- Geocoding e roteamento usam Nominatim (OpenStreetMap) e OSRM — sem chave de API necessária
- Mapa nativo usa MapLibre + OpenFreeMap (gratuito), mapa web usa Leaflet
- Corridas em tempo real via Socket.io com canal dedicado por corrida
- JWT + refresh token para autenticação (7d / 30d)
- Admin panel protegido por `ADMIN_SECRET` header

## Product

- Passageiro solicita corrida (moto, básico, intermediário, VIP), acompanha em tempo real, chat com motorista, SOS
- Motorista recebe corridas, gerencia ganhos, metas, histórico, documentos
- Admin aprova/rejeita motoristas e passageiros via painel

## User preferences

- App Expo = `@workspace/zerorisco` / ZeroRisco (nome de exibição)
- Backend = `@workspace/api-server` (diretório `artifacts/saquadrive`)
- Google Maps está desativado — usar Nominatim + OSRM no lugar

## Gotchas

- Sempre rodar `pnpm --filter @workspace/db run push` após mudar schemas
- `chatMessagesTable` usa campo `timestamp` (não `createdAt`)
- Params do Express 5 retornam `string | string[]` — sempre fazer cast para `string`

## Pointers

- Ver skill `pnpm-workspace` para estrutura do workspace, TypeScript e pacotes
