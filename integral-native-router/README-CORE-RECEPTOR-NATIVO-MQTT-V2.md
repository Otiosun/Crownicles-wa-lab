# Crownicles Core original — receptor MQTT de `main.js` em laboratório V2

**16/11/2026 — ensaio de rede nativa V2 homologado em Termux: 5/5 PASS, 0 falhas, limpeza confirmada.** Branch isolada `feat/crownicles-integral-native-router` do repositório `Otiosun/Crownicles-wa-lab`. Nunca promover para `main` sem critérios de proteção.

## Fato já homologado (não repetir)

- MQTT real / reconexão V5: **5/5 PASS**, sem retransmissão do primeiro pedido, com SUBACK de ambos os lados.
- Core nativo 6.2.0.b / MariaDB temporário / MQTT TCP / Gateway SQLite V1: **5/5 PASS**, executando `PingCommand.execute` original num respondedor controlado; duplicatas bloqueadas, segundo UUID aceito; `BANCO_TEMPORARIO_REMOVIDO`, `LAB_SAIDA=0`, WhatsApp real não acessado.
- Regresso Node independente: **862/862 PASS** (antes deste ensaio).

## Por que um V2?

No V1, um responder MQTT de laboratório chamava `new PingCommand().execute` com o player original do banco de testes. Isso **não** exercitava o `mqttClient.on('message')`, `dispatchPacket` e `PacketUtils.sendPackets` originais do Core.

O receptor real é implementado no **código original** `Core/src/main.ts` / compilado `dist/Core/src/main.js`, com `mqttClient` em `Core/src/mqttClient.ts`, `packetListener` em `Lib/src/packets/PacketListener.ts` e despacho de respostas em `Core/src/core/utils/PacketUtils.ts`. O arquivo original `main` tem uma chamada incondicional a `crowniclesInstance.init()`; importar esse arquivo sem proteção iniciaria vários serviços, portanto é proibido neste laboratório.

A V2 carrega esse **`main.js` compilado e original**, num processo Node separado, com as seguintes barreiras explícitas:

1. Reutiliza o bootstrap Crownicles/MariaDB do V1, 100% em base randômica temporária, contas SQL exclusivas e limpeza. NÃO carrega o Core main sem barreiras.
2. Antes de importar `app.js`, injeta no cache CJS do `mqttClient.js` original um stub desconectado que **não consegue abrir broker compartilhado** nem publicar mensagens externas. O stub é substituído em memória pelo cliente MQTT do teste apenas após o broker temporário ser criado.
3. Usa a configuração de testes OFICIAL `setBotConfigForTests` para temporariamente apontar `PREFIX` aos tópicos randômicos do broker `127.0.0.1:porta alta` e `MQTT_HOST` à URL correspondente, depois que a base do jogo já foi criada e migrada. Não altera arquivos `config.toml` nem código upstream.
4. Inspeciona `main.js` antes de importá-lo: espera **um** ponto de chamada `crowniclesInstance.init()` e os eventos MQTT `connect`/`message`. Qualquer divergência interrompe o ensaio com limpeza normal, em vez de executar algo desconhecido.
5. Só durante o `require(main.js)` do Core original, substitui **em memória** `coreInstance.init` por uma função que não inicializa serviços, contando a tentativa; mantém a função de bloqueio até a saída do processo, para não permitir inicialização atrasada. Mantém os listeners MQTT oficiais de assinatura, recebimento, dispatch e envio de pacotes.
6. Usa `mqttResponder` somente como conexão nativa original injetada no teste (sem callback de resposta escrito por nós), e observa SUBSCRIBE/SUBACK reais sem substituir o processo de assinatura do Core. `PacketUtils.sendPackets` original publica no tópico websocket isolado, que o Gateway existente assina.
7. Instrumenta apenas uma chamada à busca do handler do próprio Core para contar execuções; **não substitui nem reimplementa `PingCommand` ou `dispatchPacket`**. Simula o recebimento de texto do WhatsApp através de callback local; Baileys/WhatsApp real e site não são acessados.

## GATE V2 — o que precisa passar no Android

- `01_CORE_ORIGINAL_RECEPTOR_E_INIT_INIBIDO`: arquivo compilado `main.js` original carregado, `init()` interceptada exatamente uma vez, player real no DB temporário.
- `02_SUBACK_OFICIAL_TOPICOS_ISOLADOS`: subcrição do Core original ao tópico randômico, SUBACK do broker e Gateway pronto.
- `03_MAIN_ORIGINAL_DISPATCH_E_PACKETUTILS`: `/ping` chega pelo Gateway SQLite e MQTT, é despachado pelo evento `message` de `main.js`, entra no handler decorado original e responde por `PacketUtils.sendPackets` original; a resposta passa novamente pelo MQTT e chega ao callback local.
- `04_MAIN_ORIGINAL_SEM_DUPLICATA`: repetir `wamid` não executa o handler uma segunda vez.
- `05_MAIN_ORIGINAL_NOVO_UUID`: segundo `wamid` gera segunda execução e resposta com request UUID novo.

Sucesso exige `PASS=01` a `PASS=05`, `CORE_RECEPTOR_NATIVO_MQTT_RESULTADOS=5/5`, `CORE_RECEPTOR_NATIVO_MQTT_FALHAS=0`, `CORE_MAIN_INIT_BLOQUEADO=SIM`, `BANCO_TEMPORARIO_REMOVIDO` e `LAB_SAIDA=0`. Todo relatório com erro ou cleanup não comprovado é **NÃO HOMOLOGADO**. O teste pode parar com `CORE_MAIN_ASSINATURA_NAO_HOMOLOGADA` ao encontrar build upstream diferente: é um bloqueio seguro, não sinal para desabilitar verificações.

## Artefato e evidências locais

Arquivo autossuficiente `crownicles_core_receptor_nativo_mqtt_v2_termux_autossuficiente.cjs`, **110501 bytes**, **SHA256 `654f68c03f80650536d520db6d7d07aa5145b43fbe6a3d0e4fd6a59acfd760ca`**.

Verificações locais: `node --check`: **PASS**. `node arquivo.cjs --verificar-pacote`: **PACOTE_INTEGRO=23/23**. Execução normal no container sem Mosquitto termina com `LAB_FALHA_DETALHE=MOSQUITTO_AUSENTE`, `LAB_SAIDA=1`, antes de qualquer provisionamento DB; comportamento seguro esperado. **A V2 foi executada e homologada no Android após a publicação deste arquivo: 5/5 PASS, 0 falhas, cleanup confirmado.**

No Android, baixar o arquivo único e executar pelo comando de SHA256 fornecido no chat. Não pede instalação de dependências adicionais e reutiliza o Core/Termux já funcional do V1.

## Limites e próximo caminho

Mesmo que a V2 passe, isso valida somente o receptor e `PingCommand` originais no transporte de teste, **não 48 comandos/56 coletores completos, WhatsApp real, persistência multiusuário de produção ou site/Keycloak**. Continuar a ampliar cobertura de comandos/coletores nativos de modo sistemático e depois o frontend WhatsApp/site usando camadas já existentes e sem reescrever a mecânica do jogo.


## Homologação Android em 16/11/2026 — GATE V2 APROVADO

Relatório fornecido pelo usuário no Termux, após a publicação do runner:

```text
LAB=CORE_RECEPTOR_NATIVO_MQTT_V2
VERSAO_CORE=6.2.0.b
PREFIXO_TEMPORARIO=crownicles_test_wa_native_9396efc79a
MARIADB_PORTA_PRODUCAO=13306
SESSAO_WHATSAPP=NAO_ACESSADA
LAB_CONFIG_MODE=OFICIAL
CORE_CONSTRUCTOR_INSTANCIADO_VIA_APP
LAB_DB_CRIADO
LAB_TCP_ISOLADO_OK
CORE_MIGRATIONS_OK
LAB_SINGLETON_MODE=OFICIAL
[CommandPingPacketReq] Registered packet handler (function 'execute' in class 'PingCommand')
MQTT_BROKER_HOST=127.0.0.1
MQTT_BROKER_PORTA_TEMPORARIA=28087
MQTT_PREFIXO=cw_wa_mqtt_lab_1d09c7c2e39da8bd0c4a1175
CORE_MAIN_COMPLETO_INICIADO=NAO
CORE_RECEPTOR_MQTT=MAIN_ORIGINAL
CORE_MAIN_INIT_BLOQUEADO=SIM
CORE_MQTT_PUBLISH=PACKETUTILS_ORIGINAL
Connected to MQTT
PASS=01_CORE_ORIGINAL_RECEPTOR_E_INIT_INIBIDO
PASS=02_SUBACK_OFICIAL_TOPICOS_ISOLADOS
Received message from topic .../crownicles_core
Sent response to web socket front ... CommandPingPacketRes
PASS=03_MAIN_ORIGINAL_DISPATCH_E_PACKETUTILS
PASS=04_MAIN_ORIGINAL_SEM_DUPLICATA
Received message from topic .../crownicles_core
Sent response to web socket front ... CommandPingPacketRes
PASS=05_MAIN_ORIGINAL_NOVO_UUID
CORE_NATIVO_PING=ORIGINAL
CORE_RECEPTOR_MQTT=MAIN_ORIGINAL
CORE_MAIN_INIT_BLOQUEADO=SIM
CORE_MQTT_PUBLISH=PACKETUTILS_ORIGINAL
CORE_RECEPTOR_NATIVO_MQTT_RESULTADOS=5/5
CORE_RECEPTOR_NATIVO_MQTT_FALHAS=0
CORE_MAIN_INIT_COMPLETA_NAO_EXECUTADA=SIM
WHATSAPP_REAL_NAO_ACESSADO=SIM
MARIADB_SERVICO_LOCAL_COMPARTILHADO=SIM
SCHEMA_DE_PRODUCAO_NAO_ACESSADO=SIM
LAB_TESTES_TOTAIS=5/5
LAB_TESTES_FALHARAM=0
BANCO_TEMPORARIO_REMOVIDO
LAB_SAIDA=0
```

A evidência completa inclui todas as migrações individuais de 001 a 081, o decorador original, os dois pacotes de request e response logados pelo Core, e a limpeza. Este é um extrato sem os identificadores de contexto efêmero. **V2 encerrada. Não pedir repetição da V1 ou V2.** A comprovação de banco de produção não acessado é uma declaração do runner; não implica auditoria externa.

### Escopo remanescente e mudança de método

Não criar V3/V4 de ping. Os próximos testes devem comprovar **jogabilidade real e segurança transacional**, em lotes de comandos/coletores com o Core 6.2.0.b original, sem desativar verificações. A base declarativa atual registra 12 rotas e auditoria de 8 coletores, mas isso NÃO equivale à cobertura dos 48 comandos/56 módulos do Crownicles e tampouco a um jogo pronto.

Roteiro objetivo:
1. Auditar cobertura integral por família (comandos/coletores), mapeando o que é jogável e o que está bloqueado, mantendo Crownicles como fonte do comportamento.
2. Resolver identificação/autorização e escolhas seguras, sobretudo alvos/índices, confirmadores e idempotência pós-falha.
3. Entregar protótipo jogável end-to-end (WhatsApp sob isolamento + cadastro/ficha Web ligados ao Core), usando as interfaces existentes.
4. Rodar regressão da jornada e liberar produção somente após verificação específica de credenciais, isolamento, restarts, multiusuário e segurança.

Sem estimativa percentual de completude porque não há inventário de cobertura funcional final. Infraestrutura de transporte foi provada; produto completo não.
