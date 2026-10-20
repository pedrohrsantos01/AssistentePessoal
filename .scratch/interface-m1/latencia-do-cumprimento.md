# Próximo recorte — atribuir e reduzir a latência do cumprimento

Status: done em 20/10/2026 para este incremento de diagnóstico/atualização única. Origem: issue06 e spec/07 §1. A meta completa de 100 ms permanece pendente; não é aceite de 06/M1.

A rodada8 mediu20 mudanças com p50 de 117,78 ms, p95 de 135,03 ms e máximo de 3014,37 ms; nenhuma ficou≤100 ms. No evento máximo, handler→commit JS durou38,24 ms, sem atribuir o restante. [Relatório](../../docs/analises/2026-10-20-desempenho-instrumentado-m1.md).

Delimitar o atraso entre eventTime, chegada ao dispatch da Activity, handler, commit, refresh e frame. Verificar a base de tempo antes de alinhar marcos JS/nativos; separar custo do host/entrada, persistência/projeção e apresentação. Otimizar somente o gargalo demonstrado, com regressão apropriada e repetição do protocolo em pasta nova. Conservar todas as amostras altas válidas e comparar distribuição/fração, sem deslocar a origem nem redefinir100 ms.

Preservar sucesso após commit SQLite, fila/identidades/XP e recuperação de falhas. Não simular sucesso antecipado, não mudar schema/regras e não abrir fase futura. Repetir tipos/lint/suíte app/check API; emulador/acompanhamento visíveis somente durante teste, recursos próprios encerrados. Se o gargalo estiver no ambiente, documentar o limite antes de alterar o produto.

A cauda de feedback ainda não foi resolvida: continuar pelo [recorte delimitado](cauda-do-cumprimento.md) antes da partida dos cards. A medição anterior dos cards foi: p50 de 883,51 ms e 0/10≤300 ms desde a solicitação de abertura. A abertura geral≤2 s no AVD não dispensa o alvo dos cards nem o aceite físico. Issue06/M1 permanecem abertos por desempenho, demais estados/leitura/paletas, iPhone adiado e gates externos já documentados.

Resultado: [relatório](../../docs/analises/2026-10-20-latencia-do-cumprimento-m1.md). Probe v4 exige gesto elegível e PressEvent correspondente; v2/v3 sem essa identidade não fundamentam atribuição dos picos à aplicação. Referência/corrigido: p50 de 130,74→97,31 ms; p95 de 175,56→160,58 ms; máximo de 189,90→234,66 ms; dentro de 100 ms: 1/20→12/20. Refreshes 2→1 em 20/20. Tipos/lint/253 testes app e check completo API isolado aprovados, 85 executados/oito opt-in ignorados; primeira falha WAL e duas tentativas nativas inválidas preservadas. Reinício/convergência 10 XP e custódia confirmados; recursos próprios encerrados.
