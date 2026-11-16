# Crownicles — Jornada Mundo Aberto V5 (Termux, 16/11/2026)

**ESTADO ATUALIZADO EM 16/11/2026: V5 HOMOLOGADA NO TERMUX, 26/26 PASS, 8/8 NOVOS, 0 FALHAS, LAB_SAIDA=0.** A evidência é o log real fornecido pelo responsável. V4 anterior também comprovada 18/18. Não confundir laboratório com produção.

## Novo gate de qualidade

A V5 expande automaticamente o mesmo percurso do tutorial até depois do segundo evento (baseline 18/18) e segue com 8 testes reais adicionais **19–26**, sempre usando o Core 6.2.0.b original, a ponte MQTT WhatsApp fictícia, MariaDB e broker efêmeros.

19. **DESTINOS_DO_CONTINENTE_NATIVOS**: exige `ReactionCollectorChooseDestinationData` do Core ao final do evento original 60 no mapa29. Verifica opções reais de destino entre os mapas 6,10,17 e a correspondente `MapLinkDataController.getLinkByLocations`. Prefere mapa10 pela variedade de eventos disponíveis, sem forçar rota ou alterar mapa SQL.
20. **ESCOLHA_DESTINO_ORIGINAL_VIA_MQTT**: envia índice de menu (o próprio jogador escolheria) ao `ReactionCollectorReactPacket` original via MQTT; exige `CommandReportChooseDestinationRes` e mapLinkId persistido; coletor anterior descartado.
21. **VIAGEM_MUNDO_ABERTO_RELATORIO**: `/aventura` durante o trajeto retorna `CommandReportTravelSummaryRes` original.
22. **CHEGADA_ACELERADA_OFICIAL**: método oficial `TravelTime.timeTravel(player,tripDuration+2,NumberChangeReason.TEST)` no jogador descartável; `Maps.isArrived()` verdadeiro.
23. **CATALOGO_EVENTOS_E_SEM_FIXTURE**: após consumir evento60, `player.nextEvent === null`. `BigEventDataController.getAvailableEvents` original retorna >=2 eventos reais elegíveis no novo mapa, excluindo tutoriais 60/61. Testa também `getRandomEvent` original e confere pertencer ao conjunto elegível. **Não grava um novo nextEvent**.
24. **EVENTO_ALEATORIO_CORE_ORIGINAL**: `/aventura` chega e escolhe o **terceiro evento sem fixture**. Evento do `ReactionCollectorBigEventData` deve pertencer ao conjunto elegível do Core e ter menu seguro em pt-BR.
25. **ESCOLHA_EVENTO_ALEATORIO_ORIGINAL**: escolha suportada via MQTT é respondida por `ReactionCollectorStopPacket` e `CommandReportBigEventResultRes`, com recompensas calculadas pelo Core e expostas pela ponte.
26. **ESTADO_E_DUPLICATAS_APOS_EVENTO_ALEATORIO**: perfil (nível, dinheiro, pontos) confere com banco, missões consultam o Core, duplicata da escolha não reexecuta e menu de decisão obsoleto não fica ativo.

**Gate V5 HOMOLOGADO no log Termux recebido; foram observados:** `MUNDO_ABERTO_V5_NOVOS_TESTES=8/8`, `MUNDO_ABERTO_V5_FALHAS=0`, `JORNADA_CROWNICLES_RESULTADOS=26/26`, `JORNADA_CROWNICLES_FALHAS=0`, `LAB_SAIDA=0` e limpeza `BANCO_TEMPORARIO_REMOVIDO`/`MARIADB_PRIVADO_REMOVIDO`.

## Evidências locais pré-Android

- Sintaxe Node: `node --check` PASS.
- Pacote bridge: `PACOTE_INTEGRO=23/23`, nenhuma inicialização Core na verificação.
- Guards: **11/11 PASS** (estrutura, baseline, 8 testes novos, nenhum evento forçado após tutorial, caminho original do mapa, ponte, segurança, saída dinâmica e SHA256).
- ZIP Android: descompactado e validado byte a byte, sem erro.
- A execução do Core/MariaDB **foi realizada depois pelo usuário em Termux Android, com 26/26 PASS**. Os guards locais eram apenas preparação; ver extrato factual abaixo.

## Segurança e atribuição

- Motor pinado `Crownicles/Crownicles@64d08c05f11949029317341735f6f73024f19f9b`, versão 6.2.0.b.
- Fonte oficial de roteamento e seleção: `Core/resources/mapLinks/78.json`, `79.json`, `80.json`, `Core/resources/mapLocations/{6,10,17}.json`, `Core/src/data/BigEvent.ts`, `Core/src/core/report/ReportBigEventService.ts`.
- Usar apenas DB único temporário (e MariaDB privativo se socket inativo), broker MQTT 127.0.0.1, identidade fictícia, `Core.init()` bloqueado. **Não tocar no WhatsApp/Baileys real, Keycloak, site, schemas de produção, MariaDB compartilhado, cron nem branch main**. Em caso de falha, corrigir precisamente a origem; não fraudar teste e não refazer ping.

## Artefatos entregues

- [Runner V5 único (.cjs)](https://drive.google.com/file/d/1phmHqw_ddgohotE9HLahR9b0uZmoXtvs/view), **145747 bytes SHA256 `1f14ec3f9297cf8fa88bcd251655990da473dadfa5c1982d14ba6b147615ab7d`**.
- [ZIP Android somente CJS](https://drive.google.com/file/d/1eIF_3M5eHdb4FwYrCrz0mBU3zQz7VAkw/view), **80086 bytes SHA256 `9c18580654c27a11de3a4fa7446a3f648a882efc15e6de15dbc919b1214d6479`**.
- [ZIP código-fonte+teste 11/11+builder+README+manifest](https://drive.google.com/file/d/19MqWqIh6DFCWp7t6SCmz43jWQdUzHcj3/view), **89022 bytes SHA256 `17cbda5afadaaea4acdf26200f624ec239933c0f85a7d2a48216f5edb1fbfe46`**.
- [README](https://drive.google.com/file/d/1EL1ksNwv0ZJzjBeiz3JAdgbLTQei6jDQ/view).

Diário Komekko: https://docs.google.com/document/d/1p6yD3vVhAP_sCNsAA8gl2tCWB4OsU0xaSFBLaC7Ztoo/edit


## HOMOLOGAÇÃO V5 — log real Termux recebido em 16/11/2026

```text
V5_INTEGRIDADE=APROVADA
LAB=JORNADA_CORE_NATIVO_MQTT_V5_MUNDO_ABERTO
MARIADB_AMBIENTE=PRIVADO_DESCARTAVEL
MARIADB_PRIVADO_PORTA=34021
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
CONTINUIDADE_VIAGEM_REAL_DESTINO=29
PASS=12_RELATORIO_DURANTE_VIAGEM_ORIGINAL
CONTINUIDADE_EVENTO_60_FIXTURE=SIM
PASS=13_AVANCAR_TEMPO_PELA_ROTINA_TESTE_ORIGINAL
PASS=14_SEGUNDO_EVENTO_CROWNICLES_CHEGADA
PASS=15_DUPLICATA_SEGUNDO_RELATORIO_BLOQUEADA
PASS=16_ESCOLHA_SEGUNDO_EVENTO_NATIVO
PASS=17_PERFIL_E_INVENTARIO_CONSISTENTES_DEPOIS_2_EVENTOS
PASS=18_MISSOES_E_COLETOR_ANTIGO_CONSISTENTES
MUNDO_ABERTO_DESTINOS_OFERECIDOS=10,17,6
MUNDO_ABERTO_ROTA_ESCOLHIDA=10
PASS=19_DESTINOS_DO_CONTINENTE_NATIVOS
MUNDO_ABERTO_MAP_LINK=79
PASS=20_ESCOLHA_DESTINO_ORIGINAL_VIA_MQTT
MUNDO_ABERTO_VIAGEM_DURACAO=60
PASS=21_VIAGEM_MUNDO_ABERTO_RELATORIO
MUNDO_ABERTO_TEMPO_TESTE=62_MIN
PASS=22_CHEGADA_ACELERADA_OFICIAL
MUNDO_ABERTO_EVENTOS_ELEGIVEIS=3
MUNDO_ABERTO_EVENTO_PRE_AMOSTRA=47
MUNDO_ABERTO_EVENTO_SEM_FIXTURE=SIM
PASS=23_CATALOGO_EVENTOS_E_SEM_FIXTURE
MUNDO_ABERTO_EVENTO_SORTEADO=47
PASS=24_EVENTO_ALEATORIO_CORE_ORIGINAL
MUNDO_ABERTO_EVENTO_REAL_PONTOS=71
MUNDO_ABERTO_EVENTO_REAL_MOEDAS=7
MUNDO_ABERTO_EVENTO_REAL_XP=0
PASS=25_ESCOLHA_EVENTO_ALEATORIO_ORIGINAL
MUNDO_ABERTO_NIVEL_FINAL=3
MUNDO_ABERTO_MOEDAS_FINAIS=15019
PASS=26_ESTADO_E_DUPLICATAS_APOS_EVENTO_ALEATORIO
MUNDO_ABERTO_V5_NOVOS_TESTES=8/8
MUNDO_ABERTO_V5_FALHAS=0
JORNADA_CROWNICLES_RESULTADOS=26/26
JORNADA_CROWNICLES_FALHAS=0
CORE_MAIN_INIT_COMPLETA_NAO_EXECUTADA=SIM
WHATSAPP_REAL_NAO_ACESSADO=SIM
MARIADB_SERVICO_LOCAL_COMPARTILHADO=NAO
SCHEMA_DE_PRODUCAO_NAO_ACESSADO=SIM
BANCO_TEMPORARIO_REMOVIDO
MARIADB_PRIVADO_REMOVIDO
LAB_SAIDA=0
CODIGO_EXECUCAO=0
LOG_COMPLETO=/data/data/com.termux/files/home/jornada_v5_resultado.log
```

**Escopo provado:** após baseline V3/V4, o próprio Core apresentou destinos [10,17,6], a escolha do mapa10 foi efetivada pelo pacote original e persistiu link79. A viagem oficial de 60 minutos foi adiantada 62 minutos com API oficial de teste. No mapa10, Core listou 3 eventos elegíveis, `nextEvent === null` e selecionou evento 47 sem fixture para esse terceiro evento; coletor original processou a escolha, creditando 71 pontos, 7 moedas e 0 XP, e o perfil final retornou nível 3, 15019 moedas. A terceira recompensa é do motor; moedas acumuladas incluem o evento60 **deliberadamente forçado** no tutorial anterior, que fornecia 15001 moedas e não representa economia típica de jogo normal. Duplicatas não repetiram comandos. Tudo isolado em MariaDB efêmero, sem tocar em WhatsApp/Keycloak/main/produção. 

**Limites restantes:** a conta é sintética, o evento61 e o evento60 iniciais foram forçados para controle, e o próximo evento foi aleatório apenas dentro do mapa10. Não são homologados combate, PvE/PvP, economias variadas, reentrância/expiração de diferentes coletores, múltiplos jogadores, cadastro no site, mensagens WhatsApp reais, cron e `Core.init()` completo.
