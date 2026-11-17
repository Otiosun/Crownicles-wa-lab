# Fonte canônica: beta persistente Crownicles

**Decisão do responsável (16/11/2026):** concentrar toda a evolução útil do Crownicles original, a ponte WhatsApp antiga (W3/Lotes 02–11) e o futuro site na MESMA beta persistente. Não reduzir o projeto à lista simplificada do menu, não criar RPG paralelo nem refazer contratos originais já testados. "Pinguino" designa a conta/bot de teste, não o nome do jogo.

## Diagnóstico — redução do /ajuda
- Ponte histórica: integral-native-router/src/gateway.cjs importa lotes 02, 06, 07, 08, 09, 10, 11 e native-universal.cjs. Seu /ajuda e /comandos apresentam mais de 30 comandos e instruções de menu numérico e prévia/nonce.
- Beta: integral-native-router/beta/entrada.cjs intercepta /ajuda e /comandos antes de chamar Gateway. Sua constante HELP é muito menor. V2.5 melhora somente essa apresentação e acrescenta /grupo e /regras; não migrou os lotes históricos.
- Beta: integral-native-router/beta/integracao.cjs importa ./bridge/gateway.cjs e ./bridge/store.cjs, e não ../src/gateway.cjs. Os arquivos originais completos da pasta beta/bridge não estão rastreados nesta branch GitHub; podem estar no ZIP instalado. Antes de afirmar paridade, inspecionar os hashes/fontes instalados sem incluir credenciais.
- Beta: runtime.cjs mantém MariaDB exclusivo persistente e Core Crownicles 6.2.0.b com MQTT isolado, mas não executa Core.init completo. Registro explicitamente verificado de cinco pacotes no compiledPaths: Report, Profile, Inventory, Missions e ReactionCollectorReact. O Core original possui muito mais sistemas, mas a inicialização parcial não comprova disponibilização deles ao cliente.
- Beta e W3 anterior usam armazenamento distinto. Há registro de personagem nível 3 no W3 e personagem nível 1 na beta. Nunca fundir ou substituir UUIDs, inventários e saldos sem identificar a origem, preservar backups e demonstrar correspondência segura.

## Matriz de recuperação

| Família | Evidência ponte W3/código antigo | Status na beta atual |
|---|---|---|
| Cadastro, grupo ON/OFF, vínculo proprietário | beta V2.4 WhatsApp real | Comprovado e deve ser preservado |
| Perfil, inventário, missões, jornada, /menu e escolhas | W3 real e laboratórios Core/MariaDB/MQTT; V2.4 PV | Núcleo funcional inicial, sem homologação integral |
| Pet, guilda, classes, histórico, mapa | W3 histórico, integração e apresentações | Não aparecem na ajuda beta; disponibilidade da ponte interna ainda não confirmada |
| Raridades, bênção, ranking, jardim, defesa | Lote 06, código/testes, parte em W3 | Não homologados na beta |
| Vender, alimentar, despensa | Lote 07, tokens de confirmação e testes | Não homologados na beta |
| Expedição, poções, diário, equipamentos | Lotes 08–09, mudanças de equipamento por Core validadas em laboratório; mutação live bloqueada | Não homologados na beta |
| Combate, lojas/cidade e histórico | Lotes 09–10, apresentação de pacotes e regras nativas | Não homologados na beta |
| Versão, renascer, recompensa de liga, diário de guilda | Lote 10, testes locais, algumas interfaces W3 reais | Não homologados na beta |
| Mudar classe, abrigo, embarcar, renomear pet, cidade | Lote 11, 521 testes locais; não comprovado instalado em W3 | Não homologados na beta |
| Comandos nativos universais, 12 contratos auditados | src/native-universal.cjs, V1.1 27/27 Termux isolado, V2 849/849 locais; MQTT V3 860/860 locais | Não homologados como comandos beta |
| Conteúdo original, PT-BR, site | 8.403 textos PT e EN inventariados; RestWs/Keycloak original | Revisão integral e site ainda pendentes |

"Não homologado" não equivale a "código perdido": parte pode estar na ponte importada, mas ainda não foi comparada; outras partes existem somente nos fontes históricos ou laboratórios. Número de arquivos de protocolo NÃO equivale a número de comandos de jogador completos.

## Ordem do lote de FUSÃO (sem mais arquiteturas paralelas)
1. Inventariar fontes e hashes da pasta beta/app/bridge instalada e comparar ao antigo integral-native-router/src. Somente leitura; não ler nem publicar chaves Baileys.
2. Matriz por comando com quatro provas separadas: Core original, ponte histórica, runtime beta e WhatsApp real. Preservar bloqueios de mutações irreversíveis até testes.
3. Backup do banco beta e do W3 existente, com verificação de integridade; jamais resetar progressão nem associar personagens distintos por heurística PN/LID.
4. Portar/adaptar roteador, apresentadores e coletores existentes ao runtime beta, por famílias; não substituir por runner V8 descartável, que encerra e remove o banco de laboratório.
5. Restaurar comando por comando com índices nativos, nonce, deduplicação, autorização e rollback. A ajuda pública deve refletir a disponibilidade REAL (não apenas uma grande lista falsa).
6. Distinguir saída coletiva e privada pelo ID do pedido, UUID e chat original com testes de concorrência. Dados pessoais, inventário e códigos continuam privados até contrato contrário.
7. Regressão integral Node22/26 + WhatsApp real controlado; então patch verificado e reversível na própria beta. Nenhum novo pareamento, Core reconstruído ou duas instâncias da mesma conta.
8. Portal/site futuro conecta à mesma autoridade de jogo e mesmo UUID; nunca duplicar economia/experiência.

**Situação:** plano canônico estabelecido; fusão ainda NÃO executada. Última versão de WhatsApp real validada: V2.4. Branch experimental V2.5–V2.6 sem merge, CI GitHub ainda falhando. O objetivo prioritário agora é FUSÃO DO AVANÇO ANTIGO NA BETA, não mais cosmética do menu.
