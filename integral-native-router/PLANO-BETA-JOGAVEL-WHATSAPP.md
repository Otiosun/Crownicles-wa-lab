# Decisão de produto — Beta jogável contínua via WhatsApp (16/11/2026)

## Decisão explícita do responsável

Após V7 **40/40 homologada no Termux** e durante a execução do runner V8 **47/47 ainda pendente**, o responsável deseja **abrir o bot aos amigos para jogarem continuamente enquanto desenvolvemos**. Os dados são APENAS DE TESTE: reset de personagens, itens e economia é permitido, desde que anunciado. **Priorizar beta jogável em vez de prolongar exclusivamente o laboratório isolado.** Não abandonar o princípio máximo: **Crownicles original integralmente reaproveitado; sem reimplementar mecânicas.** Nome final do RPG ainda não definido.

### Escopo e diferença para o laboratório atual

O laboratório atual testa Core Crownicles 6.2.0.b por MQTT com WhatsApp fictício, banco efêmero apagado ao final, identidades/UUIDs de teste criados por fixture, `Core.init()` bloqueado. Até V7, não existe comprovação de WhatsApp/Baileys real entregando/recebendo pacotes end-to-end. O `integral-native-router/src/gateway.cjs` recusa números desconhecidos no método `receive`: `if(!Object.hasOwn(this.config.bindings,wa))return false`; a criação/vinculação de personagem precisa ser funcional para onboarding. `src/core.cjs` é adaptador MQTT verdadeiro, NÃO um processo de Core hospedado ou cliente Baileys. O `Otiosun/meu-bot-rpg` tem Baileys real, mas é o **Clover** existente, produto independente; **não mesclar nem reutilizar sua sessão/grupos/banco sem autorização específica**. Reutilizar padrões de engenharia apenas, de preferência instalar adaptador isolado no diretório de Crownicles.

## Alvo: beta privada incremental, com reconfiguração simples

- O jogador envia `/cadastro` EXPLICITAMENTE no WhatsApp beta; o adaptador Baileys normaliza número/JID e encaminha ao cadastro persistente. Cadastro cria um UUID e Player/InventoryInfo/InventorySlot no banco Crownicles BETA, sem fixture artificial de evento. `/jogar` só funciona DEPOIS do cadastro e inicia a aventura original pelo ReportCommand. Nada de inscrição automática em `/jogar`. O dono pode enviar `/ativar` ou `/desativar` dentro do grupo específico, somente se o senderJid estiver na allowlist de proprietário; outros grupos seguem desativados e chats privados permanecem disponíveis. `/grupos` no privado lista grupos ativos. O Core original calcula progressão; menus e escolhas renderizados em pt-BR.
- Comandos beta iniciais: `/cadastro`, `/jogar` ou `/aventura`, `/menu`, `/perfil`, `/inventario`, `/missoes`, `/ajuda` e controles do dono `/ativar`, `/desativar`, `/grupos`; aceitar número de escolha do coletor. As mensagens de estado/aventura são inicialmente respondidas no privado mesmo quando o comando chegar em grupo autorizado, para preservar correlação por jogador na ponte. Ampliar comandos só quando operáveis. Exibir mensagem explícita quando função está em desenvolvimento, sem prometer comandos quebrados.
- Banco MariaDB beta exclusivo deve ser **persistente entre reinícios e atualizações** (senão jogadores não conseguem continuar a sessão), **mas descartável por reset conscientemente anunciado**. Não apagar toda vez que o processo encerra. Reset individual e geral com comando administrativo isolado, com confirmação e sem afetar outros projetos; não preservar histórico de jogador definitivo.
- Uma única instância de Core original em execução, um broker MQTT de beta, uma única sessão WhatsApp beta e um único gateway: não iniciar múltiplos sockets Baileys no mesmo número e não acoplar à instalação Clover/Cidade Dorme/Pokémon.
- Executar como release beta em diretório e perfis próprios, com PM2/Termux conforme compatibilidade comprovada, QR/pareamento apenas mediante ação explícita do responsável; não exportar `auth_info` nem dados sensíveis. O WhatsApp com biblioteca não oficial pode desconectar/ter limitações ou bloqueio: preferir número de teste, evitar automações massivas, permitir pausa e reconexão. Nunca oferecer garantia de ausência de banimento.
- Logs mínimos úteis e sem segredos; `/status` do admin para confirmar Core/MQTT/baileys, controle de crash/restart sem reenvio cego de operações mutantes. Mostrar incerteza em caso de timeout: solicitar `/perfil` em vez de disparar a operação de novo.
- No futuro adicionar site e funcionalidades integrais do Crownicles; **não** bloquear a beta inicial por site/Keycloak complexo se o motor puder receber identidade beta coerente e autorizada.

## Sequência prática curta de lançamento

1. **Inventário read-only Termux e isolamento:** verificar serviços ativos (nó, Mosquitto, MariaDB, Baileys), porta e diretório do Core instalado, espaço/CPU, sessão WhatsApp disponível, evitar colisão com outros bots. Sem expor senhas e QR. V8 laboratório pode continuar em paralelo, mas não fornece automaticamente servidor persistente.
2. **Instalador único da beta e smoke local sem WhatsApp:** criar instância Core original com config explicitamente beta, MariaDB dedicado PERSISTENTE mas resetável, MQTT para gateway, entrega simulada e onboarding real (novo número→UUID→Player), comandos iniciais; persistência teste após reinício e idempotência/reconciliador das operações.
3. **Conexão Baileys beta real:** receber evento WhatsApp só para grupo/números allowlist inicialmente; responder efetivamente por WhatsApp, emitir QR/pareamento apenas no terminal; não usar sessão do Clover; ensaio ponta a ponta com responsável e um amigo.
4. **Liberar amigos + atualizações atômicas:** grupo de teste com aviso de reset; atualizar apenas ponte sem resetar DB quando possível; quando mudar esquema, anunciar `reset`; manter relatório de bugs / pedidos e status de recursos. No início 5–10 testers ou número pequeno controlado; aumentar após medir.
5. **Iterar no produto:** priorizar fluxo divertido da aventura, decisões, progressão real, feedback e exploração, antes de ampliar auditoria de integração de todo recurso. Reutilizar os módulos e pacotes Core reais; bots de teste não são contas de produção.

## Critérios mínimos para abrir beta

- O proprietário consegue parear a sessão beta num número próprio ou expressamente destinado ao teste.
- Dois números de teste se cadastram sozinhos via WhatsApp, entram no Crownicles real, recebem escolha e têm avanço separado;
- `/jogar`, `/menu`, `/perfil`, `/inventario`, `/missoes` retornam dados reais e mensagens em pt-BR;
- O processo reinicia mantendo o banco beta e a associação dos números sem duplicar recompensas;
- Pausa, desconexão e reenvio não duplicam ações mutantes, sem mexer em Clover, outros bots ou serviço de DB compartilhado.
- Testers recebem aviso: 'BETA DE TESTES — progresso, itens e moedas podem ser reiniciados sem aviso individual. Não compre nada; reportem bugs.' (Texto final a aprovar).

## Estado atual exato

**Não foi criada nem ligada uma sessão WhatsApp real neste lote** e **nenhum instalador beta jogável foi instalado no Termux**. Este documento é decisão e plano de corte. A criação de pacote beta executável será outra entrega, validada por logs reais; V8 pode ser testada em paralelo e não é impedimento conceitual à beta. É permitido redefinir estado dos jogadores DE TESTE, mas isso não autoriza acessar ou apagar bases de outros projetos/produção.

Diário Mestre Komekko: https://docs.google.com/document/d/1p6yD3vVhAP_sCNsAA8gl2tCWB4OsU0xaSFBLaC7Ztoo/edit


## Implementação inicial registrada após homologação V8 47/47

- V8 homologada pelo responsável em 16/11/2026: 47/47 PASS real, 7/7 novos, duas escolhas simultâneas em jogadores distintos, deduplicação/persistência e LAB_SAIDA=0. Isso NÃO liga Baileys real.
- `beta/entrada.cjs`: Node 22 `node:sqlite`, tabelas `players(jid,uuid,state)`, `groups(id,enabled)`, `seen(id)`; `/cadastro` explícito, idempotência de UUID pendente após falha e reinício, `/ativar`/`/desativar` por grupo só dono, privado sempre permitido e mensagens pessoais no privado. `makeCoreRegistration` usa `Player.findOrCreate`, `InventoryInfo.findOrCreate` e `InventorySlot.findOrCreate` do Core original, sem forçar eventos 60/61.
- `beta/integracao.cjs`: conecta a entrada a `Gateway` e `Store` originais da V8. Associa UUID ao jogador no roteador, recupera vínculos após reinício. Não inicia sessão WhatsApp nem servidor Crownicles por si só.
- Testes `beta/entrada.test.cjs` 16/16, `beta/integracao.test.cjs` 3/3 usando Gateway e Store reais + Core simulado, **19/19 PASS**, 0 falhas; 23 fontes do bundle V8 verificadas SHA256. Não afirmar homologação de Baileys+Core; isso é o próximo gate do produto.
- ZIP de fontes completo, 23 arquivos ponte e 19 testes: https://drive.google.com/file/d/1FFD7PSbuqTIq_PHkPPom6CoBWxN_Ldq3/view — SHA256 `71e186a2cb8a298b1f26913cd1e71366ccf412df7425198262d5f900efe75975`.
