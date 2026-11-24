# Crownicles CP058 — checkout local do repositório público sem GitHub Actions

**Escopo confirmado via API em 24/11/2026:** `Otiosun/Crownicles-wa-lab` está **PUBLIC**. A automação é somente leitura remota, com testes locais explicitamente opt-in. Não modifica `main`, Core nativo, contas WhatsApp, MariaDB, MQTT, credenciais, CI ou deploy.

## Por que usar

GitHub Actions não iniciou as etapas de `web-contracts` devido a pagamento/limite da conta. Isso é um bloqueio do runner, não um resultado de teste. Para continuar, é possível executar no seu próprio Linux/Windows/Termux sem depender de runner pago, **desde que o dispositivo tenha acesso HTTPS normal**. No sandbox do ChatGPT, `github.com` não resolve por DNS; é uma restrição do ambiente. A verificação integral abaixo deve ser rodada num dispositivo autorizado.

O script Python 3.10+ lê o repositório público diretamente da API e do `codeload.github.com`, sem token. Aceita SHA imutável ou número de PR pública; se for PR, resolve e grava a SHA efetiva antes de trabalhar. Obtém **commit Git**, **tree Git** e **ZIP da mesma SHA**. Calcula o Git blob SHA-1 de cada arquivo, exige lista de arquivos exata e recusa tree truncada, ZIP corrompido, symlink, submódulo, duplicata, arquivo extra/ausente, paths inseguros e limite de tamanho. O checkout inteiro só é gravado depois da validação completa. Não sobrescreve diretório preexistente.

## Executar

No checkout da PR CP058 (ou usando o script do pacote de entrega), com Python 3.10+:

```bash
python3 tools/public_checkout_cp058.py --sha 73f4473aecb16447d6adc3ba20f61a2c675806d3 --output ./crownicles-core-verificado
```

Esse SHA corresponde à branch pública `feat/crownicles-beta-final-consolidation` examinada no dia 24/11, com **187 arquivos blob / 200 entradas** na árvore Git. A branch pública `main` tem somente 11 arquivos; não contém todo o mesmo repertório. Para testar outra revisão, substitua `--sha` pelo SHA preciso ou use `--pr N` se houver PR pública apropriada.

Por padrão o script **não executa código baixado**. Acrescente as opções separadamente e somente em diretório descartável:

```bash
python3 tools/public_checkout_cp058.py --sha 73f4473aecb16447d6adc3ba20f61a2c675806d3 --output ./core-sintaxe --run-check
python3 tools/public_checkout_cp058.py --sha 73f4473aecb16447d6adc3ba20f61a2c675806d3 --output ./core-testes --run-check --run-tests
```

`--run-check` exige **Node.js** e executa `node --check` em cada arquivo `.js`, `.cjs` e `.mjs`, sem iniciar o bot. Não compila `.ts` e não configura serviços. `--run-tests` é **opt-in**: usa `node --test` exclusivamente para arquivos `*.test.cjs` nas pastas públicas `integral-native-router/beta/` e `integral-native-router/test/`. A execução é local, sem login no WhatsApp, e remove variáveis de ambiente que indiquem credenciais/tokens/sessões, usa um HOME vazio; contudo **não oferece sandbox de rede garantido**. Use uma máquina descartável sem credenciais de produção. Testes que dependam de Core externo/banco podem falhar legitimamente; isso não significa que o serviço nativo esteja homologado.

Os códigos de saída, SHA pinada, quantidade de blobs e limites são salvos em `CP058-LOCAL-EVIDENCE.json`, com `CP058-SYNTAX.log` e `CP058-TESTS.log`. Qualquer falha faz o comando retornar status diferente de zero. O script não instala dependências, não modifica configuração do computador e não dispara GitHub Actions.

## QA do próprio executor

```bash
python3 -m unittest -v tools/test_public_checkout_cp058.py
```

**15/15 testes locais de mecanismo**, usando apenas um repositório sintético em memória: bytes binários, SHA adulterada, arquivo ausente/extra, zip-slip, symlink/submódulo, ZIP duplicado, tree truncada, origem externa de PR, destino imutável e ancestor symlink, preservação do modo executável Git, opt-in de sintaxe/testes Node, falha proposital do subprocesso e isolamento das variáveis de ambiente. As três fontes do PR usam conteúdo byte-idêntico ao que foi testado (Git blob conferido no handoff).

### Limitações e próximos gates

Os metadados do repo público (HEAD `73f447...`, tree `b467f65...`, 187 blobs de modo `100644`, máximo 113.934 bytes) foram confirmados por acesso autenticado à API; **o download HTTP público real e os testes Node dessa branch não foram executados nesta sessão** devido ao bloqueio DNS deste container. NÃO declarar Core Node24/TS6, MariaDB GAME/LOGS, broker MQTT ACL, WA 2 contas, ACK ou CI como aprovados. O executor local complementa, **não substitui**, o plano nativo de W07 e não interfere no trabalho CP057 do portal.
