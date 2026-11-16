# Crownicles original — MQTT V5: reconexão com assinatura manual determinística

**16/11/2026 — laboratório, branch `feat/crownicles-integral-native-router`.** Sem promoção à produção.

## Evidência real recebida do Termux — V4 falhou 4/5

Broker temporário 127.0.0.1:56170, prefixo aleatório cw_wa_mqtt_lab_b2dd0ca522b3af5b8105fb66. PASS 01..04. Diagnóstico exato: `tcp=1`, `mosquitto_alive=1`, `gateway_socket=1`, `mock_socket=1`, `gateway_suback=0`, `mock_suback=0`, `gateway_connects=2`, `mock.connect=2`, `mock.reconnect=1`, `mock.suback=1`, `mock.subfail=1`, `elapsed_ms=22154`, `original_requests=1`, `current_requests=1`. Erro `RECONEXAO_MQTT_NAO_OCORREU_CORE_SIMULADO_SEM_SUBACK`, `LAB_SAIDA=1`. Não há quinto teste homologado.

## Causa provável fundamentada

MQTT.js 5.15.2, `resubscribe:true` por padrão, mantém cache de tópicos e reassina após broker reiniciar. A chamada manual `client.subscribe()` em `connect` pode resolver `callback(null, [])` se o tópico já consta no cache, mas nossos adaptadores só aceitam `granted` com tópico explícito. O primeiro SUBACK funcionou; após reconectar o mock reportou uma falha de confirmação e o gateway não marcou `ready`. Este é um conflito entre duas estratégias de reassinatura, não indisponibilidade TCP comprovada. É uma hipótese forte, não uma prova direta do pacote MQTT.js interno do Android.

## V5 — mudança cirúrgica

- `src/core.cjs`: opções `resubscribe:false` e `queueQoSZero:false`. Assina explicitamente a cada `connect`, aguarda o SUBACK verdadeiro para marcar `ready`. Não faz replay de comandos incertos quando a rede volta.
- `tools/mqtt-real-isolated-v5.cjs`: as mesmas opções no Core simulado; preserva o diagnóstico da V4, broker isolado e a quinta prova de solicitação nova e única.
- `test/core-mqtt-v5-reconnect.test.cjs`: dois testes novos; confere desabilitar o cache de resubscribe, SUBACK novo pós-queda, nenhuma fila MQTT QoS0 e nenhum reenvio involuntário.
- `lab/crownicles_mqtt_real_v5_termux_autossuficiente.cjs`: 24 módulos com SHA-256 verificado durante extração temporária. Não requer instalação de dependências novas. Arquivo 86067 bytes, SHA-256 `07fd6e13e34982271b037975933cf26f79d319e2d2da0b521f87a8472e613e41`.
- Drive Komekko, pasta exclusiva: https://drive.google.com/file/d/1UoPOcIvuFPEyfyawS6C0UAKUxryCHwit/view

## Qualidade comprovada x pendente

`node --test test/*.test.cjs`: **862/862 PASS, 0 fail, 0 skip**, Node v22.16.0, em ambiente de desenvolvimento. `node --check` na fonte, no runner e no arquivo autossuficiente: PASS. Manifesto 24/24 hashes íntegros. Sem Mosquitto no container, comportamento seguro `MQTT_REAL_FALHOU=MOSQUITTO_AUSENTE` e `LAB_SAIDA=1`: esperado. **V5 ainda NÃO foi executada no Android; não declarar 5/5.**

Próximo único ensaio: arquivo V5 com hash verificado no Termux. Sucesso somente com `PASS=05_RECONEXAO_E_SEGUNDA_SOLICITACAO_UNICA`, `MQTT_WIRE_TESTES=5/5`, `MQTT_WIRE_FALHAS=0` e `LAB_SAIDA=0`. Persistindo falha, trazer `MQTT_RECONNECT_DIAG` e corrigir causa específica. Não iniciar Core main, MariaDB, Baileys/WhatsApp nem usar credenciais. Propriedade do projeto: preservar o máximo do Crownicles original, sem desenvolver novo RPG.

## Proteções

O laboratório mantém URL MQTT em loopback e porta temporária, tópicos prefixados aleatórios, Core simulado, SQLite isolado e limpeza de processos. Não alterar sessão WhatsApp, não promover mudanças para main, não ativar flags de equipamento ou guildas. Não somar regressão Node com prova Android.
