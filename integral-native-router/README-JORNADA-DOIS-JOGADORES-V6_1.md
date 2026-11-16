# Crownicles V6.1 — correção do laboratório multijogador (16/11/2026)

**STATUS:** execução V6 anterior = **26/33 PASS**, 7/7 testes novos falharam, `LAB_SAIDA=2`. Correção V6.1 pronta, **20/20 testes locais PASS**, bundle bridge **23/23**, mas **Android nativo ainda pendente**. V5 26/26 permanece homologada.

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

## Gate Termux (pendente)

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

**Limites de segurança preservados:** `Core.init()` bloqueado, identities fictícias, MQTT loopback e banco/daemon MariaDB privativos, nenhuma sessão WhatsApp real, Keycloak, site, cron, banco de produção ou branch main acessados. Se houver nova falha, corrigir gate e causa específica, sem repetir /ping ou trabalhos de implantação.

Diário mestre: https://docs.google.com/document/d/1p6yD3vVhAP_sCNsAA8gl2tCWB4OsU0xaSFBLaC7Ztoo/edit
