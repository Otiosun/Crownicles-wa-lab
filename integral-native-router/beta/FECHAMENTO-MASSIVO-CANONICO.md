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
