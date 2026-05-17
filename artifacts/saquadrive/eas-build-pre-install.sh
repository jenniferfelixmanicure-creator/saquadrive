#!/usr/bin/env bash
set -euo pipefail
echo "Pre-install: atualizando lockfile para compatibilidade com pnpm no EAS..."
pnpm install --no-frozen-lockfile
