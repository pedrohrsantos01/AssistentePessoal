---
status: accepted
date: 2026-09-25
---

# ADR-017 — Reconciliação preserva lançamentos e correções

Em R3-Q11 a Q14, Pedro escolheu preservar o significado das ações entre aparelhos: desfazer um cumprimento prevalece sobre uma marcação concorrente que desconhecia a correção; uma nova marcação depois de incorporar o desfazer pode restabelecê-lo. Lançamentos quantitativos independentes somam, e desfazer um lançamento retira apenas sua contribuição. Edições em campos independentes são combinadas. Refazer uma ação restaura sua concessão original de XP, sem outra recompensa nem novo consumo do teto.

Escolher uma cópia inteira do registro diário seria mais simples, mas perderia quantidades, edições independentes ou correções ao receber dados atrasados. Aceitamos distinguir o cumprimento diário, cada lançamento e a concessão de XP, além dos envios usados para sincronizá-los. A marcação concorrente pode desaparecer ao prevalecer o desfazer; essa consequência foi explicitada e aceita.

Em R4-Q15, Pedro definiu o desempate do mesmo campo: entre alterações efetivamente concorrentes, prevalece a última aceita pelo servidor. Uma edição feita antes pode vencer por chegar depois; isso evita depender do relógio dos aparelhos, sem prometer reconstruir a ordem real da intenção. Retry não é nova edição, a sequência já conhecida precisa ser respeitada e as regras específicas de desfazer/exclusão continuam prevalecendo.

Esta decisão complementa o ADR-015 e substitui a resolução genérica por cópia inteira e descarte de um dos logs quando ela contrariar essas regras. Não escolhe event sourcing, CRDT, formato de comandos ou novas tabelas. A identidade lógica é parte do contrato; sua representação, a evidência de que o aparelho incorporou a correção e o registro inequívoco da ordem de aceitação ainda precisam ser especificados antes da implementação. As constraints atuais, sozinhas, não garantem o comportamento aprovado.

Origem: [entrevista da fundação, R3-Q11 a Q14 e R4-Q15](../../.scratch/fundacao/entrevista.md). Contratos: [Hábitos](../../specs/02-habitos.md), [Tarefas](../../specs/03-tarefas.md), [Gamificação](../../specs/04-gamificacao.md) e [Sincronização](../../specs/06-sincronizacao.md).
