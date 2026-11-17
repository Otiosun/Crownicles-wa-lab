# Crownicles Beta V2.7 — relatório técnico do primeiro lote de fusão

## Escopo implementado

- Recuperadas do Drive as fontes do pacote W3/L11 (75 entradas), Beta V2.1 (35 entradas), patch V2.3 e roteador universal V2. Confirmado que a beta V2.1 já inclui os 23 CJS da ponte W3/L11, os coletores v1/v2/v3 e o Gateway com dezenas de rotas. Não foi necessário reconstruir conteúdo do jogo.
- `entrada.cjs`: /ajuda e /comandos passam a usar provedor do estado de capacidades atuais, preservando a resposta no grupo habilitado e no PV do jogador.
- `feature-manifest.cjs`: registra até 16 handlers nativos adicionais do Core 6.2.0.b, todos com caminho explícito da árvore upstream fixada; o registro só conta se `packetListener.getListener` confirmar o contrato. Falhas individuais não abortam os 5 tipos de pacotes base nem liberam um comando sem handler.
- `integracao.cjs` e `bridge/gateway.cjs`: enviam ao Core somente pacotes que estão habilitados; os demais produzem uma recusa local sem consumir interação nativa. Reaproveitam módulos antigos de menus, fichas, cidades, pets e guildas.
- Correção de ciclo de vida: na desmontagem, Gateway deixa de consumir respostas tardias e evita consultar SQLite após envio pendente no encerramento.
- `group-identity-policy.cjs`: informações públicas de grupo não dependem de PN resolvido; controles passam pela prova original de posse e grupo e não concedem privilégios. Conta LID não verificada não joga e não recebe um novo personagem por suposição.
- Preservados os bancos e sessões persistentes. Não há nova migração de esquema, reset, cópia de personagem, alteração no Core original, MQTT, Baileys ou Keycloak.

## Testes realizados nesta sessão

- 81/81 Node 22 em fontes de beta construídas de Beta V2.1 + patch V2.3 + ajuste V2.4 + correção V2.7.
- 849/849 Node 22 da ponte histórica, executados com o novo Gateway numa cópia isolada da integração universal V2.
- Instalador: preparação em diretório de teste, 81 testes antes de tocar a beta de ensaio, instalação bem-sucedida, segunda execução idempotente, recusou run.lock com PID vivo e confirmou 6/6 arquivos iguais aos fontes construídos. Nenhuma pasta de autenticação ou schema real foi aberto nesse ensaio.
- **Core MariaDB/MQTT com 16 handlers extras reais: NÃO EXECUTADO. WhatsApp real com V2.7: NÃO TESTADO. GitHub Actions: NÃO APROVADO.** Não tratar como release final do RPG.

## Próximos bloqueios

1. No Termux, em janela de atualização controlada, rodar o instalador e verificar contagens `BETA_LEITURAS_NATIVAS` e `BETA_LEITURAS_PENDENTES`. Se houver muitos pendentes, diagnosticar caminhos e dependências reais sem reiniciar Core indiscriminadamente.
2. Validar comandos consultivos para dois jogadores em dois grupos, verificar apresentação e persistência. As respostas de aventura continuam no PV até a correlação assíncrona no outbox original ficar provada.
3. Ampliar registro para mutações e pacotes restantes do Crownicles 6.2.0.b com segurança: todas as operações de economia, equipamentos, guilda, combate e expedições devem respeitar regras originais, limites, nonce e bloqueio de replay.
4. Trazer portal/site com autoridade de personagem do mesmo Core, sem duplicar banco, economia ou progressão; localização editorial PT-BR das 8.403 chaves existentes após revisão de placeholders.
5. Sem alegar jogo completo até passar pelo aceite end-to-end real, instalação reversível e cobertura de sistemas originais.

## Rollback

O instalador cria backups dos quatro arquivos alterados sob `crownicles-beta/backups/v27-*`. Se um teste falhar no staging, a beta real não é tocada; se falhar durante cópia, restaura os arquivos de código que alterou. O reset da conta WhatsApp, SQLite, MariaDB e reemissão de vínculo **não** fazem parte do procedimento.
