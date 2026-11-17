# Crownicles WhatsApp — Lote V2.5 (UX de grupo / proteção de respostas)

## Linha de base comprovada (16/11/2026)
- /vinculargrupo terminou após renovar somente o token de segunda etapa; /ativar em grupo retornou GRUPO_COMANDO_RESULTADO=OK.
- /ajuda respondeu no grupo após correção V2.4 executada no Termux.
- /perfil e conteúdo de jogo continuam intencionalmente privados. Não confundir com falha no MQTT.
- Grupo, personagens e vínculo existentes devem ser preservados.

## V2.5 implementada nesta branch experimental
1. /ajuda e /comandos exibem comandos por contexto, preservando informações privadas.
2. /grupo exibe ON/OFF no grupo, mesmo quando desabilitado; no privado orienta o uso.
3. /regras explica quais respostas são públicas e quais são privadas; não habilita grupos desligados.
4. Texto de ativação/desativação/cadastro aprimorado sem promessa enganosa de persistência definitiva.
5. Deduplicação de mensagens: índice e descarte de IDs com mais de 30 dias, no máximo uma vez por hora via manutenção. Não toca em players, groups, aliases ou chaves.
6. Marcadores de diagnóstico sem conteúdo/JIDs: GRUPO_INFO, GRUPO_VINCULO, GRUPO_JOGO_RESPOSTA_PLANEJADA. A última marca indica roteamento planejado, não entrega.
7. Testes isolados de ON/OFF, privacidade de ajuda/regras, retenção de duplicatas, persistência de grupos/personagens. Workflow de teste no GitHub com Node 22 e SQLite.

## Segurança / isolamento
- Nenhuma mudança na autenticação Baileys, sessão Signal, MariaDB original, protocolos MQTT ou regras nativas Crownicles.
- Dono vinculado continua passando por owner_aliases + jid_aliases e pela prova prévia de posse.
- Não promover qualquer membro do grupo nem alterar apelidos JID na mão.
- Não enviar perfil/inventário/narrativa para chat público sem contrato de divulgação e correlação assíncrona por requisição.
- Não tocar na branch principal de produção nem instalar automaticamente no Android.

## Estado de validação
- Alterações enviadas ao GitHub na branch feat/crownicles-beta-group-ux-v25.
- Sintaxe JS validada em V8 para entrada.cjs, runtime.cjs e testes. Script de instalação de atualização validado com bash -n e compilação dos trechos Node.
- **Node --test em ambiente completo: pendente de execução (não reivindicar aprovado).**
- **WhatsApp real com V2.5: pendente**, assim como estabilidade ao reiniciar.
- O bridge/ Gateway original citado em integracao.cjs não está disponível como caminho rastreado na branch no momento da leitura; por isso a CI proposta valida módulos de entrada sem simular uma homologação completa do Core.

## Próximo lote técnico, sem atalhos
1. Obter/inventariar fontes rastreáveis do gateway e store originais do bundle V8, confirmar SHA e licença.
2. **Implementado isoladamente, integração pendente:** `response-context.cjs` cria índice por (ID de mensagem, UUID do jogador), chat de origem, PV canônico e permissão explícita (`private` por padrão; `group-info` condicionado a grupo ON). Nunca publica dados do Core sem revisão.
3. Integrar o índice aos pontos de entrada e saída rastreáveis da ponte original, depois correlacionar respostas nativas do Core (frontEndSubOrigin / request id) ao contexto antes de responder; tratar respostas atrasadas, duplicadas e fora de ordem.
4. Só publicar no grupo o que é classificado como coletivo. Ficha, inventário, códigos e informações de outros jogadores ficam em PV.
5. Exercitar concorrência 2 grupos x 2 jogadores, reinício, 100 comandos reordenados, Bad MAC sem vazar material criptográfico, mensagens antigas e falhas de envio.
6. Ampliar localização completa PT-BR **sobre o conteúdo original** e verificar comando a comando; não reconstruir Crownicles nem introduzir regras Pilgram duplicadas.
7. Com homologação concluída, aplicar patch no Termux com backup e rollback, primeiro em um grupo de testes.

## Aplicação
A V2.5 NÃO está instalada no bot Android. Nenhum comando ou script é executado em segundo plano. A aplicação exige o Pinguino parado, cópia de segurança, validação com Node e reinício manual, mantendo a sessão Baileys.

## Evidência adicional de laboratório e artefato de continuidade
- `response-context.test.cjs`: **11/11 em Node 22.16 local**, com normalizador compatível isolado (não integração), inclusive 200 respostas reordenadas entre dois grupos, sem destinatários trocados. O módulo da branch usa `normalizeJid` existente em `entrada.cjs`.
- Testes de entrada/owner no GitHub Actions: workflow definido, **sem execução confirmada** no momento deste registro.
- Pacote V2.5 com instalador offline e fontes experimentais: https://drive.google.com/file/d/1CtVRccRnyD4KxukaH2sEeut9l5pmKcr6/view (Drive Komekko, arquivo zip verificado, não distribuído/publicado).
- PR experimental em rascunho: https://github.com/Otiosun/Crownicles-wa-lab/pull/1, sem merge.
