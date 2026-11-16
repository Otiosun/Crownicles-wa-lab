# Crownicles inteiro — inversão da estratégia (15/11/2026)

**Regra máxima corrigida:** o produto final é o **Crownicles original completo**, reaproveitado integralmente, acessível pelo WhatsApp e pelo site, localizado para pt-BR, sem criar outro RPG mais raso. Identificador antigo da instalação **não é o nome do jogo**.

## Auditoria da fonte original
Repositório `Crownicles/Crownicles` fixado no commit `64d08c05f11949029317341735f6f73024f19f9b`; árvore Git não truncada: **3.925 entradas / 3.659 arquivos**.

- `Core/src/commands` contém **183 arquivos**, sendo **28 player**, **11 guild**, **8 pet**, **1 mission** e **135 admin/auxiliares/testes**. Arquivos **não** equivalem a 183 comandos públicos.
- **56** arquivos `Lib/src/packets/interaction`; **60** em `Lib/src/packets/commands`; **29** modelos de banco; **78** arquivos de migração; **267** arquivos `*.test.ts` nas árvores de testes.
- Sistemas originais preserváveis incluem combate, missão, evento, viagem, economia, inventário, guildas, pets, cidades, casas, jardinagem e demais conteúdos; não implementar em paralelo as regras do motor.
- `Lang/pt`: **8.403 chaves de texto**, correspondendo exatamente às **8.403** em `Lang/en`, nos mesmos 11 JSON. **0 faltantes**. **13 vazias em ambos idiomas**, não são falha específica da tradução em português. Revisão de qualidade PT-BR ainda necessária.
- A ponte WhatsApp LAB V6 contém 20 módulos CJS, menciona aproximadamente 108 nomes de pacotes (mencionado ≠ implementado). 33 esquemas de coletores reconhecidos, 10 com alguma mutação experimental confirmável, 23 mantidos bloqueados; cobertura do jogo completo **ainda não comprovada**.
- Evidência anterior: regressão Node **800/800** da ponte e teste Android Core+SQLite+MariaDB com transporte simulado **22/22**, não equivalem à integralidade, MQTT real, Baileys ou site operacional.

## Otimização de trabalho
1. Inventário automático dos contratos Core/Discord, comandos e coletores, comparado com adaptador. Não testar isoladamente cada item do zero.
2. Roteador universal de pacotes nativos + aliases pt-BR gerados, não duplicar lógica nem liberar comandos de teste/admin.
3. Renderizador universal com `Lang/pt`, contexto de jogador, confirmação e rejeição por padrão; exceções manuais só quando a semântica exigir.
4. Suite original e banco efêmero reutilizáveis para homologar **famílias inteiras**.
5. Broker MQTT exclusivo 127.0.0.1, prefixo aleatório, depois canal Baileys isolado e deploy reversível. Não iniciar segundo Core main e não tocar na sessão live.
6. Reutilizar API `RestWs`/Keycloak original para o site; QA localização sem retranscrever 8.403 strings.
7. Uma release agregada por lote de sistemas, não microinstaladores.

**Bloqueio de prazo:** nenhuma data fechada é honesta sem medir sistematicamente acessibilidade/pendências de todos os comandos/coletores. Não prometer que 100% do RPG estará pronto em dias; priorizar a cobertura real auditável.

Arquivos produzidos e arquivados no Drive Komekko:
- [Plano integral e matriz inicial](https://drive.google.com/file/d/18fiT316RZtkP3JTHvDGNGlaraYsVlqQT/view), SHA256 `ebf1259c3def6a9947601392e9180a990ed27c51900dcd5df902dfc65c471381`.
- [Scanner read-only para inventário real](https://drive.google.com/file/d/1HYlaJTffNmcpVmZh_2YA_b8xdgfNpCu3/view), SHA256 `5b9caa3b442a485f733c0f3afb1f6c19f4d6e1e62247e0724783039bf577f887`, `node --check` passou; testado offline com ponte V6. **Não executado no Termux**. Não lê dados de usuário, credenciais ou banco, apenas diretórios de fonte de Core/Lib/Lang e pacotes da ponte.

**Próximo alvo:** rodar scanner no código original instalado, classificar `existe Core` / `mapeado` / `exibível` / `mutação homologada` / `live`, e projetar a release ampla de integração; sem abandono do RPG completo.
