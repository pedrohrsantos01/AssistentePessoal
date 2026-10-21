# Próximo recorte — perfil da apresentação do cumprimento

Status: ready. Origem: issue06, spec/07 §1 e [confirmação leve](../../docs/analises/2026-10-20-feedback-com-probe-leve-m1.md). Não iniciado.

Coorte leve v4 válida: 11/20≤100 ms, p50/p95/máximo 88,2632/242,4520/450,0828 ms. Preservar as nove amostras acima da meta, inclusive 100,3508 ms. Na maior (3/2), React→frame tomou 321,1195 ms; retorno→React 43,4988 ms. Esses intervalos não identificam o componente responsável. Um refresh por alteração em 20/20; persistência/reinício/convergência de um hábito/10 XP aprovados.

Delimitar diagnóstico da apresentação com correlação do mesmo gesto, relógios e frame. Escolher captura adequada após conferir suporte das ferramentas; declarar seu modo e custo de observação. Evitar reintroduzir leituras síncronas por função no caminho leve. Atribuir trabalho/esperas JS e UI com fonte validada; não chamar escalonamento de CPU útil nem atribuir GPU/GC/host sem evidência. Conservar modo detalhado e recusar perda de dados/perfis esperados.

Antes de modificar componentes, usar uma captura válida para escolher uma única intervenção. Se houver intervenção, comparar com a mesma observação e critérios, mantendo todas as amostras válidas; não repetir só para selecionar resultado melhor. Não subtrair overhead, deslocar origem, relaxar limite ou antecipar sucesso ao commit. Nenhuma mudança de regra, identidade, XP, fila, cache de projeção, schema ou migração assíncrona.

Checks completos app/API e ensaio visível somente durante os testes, com fechamento dos recursos próprios e preservação dos preexistentes. Depois: partida dos cards, com origem de abertura mantida; confirmação atual 0/10≤300 ms, abertura 8/10≤2 s, picos 5,45/4,55 s preservados. Aparelho físico, iPhone adiado e demais gates 06/M1 permanecem abertos.
