# Resultado nativo do laboratório V6 — 22/22

**Data:** 15/11/2026, ~21:31–21:35 BRT. **Prova fornecida pelo usuário:** execução do script V6 no Android/Termux, Core Crownicles 6.2.0.b, MariaDB local porta 13306; teste fictício e schema descartável `crownicles_test_wa_native_2d57486833`.

## Resultado observado

```text
LAB=GATEWAY_CORE_E2E_V6
VERSAO_CORE=6.2.0.b
SESSAO_WHATSAPP=NAO_ACESSADA
LAB_CONFIG_MODE=OFICIAL
CORE_LOAD_ORDER=APP_PRIMEIRO
CORE_CONSTRUCTOR_INSTANCIADO_VIA_APP
LAB_DB_CRIADO
LAB_TCP_ISOLADO_OK
CORE_MIGRATIONS_OK
LAB_SINGLETON_MODE=OFICIAL
CORE_TESTES_PASSARAM=8/8
CORE_TESTES_FALHARAM=0
BRIDGE_TESTES_PASSARAM=14/14
BRIDGE_WHATSAPP_MOCK=SEM_ENVIO_REAL
LAB_TESTES_TOTAIS=22/22
LAB_TESTES_FALHARAM=0
BANCO_TEMPORARIO_REMOVIDO
LAB_SAIDA=0
```

Os 22 marcadores `PASS` apareceram: 01–08 Core real (persistência Player, equipar, troca, depósito, rejeitar vazio/inventado, isolamento, handler), 09–20 bridge + Core (menu, prévia, confirmação, nonce falso/expirado/replay, outro telefone, id duplicado, contexto falso, flag off, resposta tardia, desconhecido), 21 depósito gateway→Core→MariaDB com atualização do texto e 22 confirmação repetida antes da resposta sem duplicar.

### Correção visual validada

Antes da troca, o menu mostrava:
```text
Arma: Espada de treino
Reserva 1: Lâmina de prata
```
Depois de confirmar a troca, mostrou **corretamente**:
```text
Arma: Lâmina de prata
Reserva 1: Espada de treino
```
Após depósito:
```text
Arma: sem item ativo
Reserva 1: Lâmina de prata
Reserva 2: Espada de treino
```

Todos os menus de prova foram gerados como **texto literal de WhatsApp**, não enviados em Baileys.

## Evidência em código

- [Script V6 no Drive Komekko](https://drive.google.com/file/d/13wNW0OHBe3aRH1kGE1fwIkjDpYooUEwi/view), SHA256 `45adc3efa22d4e98455e3206c354d60c27dcdd106759d355ebcd96c1a0440173`.
- [ZIP fontes/testes/auditoria](https://drive.google.com/file/d/1M8VR0TZU5YhzjAv9K94AGLN5WROCPm3i/view).
- Preparação e correção do campo `menu.story` documentadas em [LAB-TERMUX-BRIDGE-CORE-V6.md](LAB-TERMUX-BRIDGE-CORE-V6.md).
- Regressão local dos adaptadores `800/800` (independente dos 22/22 nativos, não somar os dois como se fossem o mesmo teste).

## Limites / NO-GO de produção

Este E2E é **em processo de laboratório** com transporte JSON simulado, embora o Core, o MariaDB, o SQLite e as regras sejam reais. Não testou transporte MQTT via rede/broker, Baileys, falha da rede entre publicação/consumo, recuperação de sessão WhatsApp nem interação em produção.

**Não habilitar `CROWNICLES_WA_EQUIP_ACTIONS` no Pinguino Lote11**, nem substituir o código live com fontes do laboratório. Somente depois de prova isolada do transporte, contrato MQTT autorizado, rollback/retry e verificação da sessão é possível discutir deploy controlado. O Core e sessão live não foram alterados pelo laboratório.

## Próximo marco

Preparar prova de transporte MQTT usando namespace exclusivo do laboratório e clientes desassociados de tópicos da produção, de preferência broker efêmero privativo, com identidades fictícias, sem iniciar novo Core live e sem iniciar WhatsApp real. Fazer teste de autorização, tópico errado, duplicação e perda/retentativa antes de conectar Baileys.
