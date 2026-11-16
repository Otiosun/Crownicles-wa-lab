# Crownicles original — transporte MQTT isolado V3

**16/11/2026 | Branch de laboratório | Core fonte fixado em `Crownicles/Crownicles@64d08c05f11949029317341735f6f73024f19f9b`**

## Regra do produto

O objetivo é integrar o **Crownicles original inteiro** ao WhatsApp e ao site. A V3 trabalha uma infraestrutura compartilhada, **não é nova mecânica nem RPG alternativo**. O título definitivo do jogo ainda não foi escolhido.

## Implementações

- `src/core.cjs`: mantém o pacote MQTT **original** (`{context:{frontEndOrigin,frontEndSubOrigin,keycloakId,webSocket:{}},packet:{name,data}}`), com espera real do SUBACK, verificação de envelope, confirmação de tópico/origem/UUID, limites de tamanho, reparo seguro de estado após desconexão e envio **QoS 0 sem reenvio automático**.
- `src/mqtt-isolation.cjs`: trava o laboratório em **MQTT não criptografado somente no loopback (`127.0.0.1`/localhost/[::1])** e **prefixo aleatório** `cw_wa_mqtt_lab_<24 hexadecimal>`; recusa tópicos da produção, portas históricas e origens inválidas. Isto é proteção do LAB, **não substitui credenciais** ao criar produção.
- `test/core-mqtt-v3.test.cjs`: agora há **11 novos testes** de adapter, SUBACK negativo, envio válido, falhas em publicação, reconexão, entrada malformada, tamanho máximo, identidade, Core/Gateway+SQLite, no-replay e reinício físico do SQLite com ação pendente. Usa EventEmitter simulando cliente MQTT; **não é prova de rede real**.
- `tools/mqtt-real-isolated-v3.cjs`: ensaio de rede **MQTT/TCP com Mosquitto de verdade e a dependência npm `mqtt` já instalada no Core Termux**. Cria o broker temporário em `127.0.0.1` numa porta alta livre, com tópicos aleatórios; o **Core é simulado apenas no transporte**. Executa 5 cenários: broker/SUBACK, `/ping` via MQTT+SQLite, resposta de origem errada e duplicata, queda sem reenvio, reconexão e segunda consulta única. Para o broker **filho** ao encerrar; não usa MariaDB, Core main, WhatsApp nem credenciais.

## Provas executadas agora no ambiente de desenvolvimento

`node --test test/*.test.cjs`: **860/860 PASS, 0 falhas, 0 pulados** (849 da V2 + 11 novos). Node 22.16.0; relatório `regression_v3.tap`.

`node --check`: módulos novos e ensaio de rede: PASS.

**NÃO foi executado um broker Mosquitto real aqui**: o container de desenvolvimento não dispõe dos binários `mosquitto` nem do pacote npm `mqtt`, sem acesso externo à instalação. O ensaio real no Termux está **preparado, não homologado**. Não converter 860/860 em promessa de que a rede Core→WhatsApp está pronta.

## Executar no Termux com o ZIP já descompactado em pasta temporária

```bash
node tools/mqtt-real-isolated-v3.cjs "$HOME/crownicles-whatsapp-lab/crownicles-dev/Core"
```

Não iniciar `Core/src/main.ts`. O ensaio verifica `mosquitto` e npm `mqtt` **antes** de iniciar qualquer serviço, usa porta temporária 20000..60999 e nunca as portas/tópicos do ambiente ativo.

**Prova esperada, ainda não executada no Android:** cinco linhas `PASS=01_...` até `PASS=05_...`, `MQTT_WIRE_TESTES=5/5`, `LAB_SAIDA=0`. Se falhar, `MQTT_REAL_FALHOU=<detalhe>`; o processo próprio e arquivos temporários são encerrados/removidos pelo bloco `finally`. Não há necessidade de reiniciar MariaDB.

## O que ainda falta para o Crownicles inteiro

- Prova do **Core nativo** real se comunicando por um broker isolado: a V3 testa o formato contra um responder controlado, **não inicia o Core** por segurança. Para teste nativo, será necessário construir bootstrap com DB efêmera ou adicionar gatilho in-process isolado, não iniciar cron/sessão live.
- Ações com QoS 0 não têm garantia de confirmação de commit. A ponte **não repete** operações desconhecidas automaticamente; precisa de política completa de consulta/reconciliação para gastos, criação de guildas, comércio e efeitos. A V3 estabelece a negativa de replay, não entrega reconciliação universal ainda.
- Integrar o transporte **Baileys real** no WhatsApp e usuários autorizados, sem tocar na sessão ativa durante homologação.
- Verificar e oferecer todos os **48 contratos de comando** e **56 módulos** de coletores, incluindo opções multi-escolha ainda bloqueadas, identidade verificada de jogadores e renderização brasileira; V2 tem 12 contratos declarativos e oito tipos de confirmação auditados, não 100% do jogo.
- Site e autenticação: aproveitar interfaces originais existentes; testes end-to-end pendentes.

**Atenção:** arquivo é uma cópia de laboratório. Não copiar `src/` para a instalação ativa, não habilitar flags de mutação, não publicar servidor/broker para a Internet.
