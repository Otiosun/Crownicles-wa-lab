# Jornada Crownicles — V8 Decisões simultâneas (16/11/2026)

**Estado:** V8 preparada; **17/17 testes locais PASS** (16 guardas + 1 integração Gateway/Store SQLite com Core simulado); `node --check` PASS; `--verificar-pacote` = `PACOTE_INTEGRO=23/23`. **GATE NATIVO ANDROID 47/47 PENDENTE.** V7 anterior **40/40 homologada no Termux**, 7 novos/7, 18 respostas originais, 0 falhas, saída0; docs da V7 commit `34d1933e15395a1410320783b4c55c433a9a7bb2`. Não declarar 47/47 sem log Android.

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

## Gate V8 nativo pendente

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

Quando o usuário retornar log: verificar **47/47**, comparar **7/7**, saída0, cleanup. Em caso de falha, corrigir estritamente o gate causal sem falsificar homologação e sem repetir /ping.
