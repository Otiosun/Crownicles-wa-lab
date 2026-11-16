#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
umask 077
APP="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE="$HOME/crownicles-whatsapp-lab/crownicles-beta"
mkdir -p "$STATE"
cd "$APP"

echo '=== CROWNICLES BETA — PREPARACAO ==='
node runtime.cjs --preflight

if [ ! -s "$STATE/settings.json" ]; then
  echo 'A beta deve usar uma linha WhatsApp diferente da sua conta de administrador.'
  read -r -p 'NUMERO DO BOT (DDI+DDD+NUMERO, so digitos): ' BOT_NUM
  read -r -p 'NUMERO DO DONO (DDI+DDD+NUMERO, so digitos): ' OWNER_NUM
  if ! [[ "$BOT_NUM" =~ ^[0-9]{10,15}$ && "$OWNER_NUM" =~ ^[0-9]{10,15}$ && "$BOT_NUM" != "$OWNER_NUM" ]]; then
    echo 'ERRO: numeros invalidos ou iguais. Nenhuma sessao foi aberta.';exit 1
  fi
  BOT_NUMBER="$BOT_NUM" OWNER_NUMBER="$OWNER_NUM" SETTINGS_PATH="$STATE/settings.json" node - <<'NODE'
const fs=require('node:fs'),crypto=require('node:crypto');
const path=process.env.SETTINGS_PATH;
fs.writeFileSync(path,JSON.stringify({botNumber:process.env.BOT_NUMBER,ownerNumber:process.env.OWNER_NUMBER,dbPassword:crypto.randomBytes(24).toString('hex')},null,2)+'\n',{flag:'wx',mode:0o600});
NODE
fi

if ! node -e "require.resolve('@whiskeysockets/baileys')" >/dev/null 2>&1; then
  echo '=== INSTALANDO APENAS DEPENDENCIAS DA BETA ==='
  npm install --omit=dev --no-audit --no-fund
fi

echo '=== INICIANDO BETA ==='
exec node --max-old-space-size=384 "$APP/runtime.cjs"
