#!/bin/bash
set -e

echo "==> SaquaDrive API build iniciado"
echo "==> Diretório atual: $(pwd)"

# Navegar para a raiz do repositório (2 níveis acima de artifacts/api-server)
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
echo "==> Raiz do repositório: $REPO_ROOT"
cd "$REPO_ROOT"

# Instalar pnpm se não estiver disponível
if ! command -v pnpm &> /dev/null; then
  echo "==> Instalando pnpm..."
  npm install -g pnpm@9
fi

echo "==> pnpm version: $(pnpm --version)"

# Instalar dependências do workspace
echo "==> Instalando dependências..."
pnpm install --no-frozen-lockfile

# Aplicar migrações do banco de dados (não falhar o build se falhar aqui)
echo "==> Aplicando schema do banco de dados..."
pnpm --filter @workspace/db run push-force -- --yes || echo "==> Aviso: Falha ao aplicar schema (verifique DATABASE_URL)"

# Build do api-server
echo "==> Buildando api-server..."
pnpm --filter @workspace/api-server run build

echo "==> Build concluído!"

