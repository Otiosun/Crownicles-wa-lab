# Crownicles — Concorrência V7 (Termux 16/11/2026)

**STATUS ATUALIZADO 16/11/2026: V7 HOMOLOGADA NO ANDROID TERMUX, 40/40 PASS, 7/7 novos, 0 falhas, 18 pacotes nativos, `LAB_SAIDA=0`.** Evidência: log enviado pelo responsável neste chat. 14/14 testes locais continuam evidência auxiliar. Baseline V6.1 33/33 PASS no Termux.

## Objetivo específico

Testar requisições em sobreposição de **dois jogadores fictícios**, sem confundir chegada de respostas com ordem de envio. 18 respostas Core originais entre pares de perfis/inventários/missões, rajada de oito perfis, duplicatas e intruso. A ponte mantém SQLite, origem MQTT e identificação de cada requisição por `frontEndSubOrigin`, e verifica associação com `Store.getRequest`, `requests` e `inbound`, destino WhatsApp fictício e UUID de cada pacote. Em cada teste, respostas emitidas só são consideradas válidas quando o Core devolve o pacote esperado e o destino corresponde à conta certa.

A V7 reexecuta automaticamente os 33 gates antigos, num único banco MariaDB efêmero privado, e acrescenta os seguintes **7 testes novos**:

- 34 `PERFIS_SIMULTANEOS_UUID_E_OUTBOX`: perfis de dois jogadores enviados sem aguardar um ao outro.
- 35 `INVENTARIOS_SIMULTANEOS_ISOLADOS`: inventários simultâneos, cada UUID e outbox correto.
- 36 `MISSOES_SIMULTANEAS_ISOLADAS`: missões simultâneas, dados segregados.
- 37 `RAJADA_OITO_PERFIS_ORIGINAIS`: oito perfis (quatro para cada identidade), com serialização por conta quando o Gateway exige.
- 38 `REPLAY_QUE_CHEGA_DURANTE_A_CORRIDA`: duplicata do mesmo wamid por contato, enviada enquanto os originais estão pendentes, recusada antes do Core.
- 39 `NUMERO_INEXISTENTE_DURANTE_DUAS_CONSULTAS`: terceiro contato não cadastrado rejeitado durante duas consultas legítimas.
- 40 `ESTADO_FINAL_SEM_CROSSOVER_OU_MUTACAO`: perfil/score/dinheiro/mapLink de ambos persistidos e inalterados, coletor tutorial antigo não reaparece, nenhum erro interno, 18 respostas rastreadas.

**Escopo limitado:** consultas e dedupe sob sobreposição em duas identidades. Não testa comandos irreversíveis concorrentes, duas decisões simultâneas, 100 usuários, reconnect do broker, falhas de rede, WhatsApp real ou grupos. Não altera Crownicles original nem autoriza produção. `Core.init()` bloqueado, broker MQTT 127.0.0.1 privado, conta e schema MariaDB temporários, marcador `OWNED_BY_JORNADA_V7`, limpeza só dos recursos do lab.

## Artefatos

- CJS único `Crownicles_Concorrencia_V7.cjs`: **162165 bytes**, SHA256 `3e249934906814e74fc8612c39e35063e942a4dd8fb4160eadb3b57e77b49f0a`. Drive: https://drive.google.com/file/d/1vRa0gFBnYWe0xoLjPpSKVVGlbUY4693R/view
- ZIP Android somente CJS: **84123 bytes**, SHA256 `2b3fbb9605ea16e555f569766b27dceb2f74a16536e7a3bde75130418207cd12`. Drive: https://drive.google.com/file/d/1i6ubOVoYkaM8SmWR7bESRF0EyxQBO-qp/view
- ZIP fontes + builder + 14 testes + hashes: **93060 bytes**, SHA256 `1b58ecdbd1d928175729828a855ef35d196e001a15f6e43c2f60b47ce00a4d36`. Drive: https://drive.google.com/file/d/1DEkkrzQUSD-3tERCxzmjJxO96uVUtwk8/view
- README: https://drive.google.com/file/d/1-T--SX_DLeHngeD-JnACj51Dty8Gq_LO/view

**Gates homologados pelo log Termux recebido:** `PASS=34...` até `PASS=40...`, `CONCORRENCIA_V7_NOVOS_TESTES=7/7`, `CONCORRENCIA_V7_FALHAS=0`, `CONCORRENCIA_PACOTES_NATIVOS_TOTAL=18`, `JORNADA_CROWNICLES_RESULTADOS=40/40`, `JORNADA_CROWNICLES_FALHAS=0`, `BANCO_TEMPORARIO_REMOVIDO`, `MARIADB_PRIVADO_REMOVIDO`, `LAB_SAIDA=0`. Não afirmar 40/40 sem log real Android.

Diário mestre: https://docs.google.com/document/d/1p6yD3vVhAP_sCNsAA8gl2tCWB4OsU0xaSFBLaC7Ztoo/edit


## Homologação real — V7 concorrência (16/11/2026, 17h23 BRT)

Log do responsável, após verificação da integridade do runner V7:

```text
V7_INTEGRIDADE=APROVADA
LAB=JORNADA_CORE_NATIVO_MQTT_V7_CONCORRENCIA
MARIADB_AMBIENTE=PRIVADO_DESCARTAVEL
MARIADB_PRIVADO_PORTA=38547
LAB_DB_CRIADO
LAB_TCP_ISOLADO_OK
CORE_MIGRATIONS_OK
CORE_RECEPTOR_MQTT=MAIN_ORIGINAL
CORE_MAIN_INIT_BLOQUEADO=SIM
CORE_MQTT_PUBLISH=PACKETUTILS_ORIGINAL
PASS=01..33 (todos; V3 a V6.1)
CONCORRENCIA_PERFIS_PAR=2
PASS=34_PERFIS_SIMULTANEOS_UUID_E_OUTBOX
PASS=35_INVENTARIOS_SIMULTANEOS_ISOLADOS
PASS=36_MISSOES_SIMULTANEAS_ISOLADAS
CONCORRENCIA_RAJADA_PERFIS=8
PASS=37_RAJADA_OITO_PERFIS_ORIGINAIS
CONCORRENCIA_DUPLICATAS_BLOQUEADAS=2
PASS=38_REPLAY_QUE_CHEGA_DURANTE_A_CORRIDA
CONCORRENCIA_NUMERO_INTRUSO_REJEITADO=SIM
PASS=39_NUMERO_INEXISTENTE_DURANTE_DUAS_CONSULTAS
CONCORRENCIA_PACOTES_NATIVOS_TOTAL=18
CONCORRENCIA_ESTADO_INALTERADO=SIM
PASS=40_ESTADO_FINAL_SEM_CROSSOVER_OU_MUTACAO
CONCORRENCIA_V7_NOVOS_TESTES=7/7
CONCORRENCIA_V7_FALHAS=0
JORNADA_CROWNICLES_RESULTADOS=40/40
JORNADA_CROWNICLES_FALHAS=0
LAB_TESTES_TOTAIS=40/40
LAB_TESTES_FALHARAM=0
CORE_MAIN_INIT_COMPLETA_NAO_EXECUTADA=SIM
WHATSAPP_REAL_NAO_ACESSADO=SIM
MARIADB_SERVICO_LOCAL_COMPARTILHADO=NAO
MARIADB_INSTANCIA_PRIVADA=SIM
SCHEMA_DE_PRODUCAO_NAO_ACESSADO=SIM
BANCO_TEMPORARIO_REMOVIDO
MARIADB_PRIVADO_REMOVIDO
LAB_SAIDA=0
CODIGO_EXECUCAO=0
LOG_COMPLETO=/data/data/com.termux/files/home/jornada_v7_resultado.log
```

O terceiro evento no mundo aberto foi sorteado pelo Core como **evento 7**, +66 pontos, +9 moedas e +47 XP, nível final 3, moedas 15021 no Player1; Player2 manteve menus/conta próprios, evento de introdução 61 com +63 pontos. O evento 60 anterior tem recompensa alta **e foi forçado por fixture**, então saldo não demonstra economia típica. O ensaio V7 comprovou sobreposição de consultas de leitura e deduplicação; **não** cobre duas decisões mutantes simultâneas, racing de compra/comércio, batalha, quotas, multiplos grupos reais, WhatsApp/Baileys real, registro Keycloak, site ou processo Core completo. Broker e MariaDB privativos foram removidos.

**Próxima etapa recomendada:** estresse controlado de ações que alteram estado, incluindo corrida de coletor e duplicata simultânea de escolha e verificação de efeitos exatamente uma vez, sem executar ações irreversíveis na produção. Não requer nova demonstração de consultas /ping.
