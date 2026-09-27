# spec/03 — Módulo Tarefas

**Prioridade:** P0 (Fase 1).

**Posicionamento honesto:** este é o módulo com a concorrência mais dura do mercado (Todoist, TickTick, Things). Não vamos vencer em funcionalidade. A única vantagem defensável é **entrada por voz em 3 segundos** e a integração com hábitos e XP. Por isso: v1 deliberadamente enxuto. Não implemente filtro avançado, visão kanban, linguagem natural de data no campo de texto, nem colaboração.

---

## 1. Requisitos

### REQ-TAR-001 — Criar tarefa
**Critérios de aceite**
- Criação rápida: campo único de título + botão salvar, em ≤ 2 toques desde o Briefing
- Título é o único campo obrigatório
- Criada sem prazo, a tarefa vai para "Sem data"
- Funciona offline

### REQ-TAR-002 — Tela de edição dedicada
Campos: título, notas, status, prioridade, prazo (data + hora opcional), etiquetas, recorrência, subtarefas.

**Critérios de aceite**
- Alteração de status é possível direto da lista, sem abrir a edição
- Saída sem salvar com alterações pendentes pede confirmação
- Excluir pede confirmação e oferece desfazer por 5 segundos

### REQ-TAR-003 — Listagem e agrupamento
**Critérios de aceite**
- Grupos padrão: Atrasadas, Hoje, Amanhã, Próximos 7 dias, Sem data
- Os grupos usam a data civil no fuso do perfil e mudam à meia-noite local; não esperam a virada do dia lógico de hábitos/XP (R4-Q18)
- "Atrasadas" aparece **primeiro** e com destaque, mas sem cor de alarme agressiva
- Concluídas saem da lista principal e ficam em aba própria dos últimos 30 dias
- Ordenação dentro do grupo: prioridade, depois horário, depois `sort_order` manual
- Reordenação por arrastar persiste em `sort_order`

### REQ-TAR-004 — Conclusão
**Critérios de aceite**
- Marcar concluída gera `xp_event` de `source_type=task_completion`, respeitando o teto diário
- Desmarcar em até 24h reverte o XP (`reverted_at`); depois de 24h o XP fica
- Concluir novamente após reversão restaura a concessão original, com o mesmo valor e dia e sem novo consumo do teto (REQ-GAM-003a). Se o XP não foi revertido, concluir novamente não acrescenta nada
- Concluir tarefa-pai com subtarefas abertas pergunta se deve concluir todas
- Concluir ocorrência de tarefa recorrente gera a próxima (REQ-TAR-005)
- Exceção para desmarcar ocorrência recorrente: verificar REQ-TAR-005b antes de reabrir a tarefa ou reverter seu XP; a existência de trabalho posterior pode impedir o desfazer

### REQ-TAR-005 — Recorrência
Suporte a subconjunto de RRULE: `FREQ=DAILY|WEEKLY|MONTHLY`, `INTERVAL`, `BYDAY`, `BYMONTHDAY`, `COUNT`, `UNTIL`.

**Critérios de aceite**
- Recorrência é **por conclusão, não por materialização em massa**: existe **no máximo uma ocorrência aberta** por série. Ao concluir, a próxima elegível é gerada se a regra ainda permitir; série encerrada pode ter zero. Isso evita gerar centenas de linhas e evita a lista entupida de futuro
- Editar uma ocorrência pergunta: "só esta" ou "esta e as próximas"
- Excluir a série exige confirmação explícita e informa quantas ocorrências concluídas serão preservadas no histórico
- Ocorrência não concluída **não** acumula: se o usuário some por 10 dias numa tarefa diária, ele volta e encontra **uma** ocorrência atrasada, não dez
- `FREQ=MONTHLY;BYMONTHDAY=31` em fevereiro cai no **último dia do mês**, nunca pula o mês

### REQ-TAR-005a — Limite de ocorrências e datas puladas
Aceito em R5-Q19: `COUNT` conta as posições previstas no calendário, inclusive aquelas puladas por estarem vencidas. Não representa uma quantidade garantida de conclusões. Cinco ocorrências previstas de segunda a sexta continuam limitadas a essas cinco posições se a primeira for concluída apenas na quinta; a série não se prolonga para compensar terça e quarta. Preservar a regra já existente de calcular a próxima pela data prevista e pular vencidas. Uma posição pulada não é tarefa concluída e não gera XP.

### REQ-TAR-005b — Desfazer conclusão com sucessora existente
Aceito em R5-Q20 como exceção à regra geral de desmarcar:

- Se a sucessora gerada continua sem intervenção do usuário, desfazer retira essa sucessora e reabre a ocorrência anterior. A série continua com no máximo uma ocorrência aberta
- Se a sucessora já foi editada, concluída ou recebeu outra intervenção do usuário, impedir o desfazer e explicar o motivo. Não apagar trabalho posterior nem reverter o XP da anterior por uma operação recusada
- Geração, sincronização e reagendamento automáticos, por si, não são intervenção do usuário. A representação que permite reconhecer a sucessora intocada deve ser definida no contrato técnico
- Se o uso da sucessora em outro aparelho só aparecer na reconciliação, aplicar a rejeição recuperável de REQ-SYN-017 e incorporar o estado canônico, sem aparentar que o desfazer foi aceito
- Quando o desfazer for permitido, manter a regra de XP: em até 24h, reverter; depois de 24h, preservar. Refazer restaura a concessão original quando houver reversão, sem novo consumo do teto
- Retirar a sucessora como parte deste desfazer é uma transição da série, distinta de excluir explicitamente uma tarefa. Repetir envios ou refazer a conclusão não pode duplicar uma posição da série

O teste de concorrência deve cobrir desfazer a anterior enquanto outro aparelho edita/conclui a sucessora, com reconciliação do estado e do XP correspondente.

### REQ-TAR-006 — Prazo, hora e fuso
**Critérios de aceite**
- `due_is_all_day = true` significa uma data civil, sem instante associado; a notificação sai às 09:00 locais. A tarefa passa a atrasada quando essa data termina, à meia-noite local, se ainda estiver aberta
- Com hora definida, a notificação sai no horário exato
- Prazo **com hora** representa um instante armazenado em UTC, exibido e agendado no fuso do perfil; ao mudar de fuso, preservar o instante
- Prazo **sem hora** preserva a data escolhida após mudança de fuso. Não converter uma meia-noite UTC em outra data local. A representação dessa data será incorporada ao modelo de dados
- Mudança de fuso reagenda as notificações: às 09:00 na data civil para prazo sem hora; no instante preservado para prazo com hora
- À 00h30 de sexta, uma tarefa sem hora com prazo quinta já está atrasada; concluir essa tarefa nesse momento pode contar XP no dia lógico de quinta se a virada for às 04h. Prazo e dia de contabilização são conceitos distintos (R4-Q18)

### REQ-TAR-007 — Subtarefas
Um nível apenas. Progresso da pai mostra "2/5". Subtarefa não tem prazo próprio nem gera XP individual (evita farming).

### REQ-TAR-008a — Expressão matemática no texto
Expressão entre `=` no título é avaliada e o resultado exibido ao lado: "comprar tinta =3*89,90" mostra 269,70.

**Critérios de aceite**
- O texto original é preservado; o resultado é exibido, não substituído
- Suporta `+ - * / ( )`, vírgula ou ponto como decimal
- Expressão inválida não quebra nada: mostra o texto como está, sem erro
- Avaliação é **local e sem `eval`** — parser restrito, porque título de tarefa é entrada do usuário

### REQ-TAR-008 — Etiquetas
Criar, renomear, cor, filtrar por uma etiqueta. Excluir etiqueta remove a associação, nunca as tarefas.

### REQ-TAR-009 — Busca
Busca por título e notas, com resultado em ≤ 200 ms sobre 5.000 tarefas (índice local).

### REQ-TAR-010 — Lembretes locais
Mesmas regras do REQ-HAB-008 (limite de 64 pendentes no iOS, reagendamento ao abrir o app, ação rápida de concluir pela notificação).

## 2. Estados de tela

| Estado | Comportamento |
|---|---|
| Carregando | skeleton de 3 linhas |
| Vazio total | ilustração + "criar primeira tarefa" |
| Tudo concluído hoje | mensagem de conclusão do dia — este é o momento de reforço positivo, use-o |
| Muitas atrasadas (>20) | oferecer ação em lote "reagendar todas para hoje" |

## 3. Edge cases mapeados

1. Tarefa criada com prazo no passado → aceita, entra direto em "Atrasadas"
2. Tarefa recorrente concluída **antes** do prazo → a próxima ocorrência é calculada a partir da **data prevista**, não da data de conclusão (senão a série "anda" sozinha)
3. Tarefa recorrente com prazo passado concluída hoje → próxima calculada da data prevista, com skip das ocorrências vencidas para não gerar cascata; posições puladas consomem `COUNT` (REQ-TAR-005a)
4. Subtarefa de uma tarefa recorrente → resetam junto com a nova ocorrência
5. Concluir e desfazer repetidamente → uma única concessão original; quando houver reversão, refazer restaura essa concessão, sem ganho adicional nem novo consumo do teto (REQ-GAM-003a)
6. 500 tarefas atrasadas → lista virtualizada, ação em lote disponível
7. Título com 2.000 caracteres → limite de 500 com contador visível
8. Emoji e acento no título e na busca → normalização de acento na busca (busca por "reuniao" acha "reunião")
9. Edição simultânea em dois aparelhos → preservar alterações em campos independentes (ex.: título e prazo). No mesmo campo concorrente, prevalece a última alteração aceita pelo servidor (REQ-SYN-010a); retry não é nova edição
10. Tarefa excluída em um aparelho e editada em outro → **exclusão vence** sempre
11. "Editar esta e as próximas" numa série com lembrete → os lembretes das ocorrências futuras precisam ser recalculados junto; lembrete órfão apontando para a regra antiga é bug
12. Tarefa concluída pela ação da notificação enquanto o app está fechado → mesmo limite e mesma spike do REQ-HAB-008b
13. Desfazer conclusão recorrente cuja sucessora já foi usada → impedir com explicação e preservar o trabalho posterior; se intocada, retirar sucessora e reabrir anterior (REQ-TAR-005b)

## 4. Fora de escopo neste módulo

Kanban, gráfico de Gantt, dependência entre tarefas, atribuição a outra pessoa, anexo de arquivo, comentário, parsing de data em linguagem natural no campo de título (isso é papel do assistente, ver spec/05), integração com calendário externo.
