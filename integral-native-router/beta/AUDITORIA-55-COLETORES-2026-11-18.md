# Auditoria do ciclo de jogo — 55 coletores originais (18/11/2026)

Fonte oficial: Crownicles/Crownicles commit 64d08c05f11949029317341735f6f73024f19f9b, Core 6.2.0.b. Comparação: PR #6, branch feat/crownicles-beta-final-consolidation. Auditoria de caminhos de interface, não de jogo concluído.

## Resultado estrutural

- 56 arquivos TypeScript em Lib/src/packets/interaction; 55 classes ReactionCollector*Data declaradas. PetFree.ts declara 3 tipos; Packet.ts, StopPacket.ts e ResetTimer.ts são infraestrutura sem classe Data adicional.
- Um único ReactionCollectorCity.ts possui aproximadamente 975 linhas, com dezenas de tipos de reação, incluindo hospedaria, casa, ferraria, horta, lojas, serviços e apartamentos. Contar 1 coletor não significa terminar todas essas decisões.
- 54 dos 55 tipos são mencionados nominalmente na ponte; a exceção ReactionCollectorAnyShopSmallEventData é uma classe-base para ofertas pequenas, não um menu independente. Menção não garante execução nem UX correta.
- 26/55 têm tipo declarado no Presenter normal, incluindo seis específicos de guilda/pet.
- 3/55 (PetExpedition, PetExpeditionChoice, PetExpeditionFinished) têm rota especializada agora validada e exposta no Presenter normal.
- 2/55 (GuildInvite e PetSell) exigem Gateway de destinatário comprovado e consentimento do segundo jogador.
- 23/54 fluxos concretos são experimentais (somente adaptadores antigos) ou ainda não têm rota própria normal; um tipo adicional é a classe-base abstrata de ofertas. Podem aparecer como fallback genérico ou bloqueio seguro.
- Total de caminhos normais específicos, NÃO necessariamente jogáveis: 31/54 = 57%. (55 classes Data, mas 54 concretas.) A maturidade ponderada da beta geral continua 50% ±10 pontos; são duas métricas diferentes.

## Vinte e três tipos com lacuna no caminho normal

Altar, BadPetSmallEvent, BuyHeal, Cart, EpicShopSmallEvent, FightPet, Gardener, GoToPVEIsland, GobletsGame, GuildElder, GuildElderRemove, GuildKick, InteractOtherPlayersPoor, ItemChoice, Limoges, Lottery, PetFoodSmallEvent, PetFreeSelection, ShopSmallEvent, SkipMissionShopItem, TokenMerchant, Unlock e Witch.

A existência de adaptadores experimentais não autoriza liberar opções perigosas: preservar bloqueios até haver identidade, custo e efeitos confirmados.

## Medição reproduzível

Execute no clone da branch: node integral-native-router/beta/collector-coverage.cjs

Gera JSON com o nome de cada tipo, o arquivo TS original e a categoria de rota; não envia comandos e não altera o banco. Testes automatizados conferem unicidade, contagens e casos de origem.

## Nova implementação de expedições

A fonte original foi inspecionada nos módulos PetExpeditionChoice.ts, PetExpedition.ts, PetExpeditionFinished.ts, PetBasicInfo.ts e ExpeditionConstants.ts. Nova integração bridge/pet-expedition-collector.cjs, chamada por universal-collector-v3.cjs e presenter.cjs, com estes contratos:

1. Escolha: todos os dados de cada opção precisam ser idênticos ao snapshot original da reação (ID, bioma, duração, risco, dificuldade, consumo, índice e flags). IDs duplicados, seleção ausente e reações contraditórias bloqueiam o menu. Preserva-se a ordem oficial dos índices. Escolha e cancelamento que pode custar afinidade requerem nonce.
2. Em andamento: PetBasicInfo.petNickname, bioma e retorno estimado. Recolhimento exige confirmação; fechar a consulta não.
3. Finalizada: claim/recompensas exige confirmação, sem calcular dinheiro ou itens na ponte.
4. Se o pacote não satisfaz o contrato, o Presenter deixa todas as opções indisponíveis. Nunca volta ao adaptador antigo mais permissivo nesse caso.

Foram executados 18/18 testes de contrato de expedições + 6/6 do inventário estrutural = 24/24 aprovados em Node 22 isolado com dados sintéticos. Outros quatro testes envolvendo o Presenter completo foram versionados, mas NÃO rodaram no clone completo (runner GitHub CI indisponível). Nenhum teste desta etapa altera personagens reais. Não chamar de teste de WhatsApp ou Core/MariaDB real.

## Próximas prioridades

Combate (Fight, FightChooseAction, FightPet, PveFight); cidade (subreações e custos específicos de City); loja, comércio e casas; eventos e escolhas de itens; cargos/expulsão/libertação com identidade de outros jogadores; e, ao final, regressão HEAD exata e homologação MariaDB/MQTT/Baileys em dois grupos e dois jogadores.

PR #6 continua draft e não foi instalado no celular. A V3.0 permanece a última instalada; o usuário está utilizando a sessão do Termux em outra atividade. Progresso não aumenta por contagem de arquivos ou menções no código.


## Checkpoint — 18/11/2026 — fechamento da auditoria dos coletores

Head de código verificado: 77627761f29ab7a5415ab4290137ededb564a8f9 (21 commits/16 arquivos desde 3758875c0a16c93dea3e4f41f4444c2eb327b11a, antes deste registro).

- 54/54 tipos concretos identificados, 52/54 rotas estruturais de ação revisadas (96,3%), 2/54 apenas cancelamento seguro: GuildElderRemove e SkipMissionShopItem. Não equivale a gameplay homologado. Distribuição: 22 main, 9 world, 5 item, 7 event, 4 target, 3 expedition, 2 private, 2 guarded-cancel, 0 adapter-only. Uma classe abstrata fora do denominador.
- Inventário dos 44 contratos públicos: 11/13 expansões têm rota revisada offline (6 universal, 2 social privada, 3 alvo verificado); FriendlyFight e GuildElderRemove não liberados como comandos revisados. Registro de listener e WhatsApp E2E ainda exigidos.
- /minharef, /promoveranciao REF, /expulsarguilda REF, /libertarjogador REF; referência pseudônima de personagem, não credencial. /guilda apresenta vínculos verificáveis em resposta privada. Ações usam identidade vinculada, nonce inicial, contexto correlacionado, confirmação do coletor original e revalidação. Doação anônima de uma moeda preserva regra original; resposta não garante débito confirmado.
- Cotação de substituição vinculada ao pedido original e exibida na seleção, sem permitir troca até corrigir Core. Candidato puro patches/core-v31-safety-candidate.cjs fixa quatro blobs upstream; preserva guilda/alvo originais, valida cotação, saldo, slot e snapshot antes de mutação; propõe transação e resultados pós-commit. Não aplicado nem compilado. Validação textual em quatro fontes exatas retornadas pelo GitHub, hash simulado; SHA1 real e testes TypeScript/DB pendentes. Não alterar Termux atual nem MariaDB real.
- 59/59 verificações em V8 no head de código (31 alvo/cotação, 12 coletores, 5 inventário, 8 expansão, 3 pin candidato), mais 15/15 Gateway em 03a3b92455336e6622c3d5be153a067edf481fb0. Harness simula crypto e dependências; Gateway usa Fake Store, FS e módulos legados não relacionados stubados. Não são 74 testes Node/SQLite reais. Caso opcional de fontes no teste candidato não executado pelo harness de 59; conferência estática separada de quatro blobs passou. GitHub Actions #248 falhou, steps/log indisponíveis (404 BlobNotFound), causa não determinada. Não declarar CI verde.
- Próxima etapa: validação em checkout isolado com Node 22 real + suite SQLite, compilação e regressão de Core/MariaDB descartável, concorrência/rollback e attestation do candidato antes de habilitar os dois bloqueados; depois WhatsApp de teste e web. Não mergear, instalar ou publicar automaticamente. Estimativas globais permanecem conservadoras: beta ~50%, projeto com site ~40%, incerteza ±10pp.
