# Crownicles beta privada — Termux / WhatsApp

Versão inicial de **instalação para teste**, ainda sem homologação com Baileys + Core no celular. Reaproveita o Core Crownicles 6.2.0.b original que já está compilado no seu Termux e a ponte WhatsApp testada anteriormente, sem copiar nem modificar o código original do jogo.

## O que roda

- MariaDB **privado** com banco `crownicles_beta_game` **persistente**, criado dentro de `~/crownicles-whatsapp-lab/crownicles-beta/mariadb-private`. Não o remove ao fechar. Nunca reutiliza o banco de produção ou o banco efêmero dos testes anteriores.
- Broker Mosquitto privado em `127.0.0.1` com porta aleatória, MQTT `main.js`/`PacketUtils` originais e gateway da ponte Crownicles.
- `Core.init()` completo continua bloqueado para evitar ativar cron, servidor e serviços que não foram homologados; os comandos básicos são registrados e executados pelo motor original.
- Sessão Baileys **reutilizada** do Pinguino/Crownicles: a instalação procura `infra/wa-baileys-session-w3-fix` e depois `infra/wa-baileys-session`, validando `creds.json` registrado e copiando a sessão para `crownicles-beta/baileys-auth` sem alterar a original. Nunca copia a sessão de Clover ou outro bot. Pareamento novo está bloqueado neste instalador.
- Cadastro e grupos em SQLite dentro da mesma pasta persistente. O bot é pareado com uma **linha diferente da do proprietário**.

## Como instalar

1. Baixe o ZIP de instalação no ChatGPT.
2. Copie o bloco de comando fornecido no ChatGPT para o Termux; ele confere SHA256, extrai os fontes num diretório exclusivo e executa `bash setup.sh`.
3. A instalação procura a sessão Crownicles **já conectada**; se não localizar, PARA sem solicitar novo pareamento. Informe dois telefones somente no Termux: número **DO BOT** e número **DO DONO**, com DDI/DDD e sem `+`. Devem ser diferentes.
4. O instalador confere se o número do bot corresponde à sessão Pinguino já registrada, instala as dependências Baileys em sua pasta privada e inicia a beta. **Não gera código nem QR de pareamento**; se a sessão antiga não for válida, interrompe e solicita diagnóstico, sem reautenticação automática.
5. Depois de `WHATSAPP_BETA=CONECTADO`, o dono entra no grupo escolhido e manda `/ativar`. Cada amigo manda `/cadastro` e depois `/jogar`. As respostas de aventura/perfil inicialmente saem **no privado**, mesmo quando o comando for enviado no grupo.

## Comandos

| Comando | Resultado |
|---|---|
| `/cadastro` | cria personagem e itens iniciais do Crownicles (explicitamente) |
| `/jogar` ou `/aventura` | jogo original, eventos e viagem |
| `/menu`, `1`, `2`, ... | ver e responder às escolhas |
| `/perfil`, `/inventario`, `/missoes` | estado do jogador no Core |
| `/ajuda` | lista básica |
| `/ativar` | somente dono e dentro do grupo escolhido |
| `/desativar` | somente dono e dentro do grupo escolhido |
| `/grupos` | dono, consulta no privado |

## Manutenção

O instalador roda no **primeiro plano**. Pare com `Ctrl+C`; dados são preservados. Reabra o Termux e execute:

```bash
cd ~/crownicles-whatsapp-lab/crownicles-beta/app
bash start.sh
```

**Não use o runner da V8 como servidor**: ele apaga o banco temporário no final. Para reiniciar a beta, não apague a pasta `crownicles-beta` (o banco persistente e a sessão Baileys estão lá). Não executar duas instâncias do `start.sh` ao mesmo tempo; há uma trava local contra instâncias duplicadas.

## Limites / riscos

- Essa entrega é **candidata a beta**, não já testada com mensagem WhatsApp real: primeiro é necessário conferir os logs do Termux e enviar `/cadastro` de uma linha de teste. Se houver erro, capturar **apenas o texto do erro**, não QR, código de pareamento ou arquivos de autenticação.
- O bot usa Baileys (biblioteca não oficial do WhatsApp): há riscos de desconexão/restrição da conta. Usar **número de teste**, sem mensagens em massa e sem garantias de disponibilidade permanente.
- O processamento não inclui `Core.init()` completo nem todas as rotinas cron; os recursos iniciais não equivalem ao jogo inteiro disponível. Sistemas novos serão liberados em atualizações.
- A beta é resetável mediante decisão do proprietário, mas **não apaga estado a cada execução**. É preciso avisar aos jogadores que moedas, itens e personagens beta podem ser zerados.
- O primeiro log de inicialização pode acusar problemas de compatibilidade Termux/Baileys/MariaDB. Corrigir esses erros específicos; não acessar outros bancos, sessões nem produção.

## Observabilidade

A saída do terminal mostra marcadores como `CORE_ORIGINAL=PRONTO`, `MQTT_ORIGINAL=PRONTO`, `BETA_CADASTRO=HABILITADO`, `BETA_GRUPOS=SOMENTE_ATIVADOS` e, somente após conectar a conta, `WHATSAPP_BETA=CONECTADO`. Isso é **inicialização técnica**, não confirmação de que dois jogadores reais testaram a partida.

## Fontes

`runtime.cjs`, `entrada.cjs`, `integracao.cjs`, 23 fontes originais da ponte em `bridge/`, `setup.sh`, `start.sh`, `package.json` e os 19 testes de entrada/integração já aprovados. Para maior rastreabilidade, nenhum binário ou pacote npm baixado está embutido: o instalador usa npm quando necessário.

## Correção V2.1 — sessão Crownicles existente

Este pacote **não exige parear novamente**: verifica e importa uma cópia da sessão Baileys do Pinguino já existente em `~/crownicles-whatsapp-lab/infra/wa-baileys-session-w3-fix/` (alternativa histórica: `wa-baileys-session/`). A autenticação original não é removida. Nunca iniciar o antigo gateway Pinguino e a nova beta simultaneamente com a mesma conta: isso pode provocar desconexões. O `setup.sh` recusa sessão ausente/não registrada e dados de número divergentes. Arquivos `creds.json` e chaves privadas não devem ser enviados ao chat. Se falhar, enviar SOMENTE a mensagem de erro sem o conteúdo do arquivo.


## Instalação npm 12 / EALLOWGIT — Termux 16/11/2026

No primeiro `bash setup.sh` do usuário, o preflight Crownicles 6.2.0.b passou, a sessão antiga Pinguino foi importada (`SESSAO_EXISTENTE=REUSED`, `PAREAMENTO_NOVO=NAO`), números bot/dono foram informados e a sessão conferiu. A instalação de Baileys 6.7.24 parou no comando `npm install` com `EALLOWGIT` porque `libsignal` é dependência Git transitiva. Isso não prova erro na sessão nem no Core. Não há necessidade de parear novamente ou reinstalar o jogo. Solução imediata apenas dentro de `crownicles-beta/app`:

```bash
npm_config_allow_git=all npm install --omit=dev --no-audit --no-fund && bash start.sh
```

`npm_config_allow_git=all` vale somente para esse comando npm e não configura npm globalmente. É uma exceção de segurança para permitir dependências Git (risco de dependência Git sem commit fixo); não usar como configuração global. Baileys permanece pinado em 6.7.24. A conexão `WHATSAPP_BETA=CONECTADO` e os comandos do jogo real continuam PENDENTES do próximo log Termux, mesmo após uma eventual instalação npm bem-sucedida. **Não armazenar números reais ou conteúdo da autenticação nos registros.**


## 16/11/2026 — Hotfix V2.2: ativação silenciosa de grupos

**Primeiro E2E real homologado parcialmente:** o responsável enviou `/cadastro` e `/jogar` ao Pinguino conectado e recebeu cadastro confirmado e o **evento inicial 61 original com 3 opções**, prazo e numeração. Core, MariaDB persistente, MQTT e Baileys funcionam no privado. **Não** declarar grupos homologados: `/ativar` no grupo não produziu resposta. A mensagem pode estar chegando com JID de remetente `@lid` enquanto o proprietário está na allowlist como `@s.whatsapp.net`; o BetaEntrance V2.1 rejeitava silenciosamente `not-owner`. É hipótese técnica ainda pendente de teste real da V2.2, não causa empiricamente confirmada.

**Correção do runtime:** `group-sender.cjs` identifica PN com dados de origem confiáveis `participantPn`, `participantAlt`, `senderPn`, `participant`; se só existir LID tenta `socket.signalRepository.lidMapping.getPNForLID` sem equiparar números arbitrariamente. Quando não houver PN, impede cadastrar um segundo personagem por LID; para ativação oferece um fallback administrativo por código de uso único. O grupo imprime no terminal somente `GRUPO_CONTROLE_RECEBIDO=SIM`, `GRUPO_TIPO_IDENTIDADE=...`, `GRUPO_COMANDO_RESULTADO=...` ou `GRUPO_AUTORIZACAO=CHAVE_NECESSARIA`, **sem JID, número ou credenciais**.

**Comandos:** usuário proprietário tenta `/ativar` normalmente **dentro do grupo**; se o WhatsApp ocultar o PN, o bot informa alternativa `/chavegrupo` no **privado do proprietário**. A chave temporária, válida por **5 minutos e uma vez**, permite `/ativar CODIGO` no grupo. Para desligar, `/chavegrupo desativar` no privado e `/desativar CODIGO` no grupo; `/desativar` sem código continua liberado se a identidade do dono for reconhecida. O token fica guardado somente como digest SHA256 em SQLite, sem expor valor nos logs; nenhum outro usuário pode emitir chaves. É um fallback enquanto não se consegue a correspondência confiável entre LID e PN.

**Artefato de hotfix V2.2:** [ZIP direto](https://drive.google.com/file/d/1Jbl46TaT4d5eIMizBLQnUPGY2xOL7Ak_/view), **18011 bytes**, SHA256 `121e01cc8c5be214a459d2263a11fa7307c958441dff042dd370db275a9b2d4b`. Contém `apply.sh`, módulos runtime/entrada/group-sender, dois testes e README. O aplicador recusa alteração se runtime ainda estiver ativo (`run.lock`) ou se hashes do código original divergirem; salva backup do código anterior em `crownicles-beta/backups` e não toca **MariaDB persistente, SQLite de jogadores, credenciais Baileys ou binários do jogo**. Verifica sintaxe e roda `48/48 testes Node locais PASS` (inclui integração Gateway/Store com Core simulado). Também foi ensaiada a aplicação e reaplicação idempotente em cópia isolada da instalação V2.1: PASS. Esses 48 não provam autorização real via mensagem de grupo; falta executar no Termux.

**Passos da execução:** no Termux com Pinguino conectado, parar com `Ctrl+C`. Baixar ZIP V2.2 pelo ChatGPT, localizar pelo SHA, extrair numa pasta de patch beta, executar `bash apply.sh` (testa e religa com `bash start.sh`). Esperar `WHATSAPP_BETA=CONECTADO` e enviar `/ativar` pelo dono no grupo. Se pedir chave, usar a alternativa acima. **Jamais rodar Pinguino antigo e beta ao mesmo tempo, jamais parear de novo por causa desse hotfix.**


## 16/11/2026 — Hotfix V2.3: identidade permanente do proprietário + personagem único por conta provada

**Diagnóstico real anterior:** usuário confirmou 3 players ativos no banco Beta (1 JID `@lid`, 2 JIDs `@s.whatsapp.net`) e 1 grupo habilitado. `DONO_TEM_CADASTRO=NAO`, porque JID de remetente real não coincide com configuração do proprietário. O grupo foi ativado pela chave de uso único em SQLite (`GRUPO_COMANDO_RESULTADO=OK`), mas no PV e grupo surgiram relatos de cadastro novamente e 2 UUIDs distintos no Crownicles, sem evidência suficiente para afirmar que todos os registros são da mesma pessoa. Não apagar ou fundir personagens por mera semelhança de número.

**V2.3:** adicionados `owner_aliases`, `jid_aliases` e `admin_claims` ao SQLite Beta com `CREATE TABLE IF NOT EXISTS`; sem sobrescrever dados. CLI local `node admin-link.cjs` (dentro de `crownicles-beta/app`) cria desafio aleatório de 12 bytes (24 hex; apenas SHA256 persistido; 10 minutos), imprimindo comando `/vinculardono CODIGO` apenas no terminal. Enviar no PV do Pinguino comprova o JID PRIVADO do remetente pela posse da chave local e adiciona seu alias ao dono. O bot responde com segundo código `/vinculargrupo CODIGO`, válido por 10 minutos, uma vez; esse segundo comando no grupo comprova e registra o JID de GRUPO observado, ligando-o ao primeiro JID privado. Na sequência `/ativar`, `/desativar`, `/chavegrupo` funcionam sem códigos adicionais, e `/cadastro`, `/jogar`, `/perfil` enviados no grupo usam a UUID do personagem previamente cadastrado no privado, incluindo respostas PRIVADAS. Se antes havia outro personagem cadastrado no JID do grupo, continua salvo intacto: é tornado alternativo, mas não deletado ou fundido. Nenhum terceiro é vinculado sem o token local; rejeita token errado/expirado/usado e conflito de alias. Não divulgue tokens no chat. O grupo precisa estar com a conta correta, pois o segundo token é prova de posse temporária que alguém com acesso ao grupo pode copiar se agir antes; enviar imediatamente.

**Mitigação de privacidade:** runtime mascara `console.log('Closing session:', <SessionEntry>)` de libsignal para não imprimir `privKey` / `rootKey` nos logs; isso não corrige decriptação Bad MAC, tratada como problema separado. Manter auth Beta, banco de jogadores e Core intocados.

**Artefato:** ZIP V2.3, https://drive.google.com/file/d/1FoAYfka_upQN0WlhcQklUXJq8CtrPJFV/view, 18.680 bytes, SHA256 `5588c3689951a332a14d7daeea6787169f72226a03ce3d0d200df1f62b72d4df`. 58/58 testes Node locais PASS (48 regressões + 10 novos), 0 falhas; `bash -n` e `node --check` PASS. Aplicação em CÓPIA da instalação anterior V2.2: PASS, reaplicação idempotente PASS, teste de emissão de token CLI PASS. O aplicador bloqueia escrita se o processo beta ainda estiver rodando, exige hashes exatos da V2.2, salva backup de código/SQLite em `crownicles-beta/backups`, copia só runtime/entrada/CLI/teste, executa testes e inicializa beta. Não atualiza dependências nem gera QR, nem repara sessão. Ainda não testado ao vivo no Android; confirmação WhatsApp real pendente.

**Instruções:** Ctrl+C no Termux principal; baixar ZIP novo do ChatGPT e executar comando de instalação buscando SHA. Após `WHATSAPP_BETA=CONECTADO` em segundo terminal `cd ~/crownicles-whatsapp-lab/crownicles-beta/app && node admin-link.cjs`, enviar primeiro comando obtido no **privado** e segundo comando devolvido pelo bot no **grupo**. Testar `/ativar` no grupo e `/perfil` nos dois contextos antes de liberar novos jogadores. Registro do usuário deve permanecer privado; não enviar chaves nem logs libsignal com buffers.
