# Próximo recorte — cauda do cumprimento e recomposição restante

Status: ready. Origem: issue06, spec/07 §1 e [comparação de 20/10/2026](../../docs/analises/2026-10-20-latencia-do-cumprimento-m1.md). Não iniciado.

A atualização duplicada foi removida: uma publicação após commit em 20/20 casos. No método v4, o feedback corrigido teve p50 de 97,31 ms, p95 de 160,58 ms, máximo de 234,66 ms e 12/20≤ 100 ms. A meta continua aberta. O maior caso teve77,86 ms entre handler/commit e 52,25 ms entre commit/retorno, além de atraso de entrega e apresentação; não culpar apenas o SQLite.

Instrumentar separadamente leitura do perfil, cálculo do dia lógico, identidade/comando, transação/projeção e recomposição/scheduling. Relacionar a cauda com trabalho/esperas do runtime e do ambiente usando perfil apropriado, sem presumir causa por leitura do código. Otimizar somente o custo demonstrado, uma variável por vez, com regressão na interface real e nova coorte completa. Não introduzir cache de domínio ou migração para assíncrono sem essa prova.

Manter probe v4: DOWN/UP elegível e PressEvent correspondente, relógios nativos conferidos, endpoint de frame, dez partidas/vinte alterações offline, todas as amostras válidas altas e metas intactas. Usar pasta nova e preservar tentativas inválidas; nenhuma distribuição parcial substitui a coorte. Preservar commit SQLite antes de sucesso, fila, identidade, XP, reinício e convergência independente.

Repetir tipos/lint/suíte app/check API. Testes visíveis; emulador e acompanhamento apenas durante ensaio e fechados ao final, preservando processos preexistentes. Evitar compilação ou suítes pesadas concorrentes durante medições. Essa condição de isolamento não estabelece a causa das variações já observadas.

Depois, partida dos cards (continua0/10≤ 300 ms na coorte corrigida). Issue06/M1 permanecem abertos também por demais estados/leitura/paletas, aceite físico/iPhone adiado e gates externos documentados.
