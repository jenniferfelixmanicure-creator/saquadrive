#!/usr/bin/env bash
set -euo pipefail

echo "EAS pre-install: sincronizando lockfile com pnpm@10.26.1..."

# Garante que o Corepack usa a versão correta do pnpm
export COREPACK_ENABLE_STRICT=0

# Regenera o lockfile ignorando restrições de release age e frozen-lockfile
# Isso resolve ERR_PNPM_LOCKFILE_CONFIG_MISMATCH que ocorre quando
# o EAS usa uma versão de pnpm diferente da que gerou o lockfile original
pnpm install --no-frozen-lockfile --config.minimumReleaseAge=0

echo "EAS pre-install: lockfile sincronizado com sucesso."
