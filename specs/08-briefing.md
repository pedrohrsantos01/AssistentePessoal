# spec/08 — Briefing (tela inicial)

**Prioridade:** P0 na Fase 1, em versão reduzida. É a home do app e a superfície onde todos os módulos futuros aparecem.

---

## 1. O que é

A primeira tela ao abrir o app, e a **única** tela de uso diário. Responde, em uma rolagem, à pergunta: **"o que eu preciso saber agora?"**

**REQ-BRF-000 — O Briefing absorve a antiga "tela Hoje".** Não existe tela Hoje separada. Hábitos e tarefas do dia são cards **dentro** do Briefing, marcáveis ali mesmo. As telas dedicadas de hábitos e tarefas existem para **gestão** (criar, editar, arquivar, ver histórico), não para o uso diário. Qualquer spec que ainda mencione "tela Hoje" refere-se ao Briefing.

Ela não é uma lista de tarefas com enfeites. É uma pilha de **cards independentes**, cada um pertencente a um módulo, ordenados por relevância do momento.

**Regra de ouro:** o Briefing sempre entrega algo antes de pedir algo. Se não houver nada a mostrar, ele mostra o resumo do dia anterior ou uma conquista recente — nunca uma tela que só cobra.

## 2. Arquitetura de cards

**REQ-BRF-001** — O Briefing é um **registro de providers**. Cada módulo registra um `BriefingCardProvider`:

```ts
type BriefingCardProvider = {
  id: string;                 // 'habits.today', 'sports.next_match'
  module: ModuleId;
  priority: (ctx: BriefingContext) => number | null;  // null = não exibir agora
  load?: (ctx: BriefingContext) => Promise<CardData>;
  render: (data: CardData) => ReactNode;
};
```

O Briefing **não conhece nenhum módulo**. Adicionar Notícias ou Esportes na Fase 2 é registrar um provider, não reescrever a home. Esta é a razão de a tela existir desde a Fase 1 mesmo com só três cards.

**REQ-BRF-002** — Um card que falha ao carregar **não derruba a tela**: ele some ou mostra estado de erro contido. Error boundary por card, obrigatório.

**REQ-BRF-003** — Cards carregam de forma independente e progressiva. A tela nunca espera o mais lento. Cards locais (hábitos, tarefas) aparecem instantaneamente; cards de rede (notícias, jogos) chegam depois com skeleton.

No M1, a sessão já entrega a projeção local confirmada. Esses providers renderizam o contexto diretamente, sem loader assíncrono que substitua controles por carregamento a cada atualização. Providers que precisam carregar dados conservam o loader opcional e o isolamento próprio de falha. A atualização de um cumprimento preserva a identidade do controle e o foco acessível; não expõe sucesso antes da gravação local.

**REQ-BRF-004** — O usuário pode ocultar e reordenar cards nas configurações. Ordem manual vence a automática.

## 3. Cards da Fase 1

**Recorte aprovado para o primeiro marco (R6-Q27):** saudação, hábitos binários diários acionáveis e XP básico. Ofensivas, níveis, proteções, conquistas, Agenda, tarefas e fechamento do dia chegam nos incrementos correspondentes da Fase 1; não exibir controles de capacidades indisponíveis. O estado vazio oferece uma ação útil de criação de hábito.

**Direção visual consolidada em 09/10/2026:** Pedro entregou o protótipo; [spec/11](11-design-system.md) define a referência e correções de acessibilidade. O [recorte 01](../docs/analises/2026-10-09-interface-primeira-jornada.md) implementa saudação, data/dia lógico, hábitos e XP com providers locais independentes, vazio útil e subscrições da projeção real. Os [recortes M1](../.scratch/interface-m1/spec.md) seguintes e o aceite integral nos aparelhos permanecem pendentes.

A tabela abaixo descreve o Briefing da Fase 1 completa.

| Card | Prioridade | Conteúdo |
|---|---|---|
| **Saudação e data** | sempre no topo | nome, data por extenso, ofensiva global |
| **Agenda de hoje** | alta se houver evento hoje | até 4 eventos; próximo evento em <1h ganha destaque (spec/12 §4) |
| **Hábitos de hoje** | alta se houver hábito devido não cumprido | lista marcável direto no card, sem navegar |
| **Tarefas de hoje** | alta se houver atrasada ou vencendo hoje | até 5 itens, concluíveis direto no card |
| **Fechamento do dia** | após as 21h, se tudo cumprido | resumo do dia, XP ganho |

**REQ-BRF-005** — Hábito e tarefa são acionáveis **dentro do card**. Se o usuário precisa navegar para marcar, o Briefing falhou.

**REQ-BRF-005a — Viradas independentes.** Aceito em R4-Q18: o card de tarefas usa a data civil no fuso do perfil e atualiza seus grupos à meia-noite; hábitos e XP usam o dia lógico configurado. À 00h30, uma tarefa de ontem já pode estar atrasada enquanto o hábito ainda pertence ao dia lógico anterior. Os cards devem respeitar o calendário do próprio domínio, sem aplicar a virada das 04h a todos os dados.

## 4. Cards da Fase 2 (planejados, não implementar agora)

| Card | Módulo | Gatilho |
|---|---|---|
| Manchetes do dia | Notícias | sempre, com 3 a 5 itens |
| Mediação de agenda | Agenda + IA | choque de horário, deslocamento inviável, dia sobrecarregado (spec/12 §9) |
| Jogo hoje | Esportes | dia de jogo de time favorito |
| Ao vivo | Esportes | partida em andamento — sobe para o topo |
| Resultado | Esportes | até 12h após o fim da partida |
| Treino de hoje | Treinos | dia previsto na rotina |
| Resumo financeiro | Finanças | segundas e dia 1º |

## 5. Entrega proativa

**REQ-BRF-006 — Notificação de briefing matinal.** Uma notificação local por dia, em horário escolhido pelo usuário (padrão 07:00), abrindo direto no Briefing. Texto = a manchete do card de maior prioridade, não uma mensagem genérica.

**REQ-BRF-007** — Desligável em um toque. Nunca mais de uma por dia. Respeita o silêncio noturno (REQ-GAM-021).

## 6. Desempenho

- Cards locais renderizados em ≤ 300 ms após o cold start
- [Perfil nativo de 21/10/2026](../docs/analises/2026-10-21-apresentacao-do-cumprimento-m1.md): cards0/10≤300 ms, mesma origem da abertura (p50 1685,8937 ms). Abertura10/10≤2 s nessa coorte com trace; não aceita aparelho físico. Feedback0/20≤100 ms, pico411,7630 ms. Próximo experimento: manter o checkmark montado; partida dos cards vem depois. Metas e M1 abertos; não deslocar a origem nem comparar causalmente observações diferentes.
- [Perfil nativo de 21/10/2026](../docs/analises/2026-10-21-apresentacao-do-cumprimento-m1.md): cards0/10≤300 ms, mesma origem da abertura (p50 1685,8937 ms). Abertura10/10≤2 s nessa coorte com trace; não aceita aparelho físico. Feedback0/20≤100 ms, pico411,7630 ms. Próximo experimento: manter o checkmark montado; partida dos cards vem depois. Metas e M1 abertos; não deslocar a origem nem comparar causalmente observações diferentes.
- Cards de rede com cache: sempre mostra o último conteúdo conhecido enquanto revalida (stale-while-revalidate). **Nunca card vazio esperando rede**
- Pull-to-refresh força atualização de todos os cards de rede

## 7. Edge cases mapeados

1. Primeiro dia de uso, sem nada cadastrado → card de boas-vindas com 3 ações sugeridas, nunca tela vazia
2. Todos os cards de rede falhando (avião) → tela funciona com cards locais, com indicação discreta de offline
3. Dia sem nada devido → card de folga, com tom neutro e sem sugerir que o usuário está sendo improdutivo
4. Usuário abre o app 15 vezes por dia → o conteúdo do card de notícias não pode mudar de ordem a cada abertura; estabilizar por janela de 3 horas
5. Card de "ao vivo" durante uma partida → sobe para o topo e atualiza sem o usuário precisar puxar; ao fim da partida, vira card de resultado
6. Mais de 10 cards elegíveis → limite de 7 na tela, com "ver mais"

20/10/2026 — [Desempenho instrumentado](../docs/analises/2026-10-20-desempenho-instrumentado-m1.md). Rodada8/schema2 válida no AVD/API35/3GB:10 processos frios/20 alterações offline. Abertura: p95/máximo1091,88ms,10/10≤2s. Cards: p50 de883,51ms,0/10≤300ms. Feedback: p95 de135,03ms/máximo3014,37ms,0/20≤100ms. Origem de abertura/cards no launcher do próprio Android antes do Intent; PID ausente/novo e relógios correlacionados ao frame, sem incluir comunicação do ADB. Reinício/convergência independente10XP e restauração confirmados; recursos próprios fechados. Tipos/lint e249 testes app; check API85 executados/oito opt-in ignorados,13 operacionais/modularidade, zero falhas. Sete tentativas rejeitadas separadas; metas não relaxadas. Próximo: atribuir/reduzir latência do cumprimento, depois partida dos cards. AVD não aceita aparelho mediano físico/iPhone;06/M1 continuam abertos.

20/10/2026 — [Latência do cumprimento](../docs/analises/2026-10-20-latencia-do-cumprimento-m1.md). Removida a atualização duplicada após commit, com regressão SQLite red/green e uma publicação por alteração em 20/20. Comparação v4 completa: mediana130,74→97,31 ms, p95 175,56→160,58 ms, máximo 189,90→234,66 ms e 1/20→12/20≤100 ms. A meta permanece aberta. Probe exige DOWN/UP elegível e PressEvent correspondente; diagnóstico v3 com UP antigo e tentativa com FrameMetrics perdida ficaram separados. Tipos/lint/253 testes app e check API isolado em 12 min 17 s aprovados:85 executados/oito opt-in ignorados,zero falhas/erros,modularidade. Primeira execução WAL503 preservada, causa não estabelecida. Reinício/convergência 10 XP, configuração/instalação e recursos próprios encerrados verificados. Próximo: decompor handler→commit/refresh restante, depois cards. AVD não aceita aparelho físico/iPhone;06/M1 continuam abertos.

20/10/2026 — [Cauda do cumprimento](../docs/analises/2026-10-20-cauda-do-cumprimento-m1.md). Resolução IANA memoizada após perfil validado do escalonador. Coortes v4+sched1 completas: p50 137,98→85,36 ms, p95 236,96→101,00 ms, máximo 270,67→120,76 ms e 0/20→18/20 dentro de 100 ms. Custo mediano dos spans de dia 33,91→0,95 ms. Duas amostras altas preservadas; meta continua aberta. Traces com relógio/cobertura/perdas conferidos; contador Debug rejeitado e tentativas inválidas separadas. Reinício/convergência de um hábito/10 XP, configurações restauradas e emulador/painel próprios fechados. Tipos/lint/259 testes app e seis testes do analisador aprovados; check API aprovado em 12 min 56 s: 85 executados/oito opt-in ignorados, zero falhas/erros e modularidade. Próximo: confirmar com observação reduzida, depois cards. Perfil detalhado não se compara diretamente ao ensaio anterior sem essas observações. Aparelho físico/iPhone, demais estados/leitura/paletas e gates externos mantêm 06/M1 abertos.

20/10/2026 — [Confirmação com probe leve](../docs/analises/2026-10-20-feedback-com-probe-leve-m1.md). Modos explícitos e coorte v4 válida: dez partidas/vinte alterações offline, reinício/convergência de um hábito/10 XP, restauração/isolamento e fechamento dos recursos próprios. Feedback p50/p95/máximo 88,2632/242,4520/450,0828 ms e 11/20≤100 ms; nove amostras altas preservadas. Abertura 8/10≤2 s, máximo 5451,6263 ms; cards 0/10≤300 ms. Observação diferente não permite comparação causal com o perfil detalhado anterior. Tipos/lint e 261 testes app aprovados; check API completo em 15 min 54 s: 85 executados/oito opt-in ignorados, zero falhas/erros e modularidade. Fixture de expiração alinhada ao Clock da API após regressão vermelha/verde; primeira falha preservada. Próximo: perfil da apresentação do cumprimento, depois cards. Metas, demais estados/leitura/paletas, aparelho físico/iPhone e gates externos mantêm 06/M1 abertos.
