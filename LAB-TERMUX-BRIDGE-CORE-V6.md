# LAB V5 aprovado no Termux → V6 corrige menu stale e amplia E2E

**Data:** 15/11/2026. **Produção Pinguino:** Lote 11, sem alterações. **Flag de equipamento live:** DESLIGADA.

## Prova V5 (log fornecido pelo usuário, execução real)

Execução no Core Crownicles 6.2.0.b e MariaDB existente (porta local 13306), sem WhatsApp real. Banco temporário `crownicles_test_wa_native_b33b7c5cb1`.

Resultados:

```text
CORE_MIGRATIONS_OK
CORE_TESTES_PASSARAM=8/8
CORE_TESTES_FALHARAM=0
BRIDGE_TESTES_PASSARAM=12/12
LAB_TESTES_TOTAIS=20/20
LAB_TESTES_FALHARAM=0
BRIDGE_WHATSAPP_MOCK=SEM_ENVIO_REAL
BANCO_TEMPORARIO_REMOVIDO
LAB_SAIDA=0
```

Isso prova a ponte **dentro do processo de laboratório** com SQLite, serialização JSON, Core nativo e MariaDB real. NÃO prova transporte MQTT/Baileys real ou WhatsApp em produção.

## Defeito que o log revelou (V5)

O menu depois da confirmação era internamente inconsistente: o Core tinha equipado a **Lâmina de prata**, o novo botão era **Guardar Lâmina de prata**, mas o texto ainda exibia **Arma: Espada de treino**. O campo `menu.story` não era regenerado em `refreshEquipMenu`, apenas opções e snapshot eram substituídos.

Correção no código do **LAB V6**, `src/lote09.cjs`: regenerar história textual com `equipSummary({categories:result.categories},models)`, mantendo a descrição de ações habilitadas. Assim o texto e as opções derivam do **mesmo snapshot autoritativo retornado pelo Core**; em erro não libera ações. Também mantém a proteção `Gateway.onCore` contra respostas tardias com request já `done`, descoberta e corrigida no LAB V5.

## V6 — preparação concluída, execução Android pendente

- Regressão completa ponte Node22: **800/800 aprovados** (V5 797/797).
- Três novos testes unitários: atualização do texto após troca, atualização após depósito, resposta inválida sem reciclar história antiga.
- Teste de fumaça integrado de bundle autossuficiente CJS+SQLite+fake Core passou, 20 módulos carregados.
- `node --check` do script V6 passou.
- **Provas propostas no Termux: 22/22**, ainda não executadas: V5 20 cenários + (21) depósito completo via gateway ao Core SQL com texto corrigido + (22) duas confirmações antes de resposta sem execução duplicada.
- O teste 11 agora exige `Arma: Lâmina de prata`, `Reserva 1: Espada de treino` e ausência de `Arma: Espada de treino` após troca.

Artefatos Komekko:
- [Script único V6](https://drive.google.com/file/d/13wNW0OHBe3aRH1kGE1fwIkjDpYooUEwi/view), SHA256 `45adc3efa22d4e98455e3206c354d60c27dcdd106759d355ebcd96c1a0440173`
- [ZIP da auditoria V6 (43 arquivos)](https://drive.google.com/file/d/1M8VR0TZU5YhzjAv9K94AGLN5WROCPm3i/view)
- [Guia V6](https://drive.google.com/file/d/1pnZzIsLVt3pIGaNGJAKhTwiSFKKgF4OC/view)

**Pendente:** executar V6 isolado no Termux e conferir 22/22 + `BANCO_TEMPORARIO_REMOVIDO` + saída zero. A V6 não foi instalada no bot live. Depois ainda faltará laboratório isolado de transporte MQTT/Baileys e política de recuperação/retry antes de habilitar mutações reais.
