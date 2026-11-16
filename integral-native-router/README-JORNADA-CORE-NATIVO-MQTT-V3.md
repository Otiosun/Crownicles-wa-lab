# Jornada Core nativa MQTT V3 — Termux (16/11/2026)

**Estado:** correção pronta, 13/13 testes isolados, **execução real Android PENDENTE**. NUNCA declarar jornada 11/11 sem log real.

## Causa dos dois erros anteriores

V1: `ECONNREFUSED` no socket compartilhado `infra/mariadb/mysql.sock`; não houve comando de jogo. V2: fallback seguro reconheceu o socket inativo e tentou inicializar MariaDB privado, mas parou em `MARIADB_PRIVADO_INSTALACAO` com mensagem `If you are using a binary release, ... pass --basedir`. Na V2, o instalador era chamado com `--basedir=$PREFIX` no Termux; o pacote Termux já tem caminhos compilados absolutos (incluindo `INSTALL_SBINDIR=$TERMUX_PREFIX/bin`), e o script de pós-instalação chama `mariadb-install-db` **sem** esse argumento. Isso explica o cenário de resolução incorreta de caminhos. Ver fontes:
- <https://github.com/termux/termux-packages/blob/master/packages/mariadb/build.sh>
- <https://mariadb.com/docs/server/clients-and-utilities/deployment-tools/mariadb-install-db>

## Correção V3

- Removido `--basedir=$PREFIX` da chamada `mariadb-install-db`; mantidos `--no-defaults`, `--datadir` exclusivo e login via socket.
- Corrigida segunda falha latente: checar `path.resolve(@@datadir)===path.resolve(dataDir)`, em vez de impor `.startsWith(path.resolve(dataDir)+'/')` que rejeitava diretório exato após remover slash final.
- Se o instalador falhar novamente, a mensagem `MARIADB_INSTALADOR_DIAGNOSTICO` extrai linha `FATAL ERROR` / `Could not find`, não o rodapé genérico. Se o daemon morrer, `MARIADB_PRIVADO_LOG_FINAL` lê somente log do filho recém-criado no diretório temporário.
- Mantidos os 23 módulos embutidos, o Core nativo 6.2.0.b e as 11 verificações de `/jogar`, evento inicial, reação original, perfil, inventário e missões, com identidade fictícia.
- Sem acesso a WhatsApp real, Keycloak/site, schema de produção ou inicialização total `Core.init()`. MariaDB privado usa porta loopback e pasta `~/.cache/crownicles-native-lab/mariadb-wa-<random>` com marcador `OWNED_BY_JORNADA_V3`; limpa apenas seu próprio daemon, schema e diretório.

## Evidência disponível

`node --check` PASS; `node --verificar-pacote` `PACOTE_INTEGRO=23/23`; teste unitário `node --test crownicles_jornada_mariadb_fallback_v3.test.cjs` **13/13 PASS, 0 fail**. Inclui simulação de argumentos do instalador Termux, recusa de caminho divergente, reparo do slash de datadir, socket ausente/inativo e salvaguardas de limpeza. Ambiente local sem Mosquitto e sem o MariaDB Android; **11/11 ainda PENDENTE**.

## Arquivos entregues no Drive Komekko

- Runner V3 único (127369 bytes; SHA256 `dc47ece34194fdc31c75d51f0e06b62ed6d234edbfa2e59726ded0f77e683165`): <https://drive.google.com/file/d/1ozv7xziI7kMu9PnlpizferGylFnS_l24/view>
- Código, testes 13/13, README e manifest SHA256 (ZIP; 82251 bytes, hash `a96dccf5ba6ef29bc2fb5cbcd38830fe7e7e3578518676cf8960371359d2bb09`): <https://drive.google.com/file/d/1X1jsWLPloFBVSHDxuTcXFCk4d1PR-Rpm/view>
- Teste isolado: <https://drive.google.com/file/d/1ANWcErkJr34tvQ6PUEfvKD8WGi6YPu4M/view>
- README: <https://drive.google.com/file/d/1jEx5RNUn58vRVVYvmLKNGIpm7SHw6vaD/view>

Próximo gate: executar runner V3 no Termux; exigir `JORNADA_CROWNICLES_RESULTADOS=11/11`, `JORNADA_CROWNICLES_FALHAS=0`, `LAB_SAIDA=0` e limpeza. **Se falhar, corrigir somente o novo estágio específico**, sem voltar a testar /ping, sem modificar produção.

Diário: <https://docs.google.com/document/d/1p6yD3vVhAP_sCNsAA8gl2tCWB4OsU0xaSFBLaC7Ztoo/edit>.
