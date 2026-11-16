# Crownicles — Entrada da Beta V1

**Módulo funcional e testado, ainda NÃO é um bot WhatsApp instalado ou conectado.** É a primeira peça de código reutilizável para o beta jogável: cadastro explícito e ativação por grupo, sem criar um RPG paralelo ao Core original.

## Comandos implementados

- `/cadastro` — cria idempotentemente uma identidade UUID vinculada ao JID do jogador; chama criação nativa de Player, InventoryInfo e InventorySlot originais. Não injeta os eventos de teste 60/61. Deve ser concluído antes de `/jogar`.
- `/ativar` e `/desativar` — somente JID do dono configurado; executados no próprio grupo. Outros grupos permanecem desativados.
- `/grupos` — só dono no privado, mostra grupos ativos.
- `/ajuda` e `/comandos` — comandos básicos e aviso beta.
- `/jogar`, `/aventura`, `/menu`, `/perfil`, `/inventario`, `/missoes` e opções — encaminhadas à ponte original **somente após cadastro**.

Para a primeira integração, mensagens de perfil, eventos e cadastro são direcionadas **ao privado do jogador**, mesmo quando o comando chega em grupo habilitado. Isso evita expor fichas e respostas quando houver requisições simultâneas; a escolha de publicar eventos no grupo exige refinar o correlacionamento da outbox por chat antes de ser liberada.

## Contrato de integração do runtime real

`const {BetaEntrance,makeCoreRegistration}=require('./entrada.cjs')`.

O runtime deve passar:
- `dir`: diretório absoluto **próprio da beta**, persistente entre reinícios (não dentro de temp apagável).
- `ownerJids`: um ou mais JIDs controlados pelo usuário, verificados pela sessão Baileys; não devem ser inferidos de grupo/username.
- `createPlayer: makeCoreRegistration({Player,InventoryInfo,InventorySlot,ItemCategory})`, com as classes ORIGINALMENTE carregadas e conectadas ao DB Crownicles **BETA**, nunca produção.
- `dispatchGame`: vincular `playerJid`/`playerUUID` em `Gateway.config.bindings` e então chamar `Gateway.receive(id,playerJid,text)`.
- `send`: enviar mensagens ao JID passado, com Baileys beta dedicada.

`handle({id,chatJid,senderJid,text,fromMe})` retorna `{handled:true,...}` ou `{handled:false,reason}`. O adaptador Baileys **não vem acoplado** para evitar iniciar uma sessão/conta sem autorização. A sessão precisa de um número de testes, sem reutilizar as credenciais de Clover/Cidade Dorme.

**Persistência:** `beta-access.sqlite` próprio com status `pending` antes da criação original; reexecuções com erro de DB usam o MESMO UUID. Deduplicação de IDs de mensagens e lista de grupos por JID. Um reset consciente do DB beta é permitido, mas é essencial não apagá-lo a cada encerramento.

**Segurança mínima mesmo no beta:** não há necessidade de defender progresso econômico definitivo, mas não misturar sessões de WhatsApp, números sem consentimento, bancos de outros projetos ou logs de credenciais. Não usar `Core.init()` de produção em cima de ambiente compartilhado.

## Provas

`node --check entrada.cjs`

`node --test entrada.test.cjs`

16/16 PASS no Node 22, usando SQLite real (nativo Node). O helper de criação usa modelos Core com doubles no teste: **a execução do handler original com MariaDB e a ligação Baileys real permanecem pendentes**.

**Próximo passo técnico:** integrar em servidor de beta persistente, com banco Crownicles beta isolado, MQTT original, sessão Baileys exclusiva e teste de mensagem real de um responsável e um amigo. Não anunciar beta como disponível antes desse gate.

## Gateway de produção em preparação (entrada.cjs + integracao.cjs)

`integracao.cjs` reutiliza literalmente os `Gateway`/`Store` originais do bundle da V8, registra o vínculo novo após `/cadastro` e recarrega vínculos após reinício. A outbox do Gateway entrega respostas pelo **JID do jogador no privado**. A biblioteca `bridge/` inclui os **23 arquivos originais da ponte aprovados na V8** (mesmo SHA-256). Nenhuma credencial/sessão WhatsApp é distribuída.

Testes de integração adicionais em `integracao.test.cjs` usam **Gateway + Store reais** e Core simulado para exercer `/cadastro → /jogar → send`, dois jogadores em grupo e reinício com SQLite persistente. Foram **19/19 testes locais aprovados** (16 unitários, 3 integrados), 0 falhas. Essa prova NÃO substitui teste no Android com Core e Baileys reais.

### Limites para a próxima etapa

O runtime precisa iniciar uma **instância persistente de laboratório/beta do Crownicles** com MariaDB e MQTT isolados, sem apagar a pasta DB a cada saída. Depois integrar uma **sessão Baileys beta exclusiva**, opção do grupo ativa por dono e o `handle(...)` desta entrada. Não executar a infraestrutura `V8` existente como servidor, porque ela *é um runner descartável* e executa `cleanup()` após os 47 testes. Não usar o token/sessão do Clover.
