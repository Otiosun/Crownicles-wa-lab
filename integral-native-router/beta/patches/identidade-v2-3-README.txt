Crownicles WhatsApp Beta V2.3 — vínculo confiável do dono e personagem

A causa factual registrada: /ativar chega do grupo como PN e recebe not-owner; /chavegrupo no privado não responde; banco tem 1 LID e 2 PN ativos e nenhum cadastro corresponde ao número configurado do dono. Não presumir que os três são a mesma pessoa.

Aplique APENAS com Pinguino parado (Ctrl+C). O script confirma os hashes esperados da V2.2, faz backup de código e banco SQLite, atualiza apenas entrada.cjs/runtime.cjs mais CLI/teste, roda testes e inicia o Pinguino. Nenhuma sessão Baileys, MariaDB, itens ou personagens é apagada ou fundida.

Depois do WHATSAPP_BETA=CONECTADO, em outra aba do Termux execute:
  cd ~/crownicles-whatsapp-lab/crownicles-beta/app
  node admin-link.cjs

A saída fornece /vinculardono CODIGO (24 caracteres hex, válido por 10 minutos). Envie APENAS no PRIVADO do Pinguino pela sua conta. O bot confirma propriedade do privado e responde com /vinculargrupo OUTRO_CODIGO. Envie esse segundo comando no grupo escolhido. O bot associa a identidade observada nesse grupo à identidade observada no privado, mantendo o personagem ORIGINAL do privado. Qualquer outro personagem já criado no grupo continua armazenado, não é excluído nem fundido.

Após a vinculação, /ativar, /desativar, /chavegrupo e /jogar serão reconhecidos sem pedir tokens de novo. Os códigos são de uso único, 10 minutos e NÃO devem ser publicados no chat ChatGPT.

A V2.3 também mascara logs libsignal específicos que poderiam despejar buffers privados em texto. Não corrige o mecanismo de descriptografia Bad MAC, que será examinado separadamente. Baileys não oficial permanece sujeito a riscos de bloqueio e instabilidade. Não copiar logs contendo privKey/rootKey.
