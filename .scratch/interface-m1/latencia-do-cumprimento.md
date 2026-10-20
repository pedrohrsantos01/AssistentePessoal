# Próximo recorte — atribuir e reduzir a latência do cumprimento

Status: ready. Origem: issue06, spec/07 §1 e medição de20/10/2026. Não iniciado.

A rodada8 mediu20 mudanças com p50 de117,78ms, p95 de135,03ms e máximo de3014,37ms; nenhuma ficou≤100ms. No evento máximo, handler→commit JS durou38,24ms, sem atribuir o restante. [Relatório](../../docs/analises/2026-10-20-desempenho-instrumentado-m1.md).

Delimitar o atraso entre eventTime, chegada ao dispatch da Activity, handler, commit, refresh e frame. Verificar a base de tempo antes de alinhar marcos JS/nativos; separar custo do host/entrada, persistência/projeção e apresentação. Otimizar somente o gargalo demonstrado, com regressão apropriada e repetição do protocolo em pasta nova. Conservar todas as amostras altas válidas e comparar distribuição/fração, sem deslocar a origem nem redefinir100ms.

Preservar sucesso após commit SQLite, fila/identidades/XP e recuperação de falhas. Não simular sucesso antecipado, não mudar schema/regras e não abrir fase futura. Repetir tipos/lint/suíte app/check API; emulador/acompanhamento visíveis somente durante teste, recursos próprios encerrados. Se o gargalo estiver no ambiente, documentar o limite antes de alterar o produto.

Após esse recorte, tratar a partida dos cards: p50 de883,51ms e0/10≤300ms desde a solicitação de abertura. A abertura geral≤2s no AVD não dispensa o alvo dos cards nem o aceite físico. Issue06/M1 permanecem abertos por desempenho, demais estados/leitura/paletas, iPhone adiado e gates externos já documentados.
