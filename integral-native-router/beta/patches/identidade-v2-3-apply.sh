#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
umask 077
PATCH_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE="$HOME/crownicles-whatsapp-lab/crownicles-beta"
APP="$STATE/app"
ORIG_RUNTIME='c45c909248ffa59a4f74b885a3a3e6b45e33d25798303ef6d5cbbbf2510519f3'
ORIG_ENTRADA='691830a9bcc9b0eed3b0c18a699f361d16fab7e2f13894247b144fb059db9897'
NEW_RUNTIME='5c508dc105fe885234b993a01f7368ef94b9f21f334cc207dda5444980afa08e'
NEW_ENTRADA='a231bf70b76d02db5a44bf98fee3a4eea875557b73971848fe652ee150bd0a48'

for P in runtime.cjs entrada.cjs admin-link.cjs owner-link.test.cjs; do
  [ -f "$PATCH_DIR/$P" ] || { echo "ERRO=ARQUIVO_PATCH_AUSENTE_$P"; exit 2; }
done
[ -f "$APP/runtime.cjs" ] && [ -f "$APP/entrada.cjs" ] && [ -f "$APP/start.sh" ] || { echo 'ERRO=BETA_V2_2_NAO_ENCONTRADA'; exit 2; }

if [ -r "$STATE/run.lock" ]; then
  read -r PID < "$STATE/run.lock" || PID=''
  if [[ "${PID:-}" =~ ^[0-9]+$ ]] && kill -0 "$PID" 2>/dev/null; then
    echo 'ERRO=BETA_AINDA_RODANDO_PARE_COM_CTRL_C'; exit 2
  fi
fi
CUR_RUNTIME=$(sha256sum "$APP/runtime.cjs" | cut -d' ' -f1)
CUR_ENTRADA=$(sha256sum "$APP/entrada.cjs" | cut -d' ' -f1)
if [ "$CUR_RUNTIME" = "$NEW_RUNTIME" ] && [ "$CUR_ENTRADA" = "$NEW_ENTRADA" ]; then
  echo 'PATCH_V2_3_JA_APLICADO=SIM'
elif [ "$CUR_RUNTIME" != "$ORIG_RUNTIME" ] || [ "$CUR_ENTRADA" != "$ORIG_ENTRADA" ]; then
  echo 'ERRO=CODIGO_BETA_DIFERENTE_PATCH_BLOQUEADO'; exit 2
else
  BACKUP="$STATE/backups/identidade-v2-3-$(date +%Y%m%d-%H%M%S)"
  mkdir -p "$BACKUP"
  for F in runtime.cjs entrada.cjs; do cp -p "$APP/$F" "$BACKUP/$F"; done
  # Banco pertence SOMENTE a esta beta. Não tocar no MariaDB nem na sessão Baileys.
  if [ -f "$STATE/access/beta-access.sqlite" ]; then
    for F in beta-access.sqlite beta-access.sqlite-wal beta-access.sqlite-shm; do
      [ -f "$STATE/access/$F" ] && cp -p "$STATE/access/$F" "$BACKUP/$F" || true
    done
  fi
  echo "BACKUP_ANTES_DA_ATUALIZACAO=$BACKUP"
fi
for F in runtime.cjs entrada.cjs admin-link.cjs owner-link.test.cjs; do
  cp "$PATCH_DIR/$F" "$APP/$F"
done
cd "$APP"
node --check entrada.cjs && node --check admin-link.cjs && node --check runtime.cjs
LOG="$STATE/identidade-v2-3-testes.log"
if ! node --test entrada.test.cjs integracao.test.cjs runtime.test.cjs reuse-session.test.cjs group-sender.test.cjs owner-link.test.cjs > "$LOG" 2>&1; then
  echo 'ERRO=TESTES_PATCH_V2_3_NAO_APROVADOS'
  grep -E '^not ok|^# tests|^# pass|^# fail|error:|ERR_' "$LOG" | tail -25 || true
  echo "LOG_TESTES=$LOG"
  echo 'BETA_NAO_INICIADA=SIM'
  exit 2
fi
grep -E '^# tests|^# pass|^# fail' "$LOG" || true
echo 'PATCH_IDENTIDADE_V2_3=APROVADO'
echo 'BETA_SESSAO_E_PERSONAGENS_PRESERVADOS=SIM'
if [ "${BETA_PATCH_ONLY:-0}" = '1' ]; then exit 0; fi
echo 'INICIANDO_PINGUINO=SIM'
exec bash start.sh
