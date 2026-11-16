# Crownicles — Jornada Contínua V4 (Termux)

**Situação em 16/11/2026: V4 HOMOLOGADA NO TERMUX, 18/18 PASS, 7/7 novos, 0 falhas, LAB_SAIDA=0 e limpeza verificada.** A evidência foi fornecida diretamente pelo responsável. Não é homologação do bot de produção.

## Propósito

Avançar do evento inicial 61 até a próxima viagem e segundo evento nativo 60, com report, decisão real, recompensas, ficha, inventário e missões, usando o Core Crownicles 6.2.0.b original, MQTT do `Core/main.js`, jogo persistido **somente em MariaDB temporário** e bridge WhatsApp mock local.

A V4 se baseia na V3 homologada pelo usuário no Termux. Ela reconstitui automaticamente 11 testes da V3 como pré-condição no MESMO banco descartável e acrescenta os sete testes seguintes. Não se trata de obrigar o usuário a reconfigurar dependências.

| Pass | Novo critério |
|---|---|
| 12 | Novo `/aventura` DURANTE a viagem retorna `CommandReportTravelSummaryRes` original, destino mapId29 e chegada coerente |
| 13 | Avanço de 5 minutos com `TravelTime.timeTravel(player,5,NumberChangeReason.TEST)` + `player.save()` originais; chegada confirmada com `Maps.isArrived()`; fixture efêmera `nextEvent=60` |
| 14 | Segundo `/aventura` recebe evento original 60 e menu de reações original via MQTT |
| 15 | Duplicata do segundo `/aventura` não reexecuta comando |
| 16 | Escolha original `end` retorna `ReactionCollectorStopPacket` e `CommandReportBigEventResultRes`; o próprio Core calcula recompensas e as persiste |
| 17 | Perfil/inventário oficiais depois de dois eventos, saldo/score/nível comparados à DB real temporária |
| 18 | Missões originais reconsultadas, menu antigo ausente, mensagem repetida de escolha bloqueada |

### Por que tempo acelerado e evento 60?

A fonte original `Core/src/commands/admin/testCommands/Time/AdvanceTravelTestCommand.ts` define o comando `advancetravel` com `TravelTime.timeTravel(player,minutes,NumberChangeReason.TEST)`, seguido de `player.save()`. A V4 usa **exatamente** essa API original no personagem efêmero. Não muda o relógio Android, não injeta SQL de datas, nem ativa cron. Recurso oficial `Core/resources/events/60.json` tem gatilho em `mapId=29`, possibilidades `end` e `start`. A fixture `nextEvent=60` evita incerteza: **não se afirma que sorteio aleatório de eventos foi homologado**. As recompensas de evento 60 vêm do JSON oficial e do próprio Core, não são criação da ponte.

### Integridade e segurança

Arquivo `Crownicles_Jornada_Continua_V4.cjs`: **135523 bytes**, SHA256 `26d38fb3fce09cb8f27965d9782d0afb7dadd01d015dd318bfe51fcec6b1b779`. ZIP Android com apenas o CJS, verificado byte a byte. 23 módulos bridge embutidos idênticos à V3 e verificados por SHA256. Sintaxe Node PASS. Testes de guarda estrutural `10/10 PASS` no ambiente do assistente, não são o runtime MariaDB/MQTT real. 

Continuam **proibidos**: WhatsApp/Baileys real, site/Keycloak, conta de usuário real, schema de produção, reiniciar MariaDB compartilhado, `Core.init()` (cron/servidor/rotinas), promover para `main`. A V4 usa banco e broker privativos; limpa recursos efêmeros criados pelo próprio processo. Compilação/MariaDB original passam por migrações num banco randômico a cada ensaio **por isolamento**; não há repetição manual de setup.

### Gates exigidos para homologar V4

```text
LAB=JORNADA_CORE_NATIVO_MQTT_V4_CONTINUIDADE
PASS=12_RELATORIO_DURANTE_VIAGEM_ORIGINAL
PASS=13_AVANCAR_TEMPO_PELA_ROTINA_TESTE_ORIGINAL
PASS=14_SEGUNDO_EVENTO_CROWNICLES_CHEGADA
PASS=15_DUPLICATA_SEGUNDO_RELATORIO_BLOQUEADA
PASS=16_ESCOLHA_SEGUNDO_EVENTO_NATIVO
PASS=17_PERFIL_E_INVENTARIO_CONSISTENTES_DEPOIS_2_EVENTOS
PASS=18_MISSOES_E_COLETOR_ANTIGO_CONSISTENTES
CONTINUIDADE_V4_NOVOS_TESTES=7/7
CONTINUIDADE_V4_FALHAS=0
JORNADA_CROWNICLES_RESULTADOS=18/18
JORNADA_CROWNICLES_FALHAS=0
BANCO_TEMPORARIO_REMOVIDO
MARIADB_PRIVADO_REMOVIDO
LAB_SAIDA=0
```

**Gate 18/18 foi cumprido no Termux no log enviado pelo responsável.** A V4 não confirma produção, cron ou seletores aleatórios: mapId29, evento 61 e evento 60 foram condicionados por fixtures de laboratório. Próxima bateria deve testar variação realista/seleção não forçada e persistência entre viagens sem repetir setup manual.

## Arquivos no Drive Komekko

- Runner único: https://drive.google.com/file/d/1yHVujH06PFYEeZBaNYKJMzbvr5bEThSI/view
- ZIP Android: https://drive.google.com/file/d/1wk836LB1A9Neg7dwUwWu3PXzJ8ukLjXW/view
- Fontes + guardas 10/10 + documentação + SHA256SUMS: https://drive.google.com/file/d/19bMYJkng0KdDVYXgZT4gFDJUMW_TOkde/view
- README: https://drive.google.com/file/d/1EjGYc0ZcNif2nALfJilYiQaWljkeczDW/view

Diário mestre: https://docs.google.com/document/d/1p6yD3vVhAP_sCNsAA8gl2tCWB4OsU0xaSFBLaC7Ztoo/edit


## HOMOLOGAÇÃO REAL V4 — log fornecido pelo usuário em 16/11/2026

```text
V4_INTEGRIDADE=APROVADA
LAB=JORNADA_CORE_NATIVO_MQTT_V4_CONTINUIDADE
MARIADB_AMBIENTE=PRIVADO_DESCARTAVEL
MARIADB_PRIVADO_PORTA=37385
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
CONTINUIDADE_VIAGEM_RESTANTE_MIN=3
PASS=12_RELATORIO_DURANTE_VIAGEM_ORIGINAL
CONTINUIDADE_TEMPO_AVANCADO_ORIGINAL=5_MIN
CONTINUIDADE_EVENTO_60_FIXTURE=SIM
PASS=13_AVANCAR_TEMPO_PELA_ROTINA_TESTE_ORIGINAL
CONTINUIDADE_SEGUNDO_EVENTO_ID=60
PASS=14_SEGUNDO_EVENTO_CROWNICLES_CHEGADA
PASS=15_DUPLICATA_SEGUNDO_RELATORIO_BLOQUEADA
CONTINUIDADE_EVENTO2_RECOMPENSA_MOEDAS=15001
CONTINUIDADE_EVENTO2_RECOMPENSA_XP=287
CONTINUIDADE_EVENTO2_PONTOS=5
PASS=16_ESCOLHA_SEGUNDO_EVENTO_NATIVO
CONTINUIDADE_PERFIL_FINAL_LEVEL=3
CONTINUIDADE_PERFIL_FINAL_MOEDAS=15009
PASS=17_PERFIL_E_INVENTARIO_CONSISTENTES_DEPOIS_2_EVENTOS
CONTINUIDADE_MISSOES_CAMPANHA=4
PASS=18_MISSOES_E_COLETOR_ANTIGO_CONSISTENTES
CONTINUIDADE_V4_NOVOS_TESTES=7/7
CONTINUIDADE_V4_FALHAS=0
JORNADA_CROWNICLES_RESULTADOS=18/18
JORNADA_CROWNICLES_FALHAS=0
WHATSAPP_REAL_NAO_ACESSADO=SIM
MARIADB_SERVICO_LOCAL_COMPARTILHADO=NAO
SCHEMA_DE_PRODUCAO_NAO_ACESSADO=SIM
BANCO_TEMPORARIO_REMOVIDO
MARIADB_PRIVADO_REMOVIDO
LAB_SAIDA=0
CODIGO_EXECUCAO=0
LOG_COMPLETO=/data/data/com.termux/files/home/jornada_v4_resultado.log
```

**Leitura técnica:** a sequência nativa processou dois eventos e uma viagem; primeiro evento 61 devolveu score aleatório 65; segundo evento 60 deliberadamente fixado pelo teste produziu 15001 moedas, 287 XP e 5 pontos, elevando personagem a nível 3, 15009 moedas e campanha 4. Esses números não representam recompensa normal de gameplay, pois o 60 é um evento específico de teste com altos valores. Distinguem-se testado e ainda não testado: a escolha foi original, persistência real no banco efêmero, mas **não** houve rotação aleatória de eventos sem fixture. O banco e daemon privados foram apagados e nenhuma sessão WhatsApp real foi acessada.
