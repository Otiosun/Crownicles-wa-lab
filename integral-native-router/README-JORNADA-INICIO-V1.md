# Crownicles 6.2.0.b — Jornada inicial WhatsApp V1 (ponte isolada)

Data: 16/11/2026. Fonte canônica: Crownicles/Crownicles @64d08c05f11949029317341735f6f73024f19f9b.

## Descoberta diretamente comprovada na fonte original

- `Lib/src/packets/commands/CommandReportPacket.ts`: `CommandReportPacketReq extends CrowniclesPacket {}` (pedido sem campos).
- `Core/src/commands/player/ReportCommand.ts`: método `ReportCommand.execute`, decorado por `@commandRequires(CommandReportPacketReq, ...)`, inicia o jogador chamando `initiateNewPlayerOnTheAdventure(player)` **somente** quando `player.score === 0 && player.effectId === Effect.NOT_STARTED.id`; depois continua o fluxo da aventura pelo Core.
- `Core/src/commands/player/ProfileCommand.ts`, `InventoryCommand.ts`, `Core/src/commands/mission/MissionsCommand.ts`: contratos oficiais de ficha, equipamento e missões são consultas ao Crownicles; NÃO criamos um banco de fichas paralelo.

## Implementação do lote

- `src/gateway.cjs`: `/jogar`, `/iniciar`, `/inicio`, `/início`, `/comecar` e `/começar` são aliases de `/aventura`/`/relatorio` e enviam `CommandReportPacketReq` com `{}`, usando o mesmo controle SQLite/Gateway. A ajuda agora mostra `/jogar`.
- `src/presenter.cjs`: perfil e inventário ainda não iniciados orientam o jogador a usar `/jogar`.
- `src/lote02.cjs`: missões ainda não iniciadas orientam o jogador a usar `/jogar`.
- `test/jornada-inicio-nativo-v1.test.cjs`: sete testes novos de aliases, contratos, deduplicação por `wamid`, identidade vinculada, bloqueios do menu pendente, erros antes de iniciar e leitura posterior. **FakeCore simulado**, sem alegar Core nativo executado.

## Resultado da regressão local

`node --test test/*.test.cjs`: **869/869 PASS, 0 fail, 0 skip** em Node 22.16.0 na cópia isolada. Resultado anterior: 862/862. Os sete casos são adicionais. Na primeira execução a cópia local não continha o fixture já existente `scripts/repair-secrets.cjs`; o script foi reincorporado ao snapshot e a regressão completa ficou verde. Nenhuma instalação ou alteração em produção.

Artefato íntegro: `crownicles_jornada_inicio_v1_fontes_e_869_testes.zip` (**170297 bytes**, SHA256 `5d65de0e9bc53dd91154f5bf414a38dc4431c2b973423a101b0be374c7dcc2c6`).
Pasta Komekko: https://drive.google.com/drive/folders/164Bd4smraOE3D-Z1-qx6MRO4201aBnHK
ZIP: https://drive.google.com/file/d/1nUhcPxrE-hp81eZEC6WDTfUtDZor5ysC/view
README: https://drive.google.com/file/d/12TotnwPG6zMSssUFEkR8WPtgdDWO0ND8/view

O ZIP contém o snapshot **completo** dos módulos usados pela regressão, inclusive `src/lote02.cjs`. A branch GitHub contém apenas alguns `src` individualmente; não confundir o snapshot completo do ZIP com a árvore parcial no GitHub. Nesta branch `src/gateway.cjs` atualizado em e01d60742a2a49911fa0e5179f60c16e66db3b27 e `src/presenter.cjs` atualizado em 9637e9c17a1271ef3135d9bd87bb227e634104a9. `src/lote02.cjs` existe no arquivo ZIP/Drive, não individualmente na branch.

## Pendente — não extrapolar

- O `ReportCommand.execute` original NÃO foi executado para criar o jogador no Android nesta entrega. O MQTT V2 nativo cobriu **apenas ping**, e não o fluxo completo de `Report`.
- NÃO foram validados novos personagens reais, missões de campanha, mapas, coletores, site/Keycloak nem Baileys/WhatsApp real.
- Próximo gate: executar primeira aventura real no Core original, banco efêmero e broker isolado, com dependências de mapas/missões protegidas e sem invocar a inicialização completa do Core, jobs, servidores ou contas reais. Confirmar /jogar → /perfil → /inventario → /missoes, estado do banco e limpeza.
- NUNCA promover para main ou produção antes de homologação específica de segurança, multiusuário e persistência. Não refazer o núcleo do Crownicles.
