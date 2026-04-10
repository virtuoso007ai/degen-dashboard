#!/usr/bin/env bash
# Git Bash / WSL: PATH'e virtuals-protocol-acp ekleyip `acp` için kullan.
#   export PATH="/d/super-saiyan-raichu/virtuals-protocol-acp:$PATH"
# veya: bash acp.bash job status 123
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT" || exit 1
exec npx --yes tsx bin/acp.ts "$@"
