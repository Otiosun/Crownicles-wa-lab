#!/data/data/com.termux/files/usr/bin/bash
# Crownicles Beta V2.8.1: compatible surgical patch over any verified V2.7.
# Modifies only runtime.cjs and feature-manifest.cjs; never opens DB or auth.
set -Eeuo pipefail
umask 077
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
STATE="$HOME/crownicles-whatsapp-lab/crownicles-beta"
APP="$STATE/app"
CORE="$HOME/crownicles-whatsapp-lab/crownicles-dev/Core"
BASE_MANIFEST="f8697465d7f3e3624b8dcd63d207cc3f18e6f2e64cbad9e0eeeb44331b0682a0"
NEW_MANIFEST="2d03a641123da05317de159a48afc65a07201fee30d9165706d0b65c99d6c02d"
[ -d "$APP/bridge" ] && [ -f "$CORE/package.json" ] || { echo 'ERRO=BETA_V27_OU_CORE_AUSENTE';exit 2; }
for f in runtime.cjs feature-manifest.cjs; do
 [ -f "$APP/$f" ] && [ ! -L "$APP/$f" ] || { echo "ERRO=FONTE_INSEGURA_$f";exit 2; }
done
check_running(){
 if [ -r "$STATE/run.lock" ]; then
  local PID; PID="$(head -n 1 "$STATE/run.lock")"
  if [[ "$PID" =~ ^[0-9]+$ ]] && kill -0 "$PID" 2>/dev/null; then
   echo 'ERRO=BETA_RODANDO_PARE_COM_CTRL_C';exit 2
  fi
 fi
}
check_running
( cd "$HERE" && sha256sum -c SHA256SUMS-v28-1.txt >/dev/null ) || { echo 'ERRO=PACOTE_V28_1_ALTERADO';exit 2; }
node - "$CORE/package.json" <<'NODE'
const fs=require('node:fs');
try{if(JSON.parse(fs.readFileSync(process.argv[2],'utf8')).version!=='6.2.0.b')throw Error()}
catch{console.log('ERRO=CORE_VERSAO_INCOMPATIVEL');process.exit(2)}
NODE
actualManifest="$(sha256sum "$APP/feature-manifest.cjs" | cut -d' ' -f1)"
if [ "$actualManifest" = "$NEW_MANIFEST" ]; then
 if grep -Fq 'probeMenuHandlers' "$APP/runtime.cjs" && grep -Fq 'BETA_MENUS_NATIVOS' "$APP/runtime.cjs"; then
  echo 'ATUALIZACAO_BETA_V28_1=JA_APLICADA';exit 0
 fi
 echo 'ERRO=ESTADO_PARCIAL_OU_FONTE_ALTERADA';exit 2
fi
if [ "$actualManifest" != "$BASE_MANIFEST" ]; then
 echo 'ERRO=MANIFEST_V27_DIVERGENTE_SEM_ALTERAR'
 echo "SHA256_MANIFEST_ATUAL=$actualManifest"
 exit 2
fi
# The installer intentionally DOES NOT demand a fixed runtime.cjs hash: V2.7
# is a patch against locally differing earlier versions. The exact 2-anchor
# code transform plus full staging tests are the compatibility gate.
mkdir -p "$STATE/backups";chmod 700 "$STATE/backups"
BACKUP="$(mktemp -d "$STATE/backups/v28-1-XXXXXXXX")"
STAGE="$(mktemp -d "$STATE/backups/v28-1-stage-XXXXXXXX")"
mkdir -p "$STAGE/bridge"
cp -p "$APP/runtime.cjs" "$APP/feature-manifest.cjs" "$BACKUP/"
CHANGED=0
cleanup(){
 code=$?;trap - EXIT
 if [ "$CHANGED" -eq 1 ] && [ "$code" -ne 0 ]; then
  cp -p "$BACKUP/runtime.cjs" "$APP/runtime.cjs"
  cp -p "$BACKUP/feature-manifest.cjs" "$APP/feature-manifest.cjs"
  echo 'ROLLBACK_CODIGO_V28_1=OK'
 fi
 rm -rf "$STAGE"
 exit "$code"
}
trap cleanup EXIT
# Tests run on a source-only copy, not on a real bot/player database.
for f in "$APP"/*.cjs; do [ -f "$f" ] && [ ! -L "$f" ] && cp -p "$f" "$STAGE/"; done
for f in "$APP/bridge"/*.cjs; do [ -f "$f" ] && [ ! -L "$f" ] && cp -p "$f" "$STAGE/bridge/"; done
cp -p "$APP/package.json" "$STAGE/package.json"
cp -p "$HERE/feature-manifest.cjs" "$STAGE/feature-manifest.cjs"
cp -p "$HERE/feature-manifest.test.cjs" "$HERE/feature-integration.test.cjs" "$STAGE/"
node "$HERE/patch-runtime-v28-1.cjs" "$STAGE/runtime.cjs" || { echo 'ERRO=PATCH_INCOMPATIVEL_SEM_ALTERAR';exit 2; }
for f in runtime.cjs feature-manifest.cjs feature-manifest.test.cjs feature-integration.test.cjs; do node --check "$STAGE/$f" >/dev/null;done
( cd "$STAGE" && node --test *.test.cjs ) > "$BACKUP/regressao.tap" 2>&1 || {
 tail -n 35 "$BACKUP/regressao.tap"
 echo 'ERRO=TESTES_V28_1_REPROVADOS_SEM_ALTERAR';exit 3
}
if ! grep -q '^# fail 0$' "$BACKUP/regressao.tap";then echo 'ERRO=REGRESSAO_INCOMPLETA';exit 3;fi
COUNT="$(grep '^# pass ' "$BACKUP/regressao.tap" | tail -1 | awk '{print $3}')"
if [ "${COUNT:-0}" -lt 82 ];then echo "ERRO=TESTES_INSUFICIENTES_${COUNT:-0}";exit 3;fi
echo "TESTES_BETA_V28_1=$COUNT/$COUNT"
check_running
# Files changed by any concurrent editor during testing? Fail, no overwrite.
cmp -s "$APP/runtime.cjs" "$BACKUP/runtime.cjs" && cmp -s "$APP/feature-manifest.cjs" "$BACKUP/feature-manifest.cjs" || {
 echo 'ERRO=BASE_ALTERADA_DURANTE_TESTES';exit 2
}
CHANGED=1
install -m 600 "$STAGE/runtime.cjs" "$APP/runtime.cjs"
install -m 600 "$STAGE/feature-manifest.cjs" "$APP/feature-manifest.cjs"
cmp -s "$APP/runtime.cjs" "$STAGE/runtime.cjs" && cmp -s "$APP/feature-manifest.cjs" "$STAGE/feature-manifest.cjs" || {
 echo 'ERRO=VERIFICACAO_COPIA';exit 3
}
CHANGED=0
trap - EXIT
rm -rf "$STAGE"
echo 'ATUALIZACAO_BETA_V28_1=INSTALADA'
echo 'BANCO_E_PERSONAGENS=NAO_ALTERADOS'
echo 'SESSAO_BAILEYS=NAO_ALTERADA'
echo "BACKUP_CODIGO=$BACKUP"
echo 'REINICIO_MANUAL=bash start.sh'
echo 'WHATSAPP_REAL_V28_1_PENDENTE=SIM'
