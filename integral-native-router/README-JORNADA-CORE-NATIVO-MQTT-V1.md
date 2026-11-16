# Crownicles 6.2.0.b — Jornada nativa MQTT V1 (primeiro personagem)

**Preparado em 16/11/2026. Android/Termux ainda NÃO homologado.** Branch privada de laboratório `feat/crownicles-integral-native-router`. Fonte original fixa `Crownicles/Crownicles@64d08c05f11949029317341735f6f73024f19f9b`.

## Mudança de fase: do Ping à jornada jogável

Os gates anteriores já passaram: Core/MariaDB nativos, gateway MQTT real e Core `main.js` MQTT original via `PingCommand` (último 5/5). Esta entrega não repete Ping. Usa **código de jogo do Crownicles original compilado** para executar a sequência:
`/perfil` + `/inventario` + `/missoes` antes de iniciar → `/jogar` → evento inicial original com menu → reação → ficha/inventário/missões depois do início.

Registro de fonte:
- `ReportCommand.execute` chama `initiateNewPlayerOnTheAdventure()` para `score===0 && effectId==='notStarted'`; `Maps.startTravel` inicia mapa 83 → 28; evento 61 é o tutorial do mapa 28, com opções `end`, `follow`, `observe`.
- O laboratório fixa `nextEvent=61` **apenas no player efêmero** para reduzir aleatoriedade. Não é prova de sorteio nem de progressão completa; evento 61 NÃO equivale a `ReportConstants.FIRST_BIG_EVENT_ID=0`.
- `ProfileCommand`, `InventoryCommand`, `MissionsCommand` são os originais; antes do jogo retornam `RequirementEffectPacket.currentEffectId='notStarted'` do `@commandRequires`. O presenter foi corrigido para orientar `/jogar` especificamente nesse caso (commit `de032d8c022379d4233ae6873bc6438c9761acee`).
- `CoreHandlers.reactionCollector` chama `ReactionCollectorController.reactPacket` original, preservando reação por índice e filtro de identidade.
- `Lang/pt/events.json` e `Lang/pt/models.json` são originais e somente lidos; ainda necessitam revisão completa pt-BR.

## Segurança/isolamento

O arquivo inclui 23 módulos gateway CJS com SHA256 e replica as barreiras da V2 homologada: processo isolado, único schema MariaDB randômico descartável, broker Mosquitto exclusivo em `127.0.0.1`, porta e prefixos temporários, SQLite de teste, identidade de WhatsApp fictícia e callback local. **Não abre Baileys, nem Keycloak/site, nem produção**.

O `Core.main.js` original recebe e responde por MQTT / `PacketUtils`; **a inicialização total `Core.init()` fica bloqueada**, não inicia webserver, cron, jobs ou loops. Só inicializadores de classe/pet puramente em memória. O `MapCache.init()` original executa sob consulta de logs de mapa interceptada e vazia (não acessa schema real de logs). O banco de jogo original é efêmero.

## Artefatos e provas

**Runner (um arquivo)**: `crownicles_jornada_core_nativo_mqtt_v1_termux_autossuficiente.cjs`, **119416 bytes**, SHA256 `0c0c9575cccb5eeef42c2acdcc6bfedd658e48cf81ab12481b5b7218ccc5845b`. Drive Komekko: https://drive.google.com/file/d/1TuEVSeUX2II1FWjZZJHsYD9BnbIIONW_/view .

`node --check`: PASS. `node runner.cjs --verificar-pacote`: `PACOTE_INTEGRO=23/23`, `VERIFICACAO_PACOTE_SEM_INICIALIZAR_CORE=SIM`. O container de desenvolvimento não tem Mosquitto; execução de rede real interrompe com diagnóstico seguro **antes de tocar MariaDB**. **Não alegar execução nativa aprovada até receber o log real do Termux**.

**Snapshot das fontes/testes Node**: ZIP com 57 fontes/README e `SHA256SUMS`, **172167 bytes**, SHA256 `68fdfa4fbadd993485f2b236cf544411941ef65ca85a3f5f891093c9d046eff4`. Drive Komekko: https://drive.google.com/file/d/1pu4fQbEOsasNBvaZ-z9WDYIoB_03UhED/view .

Regressão completa Node 22.16.0 no laboratório isolado `node --test test/*.test.cjs`: **871/871 PASS**, 0 fail, 0 skip. Com FakeCore nos testes da ponte; **não é prova nativa**. README completo: https://drive.google.com/file/d/1K057C0yyjieMfNGuBgLSjI50LzyQUPnm/view .

## GATE original V1: exigências no Termux (ainda PENDENTES)

```text
PASS=01_CORE_ORIGINAL_QUATRO_COMANDOS_E_COLETOR
PASS=02_MQTT_SUBACK_ORIGINAL
PASS=03_PERFIL_PRE_INICIO_CROWNICLES
PASS=04_INVENTARIO_PRE_INICIO_CROWNICLES
PASS=05_MISSOES_PRE_INICIO_CROWNICLES
PASS=06_JOGAR_CROWNICLES_REPORT_E_MAPA_PERSISTIDO
PASS=07_REENTREGA_JOGAR_SEM_NOVO_COMANDO
PASS=08_MENU_E_REACAO_CROWNICLES_ORIGINAL
PASS=09_PERFIL_APOS_EVENTO_CROWNICLES
PASS=10_INVENTARIO_APOS_EVENTO_CROWNICLES
PASS=11_MISSOES_APOS_EVENTO_CROWNICLES
JORNADA_CROWNICLES_RESULTADOS=11/11
JORNADA_CROWNICLES_FALHAS=0
BANCO_TEMPORARIO_REMOVIDO
LAB_SAIDA=0
```

A reprovação ou falta de qualquer prova é **NÃO HOMOLOGADO**. Se falhar, corrigir somente a causa e repetir a nova versão, sem voltar à infraestrutura Ping nem retirar guardas de segurança. Esse gate não cobre WhatsApp real, site, Keycloak, PvE completo, coletores totais, ou produção.
