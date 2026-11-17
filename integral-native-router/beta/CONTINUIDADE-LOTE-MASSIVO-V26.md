# Crownicles WhatsApp — Continuidade do lote massivo (16/11/2026)

## Situação comprovada pelo responsável no WhatsApp
- V2.3: vínculo admin privado + grupo concluído após renovar a segunda prova; `/ativar` retorna `GRUPO_COMANDO_RESULTADO=OK`.
- V2.4: `/ajuda` agora responde publicamente no grupo. **Este é o último comportamento confirmado no Termux real.**
- A sessão Pinguino, o banco beta, o grupo ON, personagens e chaves Baileys **não foram modificados** pelas tarefas nesta branch.

## Código desta branch experimental (não implantado)
- V2.5: comandos de informação `/ajuda`, `/comandos`, `/grupo` e `/regras` públicos em grupos habilitados. Fichas e aventura privadas. Limpeza de IDs de mensagem antigos da tabela `seen` sem tocar players/groups/aliases.
- Endurecimento PN/LID: `group-identity-policy.cjs` admite mensagens de informação pública de LID sem PN, permite chegar ao validador existente para `/ativar`, `/desativar` e `/vinculargrupo`, e permite jogo somente para alias já **comprovado**. O módulo **não concede proprietário**; a autorização é do `BetaEntrance`.
- Origem de pedidos do Core: `context-dispatch.cjs` agora registra de forma privada `requestId + playerUUID + chat` na entrada rastreável `integracao.cjs` e encaminha o pedido ao Gateway original. Não altera destinatário da saída. IDs conflitantes não executam de novo; requisições falhas liberam a entrada do índice.
- `response-context.cjs` conserva contexto temporário (TTL/capacidade) e exige visibilidade explícita `group-info` e grupo ON em dois pontos. **Sem publicações automáticas do Core nesta versão.**
- Testes acrescentados para LIDs, requisições duplicadas, falha síncrona/assíncrona, retomada da mesma personagem e colisões entre grupos.

## Estado honesto da validação
- Laboratório Node 22 local isolado: 20/20 testes da política LID, 9/9 do wrapper de contexto e 8/8 cenários de `group-sender` executados contra uma cópia do resolvedor com a mesma normalização de JID. **37/37 checks locais**, sem Core/MQTT/Baileys.
- Testes completos `entrada.test.cjs`, `owner-link.test.cjs` e `response-context.test.cjs` na branch: **sem execução completa confirmada**. Os novos casos de integração LID foram registrados, mas não homologados.
- GitHub Actions: várias execuções associadas ao PR terminaram em `failure`, e a consulta de jobs devolve `steps: null`; até se identificar a causa, **CI = NÃO APROVADA**. Não presumir que o código passou nem que o erro foi causado pelo código.
- Adaptador `integracao.cjs` carregará `bridge/gateway.cjs` e `bridge/store.cjs` da instalação atual; essas dependências originais não foram localizadas como código versionado nesta branch. **A regressão real Core/MQTT e a saída correlacionada ainda não foram verificadas.**
- Esta branch **não** deve ser instalada diretamente no Termux, fundida à branch base ou apresentada como homologada.

## Próximas etapas técnicas por ordem de dependência
1. Inventariar e tornar auditáveis os 23 arquivos do bridge original, preservando SHA/contrato e autorização para uso; não reconstruir o Core.
2. Observar no gateway original onde `message ID/request ID`, UUID, `frontEndSubOrigin`, MQTT e outbox são conservados; bloquear qualquer fallback de “último grupo/último jogador”.
3. Integrar a correlação também **na saída**, com visibilidade `private` padrão; só respostas públicas explicitamente liberadas podem ir ao grupo. Não divulgar ficha, inventário, tokens ou progressão privada.
4. Exercitar 2 grupos × 2 jogadores, respostas invertidas/atrasadas, falhas de envio, duplicatas, reinício, LID/PN e grupo OFF em testes que usem a ponte original.
5. Ampliar a matriz dos pacotes **já existentes** no Crownicles: `CommandReportPacketReq` (jornada/evento), `CommandProfilePacketReq`, `CommandInventoryPacketReq`, `CommandMissionsPacketReq` e `ReactionCollectorReactPacket`. Inventariar equipamento, combate, expedição, economia, missões e social a partir dos handlers compilados antes de expor comandos.
6. Localizar integralmente o conteúdo nativo para PT-BR mantendo chaves, placeholders e narrativa original compatíveis; nenhuma mecânica Pilgram redundante.
7. Integrar site e WhatsApp ao **mesmo** Core e progressão; não criar personagem/carteira paralelos.
8. Gerar patch autocontido com verificação de hashes, backup+rollback e instalação exclusivamente quando o usuário retornar e consentir; nada de segundo Baileys/repareamento, nem apagamento SQLite/MariaDB.

## Regra de continuidade
Manter PR em rascunho até termos CI verde, pacote de bridge auditado, regressão real e confirmação no WhatsApp. Não confundir “Código salvo” com “Jogo atualizado no telefone”.
