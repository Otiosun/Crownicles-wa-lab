# Crownicles V6.1 — correção do laboratório multijogador (16/11/2026)

**STATUS ATUALIZADO EM 16/11/2026: V6.1 HOMOLOGADA NO TERMUX, 33/33 PASS, 7/7 novos, 0 falhas, `LAB_SAIDA=0`, `CODIGO_EXECUCAO=0`.** A execução V6 anterior havia falhado 26/33; V6.1 corrigiu o interceptor de identidades. Os 20/20 testes locais e bundle bridge 23/23 são evidências adicionais, não substituem a homologação nativa.

## Erro do usuário na V6

Log original recebido:
```text
V6_INTEGRIDADE=APROVADA
LAB=JORNADA_CORE_NATIVO_MQTT_V6_DOIS_JOGADORES
... 01–26 PASS (V5)
FAIL=27_SEGUNDA_IDENTIDADE_PRE_INICIO Error CORE_SEM_PACOTE_NATIVO_/perfil
FAIL=28_SEGUNDO_JOGADOR_EVENTO_CORE_NATIVO Error CORE_SEM_PACOTE_NATIVO_/jogar
FAIL=29_MENUS_PRIVADOS_SEM_VAZAMENTO ERR_ASSERTION assert(secondCollector)
FAIL=30_REACAO_JOGADOR2_APLICADA_SOMENTE_A_ELE ERR_ASSERTION assert(secondCollector)
FAIL=31_PERSISTENCIA_SEPARADA_DOS_DOIS_JOGADORES ERR_ASSERTION null !== 75
FAIL=32_DUPLICATA_SEGUNDO_JOGADOR_NAO_AFETA_ESTADO ERR_ASSERTION true !== false
FAIL=33_PERFIS_NATIVOS_SEGREGADOS_E_NUMERO_DESCONHECIDO Error CORE_SEM_PACOTE_NATIVO_/perfil
DOIS_JOGADORES_V6_NOVOS_TESTES=0/7
DOIS_JOGADORES_V6_FALHAS=7
JORNADA_CROWNICLES_RESULTADOS=26/33
JORNADA_CROWNICLES_FALHAS=7
BANCO_TEMPORARIO_REMOVIDO
MARIADB_PRIVADO_REMOVIDO
LAB_SAIDA=2
CODIGO_EXECUCAO=2
```

## Causa raiz comprovada por leitura do CJS V6

O interceptador do receptor MQTT ORIGINAL do Core tinha guarda de laboratório `context?.keycloakId!==playerUUID`, e `playerUUID` era o UUID apenas do PRIMEIRO jogador (herdado da V5 que só testava 1). Requisições do 2º usuário eram rejeitadas **antes** da instrumentação de `nativeReplies`/`nativeFailures` — portanto o teste reportava `CORE_SEM_PACOTE_NATIVO` e os coletores nunca abriam. **Isso é um bug no interceptor do ensaio, não prova falha no Crownicles original.**

## Correção V6.1 (cirúrgica)

- Criada `isAuthorizedLabContext(context,expectedOrigin,allowedLabIds)`, exigindo mesma origem MQTT, UUID presente em allowlist fechada, WebSocket e suborigem UUID válida.
- `const allowedLabIds=new Set([playerUUID]);` antes de instalar os listeners originais; adicionar `secondUUID` **somente após criar e persistir o Player2 no MariaDB privado e vincular o WhatsApp fictício**, comprovando 2 IDs e impedindo terceiros.
- O interceptor inclui `playerId:context.keycloakId` em cada resposta recebida; `runWa` rejeita UUID de resposta diferente da identidade vinculada ao número destino. Também preserva o guarda `RESPOSTA_ENVIADA_A_OUTRO_JOGADOR` no outbox.
- Diagnóstico `CORE_SEM_PACOTE_NATIVO` melhorado com mensagem local truncada; não expõe secrets. Todos os gates 1–33 mantidos, nenhum Core original modificado, 23 fontes ponte com hashes iguais às da V6.
- Marcador do MariaDB efêmero `OWNED_BY_JORNADA_V6_1` e assinatura `LAB=JORNADA_CORE_NATIVO_MQTT_V6_1_DOIS_JOGADORES`.

## Evidências de teste disponíveis

- `node --check Crownicles_Dois_Jogadores_V6_1.cjs` PASS.
- `node Crownicles_Dois_Jogadores_V6_1.cjs --verificar-pacote` `PACOTE_INTEGRO=23/23`, sem iniciar Core.
- Teste `node --test Crownicles_Dois_Jogadores_V6_1.guard.test.cjs`: **19/19 PASS**, incluindo execução da função real de autorização com duas UUIDs e rejeição de terceiros/origem diferente/UUID request inválido.
- Teste `node --test V6_1_Gateway_Duas_Identidades.regression.test.cjs`: **1/1 PASS** usando a implementação embutida real `Store` (SQLite) + `Gateway` do projeto, MAS **Core simulado local** para respostas. Dois contatos separados, nenhum crossover, rejeição de número intruso e wamid duplicado.
- Comandos `node --test ... ...`: **20/20 PASS**, 0 falhas.
- **33/33 ainda não comprovado** no Android, onde Core Crownicles original e MariaDB/MQTT reais serão executados.

## Arquivos no Drive Komekko

- [CJS único V6.1](https://drive.google.com/file/d/1s5kqgbIhIKeT2349-9MY58iLRrA_VFQ0/view) — **153838 bytes**, SHA256 `007144d1a41ba36b9ce7f016b4e88a62073fb20035ad0ca2750405303609abce`.
- [ZIP Android só CJS](https://drive.google.com/file/d/1sg5kGx91ixwgqjKyNdzcOG9raDlXOYOh/view) — **82007 bytes**, SHA256 `8f745ba9db5e9f0ef1569f7a8c593fc1e3bc27409a99785f85afd07adc437007`.
- [ZIP código + 20 testes + fontes bridge simulador + README](https://drive.google.com/file/d/1xxcziy9bYFM44ld_7GldZzk1V1KAG-CC/view) — **165714 bytes**, SHA256 `b466bc37c0828ac35f8e0239987e54d89b978284525285094fbbb5605c323206`.
- [README](https://drive.google.com/file/d/1gvk7ZUY5zqEoqBrMCdR2xh3nVmm8Sbkf/view).

## Gate Termux (cumprido, conforme log Android recebido)

```text
V6_1_INTEGRIDADE=APROVADA
LAB=JORNADA_CORE_NATIVO_MQTT_V6_1_DOIS_JOGADORES
PASS=27_SEGUNDA_IDENTIDADE_PRE_INICIO
PASS=28_SEGUNDO_JOGADOR_EVENTO_CORE_NATIVO
PASS=29_MENUS_PRIVADOS_SEM_VAZAMENTO
PASS=30_REACAO_JOGADOR2_APLICADA_SOMENTE_A_ELE
PASS=31_PERSISTENCIA_SEPARADA_DOS_DOIS_JOGADORES
PASS=32_DUPLICATA_SEGUNDO_JOGADOR_NAO_AFETA_ESTADO
PASS=33_PERFIS_NATIVOS_SEGREGADOS_E_NUMERO_DESCONHECIDO
DOIS_JOGADORES_V6_NOVOS_TESTES=7/7
DOIS_JOGADORES_V6_FALHAS=0
JORNADA_CROWNICLES_RESULTADOS=33/33
JORNADA_CROWNICLES_FALHAS=0
BANCO_TEMPORARIO_REMOVIDO
MARIADB_PRIVADO_REMOVIDO
LAB_SAIDA=0
```

**Homologação confirmada: 33/33 PASS no Android, segundo jogador com números/UUIDs fictícios e decisões segregadas, sem crossover observado no ensaio sequencial.** Concorrência simultânea de comandos, grupos reais e integração de contas continuam NÃO homologados.

**Limites de segurança preservados:** `Core.init()` bloqueado, identities fictícias, MQTT loopback e banco/daemon MariaDB privativos, nenhuma sessão WhatsApp real, Keycloak, site, cron, banco de produção ou branch main acessados. Se houver nova falha, corrigir gate e causa específica, sem repetir /ping ou trabalhos de implantação.

Diário mestre: https://docs.google.com/document/d/1p6yD3vVhAP_sCNsAA8gl2tCWB4OsU0xaSFBLaC7Ztoo/edit


## Log real da V6.1 — 16/11/2026

Enviado pelo responsável após verificação de SHA256 do CJS. Síntese dos marcadores observados:

```text
V6_1_INTEGRIDADE=APROVADA
LAB=JORNADA_CORE_NATIVO_MQTT_V6_1_DOIS_JOGADORES
MARIADB_AMBIENTE=PRIVADO_DESCARTAVEL
MARIADB_PRIVADO_PORTA=46123
LAB_DB_CRIADO
LAB_TCP_ISOLADO_OK
CORE_MIGRATIONS_OK
CORE_RECEPTOR_MQTT=MAIN_ORIGINAL
CORE_MAIN_INIT_BLOQUEADO=SIM
CORE_MQTT_PUBLISH=PACKETUTILS_ORIGINAL
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
PASS=12_RELATORIO_DURANTE_VIAGEM_ORIGINAL
PASS=13_AVANCAR_TEMPO_PELA_ROTINA_TESTE_ORIGINAL
PASS=14_SEGUNDO_EVENTO_CROWNICLES_CHEGADA
PASS=15_DUPLICATA_SEGUNDO_RELATORIO_BLOQUEADA
PASS=16_ESCOLHA_SEGUNDO_EVENTO_NATIVO
PASS=17_PERFIL_E_INVENTARIO_CONSISTENTES_DEPOIS_2_EVENTOS
PASS=18_MISSOES_E_COLETOR_ANTIGO_CONSISTENTES
PASS=19_DESTINOS_DO_CONTINENTE_NATIVOS
PASS=20_ESCOLHA_DESTINO_ORIGINAL_VIA_MQTT
PASS=21_VIAGEM_MUNDO_ABERTO_RELATORIO
PASS=22_CHEGADA_ACELERADA_OFICIAL
PASS=23_CATALOGO_EVENTOS_E_SEM_FIXTURE
MUNDO_ABERTO_EVENTO_SEM_FIXTURE=SIM
MUNDO_ABERTO_EVENTO_SORTEADO=26
PASS=24_EVENTO_ALEATORIO_CORE_ORIGINAL
PASS=25_ESCOLHA_EVENTO_ALEATORIO_ORIGINAL
PASS=26_ESTADO_E_DUPLICATAS_APOS_EVENTO_ALEATORIO
DOIS_JOGADORES_IDENTIDADES=2_DISTINTAS
PASS=27_SEGUNDA_IDENTIDADE_PRE_INICIO
DOIS_JOGADORES_EVENTO_WA2=61
PASS=28_SEGUNDO_JOGADOR_EVENTO_CORE_NATIVO
DOIS_JOGADORES_MENU_SEPARADO=SIM
PASS=29_MENUS_PRIVADOS_SEM_VAZAMENTO
DOIS_JOGADORES_WA2_PONTOS=62
PASS=30_REACAO_JOGADOR2_APLICADA_SOMENTE_A_ELE
DOIS_JOGADORES_SALDOS_INDEPENDENTES=SIM
PASS=31_PERSISTENCIA_SEPARADA_DOS_DOIS_JOGADORES
DOIS_JOGADORES_REPLAY_WA2_BLOQUEADO=SIM
PASS=32_DUPLICATA_SEGUNDO_JOGADOR_NAO_AFETA_ESTADO
DOIS_JOGADORES_PERFIS_CROSSOVER=NAO
PASS=33_PERFIS_NATIVOS_SEGREGADOS_E_NUMERO_DESCONHECIDO
DOIS_JOGADORES_V6_NOVOS_TESTES=7/7
DOIS_JOGADORES_V6_FALHAS=0
JORNADA_CROWNICLES_RESULTADOS=33/33
JORNADA_CROWNICLES_FALHAS=0
CORE_MAIN_INIT_COMPLETA_NAO_EXECUTADA=SIM
WHATSAPP_REAL_NAO_ACESSADO=SIM
MARIADB_SERVICO_LOCAL_COMPARTILHADO=NAO
MARIADB_INSTANCIA_PRIVADA=SIM
SCHEMA_DE_PRODUCAO_NAO_ACESSADO=SIM
BANCO_TEMPORARIO_REMOVIDO
MARIADB_PRIVADO_REMOVIDO
LAB_SAIDA=0
CODIGO_EXECUCAO=0
LOG_COMPLETO=/data/data/com.termux/files/home/jornada_v6_1_resultado.log
```

Interpretação: o próprio Core original persistiu os dois personagens distintos e a ponte entregou as respectivas respostas somente ao número de laboratório associado; menus não vazaram, reentrega não duplicou. Os sistemas testados funcionaram **sequencialmente**, no mesmo broker e banco efêmeros. A execução não prova corrida de dois comandos simultâneos nem prontidão para usuários reais. Próximo gate recomendado: concorrência simultânea de duas identidades e comportamento sob replay de coletor, com limites e cleanup.
