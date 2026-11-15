# Crownicles — laboratório Core/MariaDB, PRIVADO e DESCARTÁVEL

Este repositório deve ser **novo, privado e exclusivo** para testes. Não inclui bot,
credenciais, sessão Baileys, banco, jogadores reais ou alterações no Core. O workflow
manual baixa o Crownicles **exatamente no commit**
`64d08c05f11949029317341735f6f73024f19f9b` e executa a suíte oficial,
mais sete cenários novos de equipamentos, sobre o MariaDB efêmero da Actions.

## Executar

1. Crie um repositório GitHub **privado** chamado `crownicles-wa-lab`.
2. Publique apenas o conteúdo desta pasta `lab-ci-only/` na raiz do repositório,
   incluindo `.github/workflows/core-mariadb-official-lab.yml` no ramo principal.
3. Na aba **Actions**, selecione `Crownicles Core MariaDB - private disposable lab`
   e clique **Run workflow**. A execução é manual, usa minutos do seu GitHub e
   requer que Actions esteja habilitado no repositório.
4. Abra o job e baixe `crownicles-core-mariadb-audit`. Compartilhe apenas logs
   e JUnit de teste, sem credenciais ou tokens. O selo real de aprovação é
   `UPSTREAM_MARIADB_EQUIP_GATE_PASSED`; testes unitários da ponte não bastam.

Se `pnpm` falhar, a compilação falhar ou algum teste falhar/for pulado, o job
é reprovado. O arquivo XML por si só nunca prova execução real do banco:
precisamos do **resultado do workflow** e do commit fixado. O trabalho futuro
WhatsApp->Core->MariaDB->WhatsApp ainda exigirá um teste separado.

**Não executar no Termux live nem misturar com repositórios de outros projetos.**
