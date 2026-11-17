#!/data/data/com.termux/files/usr/bin/bash
# Crownicles Beta V2.8 — restaura sete menus originais sobre a V2.7 validada.
# Modifica APENAS runtime.cjs e feature-manifest.cjs, sem tocar DB ou auth.
set -Eeuo pipefail
umask 077
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
STATE="$HOME/crownicles-whatsapp-lab/crownicles-beta"
APP="$STATE/app"
CORE="$HOME/crownicles-whatsapp-lab/crownicles-dev/Core"
BASE_MANIFEST="f8697465d7f3e3624b8dcd63d207cc3f18e6f2e64cbad9e0eeeb44331b0682a0"
BASE_RUNTIME="a8433255388e4d12c3ba18b8e4b36138704cef9add3ae7eb7bd4b23c5f960146"
[ -d "$APP/bridge" ] && [ -f "$CORE/package.json" ] || { echo 'ERRO=BETA_V27_OU_CORE_AUSENTE';exit 2; }
for f in runtime.cjs feature-manifest.cjs; do
 [ -f "$APP/$f" ] && [ ! -L "$APP/$f" ] || { echo "ERRO=FONTE_INSEGURA_$f";exit 2; }
done
# Do not start or replace Baileys when another process holds the beta lock.
if [ -r "$STATE/run.lock" ]; then
 PID="$(head -n 1 "$STATE/run.lock")"
 if [[ "$PID" =~ ^[0-9]+$ ]] && kill -0 "$PID" 2>/dev/null; then
  echo 'ERRO=BETA_RODANDO_PARE_COM_CTRL_C';exit 2
 fi
fi
( cd "$HERE" && sha256sum -c SHA256SUMS-v28.txt >/dev/null ) || { echo 'ERRO=PACOTE_V28_ALTERADO';exit 2; }
node - "$CORE/package.json" <<'NODE'
const fs=require('node:fs');
try{if(JSON.parse(fs.readFileSync(process.argv[2],'utf8')).version!=='6.2.0.b')throw Error()}
catch{console.log('ERRO=CORE_VERSAO_INCOMPATIVEL');process.exit(2)}
NODE
if cmp -s "$APP/runtime.cjs" "$HERE/runtime.cjs" && cmp -s "$APP/feature-manifest.cjs" "$HERE/feature-manifest.cjs"; then
 echo 'ATUALIZACAO_BETA_V28=JA_APLICADA';exit 0
fi
oldManifest="$(sha256sum "$APP/feature-manifest.cjs" | cut -d' ' -f1)"
oldRuntime="$(sha256sum "$APP/runtime.cjs" | cut -d' ' -f1)"
if [ "$oldManifest" != "$BASE_MANIFEST" ] || [ "$oldRuntime" != "$BASE_RUNTIME" ]; then
 echo 'ERRO=FONTE_V27_DIVERGENTE_SEM_ALTERAR';exit 2
fi
mkdir -p "$STATE/backups";chmod 700 "$STATE/backups"
BACKUP="$(mktemp -d "$STATE/backups/v28-XXXXXXXX")"
STAGE="$(mktemp -d "$STATE/backups/v28-stage-XXXXXXXX")"
mkdir "$STAGE/bridge"
cp -p "$APP/runtime.cjs" "$APP/feature-manifest.cjs" "$BACKUP/"
CHANGED=0
cleanup(){
 code=$?;trap - EXIT
 if [ "$CHANGED" -eq 1 ] && [ "$code" -ne 0 ]; then
  cp -p "$BACKUP/runtime.cjs" "$APP/runtime.cjs"
  cp -p "$BACKUP/feature-manifest.cjs" "$APP/feature-manifest.cjs"
  echo 'ROLLBACK_CODIGO_V28=OK'
 fi
 rm -rf "$STAGE"
 exit "$code"
}
trap cleanup EXIT
# Tests are run on a source-only copy; no MariaDB/session/real player is opened.
for f in "$APP"/*.cjs; do [ -f "$f" ] && [ ! -L "$f" ] && cp -p "$f" "$STAGE/"; done
for f in "$APP/bridge"/*.cjs; do [ -f "$f" ] && [ ! -L "$f" ] && cp -p "$f" "$STAGE/bridge/"; done
cp -p "$APP/package.json" "$STAGE/package.json"
for f in runtime.cjs feature-manifest.cjs feature-manifest.test.cjs feature-integration.test.cjs; do
 cp -p "$HERE/$f" "$STAGE/$f"
done
for f in runtime.cjs feature-manifest.cjs feature-manifest.test.cjs feature-integration.test.cjs; do
 node --check "$STAGE/$f" >/dev/null
done
( cd "$STAGE" && node --test *.test.cjs ) > "$BACKUP/regressao.tap" 2>&1 || {
 tail -n 30 "$BACKUP/regressao.tap";echo 'ERRO=TESTES_V28_REPROVADOS_NENHUMA_MUDANCA';exit 3;
}
if ! grep -q '^# fail 0$' "$BACKUP/regressao.tap"; then echo 'ERRO=REGRESSAO_INCOMPLETA';exit 3;fi
COUNT="$(grep '^# pass ' "$BACKUP/regressao.tap" | tail -1 | awk '{print $3}')"
if [ "${COUNT:-0}" -lt 82 ]; then echo "ERRO=TESTES_INSUFICIENTES_${COUNT:-0}";exit 3;fi
echo "TESTES_BETA_V28=${COUNT}/$COUNT"
# Race guard: process must remain stopped through the file replacement.
if [ -r "$STATE/run.lock" ]; then
 PID="$(head -n 1 "$STATE/run.lock")"
 if [[ "$PID" =~ ^[0-9]+$ ]] && kill -0 "$PID" 2>/dev/null;then echo 'ERRO=BETA_INICIADA_DURANTE_TESTE';exit 2;fi
fi
CHANGED=1
install -m 600 "$STAGE/runtime.cjs" "$APP/runtime.cjs"
install -m 600 "$STAGE/feature-manifest.cjs" "$APP/feature-manifest.cjs"
cmp -s "$APP/runtime.cjs" "$HERE/runtime.cjs" && cmp -s "$APP/feature-manifest.cjs" "$HERE/feature-manifest.cjs" || { echo 'ERRO=VERIFICACAO_COPIA';exit 3; }
CHANGED=0
trap - EXIT
rm -rf "$STAGE"
echo 'ATUALIZACAO_BETA_V28=INSTALADA'
echo 'BANCO_E_PERSONAGENS=NAO_ALTERADOS'
echo 'SESSAO_BAILEYS=NAO_ALTERADA'
echo "BACKUP_CODIGO=$BACKUP"
echo 'REINICIO_MANUAL=bash start.sh'
echo 'WHATSAPP_REAL_V28_PENDENTE=SIM'
