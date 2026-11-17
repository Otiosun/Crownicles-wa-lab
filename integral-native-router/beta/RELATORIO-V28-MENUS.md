# Lote V2.8 — registro de testes e dependências

- Base-alvo: Crownicles Beta persistente V2.7 instalada/observada no WhatsApp, Core original 6.2.0.b pinado.
- Mudanças em produção: só `runtime.cjs` e `feature-manifest.cjs`.
- Core: mesmos arquivos TS compilados, nenhum código upstream, banco, inventário, classes, conteúdo ou sessão editados.
- 7 contratos adicionais: Fight, Sell, PetFeed, Drink, DailyBonus, Classes, JoinBoat.
- Guardas: caminho fixo de cada handler, registro confirmado no `packetListener`, lista permitida para `Gateway.canSendPacket`, menu de ajuda derivado de handlers existentes, sem envio repetido ou autoescolha.
- Teste beta local V2.8: 99/99 Node 22.16.0 em bancada completa; 82/82 no staging que reproduz exatamente a V2.7 entregue, ambos 0 falhas/skips. Segunda execução idempotente, PID ativo bloqueado e base divergente recusada.
- Teste da ponte anterior W3/L11: 849/849 Node 22 local em cópia anterior, nenhum arquivo bridge modificado neste lote.
- Limites: não homologado na rede real antes de executar o instalador; incertezas de Core.init parcial, guildas, menus com prévia, outros 110 contratos não caracterizados.
- Próximo gate: ver os novos marcadores `BETA_MENUS_NATIVOS`, confirmar respostas consultivas no WhatsApp; então ativar os fluxos custosos um a um após E2E banco descartável com rollback.
