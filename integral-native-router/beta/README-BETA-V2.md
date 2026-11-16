# Crownicles beta privada — Termux / WhatsApp

Versão inicial de **instalação para teste**, ainda sem homologação com Baileys + Core no celular. Reaproveita o Core Crownicles 6.2.0.b original que já está compilado no seu Termux e a ponte WhatsApp testada anteriormente, sem copiar nem modificar o código original do jogo.

## O que roda

- MariaDB **privado** com banco `crownicles_beta_game` **persistente**, criado dentro de `~/crownicles-whatsapp-lab/crownicles-beta/mariadb-private`. Não o remove ao fechar. Nunca reutiliza o banco de produção ou o banco efêmero dos testes anteriores.
- Broker Mosquitto privado em `127.0.0.1` com porta aleatória, MQTT `main.js`/`PacketUtils` originais e gateway da ponte Crownicles.
- `Core.init()` completo continua bloqueado para evitar ativar cron, servidor e serviços que não foram homologados; os comandos básicos são registrados e executados pelo motor original.
- Sessão Baileys exclusiva em `~/crownicles-whatsapp-lab/crownicles-beta/baileys-auth`, sem copiar credenciais de Clover ou outros bots.
- Cadastro e grupos em SQLite dentro da mesma pasta persistente. O bot é pareado com uma **linha diferente da do proprietário**.

## Como instalar

1. Baixe o ZIP de instalação no ChatGPT.
2. Copie o bloco de comando fornecido no ChatGPT para o Termux; ele confere SHA256, extrai os fontes num diretório exclusivo e executa `bash setup.sh`.
3. Informe dois telefones somente no Termux: número **DO BOT** e número **DO DONO**, com DDI/DDD e sem `+`. Devem ser diferentes.
4. O instalador verifica o Core, instala dependências Baileys em **sua pasta privada** e inicia a beta. Se o terminal emitir `CODIGO_PAREAMENTO=...`, no WhatsApp da **linha do bot** abra *Aparelhos conectados → Conectar com número de telefone*, e introduza esse código. Não envie o código para ninguém nem publique o log com ele.
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
