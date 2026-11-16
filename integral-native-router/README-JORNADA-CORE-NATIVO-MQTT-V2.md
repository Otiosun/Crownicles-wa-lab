# Jornada MQTT nativa V2 — correção do BOOT MariaDB

**Status:** preparada e testada estaticamente; **aguardando execução real no Termux**. Data: 16/11/2026.

## Incidente recebido
Execução V1 Android:
```text
LAB=JORNADA_CORE_NATIVO_MQTT_V1
LAB_FALHOU=ECONNREFUSED
LAB_FALHA_ETAPA=BOOT
LAB_FALHA_DETALHE=connect ECONNREFUSED /data/data/com.termux/files/home/crownicles-whatsapp-lab/infra/mariadb/mysql.sock
LAB_SAIDA=1
```
O arquivo de socket estava presente, mas não aceitava conexão; isso ocorreu **antes** de qualquer progresso no jogo ou criação de banco descartável. Não declarar que 11/11 passaram.

## Correção implementada
- Em vez de exigir um socket compartilhado ativo, tenta conectar usando o mesmo teste de identidade de socket e porta já aprovado na V1.
- Se o daemon não atende (`ECONNREFUSED`, `ENOENT`, `ETIMEDOUT`), **não reinicia, altera nem encerra o serviço compartilhado**. Inicia MariaDB independente com `mariadb-install-db` e `mariadbd` em `~/.cache/crownicles-native-lab/mariadb-wa-<random>`, porta efêmera loopback diferente da porta de produção, autenticação por socket de usuário Unix e `--no-defaults`.
- Valida `@@socket`, `@@port`, `@@datadir` da instância privada. Cria logins SQL aleatórios com grants limitados exclusivamente ao banco `crownicles_test_wa_native_<random>_game`. Core original recebe a config isolada **apenas no processo do teste**.
- Usa exatamente os mesmos 23 módulos CJS embutidos e os mesmos onze checks do fluxo `/perfil`, `/inventario`, `/missoes`, `/jogar`, evento 61, escolha, leitura posterior.
- Limpa banco/usuários temporários, mata **somente filho privado próprio** e remove exclusivamente diretório lab marcado. Se não houver confirmação de término do filho, preserva diretório e sinaliza limpeza pendente.
- Falha fechada para `ER_ACCESS_DENIED_ERROR`, socket fora do diretório autorizado ou alvo compartilhado inconsistente.

## Validações efetuadas
- `node --check`: PASS.
- `node ...cjs --verificar-pacote`: `PACOTE_INTEGRO=23/23`, `VERIFICACAO_PACOTE_SEM_INICIALIZAR_CORE=SIM`.
- `node --test crownicles_jornada_mariadb_fallback_v2.test.cjs`: **8/8 PASS** (5 caminhos de socket/segurança e 3 guardas).
- **Sem teste de execução com MariaDB real neste ambiente**: binários de servidor ausentes na infraestrutura local. Não declarar homologação nem recontar 871 testes Node de ponte da rodada anterior.
- Arquivo runner 125830 bytes, SHA256 `4b8d5a30a499a46b26485a1d9ab0e97e41ac45fd90e1e69d8399531f790a8463`.

## Artefatos persistidos na conta Komekko
- <https://drive.google.com/file/d/1iYXFQYd5PTe5FlOO6LyVZdCnU7Znzt4E/view> — runner Android V2
- <https://drive.google.com/file/d/1va_J7jxMoQeUpVttliFGmusfhVLLJf77/view> — fonte V2, testes 8/8 e README zip
- <https://drive.google.com/file/d/10puDwqeZ21VclYUDlUvuSdNu-lUa6ZBC/view> — 8 testes de fallback
- <https://drive.google.com/file/d/1lfUUAL4yYjVndA8BxvY0IWH0d6yOkZuS/view> — documentação detalhada

**Próxima ação:** Termux, baixar o arquivo V2 único e executar. Verificar resultado `JORNADA_CROWNICLES_RESULTADOS=11/11`, `FALHAS=0`, `LAB_SAIDA=0` e limpeza. Não revalidar o `PingCommand` nem mexer em produção.

Fonte oficial do mecanismo de inicialização privada: <https://mariadb.com/docs/server/clients-and-utilities/deployment-tools/mariadb-install-db>.
