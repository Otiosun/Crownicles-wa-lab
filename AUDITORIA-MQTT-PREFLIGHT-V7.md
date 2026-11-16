# Auditoria preliminar do protocolo MQTT e pré-voo V7

**Data:** 15/11/2026. **Estado:** Core + gateway + SQLite/MariaDB em processo de teste **22/22 aprovado** no Termux V6; MQTT em rede e Baileys **não validados**. O Pinguino Lote 11 não foi alterado.

## Referência oficial Crownicles 6.2.0.b
Código original pinado em `64d08c05f11949029317341735f6f73024f19f9b`, arquivos:
- `Core/src/main.ts` assina `MqttTopicUtils.getCoreTopic(botConfig.PREFIX)` e lê um JSON com `context` e `packet`; despacha para o handler.
- `Lib/src/utils/MqttTopicUtils.ts` define entrada `<prefixo>/crownicles_core` e saída `<prefixo>/crownicles_websocket`.
- `Core/src/core/utils/PacketUtils.ts` usa `context.webSocket` para selecionar a saída WebSocket e serializa `{context,packets:[{name,packet}]}`.
- `Core/src/mqttClient.ts` conecta no broker por `botConfig.MQTT_HOST`.
- `Core/src/main.ts` **também invoca `crowniclesInstance.init()`**, que inicializa o bot inteiro, incluindo cron e web; nunca iniciar a segunda instância Main no ambiente ativo para um teste.

## A ponte real em laboratório
O `src/core.cjs` do pacote Gateway V6 usa MQTT client do Core, publica `{context:{frontEndOrigin,frontEndSubOrigin,keycloakId,webSocket:{}}, packet:{name,data}}` no tópico `config.mqttTo`; recebe no tópico `config.mqttFrom` e valida origin. O `Gateway.onCore` valida suborigin (request ID), Keycloak ID, resposta tardia e estado idempotente do SQLite.

**Contrato em JSON e tópicos coerente com Crownicles original**, desde que os prefixos dos dois clientes sejam exatamente iguais. Essa é uma verificação de fonte e não de rede: nenhuma mensagem MQTT foi enviada.

## Risco de operação
A ponte envia ações com `mqtt.publish()` sem QoS/ack de execução explícito. A presença de resposta na rede e o commit no banco não são uma transação atômica. Respostas perdidas/duplicadas podem causar divergência de estado; a política de reconciliar resultados e lidar com reintento ainda exige prova. Endpoints/tópicos de produção nunca podem ser usados no ensaio.

## Próximo passo sem gastos
Conferir SOMENTE localmente se `mosquitto`, `mqtt` e `mqtt-packet` já existem no Termux, antes de escolher o laboratório de transporte. O pré-voo não publica, não conecta e não altera arquivo do bot.

[Guia e comando de pré-voo V7 no Drive Komekko](https://drive.google.com/file/d/1a9VT9hCFMagZKhGx9NCwQobm2yWQMQID/view), SHA256 `777d5add998214e90dc13b0024f107bce562f9afea48f79ff842785905357599`.

### Condições para próximo teste
1. Broker efêmero exclusivo (127.0.0.1, porta não usada, prefixo aleatório), processado sem os tópicos reais.
2. Cliente MQTT da ponte + cliente MQTT sintético do handler Core com pacote real; selecionar testes de timeout, entrega duplicada, destinatário/tópico errado e resposta perdida.
3. Separar o que passa em MQTT por TCP da validação restante com Baileys e WhatsApp reais; não ativar mutações reais antes de uma política robusta de confirmação e recuperação.
