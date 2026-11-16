#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
umask 077
PATCH_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE="$HOME/crownicles-whatsapp-lab/crownicles-beta"
APP="$STATE/app"
ORIG_RUNTIME='d52a6df552b3cbd1e0cfe5d1b4397ca1a68a30b2fcf4e06bc844c59d2708e43c'
ORIG_ENTRADA='456b4cfb23857814ae5ee11b016a226ac636b43bc868d578403fc6e5d80cac9f'
NEW_RUNTIME='c45c909248ffa59a4f74b885a3a3e6b45e33d25798303ef6d5cbbbf2510519f3'
NEW_ENTRADA='691830a9bcc9b0eed3b0c18a699f361d16fab7e2f13894247b144fb059db9897'

if [ ! -f "$APP/runtime.cjs" ] || [ ! -f "$APP/entrada.cjs" ] || [ ! -d "$APP/bridge" ] || [ ! -f "$APP/start.sh" ]; then
  echo 'ERRO=INSTALACAO_BETA_V2_1_NAO_ENCONTRADA'
  exit 2
fi
if [ -r "$STATE/run.lock" ]; then
  read -r PID < "$STATE/run.lock" || PID=''
  if [[ "${PID:-}" =~ ^[0-9]+$ ]] && kill -0 "$PID" 2>/dev/null; then
    echo 'ERRO=BETA_AINDA_RODANDO'
    echo 'PARE_A_BETA_COM_CTRL_C_ANTES_DE_APLICAR=SIM'
    exit 2
  fi
fi
for F in runtime.cjs entrada.cjs group-sender.cjs entrada.test.cjs group-sender.test.cjs; do
  [ -f "$PATCH_DIR/$F" ] || { echo "ERRO=PATCH_ARQUIVO_AUSENTE_$F";exit 2; }
done
HASH_R=$(sha256sum "$APP/runtime.cjs" | cut -d' ' -f1)
HASH_E=$(sha256sum "$APP/entrada.cjs" | cut -d' ' -f1)
if [ "$HASH_R" = "$NEW_RUNTIME" ] && [ "$HASH_E" = "$NEW_ENTRADA" ]; then
  echo 'PATCH_GRUPOS_JA_APLICADO=SIM'
elif [ "$HASH_R" != "$ORIG_RUNTIME" ] || [ "$HASH_E" != "$ORIG_ENTRADA" ]; then
  echo 'ERRO=VERSAO_BETA_DIFERENTE_NAO_SOBRESCREVER'
  exit 2
else
  BACKUP="$STATE/backups/grupo-v2-2-$(date +%Y%m%d-%H%M%S)"
  mkdir -p "$BACKUP"
  for F in runtime.cjs entrada.cjs entrada.test.cjs;do cp -p "$APP/$F" "$BACKUP/$F";done
  echo "BACKUP_CODIGO=$BACKUP"
  cp "$PATCH_DIR/runtime.cjs" "$APP/runtime.cjs"
  cp "$PATCH_DIR/entrada.cjs" "$APP/entrada.cjs"
  cp "$PATCH_DIR/group-sender.cjs" "$APP/group-sender.cjs"
  cp "$PATCH_DIR/entrada.test.cjs" "$APP/entrada.test.cjs"
  cp "$PATCH_DIR/group-sender.test.cjs" "$APP/group-sender.test.cjs"
fi
cd "$APP"
node --check entrada.cjs && node --check group-sender.cjs && node --check runtime.cjs
LOG="$STATE/grupo-v2-2-testes.log"
if ! node --test entrada.test.cjs integracao.test.cjs runtime.test.cjs reuse-session.test.cjs group-sender.test.cjs > "$LOG" 2>&1;then
  echo 'ERRO=TESTES_PATCH_NAO_APROVADOS'
  grep -E '^not ok|^# tests|^# pass|^# fail|error:|ERR_' "$LOG" | tail -25 || true
  echo "LOG_TESTES=$LOG"
  echo 'NAO_INICIE_BETA_ATE_CORRIGIR=SIM'
  exit 2
fi
grep -E '^# tests|^# pass|^# fail' "$LOG" || true
echo 'CORRECAO_GRUPOS_V2_2=APROVADA'
echo 'BANCO_E_SESSAO_PRESERVADOS=SIM'
if [ "${BETA_PATCH_ONLY:-0}" = 1 ]; then exit 0;fi
echo 'INICIANDO_PINGUINO=SIM'
exec bash start.sh
