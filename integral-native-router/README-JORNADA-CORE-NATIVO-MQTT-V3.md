# Jornada Core nativa MQTT V3 — Termux (16/11/2026)

**Estado atualizado em 16/11/2026:** **GATE JORNADA NATIVA V3 HOMOLOGADO NO TERMUX: 11/11 PASS, 0 falhas, saída 0.** Testes isolados adicionais 13/13 PASS. A evidência da execução Android foi fornecida pelo responsável e está resumida abaixo. Não confundir homologação do fluxo com produção ou RPG completo.

## Causa dos dois erros anteriores

V1: `ECONNREFUSED` no socket compartilhado `infra/mariadb/mysql.sock`; não houve comando de jogo. V2: fallback seguro reconheceu o socket inativo e tentou inicializar MariaDB privado, mas parou em `MARIADB_PRIVADO_INSTALACAO` com mensagem `If you are using a binary release, ... pass --basedir`. Na V2, o instalador era chamado com `--basedir=$PREFIX` no Termux; o pacote Termux já tem caminhos compilados absolutos (incluindo `INSTALL_SBINDIR=$TERMUX_PREFIX/bin`), e o script de pós-instalação chama `mariadb-install-db` **sem** esse argumento. Isso explica o cenário de resolução incorreta de caminhos. Ver fontes:
- <https://github.com/termux/termux-packages/blob/master/packages/mariadb/build.sh>
- <https://mariadb.com/docs/server/clients-and-utilities/deployment-tools/mariadb-install-db>

## Correção V3

- Removido `--basedir=$PREFIX` da chamada `mariadb-install-db`; mantidos `--no-defaults`, `--datadir` exclusivo e login via socket.
- Corrigida segunda falha latente: checar `path.resolve(@@datadir)===path.resolve(dataDir)`, em vez de impor `.startsWith(path.resolve(dataDir)+'/')` que rejeitava diretório exato após remover slash final.
- Se o instalador falhar novamente, a mensagem `MARIADB_INSTALADOR_DIAGNOSTICO` extrai linha `FATAL ERROR` / `Could not find`, não o rodapé genérico. Se o daemon morrer, `MARIADB_PRIVADO_LOG_FINAL` lê somente log do filho recém-criado no diretório temporário.
- Mantidos os 23 módulos embutidos, o Core nativo 6.2.0.b e as 11 verificações de `/jogar`, evento inicial, reação original, perfil, inventário e missões, com identidade fictícia.
- Sem acesso a WhatsApp real, Keycloak/site, schema de produção ou inicialização total `Core.init()`. MariaDB privado usa porta loopback e pasta `~/.cache/crownicles-native-lab/mariadb-wa-<random>` com marcador `OWNED_BY_JORNADA_V3`; limpa apenas seu próprio daemon, schema e diretório.

## Evidência disponível

`node --check` PASS; `node --verificar-pacote` `PACOTE_INTEGRO=23/23`; teste unitário `node --test crownicles_jornada_mariadb_fallback_v3.test.cjs` **13/13 PASS, 0 fail**. Inclui simulação de argumentos do instalador Termux, recusa de caminho divergente, reparo do slash de datadir, socket ausente/inativo e salvaguardas de limpeza. O ensaio local prévio não tinha Mosquitto/MariaDB, **mas a execução real subsequente no Termux foi concluída com sucesso (11/11)**, conforme log recebido abaixo.

## Arquivos entregues no Drive Komekko

- Runner V3 único (127369 bytes; SHA256 `dc47ece34194fdc31c75d51f0e06b62ed6d234edbfa2e59726ded0f77e683165`): <https://drive.google.com/file/d/1ozv7xziI7kMu9PnlpizferGylFnS_l24/view>
- Código, testes 13/13, README e manifest SHA256 (ZIP; 82251 bytes, hash `a96dccf5ba6ef29bc2fb5cbcd38830fe7e7e3578518676cf8960371359d2bb09`): <https://drive.google.com/file/d/1X1jsWLPloFBVSHDxuTcXFCk4d1PR-Rpm/view>
- Teste isolado: <https://drive.google.com/file/d/1ANWcErkJr34tvQ6PUEfvKD8WGi6YPu4M/view>
- README: <https://drive.google.com/file/d/1jEx5RNUn58vRVVYvmLKNGIpm7SHw6vaD/view>

Este gate foi concluído. Próximo escopo **ainda não validado**: ciclo de jogo posterior ao tutorial, campanhas e eventos adicionais, casos de expiração/concorrência de coletores, conexão com transporte WhatsApp real e site. Não repetir /ping, não modificar produção.

Diário: <https://docs.google.com/document/d/1p6yD3vVhAP_sCNsAA8gl2tCWB4OsU0xaSFBLaC7Ztoo/edit>.


## HOMOLOGAÇÃO: execução real recebida do Termux, 16/11/2026 14h38–14h39 BRT

**Prova recebida por mensagem do responsável**, não alegação de execução pela infraestrutura do assistente. Extrato fiel de marcadores e respostas do log (identidades UUID de teste omitidas deste documento):

```text
LAB=JORNADA_CORE_NATIVO_MQTT_V3
VERSAO_CORE=6.2.0.b
SESSAO_WHATSAPP=NAO_ACESSADA
MARIADB_SOCKET_EXISTENTE_INATIVO=SIM
LAB_ETAPA=MARIADB_PRIVADO_INSTALACAO
LAB_ETAPA=MARIADB_PRIVADO_PARTIDA
MARIADB_AMBIENTE=PRIVADO_DESCARTAVEL
MARIADB_PRIVADO_PORTA=33087
LAB_DB_CRIADO
LAB_TCP_ISOLADO_OK
CORE_MIGRATIONS_OK
CORE_COMANDOS_ORIGINAIS=REPORT_PROFILE_INVENTORY_MISSIONS_REACTION
MAPA_INICIAL_CROWNICLES=83_28
CORE_RECEPTOR_MQTT=MAIN_ORIGINAL
CORE_MAIN_INIT_BLOQUEADO=SIM
CORE_MQTT_PUBLISH=PACKETUTILS_ORIGINAL
PASS=01_CORE_ORIGINAL_QUATRO_COMANDOS_E_COLETOR
PASS=02_MQTT_SUBACK_ORIGINAL
PASS=03_PERFIL_PRE_INICIO_CROWNICLES
PASS=04_INVENTARIO_PRE_INICIO_CROWNICLES
PASS=05_MISSOES_PRE_INICIO_CROWNICLES
JORNADA_MAP_LINK=83
JORNADA_EVENTO_INICIAL=61
PASS=06_JOGAR_CROWNICLES_REPORT_E_MAPA_PERSISTIDO
PASS=07_REENTREGA_JOGAR_SEM_NOVO_COMANDO
JORNADA_EFEITO_APOS_EVENTO=none
JORNADA_PONTOS_APOS_EVENTO=63
PASS=08_MENU_E_REACAO_CROWNICLES_ORIGINAL
PASS=09_PERFIL_APOS_EVENTO_CROWNICLES
PASS=10_INVENTARIO_APOS_EVENTO_CROWNICLES
PASS=11_MISSOES_APOS_EVENTO_CROWNICLES
LAB_ETAPA=TESTES_CONCLUIDOS
JORNADA_CROWNICLES_RESULTADOS=11/11
JORNADA_CROWNICLES_FALHAS=0
CORE_MAIN_INIT_COMPLETA_NAO_EXECUTADA=SIM
WHATSAPP_REAL_NAO_ACESSADO=SIM
MARIADB_SERVICO_LOCAL_COMPARTILHADO=NAO
MARIADB_INSTANCIA_PRIVADA=SIM
SCHEMA_DE_PRODUCAO_NAO_ACESSADO=SIM
LAB_ETAPA=LIMPEZA
BANCO_TEMPORARIO_REMOVIDO
MARIADB_PRIVADO_REMOVIDO
LAB_SAIDA=0
```

**Detalhes materiais do teste:** Antes de `/jogar`, `CommandProfilePacketReq`, `CommandInventoryPacketReq` e `CommandMissionsPacketReq` foram processados no Core e devolveram `RequirementEffectPacket: {currentEffectId:"notStarted",remainingTime:0}`. `/jogar` gerou o coletor original `ReactionCollectorBigEventData.eventId=61`, com reações na ordem `end, follow, observe`. A reação enviada foi `ReactionCollectorReactPacket.reactionIndex=0`, com retorno `ReactionCollectorStopPacket`, `PlayerLevelUpPacket.level=1`, `CommandReportBigEventResultRes` (eventId 61, possibilityId "end", score 63, experience 172, money 10, nenhum gasto de gemas/tokens), seguido de `CommandReportChooseDestinationRes.mapId=29`, tripDuration 3 min. O perfil original retornou nível 1, score 63, vida 66/66, dinheiro 10, tokens 10/20, experiência 22/164 e destino 29. Inventário original retornou foundPlayer true, equipamento inicial id0 e materiais vazios. Missões originais: `MissionsCompletedPacket` com campanha commandMission concluída; `CommandMissionsPacketRes` com commandReport pendente, spendTokens diária, campaignProgression=2 e maxCampaignNumber=149. **A progressão da campanha é do Core, não cálculo da ponte.**

**Limite da prova:** configura-se como **primeira jornada nativa isolada do motor original via MQTT com identidade fictícia e gateway de laboratório**, não operação WhatsApp real, não site, não inicialização completa do servidor, não testes de toda a exploração, classes ou PvP/PvE e não autorização de promoção para `main`. A fixture fixa evento 61; isso não homologa sorteio aleatório.
