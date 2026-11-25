# Crownicles — RC0: composição do laboratório Node 24

**Estado:** DRAFT / laboratório / não iniciar bot / sem autorização para produção.

Este trabalho fecha a lacuna de *reprodutibilidade* encontrada no Termux em 24/11/2026: o commit público PR #6 contém 187 arquivos Git íntegros, mas seus testes dependem de alguns módulos `.cjs` da distribuição beta local. A combinação manual anterior executou **652 testes: 636 PASS, 16 SKIP, 0 FAIL**, Node 24.22.3, conforme saída apresentada pelo proprietário. Esse número é histórico e **não** é resultado garantido pelo script.

## Fonte e fronteiras imutáveis

- Repositório: `Otiosun/Crownicles-wa-lab` (público).
- Commit da PR #6: `73f4473aecb16447d6adc3ba20f61a2c675806d3`.
- Árvore Git exata: `b467f65fc88604dfeff8b2c983ce588eed5bb370` (187 blobs).
- Registro de 12 contratos: único teste de PR #14; blob antes `b59811f88118a10b40e6dd9360655f1a0f10cb3b`, depois `3a6fe5fd730e89a975dd2881f5056fcc47cc3309`.
- Dependências privadas/locais: são copiadas **somente se faltarem**, exclusivamente de `crownicles-beta/app/bridge/*.cjs`; cada byte recebe SHA256 no relatório, sem presumir que é idêntico ao código canônico de Core ou de Base40.
- A árvore pública é comparada, arquivo a arquivo, com os blobs da API GitHub, e qualquer modificação, arquivo inesperado, falta ou symlink encerra a composição antes da escrita.

## Correção RC0.1 — require aparente em script de patch

Em 24/11, o primeiro compositor parou com:

`MISSING_NON_BRIDGE_DEPENDENCY:integral-native-router/beta/patches/patch-gateway-v29.cjs=>integral-native-router/beta/patches/lote11.cjs`

**Causa exata:** a expressão `require('./lote11.cjs')` está DENTRO da string `importAnchor` no arquivo original do patch, não é um import executado a partir da pasta `beta/patches`. O scanner anterior procurava `require(...)` com regex em texto cru, inclusive dentro de comentários, strings e templates, gerando dependências fictícias. Este erro impediu a criação da candidata e não implicou falha do bot.

**RC0.1** passou a mascarar trechos não executáveis (strings simples/duplas, comentários, texto de template, regex literal) e preservar posições de código em interpolações `${...}`. Rejeita strings/comentários/regex não terminados em vez de ignorá-los silenciosamente. A análise continua limitada a `require('./...')` literais; não equivale a um parser JavaScript/AST completo. Nenhum módulo de jogo foi modificado, removido ou ignorado indiscriminadamente.

QA de regressão: **antes 4 falhas adversariais** (incluindo o erro exato de `patch-gateway-v29.cjs`), **depois 22/22 Python PASS**, incluindo subprocesso real Node e verificação de importação real em template. A nova ferramenta ainda precisa ser executada na árvore completa do Termux para comprovar que não existem outros bloqueios reais.

## Reprodução no Termux (Android)

Requisitos: `python3`, `node` e acesso HTTPS de leitura à API pública GitHub. O usuário já mantém a cópia CP058 intacta em `~/core-verificado` e a beta em `~/crownicles-whatsapp-lab/crownicles-beta/app/bridge`.

```sh
mkdir -p ~/tools
curl -fL \
  https://raw.githubusercontent.com/Otiosun/Crownicles-wa-lab/feature/rc0-wa-source-pinned-composer-20261125/tools/rc0-compose-crownicles-lab.py \
  -o ~/tools/rc0-compose-crownicles-lab.py

python3 ~/tools/rc0-compose-crownicles-lab.py \
  --base ~/core-verificado \
  --donor ~/crownicles-whatsapp-lab/crownicles-beta/app/bridge \
  --output ~/crownicles-rc0-lab-v2 \
  --run-tests
```

**A pasta de destino deve não existir.** Para repetir, usar outro nome de pasta; não apagar nem sobrescrever nada automaticamente.

O programa escreve `RC0-EVIDENCE.json` e `RC0-TESTS.tap` no destino. A saída de sucesso tem o prefixo `RC0_SOURCE_VERIFIED=187/187`, o número de módulos locais adicionados, `STATUS=LAB_TEST_PASS` e o sumário `RC0_TEST_RESULTS`. O sucesso só pode ser declarado quando `exit=0`, total/pass/skipped coerentes e `fail=0`, `cancelled=0`. Caso contrário o programa encerra com status de erro e mantém os logs.

Por padrão, sem `--run-tests`, **nenhum código Node é executado**: é só inspeção de fontes, montagem em pasta nova e relatório. Com `--run-tests`, são executados **somente** os 47 arquivos `.test.cjs` públicos sob `integral-native-router/{beta,test}` em ambiente com `HOME` e `TMPDIR` isolados, variáveis de credenciais não herdadas, `NODE_ENV=test` e `CROWNICLES_OFFLINE_LAB=1`. Não há `bot.js`, PM2, Baileys live, comandos de deploy, instalação NPM nem operações em bancos reais nesse executor. Os próprios testes podem criar recursos locais em sandbox.

### O que *não* comprova

1. Compatibilidade **canônica** dos bytes da bridge local com Base40 ou cada patch privado. Seus hashes de origem só permitem repetir/inspecionar a mesma composição.
2. Transporte MQTT real, Broker ACL, ACK da saída WhatsApp e replay durável após crash/restart (issue #12), ou Core↔WA em duas contas de teste.
3. MariaDB GAME/LOGS, OIDC, sessão do site ou disponibilidade pública. As 16 condições skip do teste histórico permanecem excluídas.
4. Dependências resolvidas dinamicamente (o inventário automático cobre os `require('./arquivo')` literais; o teste efetivo descobre demais falhas).
5. Liberação de produção: oito gates operacionais continuam pendentes, independentemente do resultado local.

**Próximo desbloqueio real:** depois do retorno de `RC0-TESTS.tap` no Termux, o integrador decide quais módulos locais devem receber um pacote versionado de origem aprovada, enquanto a frente de WhatsApp resolve ACK/replay persistente na issue #12. Não importar os patches D3/D4 de `stdout`, reprovados nos testes de pipe/socket.

## QA do próprio compositor

- 22/22 testes Python adversariais/sintéticos (RC0.1), incluindo arquivo remoto alterado/incompleto/extra, symlinks de fonte/doador, dependências faltantes, travessia de diretórios, destino já existente e teste real Node com 47 arquivos artificiais.
- Execução real do Crownicles **não realizada pelo compositor nesta sessão**; depende dos módulos que estão apenas no Termux do proprietário.
- O código da PR de compositor altera **somente** `tools/` e `docs/`; não altera código de bot, gateway, Core, testes já publicados ou CI.
