# Próximo recorte — confirmar feedback com observação reduzida

Status: done. Origem: issue06, spec/07 §1 e [perfil da cauda](../../docs/analises/2026-10-20-cauda-do-cumprimento-m1.md). Modos implementados e coorte válida concluída; metas de desempenho continuam abertas.

A resolução IANA memoizada reduziu seu custo mediano em 97,19%. No perfil detalhado, feedback p50/p95/máximo de 85,36/101,00/120,76 ms e 18/20 dentro de 100 ms. As duas amostras altas permanecem válidas. Há custo de observação e trabalho/esperas restantes de apresentação; o contador `Debug` não é fonte de CPU aceita.

Delimitar um modo explícito de medição com probe v4 e marcos JS essenciais, sem as leituras síncronas detalhadas nem o trace de escalonamento. Conservar um modo detalhado explícito para diagnóstico. Registrar o modo no build e na coorte; ausência de dados esperados no modo detalhado deve continuar sendo erro, nunca virar fallback silencioso. O pacote normal, APKs detalhados e evidências anteriores devem ser preservados.

Medir a versão otimizada em nova pasta: dez processos frios/vinte alterações offline, gesto DOWN/UP elegível e mesmo PressEvent, relógios nativos, endpoint de frame e metas intactos. Não subtrair overhead estimado, trocar origem, arredondar 100,9995 ms para aceite ou excluir uma amostra alta válida. Distribuições de modos diferentes não comprovam ganho adicional da aplicação. Conferir reinício e convergência independente de um hábito/10 XP.

Se persistirem picos, usar a confirmação para delimitar o perfil da apresentação restante antes de alterar componentes. Não introduzir sucesso antes do commit, migração assíncrona, cache de projeção ou alteração de identidade/fila/XP. Este recorte não amplia funcionalidades nem depende de nova definição de produto.

Checks completos de app/API. Emulador e acompanhamento visíveis somente durante ensaio e fechados ao final; preservar recursos preexistentes. Depois, partida dos cards (0/10≤300 ms no perfil detalhado), sem deslocar sua origem de abertura. Aparelho mediano físico, iPhone adiado e demais gates de 06/M1 continuam abertos.

Resultado: [confirmação leve e limites](../../docs/analises/2026-10-20-feedback-com-probe-leve-m1.md), dez partidas/vinte alterações offline, reinício e convergência de um hábito/10 XP. Feedback 11/20≤100 ms, p50/p95/máximo 88,2632/242,4520/450,0828 ms, todas as nove amostras altas preservadas. Abertura 8/10≤2 s, cards 0/10≤300 ms. Tipos/lint/261 testes app e check API completo aprovados; fixture de expiração corrigida com regressão vermelha/verde e primeira falha preservada. Próximo: [perfil da apresentação](apresentacao-do-cumprimento.md); 06/M1 continuam abertos.
