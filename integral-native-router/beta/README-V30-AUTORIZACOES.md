# Crownicles WhatsApp — Beta V3.0 (autorizações originais W3)

O lote parte da **V2.9 instalada e ativa**; Core oficial 6.2.0.b e banco persistente permanecem intactos. Recupera quatro solicitações originais mediante **duas etapas de autorização**: `/renascer`, `/recompensaliga`, `/diarioguilda`, `/renomearpet NOME`. Nenhuma delas é enviada ao Core ao digitar o comando: abre menu local; escolher 1 cria prévia com nonce exclusivo, e somente `/confirmar 1 CÓDIGO` encaminha a solicitação nativa uma vez.

A própria regra do jogo continua sendo calculada pelo Crownicles. Renascimento pode perder pontos e resetar viagem; recompensa da guilda pode afetar membros; ligas têm prazos e elegibilidade; apelidos persistem no pet. **Não testar confirmação com dados reais sem querer de fato executar a ação.** Os handlers são adicionados à whitelist apenas quando o Core de verdade registrar os pacotes. `/ajuda` anuncia os quatro somente em caso positivo. O gateway recusa mostrar menu não suportado.

Bônus `/diario`: se Core envia `lastDailyTimestamp` e `timeBetweenDailies`, mostra data real estimada em horário de Brasília; caso contrário não inventa horário. Não muda cooldown.

**Segurança:** instalador SHA, requer V2.9, Core pin 6.2.0.b, PID parado, testagem em staging antes de tocar nos arquivos, backup e rollback, revalidação contra alteração concorrente; não acessa DB nem autenticação e altera apenas 4 arquivos de código. Arquivos de teste são executados em staging e não entram no app.

## Como instalar

1. Parar o Pinguino via `Ctrl+C` na sessão Termux.
2. Conferir SHA256 do ZIP e descompactar em pasta descartável.
3. Rodar `bash pack-v30/instalar-v30-termux.sh`.
4. Conferir `TESTES_AUTORIZACOES_V30=15/15`, `TESTES_BETA_V30` e `ATUALIZACAO_BETA_V30=INSTALADA`.
5. Iniciar manualmente `cd ~/crownicles-whatsapp-lab/crownicles-beta/app && bash start.sh`. Esperado: `BETA_AUTORIZACOES_NATIVAS=4`, `BETA_AUTORIZACOES_PENDENTES=0`, `WHATSAPP_BETA=CONECTADO` (a comprovar no celular).

Não iniciar dois processos do bot, não reinstalar Core ou MariaDB, não apagar sessão WhatsApp. O arquivo é para auditoria e uso local autorizado pelo dono.
