# Ponte WhatsApp → Core nativo → MariaDB — Laboratório V5

**Status em 15/11/2026:** laboratório preparado, sem execução nativa V5 no Termux até aqui. **NÃO INSTALADO** no bot Pinguino Lote 11.

O Core nativo já passou **8/8** no Termux (ver [resultado V4](../../blob/main/RESULTADOS-TERMUX-CORE-NATIVO.md)). O novo V5 usa o mesmo ambiente descartável e acrescenta **12 cenários** sobre os módulos reais `Gateway`, `Store` (SQLite), `Presenter`, o pacote oficial `ReactionCollectorEquip` e o handler `CoreHandlers.equipAction`, com resposta serializada como JSON, mas **transporte em memória**, sem MQTT/Baileys.

## Artefatos no Drive Komekko

- [Script único V5](https://drive.google.com/file/d/1Kn5_6vwvdvTfXdN-RsM7eq4gC2K1Wskp/view) — SHA256 `6fe8907062f3fd555726071f0dad6240641af7c41e9ef1f1cb00bb4127e19117`
- [ZIP de auditoria (script, README, regressão)](https://drive.google.com/file/d/1XCs1lf24_rF1Tn5AfbOQ8U93k0i2IP9u/view)
- [Guia de segurança e execução](https://drive.google.com/file/d/1uHtM8WjiYXujml-K8ozyZdFkNy4HWlAn/view)

O script incorpora, sem instalar no diretório live, as 20 fontes CommonJS do pacote de desenvolvimento da ponte; os módulos são expandidos somente sob `$HOME/.cache/crownicles-native-lab/wa-bridge-<aleatorio>`, removidos no `finally`.

## Segurança reforçada no pacote de laboratório

Uma resposta **diferente, tardia e não solicitada** para `request.done===1` poderia anteriormente reabrir um menu, porque a deduplicação considerava apenas o hash da resposta. O LAB V5 acrescenta `if (req.done) return` na entrada de `Gateway.onCore`. A regressão local completa passou **797/797** contra Node22, contra 796/796 antes do novo caso. O teste de fumaça do bundle V5 + SQLite + fake Core em Node22 também passou. **Essas evidências locais não são um teste de Core/MariaDB V5.** Essa alteração está *somente nos fontes embarcados para teste*, ainda não promovida ao código live.

## Doze novos testes de integração V5

09 menu original como texto WhatsApp; 10 preview sem alteração; 11 confirmação → gateway → CoreHandler real → MariaDB → menu atualizado; 12 nonce falso; 13 expirado; 14 replay; 15 outro telefone; 16 webhook ID duplicado; 17 Core response de identidade diferente; 18 feature flag desabilitada; 19 resposta tardia de pedido concluído; 20 número não autorizado.

Os oito casos nativos V4 também são repetidos antes dos doze, no mesmo esquema temporário. Os testes não utilizam o número real de WhatsApp nem jogadores reais, não chamam `Crownicles.init()` e não iniciam MQTT. O script usa contas MariaDB temporárias restritas ao seu esquema aleatório.

**Aguardando saída real do Termux** `LAB_TESTES_TOTAIS=20/20` e `LAB_SAIDA=0` para homologar este nível; ainda restará verificar MQTT/Baileys em ambiente isolado antes de habilitar `CROWNICLES_WA_EQUIP_ACTIONS=enabled` no live.
