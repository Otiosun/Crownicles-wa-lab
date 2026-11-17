# Beta V2.8.2 — corrigir regressão incompleta em Node 23+

Na V2.8.1, o instalador não forçava formato TAP para `node --test` e exigia saída `# fail 0`. A partir de Node 23, o reporter padrão é spec. Os testes podiam terminar com código zero sem produzir TAP; então o script abortava antes de alterar os arquivos do bot.

V2.8.2 fixa `node --test --test-reporter=tap` e exige resumo `# tests N`, `# pass N`, `# fail 0`, `# cancelled 0`, `# skipped 0`, `# todo 0`, N≥82. Proteções anteriores preservadas: SHA dos fontes, Core fixado 6.2.0.b, âncoras exatas, staging, rollback, guard PID, duplicação de fonte e proteção de concorrência.

Testado localmente com 82/82 em uma cópia da V2.7, outra com comentário local preservado e uma simulação de default spec do Node moderno. Segunda instalação retorna JA_APLICADA. Proteções PID ativo, manifesto modificado e âncora incompatível: saída não zero sem alterar runtime nem manifesto.

Artefato ZIP SHA256: `3f7bf24cf9d508eb113493ce1daa40ef6f634a90eec64c4f10703ebad764dd23`. Drive: https://drive.google.com/file/d/1ZbHXEpWkTtThUs_1IASPLwnIGZN5veL9/view

**Pendência:** executar no Termux do usuário e homologar sete novos menus em WhatsApp. O Pinguino real ainda está na V2.7 até comprovar `ATUALIZACAO_BETA_V28_2=INSTALADA`. Não reinstalar DB/Core/Baileys nem alterar economia.
