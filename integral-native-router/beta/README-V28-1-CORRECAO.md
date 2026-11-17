# Crownicles Beta V2.8.1 — compatibilidade real com V2.7

Esta revisão corrige o instalador da V2.8 que exigia um SHA-256 fixo de `runtime.cjs`, apesar de a V2.7 ter sido entregue como patch sobre instalações distintas. **Não force a V2.8 antiga.**

O script V2.8.1 verifica o `feature-manifest.cjs` original da V2.7 pelo SHA-256 oficial e confere as âncoras reais do runtime V2.7. Modifica exatamente dois blocos do runtime (import e registro dos sete handlers), preservando byte a byte o restante do arquivo. Só então executa testes num estágio sem SQLite de jogadores nem autenticação WhatsApp; cria backup reversível e recusa instalar com Pinguino ativo ou base alterada. Em caso de divergência incompatível, para sem alterações.

O resto da funcionalidade é idêntico à V2.8: sete menus originais (combate, venda, alimentar pet, poção, diário, mudar classe, embarcar), a serem homologados em WhatsApp, com confirmação apenas pelas opções originais. Não escolher ações de custo na primeira prova.

Após baixar e parar o bot com Ctrl+C, executar o instalador `bash instalar-v28-1-termux.sh` dentro da pasta extraída. Se imprimir `ATUALIZACAO_BETA_V28_1=INSTALADA`, reiniciar `cd ~/crownicles-whatsapp-lab/crownicles-beta/app && bash start.sh`. Não tocar em MariaDB, Core, sessão ou dados de jogadores.
