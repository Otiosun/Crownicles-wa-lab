# Crownicles Beta V2.8 — sete menus nativos recuperados

**Base obrigatória:** Beta V2.7 já instalada e parada. Não reinstala Core, não altera banco nem refaz pareamento Baileys.

Novos caminhos verificados no Core original Crownicles 6.2.0.b: `/combate`, `/vender`, `/alimentar`, `/pocao`, `/diario`, `/mudarclasse`, `/embarcar`. A ponte W3/L11 já sabe interpretar os coletores desses comandos; a V2.8 apenas registra seus handlers originais no runtime persistente, exige `packetListener.getListener` real e libera o request somente quando o Core provar o contrato. Ausência de handler bloqueia aquele comando e o remove da ajuda, sem impedir a beta de iniciar.

**Escopo de risco:** cada comando novo faz a consulta inicial que pode abrir menu; **não faz automaticamente a escolha do coletor**. Algumas escolhas podem gastar moedas, poções, energia, itens, alterar a classe ou iniciar luta. Preserve as opções de prévia/código do gateway antigo; para homologação inicial NÃO envie escolhas/confirmar. O comando de bônus diário abre o menu de objetos, não consome bônus sozinho.

**Não desbloqueados neste lote:** /renascer, /recompensaliga, /diarioguilda, /renomearpet e mutações universais que precisam de E2E separado, por seu custo/impacto. Porcentagem do RPG integral concluída não foi mensurada.

### Instalação

Depois de baixar o ZIP e parar a beta (`Ctrl+C`), use o instalador contido no diretório `pack-v28`:

```sh
bash instalar-v28-termux.sh
```

Ele verifica o SHA-256 dos arquivos, exige os hashes exatos da V2.7, recusa bot ativo, cria backup do código, executa regressões em diretório temporário e faz rollback em falhas. Não altera o banco beta, a autenticação, arquivos `bridge` ou o Core.

Depois reinicie `cd ~/crownicles-whatsapp-lab/crownicles-beta/app && bash start.sh` e confira `BETA_MENUS_NATIVOS` e `BETA_MENUS_PENDENTES`, além dos marcadores Core/MQTT/WhatsApp. Teste `/ajuda` e somente as consultas iniciais desses sete comandos sem escolher opções.

### Evidências anteriores e limites

V2.7 homologada pelo usuário em 16/11/2026: 16 handlers adicionais, Core original, MQTT/Baileys conectados, respostas reais para /pet, /mapa, /perfil, /guilda e /ajuda. V2.8: testes Node locais isolados, sem homologação WhatsApp dessa atualização até a execução do usuário.
