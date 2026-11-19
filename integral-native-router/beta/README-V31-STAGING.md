# V3.1 — preparação isolada da atualização consolidada

Status: laboratório, **não instalar na sessão real**. O manifesto é derivado das árvores Git exatas f5bbe8e0e9f7f03cef3dd1922324f50f356605d3 (V3.0) e 4f036c0237cb4da1d12c51bf898d10fa2f88bc20 (candidato), com pin upstream Crownicles 64d08c05f11949029317341735f6f73024f19f9b. Contém 46 arquivos de runtime (27 iguais, 9 substituições, 10 adições), 41 testes e 3 arquivos de apoio à validação. 

O utilitário `prepare-beta-v31.cjs` NÃO é um instalador e não inicia Node Core, Baileys, MariaDB ou outros bots. Ele lê exclusivamente caminhos do manifesto, verifica os Git blob SHA-1 de todos os arquivos da V3.0 e do candidato, recusa links simbólicos, sobreposição, caminhos estranhos, ambiente parcial e arquivos adulterados. Cria um diretório independente `beta-v31-stage-NOME` com `candidate/`, `backup-code/` e `stage-report.json`. Não lê nem copia segredos, sessões, banco, node_modules ou arquivos fora da lista.

Exemplo **somente em cópia descartável**, os três argumentos precisam ser caminhos absolutos, reais e separados:

```bash
node patches/prepare-beta-v31.cjs /lab/v30-copy /lab/v31-source /lab/beta-v31-stage-rehearsal
```

A pasta `candidate/` contém a suíte de regressão pinada (582 testes). É possível executá-la no Node 22 com o fixture upstream e TypeScript já disponíveis em laboratório via `CROWNICLES_UPSTREAM_SRC` e `CROWNICLES_TYPESCRIPT_MODULE`. Isso não certifica a execução real do Core. Não rodar `start.sh` da área staged.

O backup de código é apenas ensaio de reversão. Antes de qualquer ativação futura, ainda é obrigatório parar somente este bot, verificar lock exclusivo e processos, obter backup consistente da SQLite privada e do MariaDB beta, validar restauração e compatibilidade, manter sessão WhatsApp intacta e homologar os dois coletores bloqueados em Core/MariaDB reais. Não automatizamos ativação ou restauração de estado nesta etapa. Sem autorização explícita, nenhum merge/deploy ou alteração Termux.
