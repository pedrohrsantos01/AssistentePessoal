---
status: accepted
date: 2026-09-25
---

# ADR-018 — Agenda e meta preservam a avaliação histórica

Em R4-Q16 e Q17, Pedro decidiu que mudanças de agenda e meta de hábitos existentes passam a valer no próximo dia lógico. Hoje e os dias anteriores continuam sendo avaliados pelas regras que valiam em cada período, inclusive em registros retroativos e recálculos de ofensiva. Hábito recém-criado continua podendo ser devido hoje.

Recalcular todo o histórico pela configuração atual seria mais simples, mas poderia apagar faltas, alterar séries ou retirar um cumprimento já obtido. Aceitamos representar a vigência das regras para evitar esses efeitos. A contrapartida é que até uma correção de meta digitada errada espera a próxima virada; a interface deve informar quando a mudança começa.

A decisão substitui as alternativas ainda abertas de REQ-HAB-007: aplicar a mudança hoje ou reinterpretar o histórico com aviso. Não escolhe a estrutura física de versionamento.

Em R5-Q23, Pedro aprovou uma exceção à vigência no próximo dia: mudanças de agenda que entram, saem ou alteram N vezes por semana começam na próxima segunda-feira, na virada do dia lógico. A semana em andamento conserva a regra antiga. Esperar mais preserva o período de avaliação semanal; mudanças de meta quantitativa por dia e outras agendas continuam seguindo o próximo dia lógico.

Em R6-Q25, Pedro aceitou que a edição offline é uma proposta preservada localmente: a nova regra só recebe vigência após aceitação pelo servidor, evitando reavaliar dias processados com a regra anterior em outro aparelho. Q29 confirmou os dois cortes a partir dessa aceitação: próximo dia lógico para metas quantitativas e agendas não semanais; próxima segunda-feira lógica para mudanças envolvendo agenda semanal. Criar hábitos e registrar cumprimentos continuam disponíveis offline; a exceção é a ativação de uma mudança de regra de hábito existente.

Origem: [entrevista da fundação, R4-Q16/Q17, R5-Q23, R6-Q25 e Q29](../../.scratch/fundacao/entrevista.md). Contratos: [Hábitos](../../specs/02-habitos.md) e [Gamificação](../../specs/04-gamificacao.md).
