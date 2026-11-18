# Auditoria do ciclo de jogo — 55 coletores originais (18/11/2026)

Fonte oficial: Crownicles/Crownicles commit 64d08c05f11949029317341735f6f73024f19f9b, Core 6.2.0.b. Comparação: PR #6, branch feat/crownicles-beta-final-consolidation. Auditoria de caminhos de interface, não de jogo concluído.

## Resultado estrutural

- 56 arquivos TypeScript em Lib/src/packets/interaction; 55 classes ReactionCollector*Data declaradas. PetFree.ts declara 3 tipos; Packet.ts, StopPacket.ts e ResetTimer.ts são infraestrutura sem classe Data adicional.
- Um único ReactionCollectorCity.ts possui aproximadamente 975 linhas, com dezenas de tipos de reação, incluindo hospedaria, casa, ferraria, horta, lojas, serviços e apartamentos. Contar 1 coletor não significa terminar todas essas decisões.
- 54 dos 55 tipos são mencionados nominalmente em algum módulo da ponte. O único não mencionado é ReactionCollectorAnyShopSmallEventData. Menção não garante execução nem UX correta.
- 26/55 têm tipo declarado no Presenter normal, incluindo seis específicos de guilda/pet.
- 3/55 (PetExpedition, PetExpeditionChoice, PetExpeditionFinished) têm rota especializada agora validada e exposta no Presenter normal.
- 2/55 (GuildInvite e PetSell) exigem Gateway de destinatário comprovado e consentimento do segundo jogador.
- 24/55 são experimentais (somente adaptadores antigos) ou ainda não têm rota própria normal. Podem aparecer como fallback genérico ou bloqueio seguro.
- Total de caminhos normais específicos, NÃO necessariamente jogáveis: 31/55 = 56%. A maturidade ponderada da beta geral continua 50% ±10 pontos; são duas métricas diferentes.

## Vinte e quatro tipos com lacuna no caminho normal

Altar, AnyShopSmallEvent, BadPetSmallEvent, BuyHeal, Cart, EpicShopSmallEvent, FightPet, Gardener, GoToPVEIsland, GobletsGame, GuildElder, GuildElderRemove, GuildKick, InteractOtherPlayersPoor, ItemChoice, Limoges, Lottery, PetFoodSmallEvent, PetFreeSelection, ShopSmallEvent, SkipMissionShopItem, TokenMerchant, Unlock e Witch.

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

Foram executados 18/18 testes de contrato de expedições + 5/5 do inventário estrutural = 23/23 aprovados em Node 22 isolado com dados sintéticos. Outros quatro testes envolvendo o Presenter completo foram versionados, mas NÃO rodaram no clone completo (runner GitHub CI indisponível). Nenhum teste desta etapa altera personagens reais. Não chamar de teste de WhatsApp ou Core/MariaDB real.

## Próximas prioridades

Combate (Fight, FightChooseAction, FightPet, PveFight); cidade (subreações e custos específicos de City); loja, comércio e casas; eventos e escolhas de itens; cargos/expulsão/libertação com identidade de outros jogadores; e, ao final, regressão HEAD exata e homologação MariaDB/MQTT/Baileys em dois grupos e dois jogadores.

PR #6 continua draft e não foi instalado no celular. A V3.0 permanece a última instalada; o usuário está utilizando a sessão do Termux em outra atividade. Progresso não aumenta por contagem de arquivos ou menções no código.
