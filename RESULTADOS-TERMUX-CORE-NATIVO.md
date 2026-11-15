# Crownicles — homologação nativa do Core no Termux

Registro de laboratório em **15/11/2026**, Pinguino, **Core Crownicles 6.2.0.b**.

## Evidência recebida

A execução do artefato `pinguino_native_core_lab_v4.cjs` retornou:
```text
LAB=CORE_NATIVO_V4
VERSAO_CORE=6.2.0.b
PREFIXO_TEMPORARIO=crownicles_test_wa_native_985fa20a0c
MARIADB_PORTA_PRODUCAO=13306
SESSAO_WHATSAPP=NAO_ACESSADA
CORE_LOAD_ORDER=APP_PRIMEIRO
CORE_CONSTRUCTOR_INSTANCIADO_VIA_APP
LAB_DB_CRIADO
LAB_TCP_ISOLADO_OK
CORE_MIGRATIONS_OK
LAB_SINGLETON_MODE=OFICIAL
PASS=01_CORE_PLAYER_PERSISTE
PASS=02_EQUIP_RESERVA
PASS=03_TROCA_EQUIPAMENTO
PASS=04_GUARDA_ITEM_EQUIPADO
PASS=05_REJEITA_DEPOSITO_VAZIO
PASS=06_REJEITA_EQUIPAMENTO_INVENTADO
PASS=07_ISOLAMENTO_OUTRO_JOGADOR
PASS=08_HANDLER_CORE_EQUIP_PACOTE
CORE_TESTES_PASSARAM=8/8
CORE_TESTES_FALHARAM=0
BANCO_TEMPORARIO_REMOVIDO
LAB_SAIDA=0
```

O usuário forneceu o log de execução no próprio Android. O código-fonte do script foi inspecionado após o retorno: `runTest()` envolve os testes com `node:assert/strict`, consulta o banco com Sequelize, declara falhas individualmente, e o código de saída não-zero bloqueia aprovação. O `finally` fecha conexões, executa DROP do esquema gerado e das contas SQL temporárias, e exige sucesso da limpeza. Sem credenciais de produção nos logs.

Script arquivado no **Google Drive Komekko**:
- [pinguino_native_core_lab_v4.cjs](https://drive.google.com/file/d/1DhzFhuxoOzEcs38giODSHZ15YI7cNJFB/view)
- SHA256: `cfa0be6d83143bc8a5eb0b81abaa16d9c74a129c7b8c16587554c4a2312e2299`

## Antes / depois

| Marco | Antes | Depois |
|---|---|---|
| MariaDB real | acesso administrativo incerto | socket e escrita em banco temporário comprovados |
| Core compilado | TypeError de import circular | inicialização com app.js primeiro |
| Migrações | não executadas | migrations concluídas em banco descartável |
| Equipamentos | simulados na ponte | 6 cenários diretos de Core + 1 handler, mais persistência Player, aprovados |
| Limpeza | tentativa | banco removido e saída zero |
| WhatsApp live | Lote 11 | **Lote 11 inalterado** |

## Limites da aprovação

**NÃO** equivale a uma execução da suíte oficial Vitest no CI, nem a E2E WhatsApp → gateway → Core → MariaDB → resposta WhatsApp. O laboratório exercitou funções nativas do Core e sua persistência real, com jogadores fictícios; não transmitiu pacotes através da ponte Baileys. Por isso, não habilitar `CROWNICLES_WA_EQUIP_ACTIONS=enabled` na produção.

GitHub Actions privado [run #1](https://github.com/Otiosun/Crownicles-wa-lab/actions/runs/43749412124) falhou antes de receber runner por bloqueio de faturamento. Esta prova de Termux foi feita sem cobrar minutos de Actions.

## Próxima homologação (não executada)

1. Executar contratos de menus WhatsApp e opções com jogador fictício, sem enviar mensagens no número real.
2. Provar `gateway → Core → DB → gateway` com requisições autênticas no modo lab, sem mutação de jogador real.
3. Revalidar simultaneidade, autorização, reuso de nonce, expiração, isolamento entre jogadores e rollback.
4. Só depois da prova ponta a ponta liberar ações de equipamento atrás de feature flag e fazer rollout com reversão.

**Regra:** nenhuma permissão a mais para o usuário SQL de produção, nenhum outro bot, nenhum segundo MariaDB e nenhum dado real convertido em fixture.
