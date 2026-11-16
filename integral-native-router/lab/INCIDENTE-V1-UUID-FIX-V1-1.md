# Crownicles integral — incidente V1 e correção do laboratório V1.1

**Data:** 15/11/2026, execução no Android/Termux. **Status:** correção local aprovada; V1.1 ainda não executada no Android. **Produção WhatsApp:** intocada.

## Evidência do usuário (execução real V1)

Inicialmente o MariaDB recusou a conexão no socket local. A instância original foi recuperada, sem reinstalação. Depois o script executou sobre Core 6.2.0.b, MariaDB real e SQLite efêmero; **22/27 cenários passaram**, sendo os 22 da ponte/equipamentos já homologados; **5/5 novos falharam**. O banco temporário foi removido e o processo terminou com `LAB_SAIDA=2`.

Falhas registradas:

- `23_PING_OFICIAL_CORE_SQL_GATEWAY`: `TIMEOUT_PING_CORE`
- `24_GUILDA_CORE_REAL_REJEITA_SEM_MOEDAS`: `MENU_GUILD_NAO_CRIADO`
- `25_PET_CARINHO_REPLY_VAZIA_SEM_REPETIR`: token `undefined`
- `26_NATIVO_MUTACOES_BLOQUEADAS_FORA_LAB`: mensagem de comando desconhecido em vez de bloqueio
- `27_CONTRATO_NATIVO_OUTRO_JOGADOR_NAO_AUTORIZA`: `TIMEOUT_NONCE_NATIVO`

## Causa raiz confirmada no código V1

O gerador de jogadores SQL de teste usava `const id=labKidBase+(++playerSeq)` com valores como `wa-native-<aleatório>-1`, mas o novo roteador `src/native-universal.cjs` valida `keycloakId` como UUID antes de reconhecer **qualquer** rota nativa. Portanto o gateway recebia um ID de teste inválido, não reconhecia `/ping`, `/criarguilda` nem `/acariciar` e descartava-os como desconhecidos. As cinco falhas compartilham essa condição. Não é adequado afrouxar a validação no roteador; o gerador de **jogadores fictícios** é que precisava seguir o contrato.

## Correção V1.1 (somente laboratório)

Em `newPlayer` no script:

```js
const id=crypto.randomUUID();
assert.match(id,/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i,'LAB_PLAYER_ID_DEVE_SER_UUID');
const p=await Player.create({keycloakId:id});
```

- Nenhuma regra de jogo foi alterada.
- Não altera o roteador, o gateway real, o Core original ou os dados existentes.
- Não recomeça o trabalho feito: conserva os 27 cenários do mesmo laboratório.
- Não conecta WhatsApp, Baileys ou MQTT externo.

### Evidências locais

- `node --check` no script novo: **OK**.
- Regressão local completa da ponte: **820/820 PASS**, 0 falhas (restaurado script utilitário de teste ausente no ZIP anterior; não mudou runtime de produção).
- Cinco verificações focadas do novo fixture: `23_FIXTURE_UUID_PING_RUTA`, `24_FIXTURE_UUID_MENU_GUILDA`, `25_FIXTURE_UUID_CARINHO`, `26_FIXTURE_UUID_BLOQUEIO`, `27_FIXTURE_UUID_OUTRO_JOGADOR`: **5/5 PASS**.
- Importante: essas verificações **não** validam os 5 cenários integrados no Android. A homologação integral V1.1 continua pendente.

## Próxima execução

Usar exclusivamente o arquivo **`crownicles_integral_core_gateway_lab_v1_1_corrigido.cjs`**, verificando SHA-256 `60ee7cc3971452f01ac081ea51ae892dfd0e39935fb2650680f650da54f14598`. Não rodar novamente a V1 antiga. Esperar `LAB_TESTES_TOTAIS=27/27`, `LAB_TESTES_FALHARAM=0`, `BANCO_TEMPORARIO_REMOVIDO`, `LAB_SAIDA=0`; se falhar novamente, registrar apenas falhas novas e diagnóstico de serviço, sem perder o estado já homologado.

**Escopo máximo:** preservar e expor Crownicles inteiro via WhatsApp e site, sem customização substitutiva do motor. Passar 27/27 não significa entrega completa do RPG.


[Script validado em Drive](https://drive.google.com/file/d/1jSvQW5KrvXAnIqvtrxQsYxhE4F8DibHw/view).