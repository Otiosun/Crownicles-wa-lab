#!/data/data/com.termux/files/usr/bin/bash
# Crownicles beta V2.7 — guarded W3 routing and native handler discovery.
set -Eeuo pipefail
umask 077
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
STATE="$HOME/crownicles-whatsapp-lab/crownicles-beta"
APP="$STATE/app"
CORE="$HOME/crownicles-whatsapp-lab/crownicles-dev/Core"
[ -d "$APP" ] && [ -d "$APP/bridge" ] && [ -d "$CORE" ] || { echo 'ERRO=BETA_OU_CORE_AUSENTE'; exit 2; }
[ -f "$APP/owner-link.test.cjs" ] && [ -f "$APP/group-sender.cjs" ] || { echo 'ERRO=BASE_V23_AUSENTE'; exit 2; }
if [ -r "$STATE/run.lock" ]; then
  read -r PID < "$STATE/run.lock" || PID=''
  if [[ "${PID:-}" =~ ^[0-9]+$ ]] && kill -0 "$PID" 2>/dev/null; then
    echo 'ERRO=BETA_RODANDO_PARE_COM_CTRL_C_ANTES_DE_ATUALIZAR'
    exit 2
  fi
fi
( cd "$HERE" && sha256sum -c SHA256SUMS-v27.txt >/dev/null ) || { echo 'ERRO=PACOTE_ALTERADO'; exit 2; }
node - "$CORE/package.json" <<'NODE'
const fs=require('node:fs');const file=process.argv[2];
try{if(JSON.parse(fs.readFileSync(file,'utf8')).version!=='6.2.0.b')throw Error();}
catch{console.log('ERRO=VERSAO_CORE_DIFERENTE');process.exit(3)}
NODE
for f in entrada.cjs integracao.cjs runtime.cjs bridge/gateway.cjs; do
  [ -f "$APP/$f" ] && [ ! -L "$APP/$f" ] || { echo "ERRO=FONTE_INSEGURA_$f"; exit 2; }
done
for f in feature-manifest.cjs group-identity-policy.cjs; do
  if [ -e "$APP/$f" ] || [ -L "$APP/$f" ]; then
    [ -f "$APP/$f" ] && [ ! -L "$APP/$f" ] && cmp -s "$APP/$f" "$HERE/$f" || { echo "ERRO=MODULO_EXISTENTE_DIVERGENTE_$f"; exit 2; }
  fi
done
# Repeated invocations do not rewrite the running code or create a new backup.
if cmp -s "$APP/feature-manifest.cjs" "$HERE/feature-manifest.cjs" && \
   cmp -s "$APP/group-identity-policy.cjs" "$HERE/group-identity-policy.cjs" && \
   grep -Fq 'this.getHelp()' "$APP/entrada.cjs" && \
   grep -Fq 'enabledPackets:coreBoot.enabledPackets' "$APP/runtime.cjs" && \
   grep -Fq 'gateway.close();beta.close()' "$APP/integracao.cjs" && \
   grep -Fq 'canSendPacket(action.name)' "$APP/bridge/gateway.cjs"; then
  echo 'ATUALIZACAO_BETA_V27=JA_APLICADA'
  exit 0
fi
mkdir -p "$STATE/backups"
chmod 700 "$STATE/backups"
BACKUP="$(mktemp -d "$STATE/backups/v27-XXXXXXXX")"
STAGE="$(mktemp -d "$STATE/backups/v27-stage-XXXXXXXX")"
mkdir "$BACKUP/bridge" "$STAGE/bridge"
for f in entrada.cjs integracao.cjs runtime.cjs bridge/gateway.cjs; do cp -p "$APP/$f" "$BACKUP/$f"; done
CHANGED=0
EXISTED_MANIFEST=0
EXISTED_POLICY=0
[ -f "$APP/feature-manifest.cjs" ] && EXISTED_MANIFEST=1
[ -f "$APP/group-identity-policy.cjs" ] && EXISTED_POLICY=1
rollback(){
  code=$?
  trap - EXIT
  if [ "$CHANGED" -eq 1 ] && [ "$code" -ne 0 ]; then
    for f in entrada.cjs integracao.cjs runtime.cjs bridge/gateway.cjs; do cp -p "$BACKUP/$f" "$APP/$f"; done
    [ "$EXISTED_MANIFEST" -eq 1 ] || rm -f "$APP/feature-manifest.cjs"
    [ "$EXISTED_POLICY" -eq 1 ] || rm -f "$APP/group-identity-policy.cjs"
    echo 'ROLLBACK_CODIGO_V27=OK'
  fi
  rm -rf "$STAGE"
  exit "$code"
}
trap rollback EXIT
# Source-only staging: no auth, no settings.json, no MariaDB, no SQLite beta.
for f in "$APP"/*.cjs; do [ -f "$f" ] && [ ! -L "$f" ] && cp -p "$f" "$STAGE/"; done
cp -p "$APP/package.json" "$STAGE/"
for f in "$APP/bridge"/*.cjs; do [ -f "$f" ] && [ ! -L "$f" ] && cp -p "$f" "$STAGE/bridge/"; done
for f in feature-manifest.cjs group-identity-policy.cjs feature-manifest.test.cjs feature-integration.test.cjs group-identity-policy.test.cjs; do cp "$HERE/$f" "$STAGE/$f"; done
node "$HERE/v27-patch.cjs" "$STAGE"
for f in entrada.cjs integracao.cjs runtime.cjs bridge/gateway.cjs feature-manifest.cjs group-identity-policy.cjs; do node --check "$STAGE/$f" >/dev/null; done
( cd "$STAGE" && node --test entrada.test.cjs integracao.test.cjs runtime.test.cjs owner-link.test.cjs reuse-session.test.cjs feature-manifest.test.cjs feature-integration.test.cjs group-identity-policy.test.cjs ) > "$BACKUP/regressao.tap" 2>&1 || {
  tail -n 28 "$BACKUP/regressao.tap"
  echo 'ERRO=TESTES_REPROVADOS_SEM_ALTERAR_BETA'
  exit 3
}
echo 'TESTES_BETA_STAGE=APROVADOS'
# Recheck the lock before first write, then install code only.
if [ -r "$STATE/run.lock" ]; then
 read -r PID < "$STATE/run.lock" || PID=''
 if [[ "${PID:-}" =~ ^[0-9]+$ ]] && kill -0 "$PID" 2>/dev/null; then
  echo 'ERRO=BETA_INICIADA_DURANTE_TESTES'; exit 2
 fi
fi
CHANGED=1
for f in entrada.cjs integracao.cjs runtime.cjs bridge/gateway.cjs; do cp -p "$STAGE/$f" "$APP/$f"; done
for f in feature-manifest.cjs group-identity-policy.cjs; do install -m 600 "$STAGE/$f" "$APP/$f"; done
for f in entrada.cjs integracao.cjs runtime.cjs bridge/gateway.cjs feature-manifest.cjs group-identity-policy.cjs; do cmp -s "$STAGE/$f" "$APP/$f" || { echo "ERRO=VERIFICACAO_FALHOU_$f"; exit 3; }; done
CHANGED=0
trap - EXIT
rm -rf "$STAGE"
echo 'ATUALIZACAO_BETA_V27=INSTALADA'
echo 'BANCO_E_PERSONAGENS=NAO_ALTERADOS'
echo 'SESSAO_BAILEYS=NAO_ALTERADA'
echo "BACKUP_CODIGO=$BACKUP"
echo 'REINICIO_MANUAL=bash start.sh'
echo 'WHATSAPP_REAL_PENDENTE=SIM'
