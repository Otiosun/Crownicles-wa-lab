# Crownicles Beta V2.9 — integridade dos menus nativos

**Base:** Beta V2.8.2 do Crownicles Core 6.2.0.b.

## Correção implementada

Anteriormente, a ponte podia enviar `/combate` após `/vender` (ou outros menus) quando já havia uma decisão pendente. Isso poderia substituir o menu/snapshot, confundir o usuário e causar conflito de coletores no Core. V2.9 impede a abertura de um novo menu nativo enquanto existir uma escolha ativa. Continua permitindo consultas. Não altera o requisito de nível, preços, XP nem mecânicas do Crownicles.

## Testes

Testes integrados usam o **Gateway, Store e Presenter reais**, dados sintéticos e FakeCore: 7 famílias de coletores, índices originais, token de confirmação, não envio de ações antes de confirmar, replay, identidade de dois jogadores, cancelamento e prevenção de sobreposição de menus. **São testes de ponte com Core simulado, NÃO operações realizadas no jogo real.**

## Instalação e segurança

Com o Pinguino PARADO (`Ctrl+C`), instale pelo script `pack-v29/instalar-v29-termux.sh`. O instalador exige Core 6.2.0.b, manifesto V2.8.2 oficial, pacote SHA-256 intacto e ausência de `run.lock` ativo. Modifica exclusivamente `app/bridge/gateway.cjs` por duas âncoras exatas. Testa 12/12 coletores e a regressão completa em staging descartável antes de alterar o arquivo. Mantém backup/rollback no diretório `crownicles-beta/backups`. Não abre SQLite real, MariaDB, credentials ou sessão Baileys.

Se aparecer um `ERRO=...`, NÃO force alteração. Envie somente a saída com marcadores; não compartilhe credenciais, chaves ou arquivos de auth.
