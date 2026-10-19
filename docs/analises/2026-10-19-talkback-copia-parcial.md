# TalkBack — cópia parcial interrompida — 19/10/2026

Status: recorte delimitado aprovado na rodada 1. Issue 06 e M1 permanecem abertos. [Plano](../../.scratch/interface-m1/leitor-copia-parcial.md), [evidências](../design/evidencias/2026-10-19/leitor-copia-parcial/README.md).

## Fronteira do recorte

Spec/13 §7/13 já exige staging separado, preservação da base e intenções, manifesto novo no reinício, consulta de recibos no corte H e instalação atômica. O recorte amplia as provas dos contratos existentes; não define política nova nem altera schema, migração, protocolo, dependência ou fontes de produto.

Os novos casos SQLite e de componentes preservam projeção/10 XP e envelopes dependentes após página não vazia e reinício. A conta sem base não oferece navegação ou hábito da página parcial; a conta com cursor anterior mantém sua projeção. Somente páginas completas e recibos compatíveis autorizam a instalação. O teste HTTP existente agora exige staging de 500 entidades antes/depois de reabrir, dois manifestos distintos e staging limpo ao terminar.

## Fronteira do ensaio nativo

A fixture isolada usa conta real/API/Postgres, SQLite e SecureStore do Android. Snapshots têm 501 entidades, com primeira página real de 500. A maior parte é tombstone de hábitos sintéticos excluídos por comandos reais; os títulos visíveis da primeira página permitem verificar que a UI não expõe staging. O harness simula expiração de cursor na fronteira HTTP e recusa a segunda página com 503/Retry-After de 120s. A rota de conclusão permite manifesto e páginas reais; não limpa arquivo, guard, cofre, fila ou base. Não constitui prova do cleaner real ou indisponibilidade real do servidor.

Reinício offline permite observar progresso persistido sem outra requisição. A conta com base conserva criação/marcação dependente e 10 XP provisórios; cliente independente verifica ausência antes de retomar e resultado único depois. A conta inicial conserva o gate até concluir, incluindo reinício; a troca A/B/A verifica isolamento.

## Resultado nativo

Rodada 1 aprovada no APK a7f47a73, AVD separado Ritmo_ReadOnly/API 35/4 GB/GPU host, TalkBack e fonte a 200%: seis fases, 46 medições de controles, dez campos/IME com geometria estável e três retornos protegidos do diálogo de sincronização. Ponte SDK com JWT e observador FLAG_DONT_SUPPRESS_ACCESSIBILITY_SERVICES; nenhuma ativação por performAction ou suspensão do leitor. Alvos de 44 unidades com piso no arredondamento para pixels.

Na conta A, a primeira página real e a recusa da segunda deixaram 500 itens em staging. Base anterior, criação/marcação dependente e 10 XP provisórios continuaram disponíveis, sem mostrar o hábito da página parcial. O reinício offline conservou o progresso e as mesmas intenções. Antes de concluir, o cliente independente confirmou ausência da criação/XP remotos e editou outro hábito. A nova cópia incorporou a edição posterior e convergiu para um único cumprimento e 10 XP. Os três conjuntos de envelopes — offline, após reinício e após confirmação — ficaram idênticos, incluindo sequência, conteúdo e dependência.

Na conta B, integrada sem cópia local, 500 itens recebidos não liberaram Briefing/gestão nem o hábito parcial ou os hábitos de A. O gate permaneceu após reinício offline. Somente a conclusão liberou o hábito de B. A troca A/B/A manteve isolamento e o resultado de A. [Resumo](../design/evidencias/2026-10-19/leitor-copia-parcial/rodada1/matrix-summary.json), [gates](../design/evidencias/2026-10-19/leitor-copia-parcial/rodada1/copy-gates.json), [confirmação independente](../design/evidencias/2026-10-19/leitor-copia-parcial/rodada1/remote-result.json).

Leitor, fonte, rádios, timeout e reverse foram restaurados com readback; flags de permissão temporárias foram removidas. Fixture e observador temporários removidos; APK do controle journeytest idêntico antes/depois. Emulador e acompanhamento próprios encerrados. Os nove containers preexistentes continuaram pelos mesmos nomes; metadados dos três arquivos observados do AVD Pixel_9 original ficaram iguais, sem iniciá-lo neste recorte. Isso não é hash forense do seu conteúdo. [Preservação](../design/evidencias/2026-10-19/leitor-copia-parcial/host-preservation.json).

## Verificações e limites

App: tipos/lint e 237 testes aprovados (187 de núcleo/infra e 50 de componentes). Os dois primeiros casos de componente tinham fixtures incompletas (perfil ausente na instalação e cursor anterior ausente na conta existente); corrigidas as fixtures, os casos direcionados e a suíte completa passaram. Não se trata de regressão encontrada no produto.

API check completo aprovado em 19m15s: 14 suítes/93 casos, 85 executados e oito Android opt-in ignorados, zero falhas/erros, 13 testes operacionais Python e modularidade. O cliente HTTP de snapshots passou com a nova exigência de staging/manifesto. O snapshot do check foi salvo antes do ensaio nativo selecionado.

A primeira compilação falhou ao remover três .so do cache C++ do Expo; atributos não eram somente leitura e não havia CMake/Ninja observado. Causa não estabelecida. O retry passou sem limpeza manual (5m53s + 5m48s para as variantes); APK current a7f47a73, updated d5079db2 não instalado neste recorte, controle original d9c8fd34 restaurado. O compilador auxiliar próprio já estava encerrado na verificação de limpeza; nenhum processo preexistente foi interrompido. O ensaio JUnit/Node selecionado passou depois do check completo. Duração Node de 622516 ms inclui bootstrap; não representa desempenho de abertura/cards/feedback do app. Capturas de cópia ativa, gate inicial reaberto e retorno à conta A foram inspecionadas visualmente.

06/M1 continuam abertos por demais cenários de leitura/estados, edição falada por caractere/cursor, desempenho instrumentado, paletas do APK atual e iPhone/VoiceOver (Q55=B), além de gates externos. Capturas de seleção não comprovam áudio pronunciado. Este recorte não fornece medida de desempenho ou aceite integral.

Próximo recorte recomendado: instrumentar e medir abertura, cards locais e feedback de cumprimento, conforme spec/07 §1 e spec/08 §6, separando o tempo do produto das esperas do driver. A cobertura restante de leitura/edição falada e as demais pendências acima continuam registradas na issue 06.
