#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
umask 077
APP="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP"
exec node --max-old-space-size=384 "$APP/runtime.cjs"
