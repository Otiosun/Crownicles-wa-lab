# Crownicles — fechamento massivo da Beta V3.0 (18/11/2026)

**Status: auditoria preliminar, não é versão pronta nem aplicada ao Termux.** Baseline: branch `feat/crownicles-beta-original-auth-v30`. Código canônico do Core original `Crownicles/Crownicles@64d08c05f11949029317341735f6f73024f19f9b`, Core 6.2.0.b.

## Prova já obtida no telefone
- Até V2.9: MariaDB privado + Core + MQTT + Baileys conectaram; cinco consultas V2.7 e sete consultas V2.8.2 responderam no WhatsApp.
- V2.9: 12/12 testes coletores, 70/70 testes beta, handlers 16+7 carregados.
- V3.0: patch cirúrgico instalado e 15/15 autorizações + 85/85 regressões locais; porém restart falhou primeiro por PID reutilizado `kill EPERM`, depois por timeout no MariaDB. **Sem prova de V3.0 online ainda**. Último diagnóstico: socket sem conexão (111), mysql.pid antigo sem processo `mariadbd`, recuperação Aria/InnoDB concluída mas sem `ready for connections`; apenas ~609 MiB RAM disponíveis. A ação recomendada foi preservar socket/PID obsoletos em backup, nunca mover o diretório data e reiniciar com Termux em primeiro plano. Aguardando retorno.

## Inventário de comandos originais fora da Beta
Lista direta de `Core/src/commands/player` (28 arquivos), `guild` (11), `pet` (8), `mission` (1). Os 28 arquivos player incluem quatro arquivos sem decorador `@commandRequires` público individual: `FightPlayerStats.ts`, `FightRewards.ts`, `InventoryPotionUtils.ts`, `KingGuardFightCommand.ts`; não os contar como novos comandos só por serem arquivos. Entre estes quatro, `KingGuardFight` é auxiliar e deve ser estudado, não exposto como comando.

Considerando os 44 `@commandRequires` principais dessas quatro pastas, a beta V3.0 tem **31 nomes** no cadastro base + manifestos, e restam **13 handlers** a incorporar, cada um sujeito a controle de acesso, pré-requisitos e resposta end-to-end:

| Familia | Comando Core original | PacketReq | Decisão/risco |
|---|---|---|---|
| player | FriendlyFightCommand.ts | CommandFriendlyFightPacketReq | Inspecionar desafio e destinatário, sem efeito automático |
| player | UnlockCommand.ts | CommandUnlockPacketReq | Collector + mutação: requer decisão oficial |
| guild | GuildCreateCommand.ts | CommandGuildCreatePacketReq | Collector, custo/identidade de guilda |
| guild | GuildDescriptionCommand.ts | CommandGuildDescriptionPacketReq | Collector, conteúdo social/moderação |
| guild | GuildElderCommand.ts | CommandGuildElderPacketReq | Collector, promoção e autorização |
| guild | GuildElderRemoveCommand.ts | CommandGuildElderRemovePacketReq | Collector, revogação de permissão |
| guild | GuildInviteCommand.ts | CommandGuildInvitePacketReq | Collector, identidade de terceiro |
| guild | GuildKickCommand.ts | CommandGuildKickPacketReq | Collector, remoção de terceiro |
| guild | GuildLeaveCommand.ts | CommandGuildLeavePacketReq | Collector, saída da guilda |
| pet | PetCaressCommand.ts | CommandPetCaressPacketReq | Sem collector detectado; auditar efeitos |
| pet | PetFreeCommand.ts | CommandPetFreePacketReq | Coletores aninhados, liberação irreversível |
| pet | PetSellCommand.ts | CommandPetSellPacketReq | Collector, economia irreversível |
| pet | PetTransferCommand.ts | CommandPetTransferPacketReq | Collector, troca com outro jogador |

**A lista de 13 não mede tudo que falta do jogo:** o motor possui interações/coletores de eventos, mapas, chefes, casas, economia e atividades que também precisam ser verificados em fluxo. O site RestWs/Keycloak também não está entregue. Não confundir `handlers registrados`, `Gateway roteado`, `Presenter legível`, `decisão confirmada` e `E2E WhatsApp real`.

## Critérios de entrega única
1. Pinguino V3.0 reconectado sem reset ou repareamento: lock/PID e MariaDB estáveis em cold restart e crash-recovery.
2. Matriz auditável para 44 handlers principais com cinco estágios (Core; Gateway; Presenter; confirmação; WhatsApp).
3. Os 13 comandos faltantes e respectivas famílias de coletores conectados ao Core original, preservando idx e modelos dos pacotes, sem regras recriadas. Bloqueios de riscos e ações com terceiros até homologação, usando autorização nativa.
4. 2 usuários × 2 grupos, JID/LID/PN, resposta invertida, replay, recuperação de fila e restrição privacidade por requestId+UUID.
5. CI GitHub verde, relatório TAP, Node 22/26, testes persistentes com MariaDB e MQTT isolados e homologação WhatsApp com personagem de teste não destrutivo.
6. Localização pt-BR validada contra `Lang/pt`, incluindo placeholders; site deve usar o mesmo UUID/Core e banco, nunca duplicar carteira.
7. Distribuir **um pacote consolidado com checksum, backup e rollback** quando todo gate essencial passar. Não gerar V3.1, V3.2 etc por cada correção.

## Ações proibidas na bancada
- Não tocar em banco real, personagens, sessão Baileys, grupos da comunidade ou outros bots.
- Não apagar `mysql.sock`, `mysql.pid`, `run.lock`, tablespace ou Keycloak sem confirmar origem e preservar backup.
- Não homologar mutações reais em jogadores existentes por conveniência.
- Não dizer “pronto hoje” até haver evidência real.

## Falhas/pendências
- CI das branches anteriores terminou em failure; logs de job remoto não disponíveis na integração até aqui (`BlobNotFound`). Precisa coleta TAP/artefato de diagnóstico.
- Último restart real V3.0 MariaDB travou; o comando de recuperação conservadora foi entregue, resultado ainda não observado.
- Portal/site não desenvolvido ou validado na beta persistente.

## Avanço offline — 18/11/2026: primeira fusão massiva W3/Universal

**Nenhum arquivo desta branch foi instalado no Android.** V3.0 continua sendo a última versão instalada, sem conexão WhatsApp confirmada desde o problema anterior de MariaDB. Não prometer finalização nem declarar 13 funções jogáveis.

- `feature-manifest.cjs` inclui os 13 handlers adicionais, separados dos 31 anteriores. A rotina `probeExpansionHandlers` só registra como disponível quando o listener nativo existe, mesmo que o arquivo JS compilado esteja presente. Rejeita falhas de importação.
- `runtime.cjs` reporta registros/pêndencias e inclui no conjunto verificado o `CommandPetExpeditionResolvePacketReq` do `CoreHandlers` **somente se o listener real estiver registrado**.
- Ponte W3 `native-universal.cjs` passou a liberar **somente cinco intenções já revisadas** mediante callback de disponibilidade do Core, tanto ao abrir quanto ao confirmar: `/acariciar`, `/resgatarexpedicao`, `/criarguilda NOME`, `/descricaoguilda TEXTO`, `/sairdaguilda`. Abertura é sempre menu local, sem requisição ao Core. Opção numérica 1 emite apenas prévia com nonce; a requisição Core ocorre somente após `/confirmar 1 TOKEN` correto, único, ligado a jogador+menu+prazo. Opção de cancelar jamais abre execução.
- `presenter.cjs` habilita **três coletores binários auditados**, reconhecidos diretamente no código-fonte pinado da Lib original: `ReactionCollectorGuildCreateData`, `ReactionCollectorGuildDescriptionData` e `ReactionCollectorGuildLeaveData`. Reações `Accept/Refuse`, ambos payloads vazios, na ordem original do array; payload inválido bloqueia todas as ações. Saída do chefe sem sucessor revela explicitamente possível destruição da guilda e requer **segunda prévia e segunda confirmação** na etapa original do Core.
- Fluxos sem alvo verificado, irreversíveis ou de efeitos de terceiros continuam **bloqueados** no modo normal apesar dos handlers registrados: `/liberarpet`, `/transferirpet`, `/expulsarguilda`, `/libertarjogador`, `/amistoso` e outros. Não usar flags antigas de laboratório para habilitar tudo num bot real.
- `/ajuda` e `/nativos` mostram só as cinco ações para as quais `canSendPacket` reporta listener disponível, não os 13 como se estivessem homologados.
- O teste anterior `collector-flow.test.cjs` às vezes falhava com `database is not open` devido à atividade assíncrona simulada de FakeCore após fechar o SQLite; o teardown agora cancela os callbacks agendados, sem alterar o runtime do jogo.
- Testes locais no diretório isolado de bancada (Node 22.16.0): `reviewed-live.test.cjs` **16/16**, e suite combinada com `native-auth-v30.test.cjs`, `collector-flow.test.cjs` e `feature-manifest.test.cjs`: **61/61**, TAP fail=0/skip=0/todo=0. São FakeCore + Store/Gateway/Presenter reais de código local. O arquivo versionado `reviewed-live.test.cjs` tem 15 casos efetivos da mesma família, mas **a suite versionada ainda não passou em runner remoto**. A cópia de bancada é reconstruída de fontes V30 e arquivos de desenvolvimento e não substitui regressão completa da HEAD do GitHub nem integração Termux.
- Confirmado com o upstream original `Crownicles/Crownicles@64d08c05...` que GuildCreate, GuildDescription e GuildLeave usam `ReactionCollectorAcceptReaction` e `ReactionCollectorRefuseReaction` sem dados adicionais, e seus payloads seguem os campos validados. Não simular economia/recompensa como evidência real.
- PR#6 continua rascunho, GitHub Actions continua `failure` **antes da inicialização do runner** (runner_id=0 e steps[] nas execuções investigadas). Não apresentar CI verde nem alterar o gameplay como se fosse defeito dos testes.
- Próximos gates: (1) testes versionados no Node22 e Node26 em ambiente clonado integral; (2) preservar regras originais para membros externos/guildas e validação de alvo; (3) relatorio da cobertura real de coletores 33+; (4) fallback seguro para MariaDB/Android em pacote instalável único; (5) QA WhatsApp e site no mesmo Core. Sem necessidade de tocar na sessão atual do Termux enquanto o usuário a utiliza.

## Atualização 18/11 — sexta ação e inventário por contrato

O grupo de ações nativas revisadas foi ampliado de **5 para 6**, acrescentando `/liberarpet` (libertação do próprio companheiro). A intenção local solicita apenas `CommandPetFreePacketReq {keycloakId: jogador}` após primeira prévia e `/confirmar` única. Quando o Core apresenta `ReactionCollectorPetFreeData`, a interface mostra a identificação do animal, o valor exato `freeCost` em moedas e aviso de consequência irreversível; somente uma **segunda** prévia + segunda confirmação permite enviar `ReactionCollectorReactPacket` com índice oficial. Campos inválidos ou custo negativo ficam 100% bloqueados. O coletor `ReactionCollectorPetFreeShelterConfirmData` também possui parser binário revisado, mas a seleção aninhada `ReactionCollectorPetFreeSelectionData` não está homologada e continua fail-closed. Nenhum pet foi solto no banco real.

**Auditoria upstream conferida**: `Lib/src/packets/interaction/ReactionCollectorPetFree.ts` no commit fixado possui campos `petId`, `petSex`, `petNickname?`, `freeCost` e Accept/Refuse sem dados; o coletor de abrigo tem `petEntityId` e `isFromShelter`. `CommandPetFreePacketReq` inclui `keycloakId`. Portanto, nenhum custo ou pet ID foi inventado no adaptador.

**Testes locais atualizados**: suite focal `reviewed-live.test.cjs` de desenvolvimento e três suites legadas (`collector-flow`, `native-auth-v30`, `feature-manifest`) totalizaram **64/64 PASS**, Node 22.16.0, 0 failed/skip/todo. O commit versionado de `reviewed-live.test.cjs` inclui casos equivalentes para o Core fake e os coletores originais, mas o CI GitHub segue sem runner e ainda não executou esse commit.

**Inventário reprodutível**: `coverage-inventory.cjs` e `coverage-inventory.test.cjs` guardam os 44 contratos originais únicos: 4 base, 16 leitura, 7 menus, 4 autorizações e 13 expansão. Dos seis fluxos nativos revisados, cinco são comandos públicos nessa matriz; `CommandPetExpeditionResolvePacketReq` é auxiliar de `CoreHandlers`, verificado separadamente e nunca somado falsamente como um 45º comando público. Cada linha contém fonte TS/JS, família, status `reviewedOffline`, exigência de listener real e marca explícita de que o inventário **não constitui evidência WhatsApp E2E**. O arquivo `coverage-inventory.test.cjs` testa ausência de duplicatas, 44 contagens, linhas com flags e bloqueios dos comandos com terceiros.

**Bloqueios ainda intencionais**: /transferirpet, /expulsarguilda, /libertarjogador, /amistoso (alvo sem vínculo seguro), novas operações de ancião, petSell e subfluxos não certificados de petFree. Reverter qualquer desbloqueio perigoso se os dados do Core não atenderem aos contratos. Não usar `CROWNICLES_WA_UNIVERSAL_COMMANDS=lab` no bot real para ultrapassar os bloqueios.

**Estado de distribuição**: Todos os arquivos novos estão **somente** em `feat/crownicles-beta-final-consolidation` no GitHub; PR#6 é draft, V3.0 no Termux não modificada. GitHub run 44245500774 ainda `failure` sem passos retornados; não é regressão remota aprovada. Continuar um único pacote final verificável depois de testes completos, estabilidade MariaDB, revisão dos coletores restantes e homologação WhatsApp real.

## Etapa 18/11 — Abrigo compartilhado, autorização de terceiros e isolamento LAB

**Status**: código adicionado somente na branch de consolidação. Não instalado no Android, nem homologado com o Core real.

### Sétima rota nativa revisada: /transferirpet

- O Core original \`PetTransferCommand.ts\` cria \`ReactionCollectorPetTransferData\`, autorizando somente o \`player.keycloakId\` que abriu o menu. Quando há pet próprio, gera opção depositar (se possível) e trocas por cada pet do abrigo; sem pet próprio, gera retiradas. RefuseReaction cancela. O Core mantém locks de linha e revalida se o pet do abrigo foi transferido por outro membro.
- A ponte agora reconhece os três tipos oficiais de reação em \`bridge/pet-transfer-collector.cjs\`: \`ReactionCollectorPetTransferDepositReaction\` (payload vazio), \`ReactionCollectorPetTransferWithdrawReaction\` e \`ReactionCollectorPetTransferSwitchReaction\` (cada uma com \`petEntityId\`). Cada destino deve estar na lista \`shelterPets\` recebida do mesmo pacote oficial. IDs desconhecidos, repetidos, dados de pet inválidos, combinações incoerentes e ausência de recusa bloqueiam o menu inteiro.
- Mostra nome do pet, espécie, abrigo compartilhado e a consequência de depósito/retirada/troca. **Não inventa preços**, que não constam no coletor. A escolha preserva posição original do array, não reordena índices conforme o texto. Requer segunda prévia, nonce único e confirmação depois que o Core apresenta o coletor, além da primeira autorização para solicitar o menu.
- \`/transferirpet\` aparece na ajuda somente se o handler original estiver registrado; \`REVIEWED_LIVE_KEYS\` contém sete chaves, mas **seis** correspondem a handlers principais da matriz de 44 — a sétima \`/resgatarexpedicao\` usa o \`CoreHandlers\` auxiliar.
- A integração não habilita \`petSell\` (venda entre jogadores), \`guildInvite\` (convite) ou expulsão/libertação de outro jogador: seus contratos exigem respostas e/ou identidades de outra conta. O roteador atual não possui uma prova de entrega multijogador completa para esses efeitos, portanto o bloqueio é intencional.

### Correção de privilégio

\`bridge/native-universal.cjs\` agora privilegia SEMPRE o gate \`canSendPacket\` quando o Gateway possui a função (situação do bot real). Mesmo se flags antigas de laboratório estiverem indevidamente presentes, somente as sete chaves revisadas e listeners nativos retornando **estritamente boolean true** podem passar. Flags de laboratório funcionam exclusivamente em bancada desconectada, sem callback. Permissão é testada novamente na confirmação. O código não altera regras de economia ou disponibilidade do Core.

### Provas locais verificadas (Node 22.16.0)

- **17/17** testes de payload/identidade do coletor do abrigo, com depósito, retirada, troca, ordem original, duplicatas e contrato inválido.
- **4/4** testes de ponta a ponta na ponte local \`Gateway + Store SQLite + Presenter\` com \`FakeCore\`, confirmando dupla etapa, segundo token, índices, bloqueio de replay e de outro jogador.
- **8/8** testes de fronteira LAB/WhatsApp, listener ausente ou revogado, código de outro UUID e cancelamento.
- Total dos três arquivos **29/29**, sem falhas/skip/todo, usando montagem isolada de fontes de distribuições anteriores e alterações correspondentes da branch. Essas contagens **não substituem regressão completa na HEAD GitHub**, nem confirmação Core/MariaDB/WhatsApp real. O ensaio ampliado com fontes antigas V2.1 misturadas à V3.0 deu 82/89; os sete não passam por dependências/código da beta antiga e não são atribuíveis com segurança à HEAD atual. Registrar esse limite, não declarar CI aprovado.
- Os três arquivos \`pet-transfer-collector.test.cjs\`, \`pet-transfer-gateway.test.cjs\` e \`native-live-safety.test.cjs\` estão versionados no PR e listados na matriz do workflow. O GitHub Actions ainda requer runner disponível; execução remota não aprovada.

### Próximos gates reais

1. Reconstruir exato \`HEAD\` de todo o código beta para regressão completa (sem misturar \`entrada.cjs\` V2.1 com módulos V3.0).
2. Tratar envio seguro e consentimento de **dois participantes** para venda de pets, convites de guilda, amistosos e outras ações de terceiros, com destino validado e respostas invertidas/replay.
3. Verificar estabilidade cold-start MariaDB, reinício do bot e grupos quando Termux estiver livre.
4. Gerar apenas um pacote consolidado de instalação com hashes, rollback e smoke tests, nunca liberar por microversões.

## 18/11 — Testes de privacidade em respostas concorrentes

A suíte `multiuser-routing.test.cjs` adiciona **quatro cenários E2E de adaptador** com `Gateway + Store (SQLite real descartável) + Presenter` e `FakeCore`: pedidos simultâneos de dois jogadores com respostas invertidas, chave `keycloakId` trocada, resposta duplicada/tardia e resposta sem `frontEndSubOrigin` rastreável. Cada resposta precisa manter a conversa do `wa` autorizado; um UUID errado não encerra o pedido de outro jogador e mensagens atrasadas não reabrem o menu. Os quatro casos passaram localmente.

A regressão focada nova somou **33/33 PASS, 0 falhas**, combinando `pet-transfer-collector.test.cjs` (17), `pet-transfer-gateway.test.cjs` (4), `native-live-safety.test.cjs` (8) e `multiuser-routing.test.cjs` (4). O material foi executado em Node 22.16.0 usando uma montagem local V27/V30 com ajustes equivalentes à branch, não o `HEAD` integral autenticado. Não confundir esse conjunto de testes com a regressão global de dezenas de suites nem com uso WhatsApp, MQTT e MariaDB real.

O CI do GitHub inclui os quatro arquivos de teste, mas continua sem runner; não existe prova remota verde. O teste multiusuário atual trata **correlação de respostas de solicitações independentes**, NÃO resolve ainda o desafio de notificar o segundo participante de uma venda, convite ou promoção de guilda. A ausência de direcionamento seguro das notificações entre dois jogadores continua bloqueando essas ações.

**Acesso ao celular do usuário continua dispensado**. PR#6 permanece draft; instalar somente um pacote consolidado depois de testes com fontes exatas, smoke real e rollback documentado.

## 18/11 — destinatário verificável e decisão privada em transações de dois jogadores

**Nenhum WhatsApp real foi acionado.** Fontes e testes somente no PR#6.

Auditoria direta do Core original 6.2.0.b: `GuildInviteCommand` constrói `ReactionCollectorGuildInviteData` com `guildName` e `invitedPlayerKeycloakId` e, no Core, autoriza os dois participantes a reagir; `PetSellCommand` constrói `ReactionCollectorPetSellData` com `sellerKeycloakId`, `buyerKeycloakId?`, `price` e `pet`, e sua lógica exige que o comprador seja quem aceita (vendedor só cancela). A ponte anterior atrelava menus apenas ao pedido do iniciador. Isso **não** comprova consentimento do outro jogador.

Implementado `bridge/two-party-collector.cjs`, uma política que interpreta EXCLUSIVAMENTE esses dois coletores, valida os formatos/reaction indexes originais e localiza o destinatário por **um único vínculo UUID→JID do registro beta**; destinatários ausentes, com alias ambíguo, UUID divergente, venda sem comprador explícito, dados/preço incorretos, reação duplicada/contaminada e menu expirado falham fechados. O coletor é armazenado exclusivamente na conversa privada do destinatário, não do iniciador, com atributo `restrictedToPlayerId`. Respostas numéricas e `/menu` verificam UUID atual; mesmo que o vínculo mude, ninguém herda a escolha antiga. Opção Accept exige uma prévia com código de uso único emitido pelo SQLite, Refuse respeita índice nativo. O Core revalida elegibilidade, papéis, economia e efeitos; nada é calculado ou mutado pelo adaptador.

`bridge/gateway.cjs` agora intercepta esses coletores nativos antes de chamar o Presenter padrão. Nunca oferece o botão de aceite a quem abriu o convite ou a venda. Só oferece ao destinatário quando o binding é único, não há outro menu ativo nem requisição aguardando Core, e a resposta pertence ao requestId+UUID do iniciador. Se não puder entregar, não inventa um destinatário ou publica em grupo: mostra ao iniciador uma mensagem de indisponibilidade e permite o timeout natural do coletor oficial. Não executa recusa automática nem reação fictícia. `bridge/store.cjs` ganhou apenas a consulta read-only `hasPendingRequest(wa)`, sem migração/destruição de dados.

Provas locais Node 22.16.0 com Store SQLite real DESCARTÁVEL, Gateway/Presenter/bridge locais e FakeCore: **16/16** casos do contrato de identidade e **12/12** casos de transferência do coletor entre WhatsApps (aceite pelo destinatário, nonce único, recusa, vendedor separado, buyer explícito, alias ambíguo, destinatário ocupado, UUID trocado, resposta forjada/duplicada): **28/28**, todos PASS. Suite focada combinada com transferência de pet, autorização LAB e correlação de respostas: **61/61** PASS. Os dois arquivos de testes foram versionados no PR#6 e adicionados ao workflow GitHub. **São testes offline de uma bancada reconstruída**, não uma aprovação de CI remoto, nem E2E de Core/MQTT/Baileys. CI continua falhando antes de disponibilizar runner.

**Não liberar ainda os comandos para CRIAR novos convites e ofertas pelo usuário.** A camada recebimento/decisão está preparada, mas falta o iniciador escolher com segurança a identidade verificada do destinatário sem expor UUID ou telefone e auditar o ciclo completo Core real/concorrência. A venda sem comprador definido permanece explicitamente bloqueada; ela precisará de uma política separada de publicação e consentimento. Não habilitar por env LAB.

Continuidade: implementar fluxo amigável de destinatário sob prova de vínculo e aceitação explícita, validar pelo Core original em sandbox, revisar notificações cruzadas, então integrar ao pacote consolidado final (sem micro-zip), preservando MariaDB, Baileys e o Termux ocupado.

## 18/11 — códigos voluntários de participação para abrir pedidos entre jogadores

**Continua offline, sem instalar no Termux.** A camada de roteamento privado de coletores (acima) passou a ter um caminho de iniciação reversível, com autenticação do destinatário sem publicar UUID nem número de telefone.

### UX e contratos originais

- O destinatário emite `/meucodigo` em conversa privada: `Store.issueRecipientCode` gera `crypto.randomBytes(8)` (16 caracteres hexadecimais), armazena **somente o SHA-256 com prefixo de domínio** no SQLite junto a JID privado, UUID, expiração em 10 minutos e indicador de uso. Gerar outro código revoga o anterior. O WhatsApp não recebe UUIDs, nem o grupo recebe o código automaticamente.
- O remetente usa `/convidarguilda CODIGO` ou `/oferecerpet CODIGO VALOR`, apresentados por `bridge/social-intents.cjs`. O Core não é chamado nesse momento: o Gateway consulta o código, verifica o binding ÚNICO do destinatário e cria uma autorização local. O valor da oferta é apenas o número informado; o Core valida todas as suas próprias restrições de preço e economia.
- A primeira escolha emite prévia com nonce local e não altera nada. A confirmação `/confirmar 1 TOKEN` só despacha `CommandGuildInvitePacketReq {invitedPlayerKeycloakId}` ou `CommandPetSellPacketReq {price,askedPlayer:{keycloakId}}` depois de validar disponibilidade do handler, identity match, digest do menu, validade e consumo do código **atomicamente na mesma transação SQLite** que consome a prévia. Só uma transação concorrente pode usar o código. Se o Core indisponível após o commit, não é feito reenvio automático.
- Quando o Core retorna `ReactionCollectorGuildInviteData` ou `ReactionCollectorPetSellData`, `bridge/two-party-collector.cjs` só entrega o coletor ao convidado/comprador verificado. A decisão é deles; o remetente não ganha opção de aceitar em nome do outro. Aceitar requer outra prévia/nonce de um único uso. Recusar mantém índice oficial sem atribuir recompensa, dinheiro ou adesão falsos.
- A ajuda passa a listar os comandos sociais segundo o registro real de handlers. Mesmo assim **não se trata de homologação end-to-end**, pois ainda não foi executado o transporte real MQTT/Baileys com os dois jogadores.
- Venda aberta/sem comprador identificado continua bloqueada. O fluxo de códigos é um adaptador voluntário de identidade para WhatsApp, não uma nova economia ou guilda.

### Testes

- `social-intents.test.cjs`: 8 contratos de comandos, payload oficial, código, expiração, preço e UUID.
- `social-gateway.test.cjs`: 9 testes com Gateway/SQLite/FakeCore: emissão de código, convite/pet sale após prévia, single-use em pedidos simultâneos, revogação de código, mudança de binding, código inválido, handler ausente e cancelamento sem envio.
- Regressão focada completa da bancada (Node 22.16.0, módulo Bridge reconstruído): **78/78 PASS, 0 failed**, correspondentes aos 16+12 da camada privada, 8+9 da iniciação social e 33 de abrigo/privacidade/permissões anteriores. A suite foi executada em arquivo SQLite descartável, sem Core, MariaDB, MQTT, Baileys ou personagens reais. Todos os arquivos novos foram versionados na branch e incluídos no workflow, mas **não houve CI verde** e a regressão integral do HEAD ainda precisa ser repetida em ambiente exato.
- Nenhum outro bot, banco, sessão de WhatsApp ou configuração do usuário foi modificado.

### Próximos gates

Auditar o ciclo completo com duas identidades/duas conversas nos handlers oficiais reais, incluindo expiração, notificações após aceitar, transações irreversíveis e reconexão, antes de marcar esses recursos como disponíveis no produto instalado. Manter PR#6 draft; preparar somente uma distribuição consolidada, não pacotes por comando.


## 18/11 — combate, cidade e ofertas da jornada (consolidação)

Fonte de verdade: Crownicles 6.2.0.b @64d08c05f11949029317341735f6f73024f19f9b, contratos TypeScript, handlers de Core e catálogos Lang/pt. PR #6 continua draft; V3.0 instalada, demais bots, sessões e dados não foram alterados.

- `bridge/reviewed-world-collectors.cjs`: 4 tipos de combate (Fight, PveFight, FightChooseAction, FightPet), 28 classes de reação da cidade e 4 tipos de oferta (BuyHeal, Cart, Gardener, GoToPVEIsland). Dados malformados, duplicados ou sem correspondência com snapshot original não passam para fallback/LAB. Preserva ordem e índice; valida ownership do lutador, ações originais e moeda, preço, saldo, elegibilidade, posição do item, quantidades e acesso remoto quando aplicáveis. FightPet é evento de animal selvagem, não um combate de pets. Ações de turno não ganham prévia extra; aceites e mutações usam confirmação. Localização usa name_one real do upstream, admite none e distingue refeições, quartos, slots e mestre de missões. Se a carona oculta destino, nenhum ID/tipo/nome oculto vai ao jogador. Ilha cobra gemas; jardineiro e tratamento, moedas. Resultados nativos, nunca sucesso presumido.
- `bridge/presenter.cjs`: caminho dedicado anterior a qualquer fallback, guarda de turnos alheios sem substituir menu prévio, restrição persistida de jogador e reuso de Gateway existente. `lote04.cjs`: missionManager e lookup com propriedade própria. Novos caminhos não recriam mecânica, carteira, RNG, loot ou viagem.
- Testes versionados: `reviewed-world-collectors.test.cjs` (39), `reviewed-world-presenter.test.cjs` (26), `collector-coverage.test.cjs` (7). Suites de Presenter executadas recuperando 19 módulos reais do GitHub no commit bb3f91a3b421b8a00d8e14502481f5d719f28e65 e simulando somente infraestrutura e Store; unitários/inventário novamente em 7ad68675e8915a6a69bd6d4ae1b5b6cb76f0975c. **72/72 PASS** no harness V8 isolado, não equivalem a Node/SQLite/Core/MQTT/Baileys completos. Workflow atualizado para os testes; CI integral ainda não homologado.
- Inventário: 54 tipos concretos; 22 Presenter principal + 9 world-validated + 3 expedição + 2 privados = **36/54 (66,7%) com caminho específico normal**; 18 adapter-only e 1 classe base. Antes 31/54. Não confundir com 66,7% de conclusão funcional. Estimativas de produto mantidas ~50% beta ±10pp e ~40% com site ±10pp, até regressão completa e critérios reais de aceite.
- Próximos gates: ItemChoice/lojas/eventos que dependem de inventário e efeitos, especialmente GobletsGame (dados de estratégia originais e recompensa item), Witch e Altar; não liberar parcial que deixe escolha de item inacessível. Revisar loteria, demais adapter-only, regressão de HEAD, CI, sandbox de Core/MariaDB/MQTT e depois validação WhatsApp com dois jogadores e rollback. Sem microlotes de instalação.


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
