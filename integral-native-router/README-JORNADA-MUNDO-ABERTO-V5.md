# Crownicles — Jornada Mundo Aberto V5 (Termux, 16/11/2026)

**ESTADO: PREPARADA E TESTADA ESTRUTURALMENTE; EXECUÇÃO NATIVA NO ANDROID PENDENTE.** V4 anterior comprovada pelo usuário em Termux: **18/18 PASS**; GitHub README V4 atualizado commit `3403a8126524c631ed2c871187396ad93995e92b`.

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

**V5 NÃO HOMOLOGADA até o usuário fornecer:** `MUNDO_ABERTO_V5_NOVOS_TESTES=8/8`, `MUNDO_ABERTO_V5_FALHAS=0`, `JORNADA_CROWNICLES_RESULTADOS=26/26`, `JORNADA_CROWNICLES_FALHAS=0`, `LAB_SAIDA=0` e limpeza `BANCO_TEMPORARIO_REMOVIDO`/`MARIADB_PRIVADO_REMOVIDO`.

## Evidências locais pré-Android

- Sintaxe Node: `node --check` PASS.
- Pacote bridge: `PACOTE_INTEGRO=23/23`, nenhuma inicialização Core na verificação.
- Guards: **11/11 PASS** (estrutura, baseline, 8 testes novos, nenhum evento forçado após tutorial, caminho original do mapa, ponte, segurança, saída dinâmica e SHA256).
- ZIP Android: descompactado e validado byte a byte, sem erro.
- **Execução Core/MariaDB real do novo lote ainda não foi executada no ambiente do assistente**, pois Termux Android tem suas dependências. Não confundir guards com sucesso do gameplay.

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
