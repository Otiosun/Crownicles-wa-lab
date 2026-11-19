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


## 18/11/2026 — Inventário, comércio, exploração e seleção de libertação

Checkpoint de implementação: `3c3839243f4287d56897eebda80534b7ef54e85b` (25 commits após ec434be8, 13 arquivos alterados, +354/-10 linhas antes da documentação). Upstream mantido em Crownicles 6.2.0.b @64d08c05f11949029317341735f6f73024f19f9b.

- `bridge/reviewed-item-collectors.cjs`: ItemChoice, ItemAccept, ShopSmallEvent, EpicShopSmallEvent e TokenMerchant. ItemAccept descreve o item antigo; ItemFound não garante armazenamento. Índices e custos do Core, saldo, comparação dos atributos e descarte/venda originais, confirmação para mutações. Não recalcula recompensa.
- `bridge/reviewed-small-events.cjs`: GobletsGame, Lottery, Altar, Witch, PetFoodSmallEvent, BadPetSmallEvent e Limoges. Rotas e resultados validados antes do fallback/LAB. Não inventa probabilidade, prêmio, resposta correta ou penalidade. Constantes executáveis dos cálices (2% item no arriscado; 80% nada no apostador; multiplicador 3,3) prevalecem sobre comentários antigos divergentes. Loteria difícil: risco de 175 moedas e tempo; bruxa enum de resultado original, efeitos forçados separados; alimentação do anão depende da dieta/ciúme do pet, não da preferência do anão.
- `bridge/pet-transfer-collector.cjs`: PetFreeSelection valida cada ID de abrigo contra o snapshot, preserva a ordem (única reação não presente no abrigo pode ser o pet próprio e apenas na primeira posição, como no Core). Seleção não liberta; confirmação original subsequente discrimina abrigo/próprio, mostra custo e exige confirmação. Apelido ausente é válido; duplicatas, reações extras ou ordem divergente são bloqueadas. `universal-collector-v3.cjs` checa forma antes de acessar reações nulas.
- Auditoria corrigida: sombreamento de variável items impedia execução; agora há 48/54 tipos concretos com rota normal específica (88,9%): 22 principal, 9 world, 5 item, 7 eventos, 3 expedição, 2 privado; 6 apenas adaptador; 1 classe-base excluída. Antes 36/54. Não confundir cobertura estrutural com jogabilidade.
- 74/74 testes unitários/auditoria em V8 isolado, fontes exatas de 326211ec6449618e0dc3f097b7c9321bf9e9fef2; 19/19 Presenter em 3c3839243f4287d56897eebda80534b7ef54e85b (23 módulos incluindo 3 stubs de legado sem uso pelas rotas focadas, FS simulado). 93/93 verificações focadas nesta rodada, não suite real Node/SQLite/MariaDB/MQTT/WhatsApp. Suites e workflow versionados. Run GitHub Actions #215 (44440824838) concluído failure, job 135280934795 steps null; tentativa de log devolve 404 BlobNotFound; causa raiz não demonstrada. Não considerar CI verde.
- Restam GuildElder, GuildElderRemove, GuildKick, InteractOtherPlayersPoor, SkipMissionShopItem, Unlock. A troca de missão cobra gemas no callback pelo número de trocas semanais, mas o próximo collector não informa preço: manter bloqueado até vínculo auditável entre cotação da loja e confirmação. Administração/ações sobre outros jogadores exigem identidade e autorização verificadas. Não contornar isso com UUID visível, índice inventado, ou LAB.
- Beta geral mantém estimativa gerencial de ~50% ±10pp; todo o escopo com site ~40% ±10pp até homologação integral. Sem alteração do Core, MariaDB, Termux, sessões ou dados reais, nenhuma merge/deploy. Prioridade: seis tipos restantes, auditoria de autorização, regressão integral Node/SQLite, CI, Core sandbox e WhatsApp real; uma entrega consolidada e reversível.


## Checkpoint — 18/11/2026 — fechamento da auditoria dos coletores

Head de código verificado: 77627761f29ab7a5415ab4290137ededb564a8f9 (21 commits/16 arquivos desde 3758875c0a16c93dea3e4f41f4444c2eb327b11a, antes deste registro).

- 54/54 tipos concretos identificados, 52/54 rotas estruturais de ação revisadas (96,3%), 2/54 apenas cancelamento seguro: GuildElderRemove e SkipMissionShopItem. Não equivale a gameplay homologado. Distribuição: 22 main, 9 world, 5 item, 7 event, 4 target, 3 expedition, 2 private, 2 guarded-cancel, 0 adapter-only. Uma classe abstrata fora do denominador.
- Inventário dos 44 contratos públicos: 11/13 expansões têm rota revisada offline (6 universal, 2 social privada, 3 alvo verificado); FriendlyFight e GuildElderRemove não liberados como comandos revisados. Registro de listener e WhatsApp E2E ainda exigidos.
- /minharef, /promoveranciao REF, /expulsarguilda REF, /libertarjogador REF; referência pseudônima de personagem, não credencial. /guilda apresenta vínculos verificáveis em resposta privada. Ações usam identidade vinculada, nonce inicial, contexto correlacionado, confirmação do coletor original e revalidação. Doação anônima de uma moeda preserva regra original; resposta não garante débito confirmado.
- Cotação de substituição vinculada ao pedido original e exibida na seleção, sem permitir troca até corrigir Core. Candidato puro patches/core-v31-safety-candidate.cjs fixa quatro blobs upstream; preserva guilda/alvo originais, valida cotação, saldo, slot e snapshot antes de mutação; propõe transação e resultados pós-commit. Não aplicado nem compilado. Validação textual em quatro fontes exatas retornadas pelo GitHub, hash simulado; SHA1 real e testes TypeScript/DB pendentes. Não alterar Termux atual nem MariaDB real.
- 59/59 verificações em V8 no head de código (31 alvo/cotação, 12 coletores, 5 inventário, 8 expansão, 3 pin candidato), mais 15/15 Gateway em 03a3b92455336e6622c3d5be153a067edf481fb0. Harness simula crypto e dependências; Gateway usa Fake Store, FS e módulos legados não relacionados stubados. Não são 74 testes Node/SQLite reais. Caso opcional de fontes no teste candidato não executado pelo harness de 59; conferência estática separada de quatro blobs passou. GitHub Actions #248 falhou, steps/log indisponíveis (404 BlobNotFound), causa não determinada. Não declarar CI verde.
- Próxima etapa: validação em checkout isolado com Node 22 real + suite SQLite, compilação e regressão de Core/MariaDB descartável, concorrência/rollback e attestation do candidato antes de habilitar os dois bloqueados; depois WhatsApp de teste e web. Não mergear, instalar ou publicar automaticamente. Estimativas globais permanecem conservadoras: beta ~50%, projeto com site ~40%, incerteza ±10pp.


## 19/11 — QA V31 real

# QA real V31 — 19/11/2026

**Checkpoint de código:** `6666229835f324075d6762149b2e0d4a9cdaa609` (branch feat/crownicles-beta-final-consolidation, PR #6 draft). Upstream pin 64d08c05f11949029317341735f6f73024f19f9b.

## Regressão executada

- Ambiente isolado Node.js 22.16.0, módulo real node:sqlite, criptografia Node real. TypeScript 5.8.3 para transpileModule dos candidatos e validação sintática, não typecheck completo do Core (upstream requer Node >=24 / TypeScript 6.0.3).
- Consulta da listagem da pasta beta e recuperação de todos os 39 arquivos *.test.cjs, mais dependências. 106 registros exportados via snapshot privado Komekko; cada conteúdo conferido pelo hash Git blob SHA-1 antes de restaurar. Repositório GitHub acessível por conector; container sem resolução DNS github.com. Nenhum dado real, credencial ou sessão copiado.
- Primeira bateria real ampliada: 494/496. Corrigidos fixture de /combate (playerStats obrigatório no contrato oficial) e proteção de lock, não relaxamento de asserções.
- Lock: compara inode, dispositivo, UID e conteúdo antes de remover; recuperação de lock obsoleto serializada por guard exclusivo .recovery; guard interrompido é preservado para inspeção. Sem matar processos de terceiros. Cinco novos testes reais de filesystem.
- Regressão intermediária: 501/501 (35 arquivos); nova suite de 15 execuções sobre quatro fontes transformadas, com SQLite real e serviços/ORM simulados; três arquivos legados adicionais recuperados.
- **Resultado final: 539/539, 39 arquivos de testes, 0 falhas, 0 ignorados**, 2331.039301 ms reportados pelo runner. TAP SHA256 `961826cf4fd4a48a5816fee135b3864779589cf91d59d9caf39ed6b9bd92147e`. A nova suite exercita snapshot, cotação, saldo, rollback em geração/debito/update/commit e duas cotações concorrentes. Todos os arquivos CJS recuperados passaram na checagem de sintaxe. YAML dos dois workflows parseado; teste TypeScript MariaDB candidato transpileModule sem erros sintáticos; duas rejeições de caminho da preparação confirmadas. Não confundir sucesso com typecheck, compilação integral, ORM Sequelize ou Core real.
- Comando executado na pasta beta: `CROWNICLES_UPSTREAM_SRC=/mnt/data/crownicles-homologacao/upstream CROWNICLES_TYPESCRIPT_MODULE=/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript node --test --test-reporter=tap *.test.cjs`
- CI remoto #256 (head dd59c8e7b2b922bbd3d6be096a550b14acb788b8) falhou em 3 s (03:52:25Z a 03:52:28Z); steps=null, sem artefatos; não demonstra causa exata. Não declarar CI verde.

## Próxima barreira preparada

`patches/stage-core-v31.cjs` exige checkout descartável absoluto, nome upstream-v31-lab, marcador explícito, HEAD pinado, árvore rastreada limpa e ausência de config/dist/dados; recusa links e confere blobs antes de modificar. Não roda em instalação real. Copia ensaio `patches/crownicles-v31-safety.integration.test.ts` para suíte upstream. Workflow manual `.github/workflows/crownicles-v31-core-lab.yml` prepara Core original + Node 24 + pnpm fixado + MariaDB 11.4 descartável, compilação e integração com o coletor e ORM originais. Ainda NÃO executado nem compilado integralmente: ambiente atual não possui mariadbd/checkout integral/dependências. Workflow novo pode precisar estar na branch padrão antes de ser acionável; não foi solicitado merge nem executada publicação. O teste MariaDB usa gerador determinístico em parte dos casos para testar transação, não certifica o RNG. Os dois coletores bloqueados continuam bloqueados.

## Estimativa gerencial revisada (não medida)

Estrutural: 52/54 rotas de ação (96,3%); 2 apenas cancelamento. 44 contratos públicos mapeados, 11/13 expansões revisadas. A execução real da ponte permite rever estimativa beta de ~50% para ~58% (±10 pp): core/infra 20×80%=16; comandos/entrada 20×70%=14; coletores/ciclos 25×38%=9,5; UX 10×55%=5,5; social/identidade 10×60%=6; startup 8×55%=4,4; QA/CI/WhatsApp 7×40%=2,8. Total 58,2%. Projeto total incluindo site ~47% (80% escopo beta + 20% site ainda sem homologação). São pesos e avaliações convencionais, não percentuais de testes nem garantia de lançamento.

Snapshot de fontes conferidas (privado): https://docs.google.com/document/d/1BZ5nCdlApXk050b4kdkNJN0rhcJ_sZRy3craU0uW_fo/edit

Nenhum merge, deploy, acesso ao banco real ou alteração de Termux/WhatsApp. Próximo: Core real MariaDB descartável, correções, liberação dos dois casos somente após evidência, homologação WhatsApp e portal.
