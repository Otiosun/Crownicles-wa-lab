#!/data/data/com.termux/files/usr/bin/bash
# Crownicles Beta 2.9: original menu collector isolation, additive and reversible.
set -Eeuo pipefail
umask 077
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
STATE="$HOME/crownicles-whatsapp-lab/crownicles-beta"
APP="$STATE/app"
CORE="$HOME/crownicles-whatsapp-lab/crownicles-dev/Core"
MANIFEST_V28='2d03a641123da05317de159a48afc65a07201fee30d9165706d0b65c99d6c02d'
ERR(){ echo "ERRO=$1";exit 2; }
[ -d "$APP/bridge" ] && [ -f "$CORE/package.json" ] || ERR 'BETA_V28_OU_CORE_AUSENTE'
for f in "$APP/bridge/gateway.cjs" "$APP/feature-manifest.cjs";do
 [ -f "$f" ] && [ ! -L "$f" ] || ERR 'FONTE_INSEGURA'
done
running(){
 if [ -r "$STATE/run.lock" ];then
  local PID; PID="$(head -n1 "$STATE/run.lock")"
  if [[ "$PID" =~ ^[0-9]+$ ]] && kill -0 "$PID" 2>/dev/null;then ERR 'BETA_RODANDO_PARE_COM_CTRL_C';fi
 fi
}
running
( cd "$HERE" && sha256sum -c SHA256SUMS-v29.txt >/dev/null ) || ERR 'PACOTE_V29_CORROMPIDO'
node - "$CORE/package.json" <<'NODE'
const fs=require('node:fs');try{if(JSON.parse(fs.readFileSync(process.argv[2])).version!=='6.2.0.b')throw Error()}
catch{console.log('ERRO=CORE_VERSAO_INCOMPATIVEL');process.exit(2)}
NODE
[ "$(sha256sum "$APP/feature-manifest.cjs" | cut -d' ' -f1)" = "$MANIFEST_V28" ] || ERR 'MANIFEST_V28_DIVERGENTE'
# V28 runtime legitimately differs by earlier patch lineage. Never require one hash.
if grep -Fq 'const MENU_OPENERS_V29=new Set(' "$APP/bridge/gateway.cjs";then
 grep -Fq 'if(MENU_OPENERS_V29.has(action.name))' "$APP/bridge/gateway.cjs" || ERR 'V29_PARCIAL'
 echo 'ATUALIZACAO_BETA_V29=JA_APLICADA';exit 0
fi
mkdir -p "$STATE/backups";chmod 700 "$STATE/backups"
BACKUP="$(mktemp -d "$STATE/backups/v29-XXXXXXXX")"
STAGE="$(mktemp -d "$STATE/backups/v29-stage-XXXXXXXX")"
mkdir -p "$STAGE/bridge"
cp -p "$APP/bridge/gateway.cjs" "$BACKUP/gateway.cjs"
CHANGED=0
cleanup(){
 local ec=$?;trap - EXIT
 if [ "$CHANGED" = 1 ] && [ "$ec" -ne 0 ];then
  cp -p "$BACKUP/gateway.cjs" "$APP/bridge/gateway.cjs"
  echo 'ROLLBACK_CODIGO_V29=OK'
 fi
 rm -rf "$STAGE";exit "$ec"
}
trap cleanup EXIT
for f in "$APP"/*.cjs;do [ -f "$f" ] && [ ! -L "$f" ] && cp -p "$f" "$STAGE/";done
for f in "$APP/bridge"/*.cjs;do [ -f "$f" ] && [ ! -L "$f" ] && cp -p "$f" "$STAGE/bridge/";done
cp -p "$APP/package.json" "$STAGE/"
cp -p "$HERE/collector-flow.test.cjs" "$STAGE/"
node "$HERE/patch-gateway-v29.cjs" "$STAGE/bridge/gateway.cjs" || ERR 'GATEWAY_PATCH_FALHOU'
node --check "$STAGE/bridge/gateway.cjs" || ERR 'GATEWAY_JS_INVALIDO'
# Explicit reporter avoids Node 23+ default spec mismatch.
( cd "$STAGE" && node --test --test-reporter=tap collector-flow.test.cjs ) > "$BACKUP/collectors.tap" 2>&1 || {
 tail -n30 "$BACKUP/collectors.tap";ERR 'COLETORES_REPROVADOS'
}
for name in 'tests 12' 'pass 12' 'fail 0' 'cancelled 0' 'skipped 0' 'todo 0';do
 grep -qx "# $name" "$BACKUP/collectors.tap" || ERR 'COLETORES_INCOMPLETOS'
done
( cd "$STAGE" && node --test --test-reporter=tap *.test.cjs ) > "$BACKUP/regressao.tap" 2>&1 || {
 tail -n30 "$BACKUP/regressao.tap";ERR 'REGRESSAO_V29_REPROVADA'
}
COUNT="$(awk '/^# pass [0-9]+$/{p=$3}END{print p+0}' "$BACKUP/regressao.tap")"
TOTAL="$(awk '/^# tests [0-9]+$/{p=$3}END{print p+0}' "$BACKUP/regressao.tap")"
[ "$COUNT" -ge 61 ] && [ "$COUNT" -eq "$TOTAL" ] || ERR 'CONTAGEM_TESTES_INVALIDA'
for item in 'fail 0' 'cancelled 0' 'skipped 0' 'todo 0';do
 grep -qx "# $item" "$BACKUP/regressao.tap" || ERR 'REGRESSAO_INCOMPLETA'
done
running
cmp -s "$APP/bridge/gateway.cjs" "$BACKUP/gateway.cjs" || ERR 'CODIGO_ALTERADO_DURANTE_TESTES'
CHANGED=1
install -m600 "$STAGE/bridge/gateway.cjs" "$APP/bridge/gateway.cjs"
cmp -s "$STAGE/bridge/gateway.cjs" "$APP/bridge/gateway.cjs" || ERR 'VERIFICACAO_COPIA_FALHOU'
CHANGED=0
trap - EXIT
rm -rf "$STAGE"
echo "TESTES_COLETORES_V29=12/12"
echo "TESTES_BETA_V29=$COUNT/$TOTAL"
echo 'ATUALIZACAO_BETA_V29=INSTALADA'
echo 'BANCO_E_PERSONAGENS=NAO_ALTERADOS'
echo 'SESSAO_BAILEYS=NAO_ALTERADA'
echo "BACKUP_CODIGO=$BACKUP"
echo 'REINICIO_MANUAL=bash start.sh'
