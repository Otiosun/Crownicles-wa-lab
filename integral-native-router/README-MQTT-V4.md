# MQTT V3 Android 4/5 — correção de observabilidade V4 (16/11/2026)

## Evidência recebida do Termux

Runner V3 autossuficiente validado pelo usuário com SHA-256 `cff76a3f124817b1ef0429b210370859718d670ec791b13aa75178b2ccdf4f07`. Saída literal:

```text
LAB=MQTT_REAL_ISOLADO_V3
PASS=01_BROKER_ISOLADO_E_ASSINATURAS_REAIS
PASS=02_GATEWAY_SQLITE_MQTT_PING_END_TO_END
PASS=03_ORIGEM_INVALIDA_E_DUPLICATAS_REJEITADAS
PASS=04_QUEDA_BROKER_SEM_REENVIO_AUTOMATICO
MQTT_REAL_FALHOU=RECONEXAO_MQTT_NAO_OCORREU
LAB_SAIDA=1
```

A quinta prova NÃO passou no Android. Os testes 860/860 são regressão LOCAL contra mocks/simuladores e não demonstram recuperação de broker TCP.

## Escopo da V4

`tools/mqtt-real-isolated-v4.cjs` preserva o protocolo Core 6.2.0.b, não altera o adapter `src/core.cjs` nem o Crownicles original. O teste acrescenta instrumentação para os dois clientes (mock Core e gateway), contagem de `connect`, `reconnect`, `close`, `offline`, `error`, resultado `SUBACK` do mock e estado independente do TCP. Usa contador de época para que SUBACK obsoleto não restabeleça o mock. O prazo de espera de reconexão passou de 9 s para 22 s porque timers do Android podem atrasar; NÃO há reenvio automático nem `reconnect()` manual. Emite `MQTT_RECONNECT_DIAG=...` mesmo quando a prova passa e um motivo discriminado quando falha.

O efeito ainda não foi verificado com o Mosquitto real no Termux; isso é ferramenta de recuperação diagnóstica, não declaração de causa raiz nem garantia de correção funcional.

## Pacote autossuficiente V4

- Arquivo: `lab/crownicles_mqtt_real_v4_termux_autossuficiente.cjs`, 85.717 bytes.
- SHA-256: `e697f0f307b32285ad506ad92ef129dd9c31e38a7467222cb499344ba30399be`.
- Fonte do runner: `tools/mqtt-real-isolated-v4.cjs`, SHA-256 `0bf8bd49507c26501985840d25239b4dd96216de8f1f45785205696718e21e11`.
- Contém 23 módulos da V3 byte-idênticos e o runner V4. Os 24 conteúdos são conferidos com SHA-256 na extração temporária.
- Cópia no Drive Komekko: https://drive.google.com/file/d/1HtBeCkZwCu68BTCBwpRz8Z2IyStvyX4I/view

## Verificações efetuadas no ambiente de desenvolvimento

- `node --check` no runner e no arquivo autossuficiente V4: PASS.
- `node --test test/*.test.cjs`: **860/860 PASS**, sem falhas, pulos ou cancelamentos (4,48 s).
- Prova de fallback sem Mosquitto local: `MQTT_REAL_FALHOU=MOSQUITTO_AUSENTE`, `LAB_SAIDA=1` esperado.
- Git blob SHA dos arquivos publicados validado contra os bytes locais.
- **Nenhuma** prova MQTT V4 no Android executada até agora. Não somar 4/5 com 860 como se fosse a mesma suíte.

## Próximo passo

Executar somente o arquivo autossuficiente V4 já entregue ao usuário; verificar SHA antes. Se sair `MQTT_WIRE_TESTES=5/5` + `LAB_SAIDA=0`, broker MQTT/Gateway/SQLite com responder simulado homologado. Se falhar, a linha `MQTT_RECONNECT_DIAG` identifica qual cliente/tópico não restabeleceu a comunicação para corrigir a causa real. Só depois seguir para o Core real isolado e os outros 48 comandos e 56 coletores do Crownicles original. Não tocar na sessão WhatsApp nem no MariaDB da produção, não ligar flags de mutação, não transformar o projeto em outro RPG.
