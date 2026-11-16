# Crownicles integral — camada de comandos nativos reaproveitável (laboratório)

**Data:** 15 de novembro de 2026. **Código original:** Crownicles 6.2.0.b, commit `64d08c05f11949029317341735f6f73024f19f9b`. **Não é um instalador de produção. Não muda o WhatsApp, o Core, nem a base MariaDB existente.**

## Por que esta entrega existe

A meta é conservar **o Crownicles inteiro** (código, regras, mundos, desafios, economia, coletores, eventos, classes, pets, guildas, missões e demais recursos), servindo seus contratos pelo WhatsApp e pelo site. A V6 homologou 22 cenários de equipamentos no Android; não é a entrega do RPG inteiro. A arquitetura anterior replicava parsers para diferentes famílias de comandos. Esta V1 introduz um **roteador nativo declarativo** para que as próximas famílias sejam adicionadas por contratos auditados, sem repetir mecanismo de identidade, nonce, SQLite, MQTT e confirmação.

## Alterações reais no clone isolado

- `src/native-universal.cjs` **NOVO**: declara alias PT-BR, classe exata de pacote, payload, risco, menu de prévia e renderizações de retorno. Um único mecanismo comum e bloqueio por padrão.
- `src/gateway.cjs` **MODIFICADO**: integra parser universal **após** as rotas antigas, reaproveitando `startConfirmedRequest` e seu nonce único no SQLite. Mantém jogador vinculado ao número, expiração, no-replay, menu por jogador, fechamento de requisições, filtro de identidade e dedupe. Requisição nativa nunca sai antes do commit da confirmação. Resposta vazia de carinho encerra apenas a requisição correspondente, sem declarar recompensa nem reenviar.
- `src/presenter.cjs` **MODIFICADO**: usa renderização nativa para Ping e criação de guilda, sem expor IDs.
- `test/native-universal.test.cjs` **NOVO**: 20 testes abrangendo o roteador, termos inválidos, origem do ID, falsos nonces, cancelamento, replay, outro jogador, TTL, adulteração de menu e replies sem resultado.
- Regressão completa **820/820 PASS** no ambiente local Node 22 (os 800 testes anteriores também passaram); arquivo TAP junto no pacote.

## Quatro contratos originais exercitados na base de roteamento

| Comando WhatsApp | Pacote oficial | Regra |
|---|---|---|
| `/ping` | `CommandPingPacketReq {time}` | Consulta sem alteração, utiliza hora enviada pelo cliente |
| `/acariciar` | `CommandPetCaressPacketReq {}` | Laboratório isolado apenas; executa `MissionsController.update` no Core original, não assumir recompensa |
| `/resgatarexpedicao` | `CommandPetExpeditionResolvePacketReq {}` | Laboratório isolado apenas; Core original arbitra expedição, bloqueio, recompensas e travas |
| `/criarguilda NOME` | `CommandGuildCreatePacketReq {keycloakId,askedGuildName}` | Laboratório isolado apenas; Core verifica nome, dinheiro, guilda e emite confirmação oficial |

Nenhuma economia, dano, XP, NPC ou sorte é recriada no roteador. As ações mutáveis só são aceitas com todos os sinais `CROWNICLES_WA_UNIVERSAL_COMMANDS=lab` + `CROWNICLES_WA_LAB_ISOLATED=SIM_ISOLADO` + `WA_BAILEYS_SEND_MODE` ausente/vazio + `CROWNICLES_WA_EQUIP_ACTIONS` não habilitado. **Mesmo com esses sinais, o código deste arquivo não foi instalado em produção**. `/sistemas` mostra o conjunto experimental sem enviar nenhum pacote ao motor. Comandos administrativos ou payload arbitrário **nunca** são liberados.

## Prova adicional de Core/MariaDB no Termux (ainda NÃO executada)

- Artefato único: `crownicles_integral_core_gateway_lab_v1.cjs`, arquivo SHA256 abaixo.
- Reutiliza o laboratório efêmero V6 e seus **22 cenários nativos** previamente homologados no Termux; o script encapsula uma cópia exata dos **21 módulos atuais**, sem instalação no gateway real.
- **Cinco cenários novos**: 23 Ping com classe oficial Core e jogador no MariaDB; 24 tentativa de fundar guilda sem moedas com classe oficial Core e conferência de não-mutação; 25 resposta vazia de carinho (simulação de resposta, **não** valida progresso de missão); 26 mutações bloqueadas fora do laboratório; 27 código de confirmação de outro jogador não funciona. Os cinco ainda não foram executados no celular: não contabilizar como aprovados.
- Expectativa no Termux: `LAB_TESTES_TOTAIS=27/27`, `LAB_TESTES_FALHARAM=0`, `BANCO_TEMPORARIO_REMOVIDO`, `LAB_SAIDA=0`. Falhas fornecem etapa e stack filtrada e ainda fazem limpeza. Não conecta MQTT ou Baileys, não chama `Crownicles.init`, não usa usuários reais.

**Mesmo que a V1 passe 27/27, o Crownicles inteiro ainda NÃO está jogável via WhatsApp.** Faltam muitas interfaces e validações por família, MQTT real, Baileys real, o site, tratamento de resposta perdida e revisão de UX em PT-BR. A camada declarativa apenas elimina uma classe de trabalho repetitivo.

## Política de publicação e licenciamento

- O clone e os testes **não** devem substituir a pasta `.run/wa-gateway` nem alterar o bot ativo.
- Respostas de comandos que não possuam renderizador ainda permanecem bloqueadas/fail-closed; a fonte original é o árbitro de regras e recompensas.
- `Core/src/main.ts` inicia `crowniclesInstance.init()`; não executar um segundo main para provar o transporte.
- Crownicles é **AGPL-3.0-or-later**; modificações/serviço deverão cumprir as obrigações da licença e de atribuição conforme aplicáveis.

## Próxima convergência — sem um teste por mecânica

Preencher um registro por família de contratos (jogador, guildas, pets, combate, exploração, cidade e economia), aproveitando em lote o Core e coletores originais. Um adaptador genérico compartilhado atende consultas e confirmações; ações não classificadas conservam bloqueio seguro. O objetivo é **cobertura dos 48 contratos de comando do Core + coletores relacionados**, não repetir 48 implementações independentes. Para site, reaproveitar RestWs e autenticação Keycloak oficial, com avaliação de maturidade de RestWs.
