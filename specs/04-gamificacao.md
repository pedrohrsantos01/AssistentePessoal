# spec/04 — Engine de gamificação

**Prioridade:** P0. É a engine mais reutilizada do sistema — todo módulo futuro depende dela. Errar aqui custa reescrita.

Toda a lógica deste spec vive em `src/features/gamification/domain/` como **funções puras**, sem React e sem I/O, com cobertura de teste de 100% nas regras de ofensiva e XP.

---

## 1. XP

**Recorte do primeiro marco (R6-Q27):** XP básico de hábitos binários diários, com concessão única por cumprimento, teto diário, reversão/restauração e reconciliação entre aparelhos. O Briefing mostra esse XP; interfaces de níveis, ofensivas, proteções e conquistas ficam para incrementos seguintes da Fase 1. As regras abaixo continuam sendo o contrato final da fase, sem exigir todos os seus mecanismos no primeiro marco.

### Tabela de concessão

| Evento | XP | Módulo |
|---|---|---|
| Hábito binário cumprido ou hábito negativo com "resisti hoje" explícito | 10 | `habits` |
| Hábito quantitativo atingindo a meta | 10 (uma vez) | `habits` |
| Tarefa concluída — prioridade nenhuma/baixa | 5 | `tasks` |
| Tarefa concluída — média | 8 | `tasks` |
| Tarefa concluída — alta | 12 | `tasks` |
| Marco de ofensiva (7, 30, 100, 365 dias) | 50 / 200 / 500 / 2000 | `habits` |
| Conquista desbloqueada | definido no catálogo | — |

### Regras invioláveis

**REQ-GAM-001 — Idempotência.** Reprocessar, sincronizar duas vezes ou marcar duas vezes **não** pode gerar XP duplicado. Para hábitos, a concessão corresponde ao mesmo cumprimento lógico da conta, hábito e dia, mesmo que os aparelhos criem IDs locais diferentes ou haja desfazer e remarcar. Para tarefas, refazer a mesma conclusão não cria outra concessão. O banco deve impor unicidade sobre a identidade canônica correspondente; a constraint atual `(user_id, source_type, source_id)` só é suficiente se `source_id` representar essa identidade. O mapeamento físico será fechado em spec/00 e no contrato de sync.

**REQ-GAM-002 — Teto diário por módulo, adaptativo.** O teto **não** é um número fixo: é `max(150, 15 × número de hábitos ativos devidos hoje)` para o módulo de hábitos, e **150 XP** para tarefas. Um teto fixo de 100 seria atingido por quem tem 11 hábitos apenas cumprindo a própria rotina, e a mensagem de limite apareceria justamente quando o usuário fez tudo certo — o oposto do objetivo. O teto existe contra exploit, não contra uso legítimo. Ao atingir, a ação continua funcionando normalmente, apenas não gera XP, e a UI mostra discretamente "meta de XP do dia atingida". Isto é a defesa contra o exploit óbvio: criar e concluir 50 tarefas em um minuto.

**REQ-GAM-003 — XP não é subtraído, é revertido.** Desfazer uma ação marca `reverted_at` no evento. O total nunca fica negativo e o histórico nunca é apagado.

**REQ-GAM-003a — Restaurar a concessão original.** Aceito em R3-Q14: refazer o mesmo fato após reversão restaura a concessão original, preservando seu valor e `day_key`. Não cria novo prêmio nem consome novamente o teto; desfazer continua sem devolver o orçamento já consumido. Exemplo: cumprimento com 10 XP → desfazer com 0 XP válido → refazer com os mesmos 10 XP. Em tarefas, aplica-se quando a reversão ocorreu dentro das 24 horas de REQ-TAR-004; se o XP não foi revertido, refazer não acrescenta nada. Restauração não autoriza criar XP para uma ação que não recebeu concessão originalmente. O histórico de reversões e restaurações deve ser preservado; limpar `reverted_at` sem manter esse histórico não basta como modelo definitivo.

**REQ-GAM-004 — XP retroativo conta no dia de destino.** Registrar ontem consome o teto de ontem. Impede farming em lote.

**REQ-GAM-005 — Subtarefa não gera XP.** Apenas a tarefa-pai.

**REQ-GAM-006 — Tarefa criada e concluída em menos de 10 segundos gera XP normalmente**, mas conta duplamente para o teto diário. Amortiza o "tarefa fantasma" sem punir o usuário que realmente fez algo rápido.

## 2. Dia lógico e fuso horário

> Esta é a fonte de metade dos bugs de app com ofensiva. Leia com atenção.

- O dia lógico do usuário começa em `day_start_hour` (padrão **04:00**) e termina imediatamente antes da próxima virada, no fuso `users.timezone`. No padrão das 04:00, 03:59 pertence ao dia anterior; o limite acompanha o horário configurado.
- `day_key` é uma **string `YYYY-MM-DD`**, calculada no cliente no momento da ação, e **imutável** depois de gravada.
- **Nunca** derive o dia a partir de `created_at` em UTC numa query. Sempre use `day_key`.
- O servidor valida: `day_key` não pode ser mais de 1 dia à frente do dia do servidor no fuso do usuário (defesa contra relógio adulterado).
- Mudança de fuso do perfil afeta apenas registros futuros.
- Prazos e grupos de tarefas seguem o calendário civil, com virada à meia-noite; o XP de uma conclusão segue seu `day_key`. Não usar a data de prazo como dia automático de contabilização (R4-Q18).
- Cumprimento e ofensiva de hábitos usam a agenda e a meta vigentes no período avaliado, inclusive ao recalcular o histórico. Após aceitação pelo servidor, novas regras começam no próximo dia lógico; mudanças de agenda que entram, saem ou alteram `times_per_week` começam na próxima segunda-feira lógica (REQ-HAB-007a/b, R6-Q25 e Q29). A proposta offline ainda não aceita não muda a avaliação corrente.

**REQ-GAM-008a — Virada do dia com o app aberto.** Se o app fica aberto atravessando a hora de virada (03:59 → 04:00), o Briefing e os cards precisam se reconstruir sozinhos: hábitos voltam a aparecer como não cumpridos, a ofensiva é reavaliada e o XP marcado às 04:01 conta para o **dia novo**. Implementar por timer agendado para a próxima virada, recriado a cada volta do foreground — nunca por polling de minuto em minuto.

O exemplo acima usa o padrão das 04:00. A virada efetiva segue o perfil; os grupos de tarefas também precisam se atualizar à meia-noite civil, independentemente dessa virada. Agenda/meta de hábitos com nova vigência passam a ser consideradas no dia correspondente.

Função canônica: `getDayKey(date: Date, timezone: string, dayStartHour: number): string`. Testes obrigatórios: virada de meia-noite, 03:59 vs 04:01, horário de verão (23h e 25h), fusos com offset de 30 e 45 minutos, dispositivo com relógio adiantado.

## 3. Níveis

Curva: `xpParaNivel(n) = 100 * n^1.5`, arredondado para múltiplo de 10.

| Nível | XP acumulado |
|---|---|
| 2 | 280 |
| 5 | 1.120 |
| 10 | 3.160 |
| 20 | 8.940 |
| 50 | 35.350 |

**REQ-GAM-007** — Nível é sempre **derivado** de `sum(xp_events)`, nunca armazenado como fonte da verdade. `user_progress` é cache e deve ser recalculável por `recomputeProgress(userId)`.

**REQ-GAM-008** — Subir de nível mostra celebração breve (≤ 1,5 s), dispensável com um toque, e **nunca** bloqueia o fluxo. Nada de modal que exige "continuar".

## 4. Ofensiva (streak)

**REQ-GAM-009 — Ofensiva por hábito.** Conta apenas **dias devidos**. Hábito de seg/qua/sex não quebra no domingo.

**REQ-GAM-010 — Ofensiva global.** Sequência de dias lógicos com **pelo menos um** registro explícito (hábito ou tarefa), preservada nas ausências cobertas por REQ-GAM-011. É esta que aparece na home. O avanço automático de um hábito negativo sem recaída não é registro explícito nem incrementa a global (R5-Q21).

**REQ-GAM-011 — Proteção de ofensivas (congelamento).** Aceito em R5-Q22: **dois dias lógicos protegidos por conta a cada mês civil**, automaticamente, sem acumular saldo para o mês seguinte. A cota não é por hábito. O mês de referência corresponde à data do dia lógico protegido; sincronizar depois não transfere seu consumo para outro mês.

- Uma unidade cobre conjuntamente as ofensivas avaliadas por dia que precisariam de proteção naquele dia, incluindo a global quando necessário. Três hábitos devidos sem cumprimento no mesmo dia não gastam três unidades
- O dia protegido preserva a série, mas não conta como cumprimento, não aumenta sua contagem e não concede XP. Uma série de seis continua com seis durante a proteção; o próximo cumprimento pode avançar para sete
- Agendas `times_per_week` não recebem proteção no v1. Recaída explícita de hábito negativo continua zerando sua ofensiva; proteção não apaga uma recaída
- Consumo é automático, sem interromper o usuário. A UI informa depois, em linguagem neutra, por exemplo "usamos uma proteção ontem"
- Clientes precisam convergir para os mesmos dias protegidos e o mesmo saldo da conta; contadores locais por hábito não são fonte da verdade

**REQ-GAM-011a — Proteção após correção retroativa.** Aceito em R6-Q24: quando registros retroativos eliminarem a necessidade de proteção de todas as ofensivas daquele dia, a unidade deixa de consumir a cota do mês original. Corrigir só um dos hábitos não devolve a unidade se outro hábito ou a global ainda depender dela. A unidade pode proteger outra ausência no mesmo mês, mas nunca é transferida para um mês posterior. O recálculo precisa convergir entre aparelhos sem duplicar saldo. Esta devolução não altera a regra de não devolver teto de XP ao desfazer uma ação.

**REQ-GAM-012 — Registro retroativo restaura ofensiva.** Dentro da janela de 7 dias (REQ-HAB-006), registrar um dia perdido recalcula e pode restaurar a série.

**REQ-GAM-013 — Ofensiva é desligável.** `users.streaks_enabled = false` remove toda a UI de ofensiva do app. XP e conquistas continuam. Esta opção fica visível nas configurações, não escondida.

**REQ-GAM-014 — Ofensiva nunca é fonte de culpa.** Ver §6.

## 5. Conquistas

Catálogo estático versionado em `src/features/gamification/achievements.ts`, com `code` estável.

**REQ-GAM-014a — O catálogo é dado local, embarcado no bundle do app.** A tabela `achievements` no Postgres é apenas espelho para consulta; ela **não** é a fonte que o app lê. Sem isso, o primeiro uso offline não consegue desbloquear nada.

**REQ-GAM-015** — Conquista desbloqueada **nunca** é revogada, mesmo que a ação de origem seja desfeita. Retirar medalha é punição desproporcional e destrói confiança.

**REQ-GAM-016** — Ao adicionar conquista nova numa versão futura, roda-se avaliação retroativa: quem já cumpriu o critério recebe na atualização.

Catálogo inicial sugerido: primeira semana, 7/30/100 dias de ofensiva, 100 hábitos registrados, 500 tarefas concluídas, um dia com todos os hábitos cumpridos, primeira ação por voz, 30 dias usando o app.

## 6. Guardrails de bem-estar — obrigatórios

Gamificação de comportamento pessoal tem risco real de dano. Estas regras são requisito, não recomendação.

**REQ-GAM-017 — Proibida copy de culpa.** Nada de "você falhou", "você desistiu", "está perdendo tudo". Ao quebrar uma ofensiva, a mensagem é factual e neutra, com opção imediata de recomeço. Revisar toda string de `src/i18n/pt-BR.ts` contra esta regra.

**REQ-GAM-018 — Proibida notificação de aversão à perda agressiva.** No máximo **uma** lembrança por dia sobre ofensiva em risco, enviada no horário definido pelo usuário, nunca à noite por padrão, e desligável em um toque.

**REQ-GAM-019 — Sem punição por ausência.** Voltar depois de 30 dias sumido não gera tela de vergonha, não mostra contagem de dias perdidos, não zera XP. A tela de retorno é acolhedora e mostra o que ainda está lá.

**REQ-GAM-020 — Limite de hábitos de contagem corporal.** Quando módulos de Fase 2/3 chegarem (treino, alimentação), XP **não** pode ser vinculado a peso, déficit calórico ou restrição. Registrar pode dar XP; atingir número de peso ou caloria, não. Regra permanente.

**REQ-GAM-021 — Silêncio noturno.** Nenhuma notificação de gamificação entre 22:00 e 07:00, salvo se o usuário configurar explicitamente.

## 7. Edge cases mapeados

1. Dois dispositivos offline geram XP para o mesmo hábito/dia → reconciliar a identidade lógica e manter uma concessão; UUIDs diferentes dos logs locais não autorizam ganhos separados
2. Usuário muda o fuso e "ganha" um dia → `day_key` imutável impede ofensiva inflada
3. Teto diário atingido e depois uma ação é desfeita → o teto **não** é devolvido no mesmo dia (senão vira brecha)
4. Relógio adiantado em 3 dias → servidor rejeita `day_key` futura; app avisa que a data do aparelho parece incorreta
5. Conquista e marco de ofensiva disparando juntos → celebrações são enfileiradas, nunca empilhadas em cima uma da outra
6. Usuário desliga ofensiva e liga de novo → a série é recalculada do histórico real, sem lacuna
7. Hábito excluído com XP já concedido → XP permanece; `source_id` órfão é tolerado por design
8. Migração de curva de nível numa versão futura → nível é derivado, então o recálculo é automático; nunca migrar XP

## 8. Testes obrigatórios

`streak.test.ts` precisa cobrir no mínimo: dia devido vs não devido, quebra, congelamento consumido, congelamento esgotado, restauração retroativa, virada de mês, mudança de fuso, horário de verão, série de 365 dias, hábito `times_per_week`, hábito negativo.

Incluir as decisões R5: uma proteção por conta/dia cobrindo vários hábitos e a global; cota mensal sem acúmulo; proteção sem aumentar contagem ou conceder XP; ausência de proteção para quota semanal/recaída explícita; hábito negativo sem registro avança apenas sua ofensiva, sem 10 XP diários nem incremento automático da global; marcos de ofensiva preservados; transição de agenda semanal na segunda-feira lógica.

R6-Q24 acrescenta: correção de todas as ausências libera a unidade; correção parcial mantém o consumo; devolução pertence ao mês original, inclusive após virada de mês; retry/recálculo não duplica saldo nem altera o teto de XP.

Os testes de XP devem cobrir: dupla marcação em aparelhos distintos; ciclos de desfazer/refazer sem ganho adicional; restauração do valor e dia originais sem novo consumo do teto; tarefa refeita com e sem reversão anterior. A concessão reconciliada pelo servidor determina o total válido nos aparelhos (ADR-015).
