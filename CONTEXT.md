# Ritmo

Vocabulário do assistente pessoal Ritmo. As definições existentes no glossário do PRD foram reunidas aqui; comportamentos e contratos técnicos permanecem nos specs.

## Language

**Data civil**:
Data do calendário, independente de um instante específico. Um prazo de tarefa sem horário mantém a data escolhida mesmo após mudança de fuso.

**Dia civil**:
Período entre uma meia-noite local e a seguinte. Determina os grupos Hoje/Amanhã e o vencimento de tarefas sem horário no fuso do perfil.

**Dia lógico**:
Período diário delimitado pelo fuso e pelo horário de início do dia configurados pelo usuário. No padrão de 04:00, um registro feito à 01:30 pertence ao dia anterior.

**Dia devido**:
Dia em que a agenda do hábito prevê seu cumprimento. Dias sem execução prevista não contam como ausência.

**Vigência de uma regra de hábito**:
Período de dias lógicos em que uma agenda ou meta se aplica. A avaliação de cada dia usa a regra válida naquele período.

**Ofensiva (streak)**:
Sequência de cumprimentos de um hábito nos períodos previstos por sua agenda. Nas agendas com dias definidos, conta dias devidos; na agenda de N vezes por semana, conta semanas cumpridas. Um dia protegido preserva a sequência sem aumentar sua contagem.

**Proteção de ofensiva (congelamento)**:
Preservação de uma ou mais ofensivas durante um dia de ausência, sem transformar a ausência em cumprimento. Pertence à conta e não a um hábito isolado.

**Série recorrente**:
Sequência de ocorrências de uma tarefa, prevista por uma regra de calendário. Pode terminar com menos conclusões do que posições previstas quando datas são puladas.

**Ocorrência**:
Instância concreta de uma tarefa recorrente em uma data específica.

**Ação do assistente**:
Criação ou alteração de dados originada pelo assistente, registrada no histórico de ações e com possibilidade de desfazer.

**Registro (log)**:
Evento de cumprimento, como um hábito marcado ou uma tarefa concluída.

**Cumprimento diário de hábito**:
Estado de realização de um hábito em um dia lógico. Marcações do mesmo hábito e dia em aparelhos diferentes representam o mesmo cumprimento.

**Lançamento quantitativo**:
Contribuição individual para a quantidade registrada em um hábito, como 0,5 L de água. Pode ser desfeita sem retirar as demais contribuições daquele dia.

**Concessão de XP**:
Recompensa atribuída a um cumprimento ou outro fato elegível. Desfazer e refazer o mesmo fato reverte e restaura a recompensa original, sem criar outra concessão.

**Pendência de sincronização**:
Alteração feita pelo usuário no Ritmo que ainda aguarda confirmação da sincronização. Permanece vinculada à conta que a criou, inclusive quando o usuário sai dessa conta.


**Quarentena operacional**:
API indisponível aos clientes enquanto a completude de uma recuperação não estiver comprovada. Não encerra o uso local da conta ativa nem permite publicar uma cópia histórica incompleta. Ver ADR-019.
