#!/data/data/com.termux/files/usr/bin/bash
# Crownicles Beta V3.0 — W3 autorizações nativas, staging offline, nonce preservado.
set -Eeuo pipefail
umask 077
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
STATE="$HOME/crownicles-whatsapp-lab/crownicles-beta"
APP="$STATE/app"
CORE="$HOME/crownicles-whatsapp-lab/crownicles-dev/Core"
MANIFEST_V29='2d03a641123da05317de159a48afc65a07201fee30d9165706d0b65c99d6c02d'
ERROR(){ echo "ERRO=$1";exit 2; }
assert_not_running(){
 if [ -r "$STATE/run.lock" ]; then
  local PID;PID="$(head -n1 "$STATE/run.lock")"
  if [[ "$PID" =~ ^[0-9]+$ ]] && kill -0 "$PID" 2>/dev/null;then ERROR 'BETA_RODANDO_PARE_COM_CTRL_C';fi
 fi
}
[ -f "$APP/bridge/gateway.cjs" ] && [ -f "$APP/bridge/lote08.cjs" ] && [ -f "$APP/runtime.cjs" ] && [ -f "$APP/feature-manifest.cjs" ] && [ -f "$CORE/package.json" ] || ERROR 'BETA_V29_AUSENTE'
for file in "$APP/runtime.cjs" "$APP/feature-manifest.cjs" "$APP/bridge/gateway.cjs" "$APP/bridge/lote08.cjs";do
 [ -f "$file" ] && [ ! -L "$file" ] || ERROR 'FONTE_INSEGURA'
done
assert_not_running
( cd "$HERE" && sha256sum -c SHA256SUMS-v30.txt >/dev/null ) || ERROR 'PACOTE_V30_CORROMPIDO'
node - "$CORE/package.json" <<'NODE' || ERROR 'CORE_VERSAO_INCOMPATIVEL'
const fs=require('node:fs');const v=JSON.parse(fs.readFileSync(process.argv[2])).version;
if(v!=='6.2.0.b')process.exit(2)
NODE
if grep -Fq 'const NATIVE_AUTH_HANDLERS=Object.freeze({' "$APP/feature-manifest.cjs";then
 if grep -Fq "status('BETA_AUTORIZACOES_NATIVAS'" "$APP/runtime.cjs" &&
    grep -Fq 'const candidate=authorizedNativeCommand(menu,menu.options?.[0])' "$APP/bridge/gateway.cjs" &&
    grep -Fq 'const candidate=authorizedNickname(menu,menu.options?.[0],id)' "$APP/bridge/gateway.cjs" &&
    grep -Fq 'horário de Brasília' "$APP/bridge/lote08.cjs";then
   echo 'ATUALIZACAO_BETA_V30=JA_APLICADA';exit 0
 fi
 ERROR 'V30_PARCIAL_OU_DIVERGENTE'
fi
[ "$(sha256sum "$APP/feature-manifest.cjs" | cut -d' ' -f1)" = "$MANIFEST_V29" ] || ERROR 'MANIFEST_V29_DIVERGENTE_SEM_ALTERAR'
grep -Fq 'const MENU_OPENERS_V29=new Set(' "$APP/bridge/gateway.cjs" || ERROR 'GATEWAY_V29_AUSENTE'
mkdir -p "$STATE/backups"; chmod 700 "$STATE/backups"
BACKUP="$(mktemp -d "$STATE/backups/v30-XXXXXXXX")"
STAGE="$(mktemp -d "$STATE/backups/v30-stage-XXXXXXXX")"
mkdir -p "$STAGE/bridge" "$BACKUP/bridge"
for f in runtime.cjs feature-manifest.cjs;do cp -p "$APP/$f" "$BACKUP/$f";done
for f in gateway.cjs lote08.cjs;do cp -p "$APP/bridge/$f" "$BACKUP/bridge/$f";done
CHANGED=0
cleanup(){
 local ec=$?;trap - EXIT
 if [ "$CHANGED" -eq 1 ] && [ "$ec" -ne 0 ];then
  for f in runtime.cjs feature-manifest.cjs;do cp -p "$BACKUP/$f" "$APP/$f";done
  for f in gateway.cjs lote08.cjs;do cp -p "$BACKUP/bridge/$f" "$APP/bridge/$f";done
  echo 'ROLLBACK_CODIGO_V30=OK'
 fi
 rm -rf "$STAGE"
 exit "$ec"
}
trap cleanup EXIT
for f in "$APP"/*.cjs;do [ -f "$f" ] && [ ! -L "$f" ] && cp -p "$f" "$STAGE/";done
for f in "$APP/bridge"/*.cjs;do [ -f "$f" ] && [ ! -L "$f" ] && cp -p "$f" "$STAGE/bridge/";done
cp -p "$APP/package.json" "$STAGE/package.json"
cp -p "$HERE/native-auth-v30.test.cjs" "$HERE/collector-flow.test.cjs" "$STAGE/"
node "$HERE/patch-v30.cjs" "$STAGE" || ERROR 'PATCH_V30_INCOMPATIVEL'
for f in runtime.cjs feature-manifest.cjs bridge/gateway.cjs bridge/lote08.cjs native-auth-v30.test.cjs;do
 node --check "$STAGE/$f" >/dev/null || ERROR 'SINTAXE_INCORRETA'
done
( cd "$STAGE" && node --test --test-reporter=tap native-auth-v30.test.cjs ) > "$BACKUP/autorizações.tap" 2>&1 || {
 tail -n25 "$BACKUP/autorizações.tap"; ERROR 'AUTORIZACOES_REPROVADAS'
}
for row in 'tests 15' 'pass 15' 'fail 0' 'cancelled 0' 'skipped 0' 'todo 0';do
 grep -qx "# $row" "$BACKUP/autorizações.tap" || ERROR 'AUTORIZACOES_INCOMPLETAS'
done
( cd "$STAGE" && node --test --test-reporter=tap *.test.cjs ) > "$BACKUP/regressao.tap" 2>&1 || {
 tail -n35 "$BACKUP/regressao.tap"; ERROR 'REGRESSAO_V30_REPROVADA'
}
COUNT="$(awk '/^# pass [0-9]+$/{n=$3}END{print n+0}' "$BACKUP/regressao.tap")"
TOTAL="$(awk '/^# tests [0-9]+$/{n=$3}END{print n+0}' "$BACKUP/regressao.tap")"
[ "$COUNT" -ge 85 ] && [ "$COUNT" -eq "$TOTAL" ] || ERROR 'REGRESSAO_CONTAGEM_INCORRETA'
for row in 'fail 0' 'cancelled 0' 'skipped 0' 'todo 0';do
 grep -qx "# $row" "$BACKUP/regressao.tap" || ERROR 'REGRESSAO_INCOMPLETA'
done
assert_not_running
for f in runtime.cjs feature-manifest.cjs;do cmp -s "$APP/$f" "$BACKUP/$f" || ERROR 'CODIGO_ALTERADO_DURANTE_TESTES';done
for f in gateway.cjs lote08.cjs;do cmp -s "$APP/bridge/$f" "$BACKUP/bridge/$f" || ERROR 'CODIGO_ALTERADO_DURANTE_TESTES';done
CHANGED=1
for f in runtime.cjs feature-manifest.cjs;do install -m600 "$STAGE/$f" "$APP/$f";done
for f in gateway.cjs lote08.cjs;do install -m600 "$STAGE/bridge/$f" "$APP/bridge/$f";done
for f in runtime.cjs feature-manifest.cjs;do cmp -s "$STAGE/$f" "$APP/$f" || ERROR 'VERIFICACAO_COPIA';done
for f in gateway.cjs lote08.cjs;do cmp -s "$STAGE/bridge/$f" "$APP/bridge/$f" || ERROR 'VERIFICACAO_COPIA';done
CHANGED=0
trap - EXIT
rm -rf "$STAGE"
echo 'TESTES_AUTORIZACOES_V30=15/15'
echo "TESTES_BETA_V30=$COUNT/$TOTAL"
echo 'ATUALIZACAO_BETA_V30=INSTALADA'
echo 'BANCO_E_PERSONAGENS=NAO_ALTERADOS'
echo 'SESSAO_BAILEYS=NAO_ALTERADA'
echo "BACKUP_CODIGO=$BACKUP"
echo 'REINICIO_MANUAL=bash start.sh'
echo 'WHATSAPP_REAL_V30_PENDENTE=SIM'
