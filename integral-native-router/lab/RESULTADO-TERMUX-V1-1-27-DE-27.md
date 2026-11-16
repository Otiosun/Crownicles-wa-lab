# Homologação nativa V1.1 — integração universal Crownicles

**Data da prova:** 15/11/2026. **Ambiente:** Termux Android; Core Crownicles 6.2.0.b; MariaDB local existente, banco de teste descartável, ponte WhatsApp/SQLite de laboratório e transporte em processo. **Nenhum envio real pelo WhatsApp.**

## Evidência enviada pelo responsável

A execução foi iniciada após recuperar a **instância MariaDB já existente**, no mesmo terminal e sem reinstalar nem inicializar outro banco. O script validado foi `integral-v1_1.cjs`, com correção de UUIDs de jogadores fictícios, hash SHA-256 `60ee7cc3971452f01ac081ea51ae892dfd0e39935fb2650680f650da54f14598`.

```text
MARIADB=OK
LABORATORIO=EXECUTANDO
PASS=01_CORE_PLAYER_PERSISTE
PASS=02_EQUIP_RESERVA
PASS=03_TROCA_EQUIPAMENTO
PASS=04_GUARDA_ITEM_EQUIPADO
PASS=05_REJEITA_DEPOSITO_VAZIO
PASS=06_REJEITA_EQUIPAMENTO_INVENTADO
PASS=07_ISOLAMENTO_OUTRO_JOGADOR
PASS=08_HANDLER_CORE_EQUIP_PACOTE
PASS=09_MENU_NATIVO_FORMATADO_SEM_ENVIO
PASS=10_PREVIA_NAO_MODIFICA_BANCO
PASS=11_CONFIRMADO_GATEWAY_CORE_MARIADB
PASS=12_NONCE_FALSO_NAO_CHEGA_AO_CORE
PASS=13_NONCE_EXPIRADO_NAO_CHEGA_AO_CORE
PASS=14_NONCE_REPLAY_NAO_REPETE_MUTACAO
PASS=15_OUTRO_NUMERO_NAO_CONSOME_AUTORIZACAO
PASS=16_DUPLICACAO_ID_WHATSAPP_DEDUPLICADA
PASS=17_RESPOSTA_CORE_DE_OUTRO_JOGADOR_REJEITADA
PASS=18_FLAG_PRODUCAO_INATIVA_BLOQUEIA_EQUIP
PASS=19_RESPOSTA_TARDIA_NAO_REABRE_MENU
PASS=20_CONTEXTO_DE_DESCONHECIDO_NAO_ACESSA_CORE
PASS=21_DEPOSITO_GATEWAY_CORE_MARIADB_E_TEXTO_NOVO
PASS=22_CONFIRMACAO_REPETIDA_ANTES_RESPOSTA_NAO_DUPLICA
PASS=23_PING_OFICIAL_CORE_SQL_GATEWAY
PASS=24_GUILDA_CORE_REAL_REJEITA_SEM_MOEDAS
PASS=25_PET_CARINHO_REPLY_VAZIA_SEM_REPETIR
PASS=26_NATIVO_MUTACOES_BLOQUEADAS_FORA_LAB
PASS=27_CONTRATO_NATIVO_OUTRO_JOGADOR_NAO_AUTORIZA
LAB_TESTES_TOTAIS=27/27
LAB_TESTES_FALHARAM=0
BANCO_TEMPORARIO_REMOVIDO
LAB_SAIDA=0
MARIADB_APOS_TESTE=ATIVO
CODIGO_FINAL=0
```

**Resultado:** 27/27 testes passaram no Termux. Banco de laboratório removido, instância MariaDB permaneceu online. 22 testes anteriores passaram novamente + cinco novos. Uma prova de resposta vazia de PetCaress verifica o tratamento pelo Gateway usando transporte mock e **não** demonstra conclusão de missão real nem recompensa de pet.

**Não confundir as evidências:** suíte de regressão local Node22 820/820 é separada da execução nativa 27/27. Nenhuma das duas comprova cobertura completa do RPG original, transporte MQTT/Baileys em rede, integração de site/Keycloak ou comportamento em produção.

## Próximos objetivos do programa integral (sem microversões de equipamento)

1. Usar inventário da fonte original (48 nomes de pacotes decorados Core; 56 coletores originais; 113 módulos de comandos Discord) para gerar matriz completa de transporte, formatos e renderização, com exclusão explícita de comandos de administração/teste.
2. Escalar roteador e renderizador declarativos por famílias inteiras de **comandos originais** preservando o motor Crownicles, não recriar mecânicas.
3. Homologar transporte MQTT exclusivo em loopback, persistência/reconciliação de respostas perdidas e canal Baileys em ambiente seguro, antes de permitir mutações reais.
4. Reutilizar componentes originais da autenticação e do site, auditar funcionalidade end-to-end.
5. Documentar cobertura testada versus lacunas com rastreabilidade e lançamento controlado/rollback.

**Status da produção:** instalação atual intocada, flag das mutações nativas OFF e sistema ainda **não** liberado aos jogadores. O nome do jogo ainda não foi definido; 'Pinguino' é identificador de ambiente, não título do produto.

Artefatos:
- [Script V1.1 validado no Drive Komekko](https://drive.google.com/file/d/1jSvQW5KrvXAnIqvtrxQsYxhE4F8DibHw/view)
- [Código-fonte do roteador na branch privada](../src/native-universal.cjs)
- [Incidente UUID corrigido](INCIDENTE-V1-UUID-FIX-V1-1.md)
