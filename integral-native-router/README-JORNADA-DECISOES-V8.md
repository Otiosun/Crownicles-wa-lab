# Jornada Crownicles — V8 Decisões simultâneas (16/11/2026)

**Estado HOMOLOGADO em 16/11/2026:** V8 **47/47 testes reais PASS no Android Termux**, 7/7 novos, 0 falhas, LAB_SAIDA=0 e cleanup OK; além dos 17/17 testes locais e bundle 23/23. O log foi fornecido pelo responsável. V7 havia sido homologada 40/40.

## Objetivo: concorrência de operações mutantes

A V7 comprovou concorrência de **consultas**. V8 verifica **dois coletores que concedem recompensas** executados de modo sobreposto **para jogadores diferentes**, com mensagens repetidas e correlação forte request/UUID/WA. O runner reaproveita automaticamente os 40 gates anteriores no mesmo MariaDB efêmero e acrescenta 7:

| Gate | Verificação nativa pretendida |
|---|---|
| 41 | **NOVOS_JOGADORES_EFEMEROS_HABILITADOS** — criar 2 Players extras com Info e Slots originais, associar dois WA fictícios após persistir no banco, allowlist limitada a 4 UUIDs |
| 42 | **INICIOS_DE_AVENTURA_MUTANTES_SIMULTANEOS** — publicar 2 `/jogar` antes de aguardar retorno; coletor inicial event61 nativo para ambos |
| 43 | **COLETORES_PRIVADOS_PARA_DOIS_JOGADORES** — IDs distintos e menus separados com escolha `end` suportada |
| 44 | **ESCOLHAS_SIMULTANEAS_COM_REPLAY_EM_TRANSITO** — 2 ações de escolha sobrepostas e 2 duplicatas wamid recusadas imediatamente; retorno Core com `ReactionCollectorStopPacket` e `CommandReportBigEventResultRes` para os dois |
| 45 | **RECOMPENSAS_PERSISTIDAS_EXATAMENTE_UMA_VEZ** — pontos concedidos comparados à diferença real no Player de MariaDB; dinheiro persistido, mapa 28→29 pela rota75, nível não reduzido |
| 46 | **COLETORES_FINALIZADOS_E_REPLAY_NOVO_SEM_DUPLICACAO** — coletores antigos não persistem; novo replay de wamid não chama motor nem duplica saldo |
| 47 | **PERFIS_DOS_QUATRO_SEM_CROSSOVER** — 4 perfis originais em lote (2 anteriores, 2 novos); UUID/request/inbound/telefone/outbox segregados, saldos oficiais consistentes; Players1/2 não sofrem mutação |

A V8 usa os pacotes originais `CommandReportPacketReq`, `ReactionCollectorReactPacket`, `CommandProfilePacketReq` e `Core/main.js` MQTT original, não uma lógica reescrita. O helper de lote liga respostas ao `frontEndSubOrigin` e às tabelas `request`/`inbound` do SQLite original; nunca atribui por ordem de chegada.

## Limites críticos

- O evento **61** foi **fixado por fixture** para os dois novos jogadores a fim de testar a corrida de escolhas. Eventos 61 e 60 anteriores também foram usados para o onboarding da baseline; o terceiro evento no continente foi aleatório na V5–V7. A V8 não é amostra da distribuição normal de recompensas.
- **Concorrência de ações diferentes para jogadores diferentes**, com replay do mesmo `wamid`, **não comprova** duas escolhas de `wamid` distintos contra **o mesmo coletor**, nem corrida de compra/combate/transações ou queda da conexão.
- Nenhum WhatsApp real, grupo, Keycloak, site, `Core.init()` completo, cron, schema ou MariaDB de produção. Só identidade sintética, broker MQTT loopback e MariaDB temporário privado, marcador `OWNED_BY_JORNADA_V8`. Remover apenas recursos pertencentes ao processo de laboratório.
- Sem merge na main; próxima etapa, se passar, é dupla escolha do **mesmo** coletor e expiração/reconexão isoladas.

## Evidências locais verificadas

```text
node --check Crownicles_Decisoes_V8.cjs: PASS
node Crownicles_Decisoes_V8.cjs --verificar-pacote:
PACOTE_INTEGRO=23/23
VERIFICACAO_PACOTE_SEM_INICIALIZAR_CORE=SIM

node --test Crownicles_Decisoes_V8.guard.test.cjs:
16/16 PASS
node --test Crownicles_Concorrencia_V7.Gateway.regression.test.cjs:
1/1 PASS (Store + Gateway originais e Core SIMULADO)
TOTAL 17/17 PASS
ZIP de download descompactado: byte a byte igual ao CJS
```

**Não houve execução do Core nativo de V8 no ambiente local**: apenas o usuário poderá comprovar 47/47 no Termux.

## Artefatos no Drive Komekko e no chat

- Runner V8 `Crownicles_Decisoes_V8.cjs`, **174207 bytes**, SHA256 **`9d99b4fd96a79c50e43eee4c9c9f4bbf96770512499463e7ccc2c1e3c1069107`** — https://drive.google.com/file/d/1d-rWuHrfjRRCVKyWgOEsFQl0WEd1sGiw/view
- ZIP Android com apenas o CJS, **86639 bytes**, SHA256 **`8846847ff0c386f6af8d2f12b795e0a512fadeacf9cd737d5aa280be67832380`** — https://drive.google.com/file/d/1Aqu1QUIUb643Q5WeSqK6qSX6ka8G0NxE/view
- ZIP de fontes + builder + testes + bridge simulada + README, **171820 bytes**, SHA256 **`74f639d1fd0b2a323b31212f2b9b52f978b8650f003737ec1f98a1874540f65c`** — https://drive.google.com/file/d/1r8nhFApciZ9NrJhaNQQ42GK9eNNtmsj9/view
- README em texto — https://drive.google.com/file/d/1StV5zUSJd5aw944oKeOLjonoOc8EJqg9/view

## Gate V8 nativo HOMOLOGADO (log real do responsável)

```text
LAB=JORNADA_CORE_NATIVO_MQTT_V8_DECISOES_SIMULTANEAS
PASS=41_NOVOS_JOGADORES_EFEMEROS_HABILITADOS
PASS=42_INICIOS_DE_AVENTURA_MUTANTES_SIMULTANEOS
PASS=43_COLETORES_PRIVADOS_PARA_DOIS_JOGADORES
PASS=44_ESCOLHAS_SIMULTANEAS_COM_REPLAY_EM_TRANSITO
PASS=45_RECOMPENSAS_PERSISTIDAS_EXATAMENTE_UMA_VEZ
PASS=46_COLETORES_FINALIZADOS_E_REPLAY_NOVO_SEM_DUPLICACAO
PASS=47_PERFIS_DOS_QUATRO_SEM_CROSSOVER
DECISOES_V8_NOVOS_TESTES=7/7
DECISOES_V8_FALHAS=0
JORNADA_CROWNICLES_RESULTADOS=47/47
JORNADA_CROWNICLES_FALHAS=0
BANCO_TEMPORARIO_REMOVIDO
MARIADB_PRIVADO_REMOVIDO
LAB_SAIDA=0
```

Diário mestre https://docs.google.com/document/d/1p6yD3vVhAP_sCNsAA8gl2tCWB4OsU0xaSFBLaC7Ztoo/edit

O log real do Termux confirmou **47/47**, 7/7, saída0 e cleanup. O próximo objetivo de produto aprovado pelo responsável é abrir beta jogável via WhatsApp com **/cadastro explícito**, ativação/desativação por grupo pelo proprietário e UX rápida, usando dados beta resetáveis; veja PLANO-BETA-JOGAVEL-WHATSAPP.md. Não se deve extrapolar esse 47/47 para WhatsApp Baileys em operação.


## Evidência Android V8 — enviada em 16/11/2026

```text
V8_INTEGRIDADE=APROVADA
LAB=JORNADA_CORE_NATIVO_MQTT_V8_DECISOES_SIMULTANEAS
MARIADB_AMBIENTE=PRIVADO_DESCARTAVEL
MARIADB_PRIVADO_PORTA=43515
LAB_DB_CRIADO
LAB_TCP_ISOLADO_OK
CORE_MIGRATIONS_OK
CORE_RECEPTOR_MQTT=MAIN_ORIGINAL
CORE_MAIN_INIT_BLOQUEADO=SIM
CORE_MQTT_PUBLISH=PACKETUTILS_ORIGINAL
PASS=01..40 (todos, baseline anterior)
DECISOES_V8_JOGADORES_FICTICIOS=2
PASS=41_NOVOS_JOGADORES_EFEMEROS_HABILITADOS
DECISOES_V8_STARTS_PARALELOS=2
PASS=42_INICIOS_DE_AVENTURA_MUTANTES_SIMULTANEOS
DECISOES_V8_MENUS_ISOLADOS=SIM
PASS=43_COLETORES_PRIVADOS_PARA_DOIS_JOGADORES
DECISOES_V8_MUTACOES_PARALELAS=2
DECISOES_V8_REPLAYS_EM_TRANSITO_BLOQUEADOS=2
PASS=44_ESCOLHAS_SIMULTANEAS_COM_REPLAY_EM_TRANSITO
DECISOES_V8_RECOMPENSAS_UNICAS=SIM
PASS=45_RECOMPENSAS_PERSISTIDAS_EXATAMENTE_UMA_VEZ
DECISOES_V8_COLETORES_ENCERRADOS=SIM
PASS=46_COLETORES_FINALIZADOS_E_REPLAY_NOVO_SEM_DUPLICACAO
DECISOES_V8_PERFIS_SEGREGADOS=4
PASS=47_PERFIS_DOS_QUATRO_SEM_CROSSOVER
DECISOES_V8_NOVOS_TESTES=7/7
DECISOES_V8_FALHAS=0
JORNADA_CROWNICLES_RESULTADOS=47/47
JORNADA_CROWNICLES_FALHAS=0
LAB_TESTES_TOTAIS=47/47
LAB_TESTES_FALHARAM=0
CORE_MAIN_INIT_COMPLETA_NAO_EXECUTADA=SIM
WHATSAPP_REAL_NAO_ACESSADO=SIM
MARIADB_SERVICO_LOCAL_COMPARTILHADO=NAO
SCHEMA_DE_PRODUCAO_NAO_ACESSADO=SIM
BANCO_TEMPORARIO_REMOVIDO
MARIADB_PRIVADO_REMOVIDO
LAB_SAIDA=0
CODIGO_EXECUCAO=0
LOG_COMPLETO=/data/data/com.termux/files/home/jornada_v8_resultado.log
```

**Interpretação precisa:** quatro jogadores fictícios, duas novas solicitações de aventura e duas mutações por coletores de pessoas diferentes sobrepostas; dois replays com mesmo wamid bloqueados durante o trânsito; saldos/pontos conferidos com banco privado e perfis segregados; cleanup integral. No mundo aberto dessa rodada o evento aleatório foi 26 (+66 pontos, +9 moedas, +47 XP), enquanto eventos iniciais 61/60 foram forçados no laboratório. **Não** valida competição de duas escolhas distintas contra o mesmo coletor, combate ou comércio, reconexão Baileys real, nem prontidão de bot ao público. O usuário explicitamente priorizou **beta jogável e dados resetáveis** na sequência.
