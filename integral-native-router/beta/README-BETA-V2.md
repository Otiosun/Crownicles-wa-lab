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
