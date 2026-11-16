# Crownicles — Jornada V6, dois jogadores fictícios (16/11/2026)

**STATUS:** V6 preparada com **14/14 testes locais (estruturais) PASS**, verificação do bundle bridge **23/23**, sintaxe Node aprovada, mas **GATE NATIVO ANDROID 33/33 AINDA PENDENTE**. Baseline V5 **26/26 PASS REAL no Termux**, documentado no README da V5, commit `0e6de42b4d33f2bcbc30db217ec43e1bcdad5966`.

## Escopo da V6

Novo laboratório sequencial de **dois jogadores fictícios e dois números WhatsApp fictícios**, no mesmo processo, broker MQTT privado e MariaDB descartável, usando Core Crownicles 6.2.0.b original. Não há comunicação real WhatsApp ou Keycloak.

O runner automaticamente reexecuta baseline V3+V4+V5 26/26 no mesmo banco efêmero (não exige reconfiguração pelo usuário) e executa sete novos testes:

- 27 `SEGUNDA_IDENTIDADE_PRE_INICIO`: segundo Player original com inventário e ItemSlots nativos, novo UUID independente, `/perfil` resulta `notStarted`.
- 28 `SEGUNDO_JOGADOR_EVENTO_CORE_NATIVO`: segundo `/jogar` passa pelo Core, coletor do evento61 e mapa83; snapshot jogador1 preservado.
- 29 `MENUS_PRIVADOS_SEM_VAZAMENTO`: armazenamento de menus separado por número fictício, `/menu` não mostra menu do outro.
- 30 `REACAO_JOGADOR2_APLICADA_SOMENTE_A_ELE`: `ReactionCollectorReactPacket` original na escolha do segundo personagem e recompensas gravadas somente no Player2.
- 31 `PERSISTENCIA_SEPARADA_DOS_DOIS_JOGADORES`: UUIDs, mapLink, saldo e score de cada Player guardados independentemente.
- 32 `DUPLICATA_SEGUNDO_JOGADOR_NAO_AFETA_ESTADO`: repetir mesmo wamid não reexecuta coletor ou credita recompensa.
- 33 `PERFIS_NATIVOS_SEGREGADOS_E_NUMERO_DESCONHECIDO`: perfis via Core confirmam UUID e dinheiro do personagem certo; número não associado é rejeitado.

Além disso, o gateway de laboratório verifica destino de TODAS as mensagens enviadas durante cada novo `runWa`: `deliveries.every(v=>v.number===contact)`.

**O escopo é isolamento sequencial de duas contas fictícias, NÃO concorrência de requisições verdadeiramente simultâneas, nem dois grupos WhatsApp reais, nem toda segurança social completa.** Os eventos61/60 da baseline seguem fixtures; evento3 da V5 continua selecionado sem fixação.

## Segurança

`Core.init()` bloqueado, MQTT 127.0.0.1 isolado, login MariaDB random com schema exclusivo, marker `OWNED_BY_JORNADA_V6`, sessão Baileys real nunca acessada, nenhuma edição/reinício do MariaDB compartilhado, nenhum schema de produção. Nenhuma modificação no upstream Crownicles. A configuração das duas identidades só existe no `Gateway` efêmero local.

## Artefatos — Drive Komekko

- [V6 único CJS](https://drive.google.com/file/d/1QUmv529QGQepXylrKGK6iarLIhZF1WTg/view) **152881 bytes; SHA256 `fb0c506c147c593466b68441ccba458f09f86bcbe25f8b3ab3ac64652f24fb3c`**.
- [ZIP Android só CJS](https://drive.google.com/file/d/1G1FjC1ceBstGoj8Oq2njLFvlgAzaRbkd/view) **81659 bytes; SHA256 `7e637ab0b6ee1069580dd769d0d629eb133a6ae1a9ef4a7f1ed3e8de6d7a6461`**.
- [Fontes, builder, 14 testes guardas, README e checksums](https://drive.google.com/file/d/1siQe3Ssks6w_XyZ6yTjk8okHVmJndZW_/view) **90384 bytes; SHA256 `1fe6da1594cc3703d99a9d78cdfea43b0db6f10adf0b9e4427cb36210fa12522`**.
- [README técnico](https://drive.google.com/file/d/1GNVyIYg2SPUbmtprDuZx7VeuNM8_E0Mx/view).

## Gates pendentes — exigir log real do Android

```text
LAB=JORNADA_CORE_NATIVO_MQTT_V6_DOIS_JOGADORES
PASS=27_SEGUNDA_IDENTIDADE_PRE_INICIO
PASS=28_SEGUNDO_JOGADOR_EVENTO_CORE_NATIVO
PASS=29_MENUS_PRIVADOS_SEM_VAZAMENTO
PASS=30_REACAO_JOGADOR2_APLICADA_SOMENTE_A_ELE
PASS=31_PERSISTENCIA_SEPARADA_DOS_DOIS_JOGADORES
PASS=32_DUPLICATA_SEGUNDO_JOGADOR_NAO_AFETA_ESTADO
PASS=33_PERFIS_NATIVOS_SEGREGADOS_E_NUMERO_DESCONHECIDO
DOIS_JOGADORES_V6_NOVOS_TESTES=7/7
DOIS_JOGADORES_V6_FALHAS=0
JORNADA_CROWNICLES_RESULTADOS=33/33
JORNADA_CROWNICLES_FALHAS=0
BANCO_TEMPORARIO_REMOVIDO
MARIADB_PRIVADO_REMOVIDO
LAB_SAIDA=0
```

Não declarar gate 33/33 até evidência real. Progredir a partir do erro preciso, sem mexer em main/produção.

**Diário Mestre:** https://docs.google.com/document/d/1p6yD3vVhAP_sCNsAA8gl2tCWB4OsU0xaSFBLaC7Ztoo/edit
