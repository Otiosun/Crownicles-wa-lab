# Auditoria percentual verificável — Crownicles/Pinguino, 18/11/2026

## Resposta executiva

**Beta WhatsApp jogável abrangente, sem site: 50% concluída (intervalo de confiança operacional aproximado 40%–60%). Faltam aproximadamente 50 pontos percentuais.**

**Projeto completo incluindo o site compartilhando Core/UUID/persistência: 40% concluído (intervalo aproximado 30%–50%). Faltam aproximadamente 60 pontos.**

Estes números são **estimativas gerenciais ponderadas**, NÃO percentuais matemáticos de arquivos, requisitos aceitos ou testes que passaram. A precisão de duas casas decimais não é justificável; números arredondados para múltiplos de 5 pontos. O trabalho restante pode consumir mais tempo que o realizado devido à homologação e ao site.

**Instalação Android real: última V3.0 instalada; não comprovada online após restart. PR#6 é somente offline e draft. Não somar código offline a funcionalidades homologadas reais.**

## Evidência inventariada

- Upstream fixado: `Crownicles/Crownicles@64d08c05f11949029317341735f6f73024f19f9b`, Core 6.2.0.b. Git tree recursiva completa: 3.659 arquivos, sem truncamento. `Core/src/commands/`: 183 arquivos TS, dos quais 135 em admin e 48 nas famílias de jogador/guilda/pet/missão; 4 auxiliares não contam como comandos, resultando em 44 contratos principais públicos. `Lib/src/packets/interaction`: 56 arquivos TS; não são necessariamente 56 coletores independentes (alguns contêm mais de uma variante). `Lib/src/packets/commands`: 60 arquivos. `RestWs` e Keycloak existem no upstream, mas **não equivalem a site integrado à beta**. `Lang/pt` no inventário de fontes apresenta 8.403 chaves paralelas a `Lang/en`; a completude de chaves não garante uma revisão editorial de qualidade ou de UX WhatsApp.
- Repositório do adaptador na HEAD da branch `feat/crownicles-beta-final-consolidation` em 18/11: 153 arquivos rastreados, ~99 sob `integral-native-router/beta/`, 25 `*.test.cjs` da beta, 42 módulos `*.cjs` runtime (números são de estrutura, não de conclusão). Nenhum frontend implementado de site na branch beta.
- Matrizes `feature-manifest.cjs`, `coverage-inventory.cjs`: 4 contratos base +16 leitura+7 menus+4 autorizações+13 expansão = **44 contratos principais mapeados**. Não é uma prova de 44 comandos jogáveis. `runtime.cjs` sondará se os listeners existem; não houve homologação no Android da branch final. Sete intenções nativas revisadas offline: acariciar, resolver expedição (handler auxiliar), criar guilda, mudar descrição, sair guilda, libertar pet e transferir pet; mais códigos privados para convites e venda dirigida, com Core original responsável pelas mudanças.
- Coletores: o Presenter e os adaptadores Lote8/9/11 oferecem menus para diversas famílias, mas vários ramos possuem `supported:false`, fallback genérico ou somente opção de recusa. O conjunto de 56 arquivos da Lib não pode ser dividido por uma contagem de nomes mencionados; exigem testes semânticos de escolhas, payload, custos, confirmação e efeitos. Coletores de guilda, pet free/transfer e convite/venda têm contratos selecionados e testados com FakeCore, não todo combate, cidade, eventos, loja, casa etc.
- Testes: 78/78 **focados em bancada reconstruída** de Gateway/Store SQLite e FakeCore na sessão anterior, não regressão completa da HEAD; 25 arquivos de teste versionados, sem execução de CI verde. GitHub Actions no commit anterior à auditoria falhou antes de carregar runner/steps. V3.0 no Termux teve 15/15 autorizações +85/85 regressão de instalação; MariaDB posteriormente iniciou e encerrou normalmente, mas o bot está atualmente desligado por uso do Termux em outra tarefa. V2.9 tinha evidência anterior de Core/MQTT/Baileys conectados.
- Segurança: isolamento entre bots/banco/sessão e grupo/PV no código, tokens one-shot e correlação requestId+UUID. Testes de concorrência e cross-player offline existem; falta teste de transporte real envolvendo vários grupos, reconexão, filas e jogador de teste.
- Site: há `RestWs`/Keycloak original, sem frontend site da beta associado ao Core. Para pontuação do produto completo, dar ~0% de **integração entregue de site** (não 0% da infraestrutura que já existe no upstream).

## Modelo quantitativo da BETA WhatsApp (100 pontos)

| Área (peso) | Maturidade técnica estimada | Pontos efetivos | Fundamentação |
|---|---:|---:|---|
| Core original + isolamento DB/MQTT (20) | 80% | 16,0 | Motor reaproveitado, já operou no Termux; falta paridade e reboot |
| Comandos públicos / ponte de entrada (20) | 60% | 12,0 | 44 mapeados, muitos ligados por probe, cobertura real parcial |
| Coletores e ciclos profundos (25) | 28% | 7,0 | 56 módulos na Lib, muitas opções sem suporte; famílias QA isoladas |
| UX WhatsApp e localização PT-BR (10) | 55% | 5,5 | 8.403 chaves originais, menus e privadas parciais; refinamento restante |
| Social, identidade e consentimento (10) | 50% | 5,0 | Dois participantes simulados com segurança; grupos reais pendentes |
| Operação, restart e entrega reversível (8) | 45% | 3,6 | Backups e correções de PID/Maria, ainda não comprovados em produção |
| Regressão/CI/WhatsApp real (7) | 15% | 1,05 | 78 focados FakeCore, CI indisponível e PR não instalado |
| **Total** | | **50,15 ≈ 50/100** | estimativa, ±10pp |

As maturidades são **julgamentos explícitos de risco e prontidão baseados em código**, não métricas que um scanner sabe contar objetivamente. Faixa aproximada para conclusão da beta: 40%–60%. Exibir 50%, sem casas decimais.

## Modelo do PROJETO COMPLETO (WhatsApp + site)

Assumindo 80 pontos do produto dedicado à beta WhatsApp integral e 20 pontos à interface web integrada ao mesmo Core, UUID e banco: `0,8 × 50% + 0,2 × ~0% ≈ 40%`. **Projeto completo: ~40% (30%–50%)**. Se o site for escopo maior que 20%, a porcentagem deve cair. Se o objetivo for somente liberar uma beta mínima aos amigos, pode-se atingir um marco mais cedo do que os 50% restantes, mas isso não equivale a finalizar Crownicles.

## Estágios de prova — nunca misturar

- **Identificado:** arquivo/pacote existe no upstream.
- **Registrado:** listener Core presente e `enabledPackets` permite chamada.
- **Apresentado:** Gateway/Presenter têm contrato seguro e UX viável.
- **Testado offline:** FakeCore+Store SQLite, inclusive escolhas, replay, cross-player.
- **Homologado em Termux:** Core/MariaDB/MQTT/Baileys reais + comandos específicos, em instalação isolada.
- **Aceite:** cold restart, reconexão, idempotência, 2 jogadores, 2 grupos, atualização reversível e continuidade de dados, com evidência.

Cada linha da matriz deverá evoluir por esses estados; não considerar “registrado” como “concluído”.

## Próximas barreiras para ganhar pontos percentuais reais

1. Levantar matriz precisa de todos os coletores originais, comparando pares `ReactionCollector*Data + reações` com presenter normal, e classificar por decisão segura/recusa apenas/bloqueio/fallback.
2. Corrigir opções com mutação original ainda não apresentada com segurança, priorizando jornada/combate/cidade/lojas/economia/expedição, e auditar respostas de dois participantes.
3. Executar regressão completa usando **arquivos EXATOS do HEAD** da branch (não mistura de ZIPs V2.1 e V3.0). Destravar GitHub CI ou reproduzir ambiente verificável.
4. Homologar transporte real em grupo/PV com jogadores de teste, duas identidades e estabilidade após reinício/queda, sem tocar em outros bots.
5. Reaproveitar RestWs e Keycloak para site real sob mesmo Core/UUID, sem duplicar regras ou carteira.

Atualizar o placar por conclusão de entregáveis e testes reais, com evidência e peso, nunca por commit ou versão. Congelar novas microversões. Entregar um ZIP consolidado, com hash, backup, rollback, critérios de aceite e somente quando rodar.

## Fontes pinadas
- Upstream: https://github.com/Crownicles/Crownicles/tree/64d08c05f11949029317341735f6f73024f19f9b
- Integração: https://github.com/Otiosun/Crownicles-wa-lab/pull/6
- Inventário: `integral-native-router/catalogo/CROWNICLES_ORIGINAL_FONTE_COMANDOS_COLETORES_v1.json`
- Matriz: `integral-native-router/beta/FECHAMENTO-MASSIVO-CANONICO.md`
- Regra de escopo: `ROADMAP-COBERTURA-INTEGRAL-CROWNICLES.md`.

## Atualização da linha de base — segunda auditoria em 18/11

A comparação de todas as 56 fontes TypeScript de interação revelou 55 classes ReactionCollector*Data, das quais 54 representam tipos concretos de menu. A classe ReactionCollectorAnyShopSmallEventData é uma base compartilhada entre eventos de compra, não um menu autônomo. Um inventário executável em beta/collector-coverage.cjs classifica 26 tipos no Presenter principal, três expedições especializadas, dois fluxos privados de dois jogadores e 23 tipos dependentes de roteamento de laboratório/fallback. Portanto, **31/54 (57%) possuem algum caminho normal específico**, mas isso é somente roteamento; não é porcentagem de fluxos completamente jogáveis. O módulo original de cidade possui aproximadamente 975 linhas e dezenas de reações internas: a contagem de 54 tipos não mede essa profundidade.

Implementação adicional comprovada offline: validador dedicado do ciclo de expedições (seleção, recolhimento e recebimento), com coerência estrita de snapshots e índices nativos, sem recriar recompensas ou viagens. Em Node22 isolado, **18/18 testes de expedição + 6/6 testes do inventário = 24/24**, todos aprovados. Quatro testes de integração com Presenter foram escritos e versionados, ainda não executados na HEAD completa nem no Android real; GitHub CI continua sem executor homologado. Não inflar percentual por isso.

**Placar mantido: beta WhatsApp ampla ~50% ±10pp; projeto com site ~40% ±10pp.** A próxima atualização percentual deve refletir fechamento de decisões de combate/cidade/economia e validação operacional, não somente aumento de rotas/commits.


## Terceira auditoria — combate/cidade/jornada

- Testes versionados: `reviewed-world-collectors.test.cjs` (39), `reviewed-world-presenter.test.cjs` (26), `collector-coverage.test.cjs` (7). Suites de Presenter executadas recuperando 19 módulos reais do GitHub no commit bb3f91a3b421b8a00d8e14502481f5d719f28e65 e simulando somente infraestrutura e Store; unitários/inventário novamente em 7ad68675e8915a6a69bd6d4ae1b5b6cb76f0975c. **72/72 PASS** no harness V8 isolado, não equivalem a Node/SQLite/Core/MQTT/Baileys completos. Workflow atualizado para os testes; CI integral ainda não homologado.

- Inventário: 54 tipos concretos; 22 Presenter principal + 9 world-validated + 3 expedição + 2 privados = **36/54 (66,7%) com caminho específico normal**; 18 adapter-only e 1 classe base. Antes 31/54. Não confundir com 66,7% de conclusão funcional. Estimativas de produto mantidas ~50% beta ±10pp e ~40% com site ±10pp, até regressão completa e critérios reais de aceite.

- Próximos gates: ItemChoice/lojas/eventos que dependem de inventário e efeitos, especialmente GobletsGame (dados de estratégia originais e recompensa item), Witch e Altar; não liberar parcial que deixe escolha de item inacessível. Revisar loteria, demais adapter-only, regressão de HEAD, CI, sandbox de Core/MariaDB/MQTT e depois validação WhatsApp com dois jogadores e rollback. Sem microlotes de instalação.
Ver detalhes na matriz FECHAMENTO-MASSIVO-CANONICO.md.
