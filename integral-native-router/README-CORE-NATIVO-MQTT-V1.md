# Crownicles original — Core nativo Ping via MQTT/TCP e Gateway SQLite — V1

**16/11/2026 · homologado no Android: 5/5, 0 falhas, limpeza confirmada · branch `feat/crownicles-integral-native-router`**

## GATE anterior fechado

MQTT V5 homologado pelo usuário no Termux, **5/5**, `MQTT_WIRE_FALHAS=0`, `LAB_SAIDA=0`; broker Mosquitto isolado real, SUBACK nos dois clientes após reinício, segunda solicitação única, sem reenvio. Evidência integral: `README-MQTT-V5.md`, commit `af288926d9dc6b503b9c944cdbb2fe184893708a`. Não repetir o V5.

## Objetivo novo, sem reescrever o RPG

O runner usa o **Crownicles original, versão 6.2.0.b**, em um processo Node separado. Reaproveita o bootstrap Core/MariaDB temporário do laboratório nativo que já passou nos ensaios anteriores; carrega o construtor original via `app.js`, com configuração injetada apenas em memória. **Nunca chama `Core/src/main.ts`, `Crownicles.init()` nem inicia o bot real.**

Executa o **código original `PingCommand.execute`**, com jogador criado exclusivamente em um banco MariaDB descartável, através de um *respondedor MQTT de laboratório*. O Gateway, a lista de envios simulados e o SQLite são reais, mas o transporte WhatsApp é somente uma função mock. Portanto, a V1 comprova a *execução do handler nativo sobre MQTT*, **não** o servidor MQTT de produção nem a inicialização completa do Core. O formato de pacote (`context` + `packet`) é o do projeto original.

Em um único ensaio (sem repetir os 27 testes prévios):

1. `01_CORE_NATIVO_PLAYER_EM_DB_EFEMERA` — usuário fictício recuperável do banco SQL exclusivo.
2. `02_BROKER_MQTT_REAL_E_SUBACK` — broker Mosquitto real loopback, assinaturas manuais e estado ready.
3. `03_GATEWAY_SQLITE_MQTT_PING_CORE_NATIVO` — texto `/ping` passa por Gateway/SQLite → MQTT/TCP → código original `PingCommand.execute` → MQTT/TCP → resposta oficial renderizada.
4. `04_REENTREGA_WHATSAPP_NAO_DUPLICA_COMANDO_NATIVO` — repetição do mesmo identificador não reexecuta a consulta.
5. `05_SEGUNDO_PING_NATIVO_NOVO_UUID` — nova solicitação única, com UUID de requisição diferente.

## Segurança e limites

- O laboratório **acessa o serviço local MariaDB já existente**, mas usa uma **nova base de dados randômica, dois logins temporários com escopo restrito à base** e descarte ao final. Não lê as tabelas de jogadores de produção, não reinicia o daemon nem altera o Core instalado. A auditoria temporária fica em `~/.cache/crownicles-native-lab` somente se houver falha de limpeza.
- Broker filho temporário em `127.0.0.1:porta alta aleatória (20000–60999)` com prefixo `cw_wa_mqtt_lab_` aleatório e sem persistência. Mata apenas o processo próprio, nunca o Mosquitto/WhatsApp em uso.
- O jogador `keycloakId` é UUID fictício gerado a cada execução e não representa um usuário real. Não acessa Keycloak.
- **Baileys/WhatsApp real e site não são usados**. Não envia mensagens externas e não executa comandos mutativos por MQTT; exercita somente Ping.
- Não promove arquivos para main nem habilita funcionalidades da produção. Prova nativa anterior 27/27 e regressão Node 862/862 continuam independentes. Nunca somar essas contagens com o novo gate.
- Pacote autossuficiente inclui 23 módulos com SHA-256 embutidos e verifica cada um antes de extrair em diretório temporário. Arquivo `crownicles_core_nativo_mqtt_v1_termux_autossuficiente.cjs`, SHA256 **`305857b3e5da836d48ff13b1bb72c5e6ab4d98dab611303eec94074d7a309ab9`**, **106618 bytes**.

## Prova local e homologação real concluída

Node 22.16.0: `node --check` **PASS**. `node arquivo.cjs --verificar-pacote` retorna `PACOTE_INTEGRO=23/23`, `CORE_MAIN_NAO_INICIADO=SIM`. O ambiente de desenvolvimento não possui Mosquitto; ao invocar sem argumentos ele termina de modo esperado com `MOSQUITTO_AUSENTE`, `LAB_SAIDA=1`, antes de criar banco. **Os cinco testes de integração nativa foram executados no Termux e aprovados: 5/5, zero falhas.**

No Termux, após baixar o único `.cjs`:

```bash
node --max-old-space-size=256 "$HOME/storage/downloads/crownicles_core_nativo_mqtt_v1_termux_autossuficiente.cjs"
```

O navegador pode acrescentar sufixos ao nome; o comando oficial do chat localizará o arquivo pelo SHA256, não pelo nome. Gate foi aprovado com `PASS=01..05`, `CORE_NATIVO_MQTT_RESULTADOS=5/5`, `CORE_NATIVO_MQTT_FALHAS=0`, `LAB_SAIDA=0` e `BANCO_TEMPORARIO_REMOVIDO`. Se falhar, registrar `LAB_FALHA_ETAPA`, `LAB_FALHA_DETALHE`, cleanup e corrigir, sem tentar ligar produção.

## Continuidade após o gate

Depois de provar o handler original via broker, estudar e ligar os **packet handlers e receptor MQTT originais** do Core em contexto de teste isolado. Só então evoluir Baileys mock/inbox e expansão em lote dos 48 comandos e 56 coletores, preservando sistemas e localizações originais. A arquitetura não é um novo jogo; nome final continua indefinido.


## Homologação real Termux em 16/11/2026 — APROVADO

Relatório fornecido pelo usuário, preservado também no Diário Mestre Komekko:

```text
LAB=CORE_NATIVO_MQTT_V1
VERSAO_CORE=6.2.0.b
PREFIXO_TEMPORARIO=crownicles_test_wa_native_2ba5fd058f
MARIADB_PORTA_PRODUCAO=13306
SESSAO_WHATSAPP=NAO_ACESSADA
LAB_ETAPA=CORE_BOOTSTRAP
Verifying packets decorators... All packets decorators OK
Verifying core packets handlers... All core packets handlers OK
Verifying discord packets handlers... All discord packets handlers OK
LAB_CONFIG_MODE=OFICIAL
CORE_LOAD_ORDER=APP_PRIMEIRO
CORE_EXPORTS=Crownicles
CORE_CONSTRUCTOR_TIPO=function
CORE_CONSTRUCTOR_INSTANCIADO_VIA_APP
LAB_DB_CRIADO
LAB_TCP_ISOLADO_OK
CORE_MIGRATIONS_OK
LAB_SINGLETON_MODE=OFICIAL
[CommandPingPacketReq] Registered packet handler (function 'execute' in class 'PingCommand')
MQTT_BROKER_HOST=127.0.0.1
MQTT_BROKER_PORTA_TEMPORARIA=60170
MQTT_PREFIXO=cw_wa_mqtt_lab_2a2f60870517584ac135ae7d
CORE_MAIN_INICIADO=NAO
PASS=01_CORE_NATIVO_PLAYER_EM_DB_EFEMERA
PASS=02_BROKER_MQTT_REAL_E_SUBACK
PASS=03_GATEWAY_SQLITE_MQTT_PING_CORE_NATIVO
PASS=04_REENTREGA_WHATSAPP_NAO_DUPLICA_COMANDO_NATIVO
PASS=05_SEGUNDO_PING_NATIVO_NOVO_UUID
LAB_ETAPA=TESTES_CONCLUIDOS
CORE_NATIVO_PING=ORIGINAL
CORE_NATIVO_MQTT_RESULTADOS=5/5
CORE_NATIVO_MQTT_FALHAS=0
CORE_ORIGINAL_MAIN_NAO_INICIADO=SIM
WHATSAPP_REAL_NAO_ACESSADO=SIM
MARIADB_SERVICO_LOCAL_COMPARTILHADO=SIM
SCHEMA_DE_PRODUCAO_NAO_ACESSADO=SIM
LAB_TESTES_TOTAIS=5/5
LAB_TESTES_FALHARAM=0
LAB_ETAPA=LIMPEZA
BANCO_TEMPORARIO_REMOVIDO
LAB_SAIDA=0
```

**Nota:** log acima é extrato dos marcos de execução relevantes; o usuário forneceu também registros individuais de todas as migrações da base original, de 001 a 081 (inclusive dois scripts 068). O teste real ratifica a execução do handler original via responder MQTT controlado, mas **não** comprova execução do receptor MQTT original do Core, nem o bot WhatsApp real, nem integração integral das 48 rotas e 56 coletores. Não repetir este gate. Prosseguir com pesquisa e reaproveitamento do receptor MQTT padrão do projeto, mantendo as demais instâncias intocadas.
