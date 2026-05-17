#!/usr/bin/env bash
set -euo pipefail
echo "EAS pre-install: regenerando lockfile para compatibilidade com pnpm..."
pnpm install --no-frozen-lockfile
