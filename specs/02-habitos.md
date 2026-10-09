# spec/02 — Módulo Hábitos

**Prioridade:** P0 (Fase 1). É o módulo que valida a engine de gamificação.

---

## 1. Diferença conceitual entre Hábito e Tarefa

Esta distinção precisa ficar clara na UI, senão o usuário se perde (Q4 do PRD):

| | Hábito | Tarefa |
|---|---|---|
| Natureza | comportamento repetido, sem fim | item que termina |
| Pergunta | "fiz hoje?" | "já fiz?" |
| Não fazer | quebra ofensiva | fica atrasada |
| Histórico | interessa a série inteira | interessa só o fim |

Regra de UI: hábito **nunca** aparece na lista de tarefas, e tarefa recorrente **não** tem ofensiva.

## 2. Tipos de hábito

- `binary` — fiz / não fiz. Ex.: "meditar"
- `quantitative` — meta numérica no dia. Ex.: "beber 2L de água". `done` quando `amount >= target_amount` vigente naquele dia lógico; `partial` abaixo disso
- `negative` — sucesso é *não* fazer. Ex.: "não fumar". Marca-se "resisti hoje"; não marcar até o fim do dia **não** quebra a ofensiva automaticamente (ver REQ-HAB-012)

## 3. Requisitos

### REQ-HAB-001 — Criar hábito
Como usuário, quero criar um hábito com título, tipo, agenda e lembretes, para acompanhá-lo diariamente.

**Critérios de aceite**
- Dado que estou na tela de hábitos, quando toco em "novo hábito", então vejo formulário com título (obrigatório), tipo, ícone, cor, agenda e lembretes
- Dado que escolhi tipo `quantitative`, então os campos meta e unidade tornam-se obrigatórios
- Dado que salvei, então o hábito aparece no card do Briefing se hoje for um **dia devido**
- Dado que estou offline, quando salvo, então o hábito aparece imediatamente e sincroniza depois
- Título vazio ou só espaços: botão salvar desabilitado

### REQ-HAB-002 — Agendas suportadas
`daily`, `weekdays` (dias específicos), `times_per_week` (N vezes por semana, sem dia fixo), `interval` (a cada N dias).

**Critérios de aceite**
- Dado agenda `weekdays` = [1,3,5], quando é domingo, então o hábito **não** aparece no Briefing e **não** quebra ofensiva
- Dado agenda `times_per_week` = 3 e já registrei 3 vezes na semana, então o hábito aparece como "meta da semana cumprida" e registros extras são aceitos mas **não** dão XP adicional
- Semana começa na **segunda-feira**

### REQ-HAB-003 — Card de hábitos no Briefing
Não existe uma "tela Hoje" separada: os hábitos devidos hoje aparecem como **card dentro do Briefing** (spec/08), que é a home do app. Existe também uma tela de gestão de hábitos (lista completa, arquivados, histórico), mas ela não é a tela de uso diário.

O card mostra os hábitos devidos hoje, o estado de cada um, a ofensiva e o progresso do dia, e é marcável no próprio card.

**Critérios de aceite**
- Marcar um hábito responde visualmente em ≤ 100 ms (otimista), antes de qualquer I/O
- Vazio: se não há hábito nenhum, mostro estado vazio com CTA de criação — nunca lista em branco
- Vazio contextual: se há hábitos mas nenhum é devido hoje, mostro mensagem explícita de folga, sem parecer erro

### REQ-HAB-004 — Marcar hábito como feito
**Critérios de aceite**
- Dado que marco um hábito binário, então cria-se `habit_logs` com `status=done`, `day_key` do dia lógico e `source=manual`
- Dado que marco duas vezes rapidamente (toque duplo), então existe **exatamente um** cumprimento diário; a unicidade do estado ativo e a identidade lógica do cumprimento precisam garantir isso também entre aparelhos
- Dado que desmarco, então o cumprimento deixa de estar ativo **e** sua concessão de XP é revertida, sem apagar o histórico da correção
- Dado que marco offline, então o registro entra na fila e o XP é aplicado localmente na hora

### REQ-HAB-004a — Desfazer concorrente e remarcar
Aceito em R3-Q11, [ADR-017](../docs/adr/0017-reconciliacao-de-registros-e-correcoes.md).

**Critérios de aceite**
- iPhone marca e depois desmarca; Android marca o mesmo hábito/dia sem ter incorporado esse desfazer → após reconciliação, o cumprimento fica desmarcado, independentemente da ordem de chegada dos envios
- Depois de incorporar o desfazer, uma nova marcação pode restabelecer o cumprimento; isso também vale no aparelho que acabou de desfazer localmente
- Repetir o envio de qualquer uma dessas ações não muda o resultado nem cria outro cumprimento
- Remarcar restaura a concessão original de XP conforme REQ-GAM-003a
- Desfazer um cumprimento não é excluir o hábito. Esta regra não permite restaurar um hábito excluído

### REQ-HAB-005 — Registro quantitativo incremental
**Critérios de aceite**
- Dado meta 2L e registro 0,5L quatro vezes, então o `amount` acumula para 2,0 e o status vira `done` **apenas na quarta vez**
- XP é concedido **uma única vez**, quando cruza a meta — não a cada incremento
- Lançamentos independentes em aparelhos diferentes somam: 0,5 L no iPhone e 0,7 L no Android convergem para 1,2 L
- Reenviar o mesmo lançamento não acrescenta quantidade; dois lançamentos intencionais de mesmo valor continuam contando separadamente
- Desfazer o lançamento de 0,5 L retira apenas essa contribuição, preservando os 0,7 L; reenviar o desfazer não retira quantidade outra vez
- O estado diário é derivado das contribuições vigentes e da meta aplicável ao dia de destino (REQ-HAB-007a). Não resolver concorrência escolhendo um total e descartando as contribuições do outro aparelho

Semântica aprovada em R3-Q12. A representação dos lançamentos e de suas reversões deve ser incorporada ao modelo de dados antes de implementar; o campo `habit_logs.amount` isolado não atende ao contrato.

### REQ-HAB-006 — Registro retroativo
Como usuário, quero marcar que cumpri um hábito ontem, porque esqueci de registrar.

**Critérios de aceite**
- Posso registrar em qualquer dia dos últimos **7 dias**; além disso, o dia fica bloqueado
- Essa janela limita criar um novo retroativo; um registro feito legitimamente offline não expira por ficar mais de sete dias aguardando envio (REQ-SYN-018)
- Registro retroativo **recalcula a ofensiva** e pode restaurá-la
- Registro retroativo dá XP normal, mas conta no teto diário do `day_key` **de destino**, não do dia atual (impede farming de XP marcando 7 dias de uma vez)
- Não é possível registrar no futuro

### REQ-HAB-007 — Editar e arquivar hábito
**Critérios de aceite**
- Editar título, ícone, cor e lembrete **não** afeta histórico nem ofensiva
- Mudar a **agenda** de hábito existente preserva a avaliação de hoje e dos dias anteriores. A regra geral começa no próximo dia lógico **após aceitação pelo servidor** (R4-Q16 e R6-Q25). Mudanças que entram, saem ou alteram `times_per_week` começam na próxima segunda-feira lógica após essa aceitação (R5-Q23, mantida em Q29)
- Mudar a **meta quantitativa** de hábito existente vale a partir do próximo dia lógico após aceitação pelo servidor, preservando a meta de hoje e as anteriores (R4-Q17 e R6-Q25). Mesmo uma correção de meta digitada errada respeita essa vigência
- Depois do primeiro registro, **tipo e unidade ficam fixos** no v1 (R6-Q26). Para mudá-los, arquivar o hábito e criar outro, preservando o histórico anterior; o novo hábito começa outra série. Antes de existir histórico, permitir corrigir a configuração validando os campos relacionados. Alterar só a meta numérica continua permitido
- Arquivar remove do Briefing, cancela lembretes, preserva histórico e congela a ofensiva
- Excluir exige confirmação e informa que o histórico será perdido. Q30 (30/09/2026): reverter as concessões de XP desse hábito, sem devolver orçamento consumido. A exclusão é definitiva para esse ID e vence edições/registros atrasados; outro hábito exige ID novo. Fatos e recibos técnicos são preservados conforme spec/00 §12, sem reabrir histórico do hábito na UI. Confirmação nativa implementada no [recorte 02](../docs/analises/2026-10-09-interface-gestao-de-habitos.md), verificada no Android visível; aceite integral/iPhone seguem pendentes

### REQ-HAB-007a — Vigência e avaliação histórica
Agenda e meta são avaliadas pela regra aplicável ao dia lógico de destino, inclusive em registro retroativo, recálculo de ofensiva e recuperação de dados. Não usar a configuração atual para reinterpretar dias passados. Ver [ADR-018](../docs/adr/0018-vigencia-das-regras-de-habitos.md).

**Critérios de aceite**
- Hábito diário passa a segunda/quarta/sexta → a nova agenda só vale no próximo dia lógico após aceitação pelo servidor; dias anteriores continuam devidos conforme a agenda anterior
- Meta de hoje é 2 L, já cumprida, e passa para 3 L → hoje permanece cumprido; após aceitação, a meta de 3 L começa no próximo dia lógico
- Registro retroativo em um dia cuja meta era 2 L continua sendo avaliado contra 2 L, mesmo que a meta atual seja 3 L
- A edição informa a data de início da nova regra; a virada usa o fuso e o horário de início do dia configurados, não necessariamente meia-noite
- Mudança de três para duas vezes por semana aceita pelo servidor numa quinta mantém a quota antiga até o fim da semana; a nova começa na próxima segunda-feira, na virada do dia lógico. Entrar ou sair de `times_per_week` segue a mesma exceção (R5-Q23 e Q29)
- A exceção semanal é para a **agenda**, não para a meta quantitativa por dia: mudar de 2 L para 3 L continua valendo no próximo dia lógico (R4-Q17)
- Hábito recém-criado continua devido hoje quando sua agenda permitir. As regras de arquivamento, exclusão e edição visual não recebem esse adiamento

### REQ-HAB-007b — Edição offline de regras
Aceito em R6-Q25: agenda e meta podem ser editadas e preservadas localmente sem rede, mas a nova regra não entra em vigor antes de sua aceitação pelo servidor. Enquanto isso, exibir "aguardando conexão" e continuar avaliando os registros pela regra vigente. Após aceitação, informar a data efetiva; para agendas não semanais e metas quantitativas, usar o próximo dia lógico. Não aplicar retroativamente a data que havia sido prevista enquanto o aparelho estava offline.

Exemplo: a meta é alterada offline na segunda, mas aceita na quinta → terça e quarta continuam com a meta antiga; a nova começa no próximo dia lógico após a aceitação. Criar hábitos e registrar cumprimentos continuam disponíveis offline. Salvar a proposta no aparelho é diferente de ativar a regra.

Q29 confirmou a exceção semanal: mudanças envolvendo `times_per_week` aguardam a próxima segunda-feira lógica **após aceitação pelo servidor**. A data provisoriamente esperada offline não é aplicada retroativamente. Metas quantitativas por dia e agendas não semanais continuam no próximo dia lógico após aceitação.

O modelo deve representar proposta de regra, aceitação e vigência antes da implementação. Alteração da configuração de dia com mudança já agendada e corrida entre editar tipo/unidade sem histórico e um primeiro registro em outro aparelho ainda exigem contrato técnico que preserve as decisões aceitas; não converter unidades nem reescrever o histórico silenciosamente.

### REQ-HAB-008 — Lembretes locais
**Critérios de aceite**
- Cada horário em `reminder_times` agenda uma notificação local nos dias devidos
- Notificação traz ação rápida "marcar como feito" que registra **sem abrir o app** (`source=notification`)
- Hábito já cumprido hoje **não** dispara lembrete
- Ao arquivar, excluir ou mudar horário, as notificações são reagendadas
- Permissão negada: o app continua funcionando e mostra aviso não-bloqueante uma única vez
- **Orçamento de notificações (REQ-HAB-008a).** O iOS permite apenas **64 notificações locais pendentes por app**, somando hábitos e tarefas. Com 10 hábitos e 2 lembretes cada, 7 dias já seriam 140. Política obrigatória:
  1. Orçamento global de 64, repartido: **40 para hábitos, 24 para tarefas**
  2. Agendar por proximidade: todos os lembretes de **hoje e amanhã** primeiro, depois os demais dias até esgotar o orçamento
  3. Dentro do mesmo dia, hábito com ofensiva ativa tem prioridade sobre hábito sem
  4. Reagendar a cada abertura do app e a cada volta do background
  5. Se o orçamento estourar mesmo assim, **agrupar**: uma notificação "3 hábitos pendentes hoje" em vez de três
- **[SPIKE OBRIGATÓRIA — REQ-HAB-008b]** A ação rápida "marcar como feito sem abrir o app" depende de executar código em background ao responder uma notificação, o que é limitado no Expo gerenciado, especialmente no iOS. Antes de prometer isso na UI, validar em aparelho real. Se não funcionar de forma confiável, o comportamento passa a ser: a ação **abre o app** e aplica o registro na abertura, sem perguntar nada

### REQ-HAB-009 — Histórico e estatísticas
**Critérios de aceite**
- Calendário de 12 meses no estilo heatmap
- Taxa de cumprimento sobre **dias devidos**, nunca sobre dias corridos
- Ofensiva atual e recorde

### REQ-HAB-010 — Hábito quantitativo com meta superada
Registrar 3L numa meta de 2L conta como `done`, nunca como 150% de XP.

### REQ-HAB-011 — Mudança de fuso horário
**Critérios de aceite**
- Dado que viajo e o fuso do dispositivo muda, então o app detecta e pergunta se deve atualizar o fuso do perfil
- Dias já registrados **nunca** são reinterpretados: `day_key` é imutável depois de gravado
- A troca não pode quebrar nem inflar ofensiva

### REQ-HAB-012 — Hábito negativo
**Critérios de aceite**
- A ofensiva de hábito negativo avança automaticamente à virada do dia lógico se o usuário **não** registrou recaída
- Existe ação explícita "tive uma recaída", que zera a ofensiva sem nenhuma copy de julgamento
- Recaída **não** subtrai XP já ganho
- Os 10 XP de cumprimento diário exigem registro explícito de "resisti hoje", uma vez por hábito/dia, respeitando o teto. A ausência de recaída não cria automaticamente esse prêmio nem um registro para a ofensiva global (R5-Q21)
- O avanço automático da ofensiva do hábito permanece; os bônus por marcos dessa ofensiva já previstos em spec/04 continuam válidos. Não confundir bônus de marco com os 10 XP diários
- Recaída explícita não é falta de registro e não pode ser coberta por proteção de ofensiva (REQ-GAM-011)

## 4. Estados de tela

| Estado | Comportamento |
|---|---|
| Carregando | skeleton dos cards, nunca spinner de tela cheia |
| Vazio (sem hábitos) | ilustração + CTA + sugestão de 3 hábitos comuns |
| Vazio (dia de folga) | mensagem de folga, tom neutro |
| Falha transitória de sync | banner discreto "salvo no aparelho, sincronizando", com retry conforme spec/06 |
| Alteração recusada definitivamente | conteúdo recuperável e aviso discreto com motivo e opção de corrigir ou descartar; não mostrar como sincronizada (REQ-SYN-017) |
| Offline | Criação/registro continuam disponíveis; edição de agenda/meta é salva como proposta aguardando conexão, com vigência conforme REQ-HAB-007b |

## 5. Edge cases mapeados

1. Toque duplo rápido no mesmo hábito → um log só
2. App aberto às 23:59 e hábito marcado às 00:01 → `day_key` calculado no momento do toque, com `day_start_hour = 4` a marcação de 00:01 conta para o dia anterior
3. Relógio do dispositivo adulterado → `day_key` do cliente é aceito, mas servidor rejeita `day_key` mais de 1 dia no futuro
4. Horário de verão (se voltar ao Brasil) → dia com 23h ou 25h; `day_key` continua sendo o rótulo local, sem aritmética de horas
5. Hábito criado hoje → é devido hoje? **Sim**, se hoje casa com a agenda
6. Ofensiva de hábito `times_per_week` → conta **semanas** cumpridas, não dias consecutivos
7. Desmarcar hábito que gerou conquista → conquista **não** é revogada (ver `specs/04-gamificacao.md` §5)
8. 50 hábitos devidos no mesmo dia → lista virtualizada, sem degradação
9. Dois dispositivos marcam o mesmo hábito binário offline → convergem para um cumprimento e uma concessão de XP. Para quantitativos, preservar e somar lançamentos independentes; para desfazer/remarcar, aplicar REQ-HAB-004a
10. Hábito arquivado e depois reativado → ofensiva **não** é retomada; começa nova série, e o recorde antigo é preservado
11. Dois hábitos com título idêntico → **bloquear na criação** (título único por usuário entre hábitos ativos). Sem isso, o assistente fica permanentemente ambíguo ao ouvir "marquei academia"
12. Pull de sync traz um `habit_log` de um hábito arquivado no outro aparelho → o log é aceito e preservado; arquivamento não invalida histórico
13. Conta com 2 anos de histórico recalculando ofensiva no cold start → o recálculo tem janela máxima de **400 dias**; o recorde histórico fica materializado em `habit_streaks.longest_streak` e não é recalculado do zero
14. Fuso do sistema muda com o app aberto (viagem) → o app detecta no retorno ao foreground, não em tempo real, e aplica o REQ-HAB-011

## 6. Fora de escopo neste módulo

Hábitos compartilhados, desafios entre usuários, templates da comunidade, integração com wearable, sugestão de hábito por IA baseada em histórico (Fase 2).
