# Crownicles original — integração por famílias V2 (laboratório isolado)

**Fonte:** Crownicles/Crownicles 6.2.0.b, commit `64d08c05f11949029317341735f6f73024f19f9b`.  **Data:** 16/11/2026.

## Meta do produto (inalterada)

Portar o **Crownicles inteiro** (todos os recursos originais úteis/estáveis/compatíveis), e não criar RPG inspirado ou limitado. WhatsApp e site devem acessar o **mesmo motor Crownicles original**; localização pt-BR existente deve ser reaproveitada. O jogo ainda **não tem nome final**. Não instalar ou iniciar segunda instância do bot/WhatsApp/Core. Não habilitar ações mutáveis na instância real antes de homologação de MQTT/Baileys/site e regra de idempotência/reconciliação.

## O que entrou nesta entrega V2

- **12 contratos de acesso nativo**, dos quais **8 novos** em comparação à base V1.1: `CommandGuildDescriptionPacketReq`, `CommandGuildLeavePacketReq`, `CommandGuildElderRemovePacketReq`, `CommandGuildKickPacketReq`, `CommandPetFreePacketReq`, `CommandPetTransferPacketReq`, `CommandFriendlyFightPacketReq`, `CommandUnlockPacketReq`. O motor original continua determinando autoridade, custo, tempo de espera, sucessos e efeitos.
- O parser compartilha schema e validação para 5 formatos de argumento (`none`, `self`, `guildName`, `description`, `rank`). Não aceita pacote arbitrário, parâmetros JSON, IDs falsos ou privilégio administrativo.
- **8 coletores de confirmação originais auditados**: criação de guilda, descrição, saída, remoção de ancião, expulsão, libertação de jogador, libertação de pet, confirmação de libertação de pet no abrigo. Preservam a ordem de índices original e validam formato dos dados.
- **Confirmadores que não identificam destinatário por nome verificável ficam bloqueados**, mesmo no laboratório: expulsão, remoção de ancião e libertação de outros jogadores. O Core só fornece UUID nesses coletores. A identidade deve ser vinculada e exibida corretamente antes de permitir qualquer aceitação; cancelamento segue disponível.
- Saída de guilda exibe possibilidade de **DESTRUIÇÃO** quando `isGuildDestroyed=true`. A confirmação local do pedido e a confirmação posterior do Core são diferentes, cada uma com seu nonce. O Core ainda executa a ação somente após a segunda resposta.
- O renderizador reconhece os retornos e bloqueios originais auditados de guilda, pets, expedições, combate amistoso e libertação. Não inventa recompensas no caso de resposta vazia ou não conclusiva.
- `tools/audit-integral-coverage.cjs` mede automaticamente os módulos do Core original, pacotes, coletores e referências da ponte com avisos explícitos sobre diferença entre **declarado / mencionado / interagível / homologado**. Lê código-fonte apenas; não abre rede nem banco.

## Provas e limites

- **849/849 testes Node 22 PASS** nesta cópia; **820** eram a regressão anterior e **29 novos** cobrem roteamento, schemas, identidade, preservação do índice de reação, dupla confirmação, bloqueio de ações sem nome e inventário seguro.
- **A V1.1 anterior permanece homologada nativamente no Termux: 27/27**, com Core 6.2.0.b, MariaDB e SQLite, sem Baileys ou MQTT real. **Os novos casos V2 ainda não rodaram com Core nativo no Android**; os testes V2 usam um FakeCore para respostas. Nunca confundir `849/849` com homologação do RPG completo.
- Há **48 pacotes de comando decorados** encontrados no scan anterior do Core. A V2 tem **12 rotas nativas declarativas**; existem rotas legadas também, porém a contagem não é cobertura funcional nem porcentagem de jogo pronta.
- Os **56 módulos de coletores** do Crownicles incluem muitos estados com opções bloqueadas no WhatsApp; os oito novos descritores não transformam isso automaticamente em 56 mecânicas completas.
- `ReactionCollectorPetTransferData` e `ReactionCollectorPetFreeSelectionData` continuam incompletos para permitir transferência/libertação através do abrigo. O comando inicial pode ser solicitado no **LAB**, mas as opções de segundo nível sem validação não são enviadas ao Core.
- Não foi testado MQTT real, retransmissões perdidas, Baileys, WhatsApp real, site/Keycloak, reinício do MariaDB ou launch de produção. A instância live atual foi preservada.

## Próximos dois gargalos globais

1. Resolver autenticação/identificação do jogador-alvo com nome verificável, e serializar/validar todos os coletores restantes como escolha segura (sem permitir efeitos desconhecidos).
2. Homologar uma vez o transporte MQTT isolado e o Baileys sem produção, com deduplicação/reconciliação para não repetir operações irreversíveis quando a resposta se perde. Reaproveitar módulos web originais no site.

**Artefato:** esta pasta é uma cópia isolada do laboratório; não copiar `src/` sobre `.run/wa-gateway` nem executar `Core/src/main.ts` no ambiente ativo.

### Como executar teste local Node22, em uma cópia isolada

```bash
node --test test/*.test.cjs
```

Para emitir inventário em um ambiente que possua o código original descompactado:

```bash
node tools/audit-integral-coverage.cjs "$HOME/crownicles-whatsapp-lab/crownicles-dev"
```

**Atenção:** a análise por referência de pacote é apenas um limite inferior, não valida a funcionalidade no WhatsApp. O instrumento não lê credenciais, dados dos jogadores, sessões ou banco SQL.
