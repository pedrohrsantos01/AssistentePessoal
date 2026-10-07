# Fundação do Ritmo — entrevista de decisões

Início: 24/09/2026.
Estado: rodadas 1 a 6 registradas, incluindo esclarecimento Q29. Comportamento do primeiro marco definido; direção visual mantida em aberto pelo Pedro até concluir o protótipo. Continuação do detalhamento documental autorizada com “pode continuar”.
Método: `grill-with-docs`, com `grilling` e `domain-modeling`.

## Escopo

Esclarecer a fundação da Fase 1 a partir do PRD, dos specs e da auditoria. Nenhuma recomendação abaixo é uma decisão aprovada até sua resposta ser registrada. O objetivo desta etapa é definir contratos e critérios para o planejamento; implementação virá após o fechamento do entendimento.

## Fontes

- `PRD.md` e seus ADRs: escopo e decisões já existentes.
- `CLAUDE.md`: instruções do projeto.
- `specs/00-modelo-de-dados.md`, `specs/01-conta-e-onboarding.md` e `specs/06-sincronizacao.md`: contratos atuais a esclarecer.
- `docs/analises/2026-09-23-auditoria-fundacao.md`: evidências das lacunas.
- `docs/analises/2026-09-23-plano-de-saneamento.md`: proposta, ainda sujeita às decisões desta entrevista.

## Já estabelecido

- Configuração das skills aprovada: Markdown local, rótulos padrão, documentação de domínio em um único contexto, com instruções em `docs/agents/`.
- Usuário inicial: Pedro, com uso pessoal diário como validação do v1; portfólio e aprendizado também são objetivos declarados.
- App mobile em Expo/React Native e backend próprio em Java/Spring Modulith conforme ADR-004. Não reabrir a stack sem motivo específico.
- Conta obrigatória, autenticação por e-mail/senha e autorização Google Calendar separada.
- Local-first para a UI e suporte a múltiplos dispositivos fazem parte da Fase 1. As dúvidas são como validar e reconciliar esses comportamentos.
- Primeiro marco e política de quatro semanas definidos em R2-Q9/Q10. A data de início da implementação ainda não foi fixada; capacidade disponível será considerada ao planejar as tarefas.

## Escolhas aceitas em 24/09/2026

- **R1-Q1:** uso diário prevalece em conflitos com elaboração para aprendizado/portfólio; Java/Spring permanece como stack escolhida.
- **R1-Q2:** iPhone 16e do Pedro para uso real e emulador Android para teste do segundo cliente.
- **R1-Q3:** resposta local imediata, fatos reconciliados pelo servidor e projeções locais recalculadas. Registrado no [ADR-015](../../docs/adr/0015-autoridade-na-reconciliacao.md).
- **R1-Q4:** opção B. Logout permitido com pendências preservadas e isoladas para recuperação ao entrar na mesma conta. Registrado no [ADR-016](../../docs/adr/0016-preservar-pendencias-no-logout.md).
- **R2-Q5:** reentrada após logout exige autenticação online. Sessão não encerrada continua permitindo uso local offline.
- **R2-Q6:** pendências não expiram automaticamente; permanecem até sincronização confirmada, descarte explícito ou exclusão confirmada da conta.
- **R2-Q7:** permitido usar B enquanto pendências de A permanecem isoladas; recuperação e envio exigem autenticação como A.
- **R2-Q8:** rejeição definitiva preserva conteúdo recuperável e mostra aviso discreto com motivo e opção de corrigir ou descartar. Retry transitório e duplicação reconciliada são resultados distintos.
- **R2-Q9:** primeiro marco com conta, hábito diário, Briefing mínimo, sync entre iPhone 16e e emulador Android e persistência após reinício. Agenda, tarefas e voz permanecem na Fase 1 em incrementos seguintes.
- **R2-Q10:** quatro semanas desde o início registrado da implementação, com revisão de evidências e causas; sem migração automática para BaaS. Revisão expressa do ADR-014.

Essas escolhas foram incorporadas ao PRD, README, plano de execução, ADRs 015/016 e specs de Conta, Sincronização e Qualidade. A sequência antiga do plano passou a inventário em revisão, subordinado ao primeiro marco aprovado. A proteção de pendências também se aplica à recuperação de migrations; um erro de autenticação isolado não autoriza descartá-las. O restante do plano de saneamento continua proposto. Os detalhes ainda não decididos não devem ser preenchidos silenciosamente na implementação.

## Escolhas aceitas em 25/09/2026

- **R3-Q11:** desfazer cumprimento prevalece sobre marcação concorrente que desconhecia a correção; após incorporar o desfazer, uma nova marcação pode restabelecer o cumprimento.
- **R3-Q12:** lançamentos quantitativos independentes somam; desfazer remove apenas a contribuição identificada; retries não acrescentam nem retiram quantidade novamente.
- **R3-Q13:** preservar edições em campos independentes, com validação conjunta para campos relacionados; desempate do mesmo campo resolvido depois em R4-Q15.
- **R3-Q14:** refazer restaura a concessão original de XP, com mesmo valor e dia, sem novo prêmio ou consumo do teto. Em tarefas, aplicar quando houve reversão; XP que permaneceu não é concedido de novo.

Registradas no [ADR-017](../../docs/adr/0017-reconciliacao-de-registros-e-correcoes.md), no glossário e nos specs de Hábitos, Tarefas, Gamificação e Sync. O modelo de dados agora explicita os invariantes que ainda precisa representar; não foi tratado como um schema pronto nem foram criadas migrations. A convenção de IDs foi ajustada para não atribuir ao UUID garantias que dependem da identidade lógica e da reconciliação.

- **R4-Q15:** no mesmo campo concorrente, prevalece a última alteração aceita pelo servidor. Retry não é nova edição; sequência conhecida e regras específicas de desfazer/exclusão prevalecem.
- **R4-Q16:** nova agenda de hábito existente começa no próximo dia lógico, preservando hoje e o histórico. Hábito recém-criado continua podendo começar hoje.
- **R4-Q17:** nova meta quantitativa começa no próximo dia lógico, inclusive para corrigir uma meta digitada errada; preservar metas dos dias anteriores.
- **R4-Q18:** tarefas seguem o calendário civil, com virada à meia-noite; hábitos e XP seguem o dia lógico. Prazo sem hora conserva a data ao mudar de fuso; prazo com hora conserva o instante.

R4 foi incorporada ao ADR-017, ao novo [ADR-018](../../docs/adr/0018-vigencia-das-regras-de-habitos.md), ao glossário, às convenções e aos specs de Hábitos, Tarefas, Gamificação, Sync e Briefing. O modelo registra a necessidade de representar datas civis e vigência histórica. A exceção semanal foi resolvida posteriormente em R5-Q23.

- **R5-Q19:** o limite de uma recorrência conta as posições previstas, inclusive puladas, sem prolongar a série para garantir uma quantidade de conclusões.
- **R5-Q20:** desfazer uma conclusão recorrente pode retirar a sucessora intocada e reabrir a anterior; se a sucessora já recebeu intervenção do usuário, impedir o desfazer e preservar o trabalho posterior.
- **R5-Q21:** os 10 XP diários do hábito negativo exigem "resisti hoje" explícito. Ausência de recaída continua avançando a ofensiva do hábito, com bônus de marcos preservados; não cria registro para a global.
- **R5-Q22:** dois dias de proteção por conta/mês civil, automáticos e sem acúmulo; uma unidade cobre conjuntamente séries elegíveis e a global. Não incrementa a contagem nem concede XP; não cobre agenda semanal ou recaída explícita.
- **R5-Q23:** mudanças de agenda que entram, saem ou alteram N vezes por semana começam na próxima segunda-feira, na virada lógica. É exceção expressa à Q16; demais agendas e metas quantitativas continuam no próximo dia lógico.

R5 foi incorporada aos specs de Hábitos, Tarefas, Gamificação e Sync, ao modelo, glossário, ADR-018, PRD e README. A Q3 histórica do PRD foi marcada como resolvida. O contrato distingue a janela de criação retroativa de sete dias de transmitir mais tarde um registro válido já criado offline (REQ-SYN-018); isso decorre do suporte offline e de R2-Q6, sem nova votação.

- **R6-Q24:** devolver proteção ao mês original somente quando nenhuma ofensiva daquele dia depender dela; pode proteger outra ausência no mesmo mês, sem transferência entre meses.
- **R6-Q25:** edição offline de agenda/meta permanece proposta até aceitação pelo servidor; vigência posterior preserva a avaliação dos dias intermediários.
- **R6-Q26:** tipo e unidade ficam fixos após o primeiro registro; mudar o significado depois exige arquivar e criar outro hábito. Meta numérica continua editável conforme sua vigência.
- **R6-Q27:** onboarding retomável de fuso/início do dia e primeiro hábito binário diário pulável; Briefing com saudação, hábitos e XP básico. Interfaces da gamificação completa e demais módulos vêm depois, sem pedir permissões antecipadas.
- **R6-Q28:** Pedro está desenhando o protótipo e pediu para manter a direção visual em aberto. A recomendação de liberar visual provisório no Briefing **não foi aceita**.
- **Q29:** esclarecimento expresso de Q25: manter Q23; metas/agendas diárias no próximo dia lógico, mudanças envolvendo agenda semanal na próxima segunda-feira lógica, após aceitação do servidor.

R6 e Q29 foram incorporadas aos specs 01/02/04/06/08/11, ao ADR-018 e aos resumos do projeto. O [contrato do primeiro marco](../../specs/13-contrato-primeiro-marco.md) e o mapeamento em spec/00 §12 são propostas de engenharia rastreáveis a essas decisões, não decisões de produto atribuídas retroativamente ao Pedro. A [especificação da entrega](../primeiro-marco/spec.md) acompanha o que pode avançar e as lacunas restantes.

## Árvore de decisões

| Decisão | Pré-requisito | Situação |
|---|---|---|
| R1-Q1 — Prioridade em conflitos entre uso diário e aprendizado/portfólio | Objetivos já descritos no PRD | Resolvida: uso diário |
| R1-Q2 — Aparelho principal e segundo cliente de teste | Escopo mobile/multidispositivo já aprovado | Resolvida: iPhone 16e e emulador Android |
| R1-Q3 — Aceitação de reconciliação canônica pelo servidor | UI local-first já aprovada | Resolvida: sim, ADR-015 |
| R1-Q4 — Experiência de logout com pendências offline | Conta obrigatória e uso offline já aprovados | Resolvida: opção B, ADR-016 |
| R2-Q5 — Autenticação de reentrada após logout | R1-Q4 | Resolvida: login online |
| R2-Q6 — Retenção de pendências após logout | R1-Q4 | Resolvida: sem expiração automática |
| R2-Q7 — Entrada em outra conta com pendências preservadas | R1-Q4 | Resolvida: permitida, com isolamento |
| R2-Q8 — Feedback para rejeição definitiva de alteração | R1-Q3 | Resolvida: conteúdo recuperável e aviso discreto |
| R2-Q9 — Aceite do primeiro marco | R1-Q1 e R1-Q2 | Resolvida: conta, hábito, Briefing mínimo e sync nos dois clientes |
| R2-Q10 — Início e consequência do checkpoint de quatro semanas | R1-Q1 e ADR-014 | Resolvida: revisão desde início registrado da implementação |
| Matriz de autoridade, classificação de erros e dados sincronizados | ADR-015 e R2-Q8 | Comportamento registrado; protocolo e schema ainda em detalhamento |
| Máquina de estados da sessão e recuperação | R2-Q5, R2-Q6, R2-Q7 | Estados observáveis registrados em spec/01; cache e revogação offline pendentes de desenho técnico |
| R3-Q11 — Marcar/desmarcar concorrentes e remarcação | ADR-015 e leitura de Hábitos/Sync | Resolvida: desfazer vence concorrente; remarcar após incorporar correção é permitido |
| R3-Q12 — Contribuições quantitativas e alcance de desfazer | ADR-015 e REQ-HAB-005 | Resolvida: soma e reversão por lançamento |
| R3-Q13 — Edições concorrentes em campos independentes | ADR-015 e REQ-SYN-010 | Resolvida: preservar ambas |
| R3-Q14 — XP ao refazer uma ação desfeita | REQ-GAM-001/003 e teto não devolvido já definido | Resolvida: restaurar concessão original |
| Identidades, comandos e garantias do banco | Semântica de R3-Q11 a Q14 | Invariantes registrados em spec/00 §11; desenho físico/protocolo ainda necessário |
| R4-Q15 — Edições concorrentes do mesmo campo | R3-Q13 e inconsistência de horários identificada | Resolvida: última alteração aceita pelo servidor, sem renovar retry |
| R4-Q16 — Agenda do hábito e preservação histórica | REQ-HAB-007 e vocabulário de dia lógico | Resolvida: próximo dia lógico; histórico preservado |
| R4-Q17 — Início da nova meta quantitativa | R3-Q12/Q14 e avaliação por meta já existente | Resolvida: próximo dia lógico |
| R4-Q18 — Data civil de tarefas vs dia lógico | REQ-TAR-006 e regras de dia lógico | Resolvida: tarefas seguem calendário civil |
| R5-Q19 — Limite de recorrência e datas puladas | Calendário previsto, pulo de vencidas e corte civil definidos | Resolvida: contar posições previstas, inclusive puladas |
| R5-Q20 — Desfazer conclusão com sucessora existente | No máximo uma ocorrência aberta e regras de XP definidas | Resolvida: somente com sucessora intocada |
| R5-Q21 — XP diário de hábito negativo | Ofensiva automática e prêmio de cumprimento existentes | Resolvida: prêmio diário exige registro explícito |
| R5-Q22 — Adoção e alcance do congelamento | Proposta no PRD Q3 | Resolvida: dois dias por conta/mês, séries avaliadas por dia |
| R5-Q23 — Mudanças envolvendo agenda semanal | R4-Q16 e ofensiva semanal existente | Resolvida: próxima segunda-feira lógica |
| R6-Q24 — Proteção e registro retroativo | R5-Q22 | Resolvida: devolver apenas sem série dependente; mesmo mês |
| R6-Q25 — Vigência de regra alterada offline | R4-Q16/Q17 e R5-Q23 | Resolvida: após aceitação do servidor, com corte aplicável confirmado em Q29 |
| R6-Q26 — Tipo/unidade após histórico | R3-Q12 e preservação histórica | Resolvida: fixos após primeiro registro |
| R6-Q27 — Onboarding e conteúdo do Briefing mínimo | Primeiro marco aprovado em R2-Q9 | Resolvida: hábito binário diário pulável e XP básico |
| R6-Q28 — Gate visual do Briefing mínimo | Spec/11 aberto e tokens provisórios permitidos em outras telas | Em aberto por escolha do Pedro, aguardando seu protótipo; sem exceção provisória |
| Q29 — Preservação da exceção semanal | R6-Q25 | Resolvida: manter Q23 após aceitação do servidor |
| Schema, protocolo, propriedade dos dados e recuperação | Comportamentos relevantes resolvidos | Trabalho de engenharia; não transformar escolhas internas em nova rodada de votos |
| Agenda, voz e notificações | Contratos de dados, dispositivos e resultados de investigação | Rodadas por capacidade |
| Especificação das primeiras entregas e tarefas | Decisões necessárias resolvidas e entendimento confirmado | Continuação documental autorizada; contrato proposto e entrega registrados, sem iniciar código |

## Rodada técnica 1

### R1-Q1 — Prioridade prática

Quando uma solução mais rápida de usar conflitar com uma implementação mais elaborada para portfólio/aprendizado, o que deve prevalecer?

Recomendação: uso diário primeiro, mantendo Java/Spring já escolhido e justificando complexidade pelo comportamento necessário.

Resposta: recomendação aceita pelo Pedro — uso diário primeiro.

### R1-Q2 — Aparelhos

Qual é o celular principal (Android/iPhone e modelo), e há outro aparelho disponível para testar a mesma conta?

Recomendação: validar primeiro no celular usado diariamente e num segundo cliente, que pode ser um emulador. A decisão não retira o suporte multidispositivo do v1.

Resposta: iPhone 16e e desejo de testar também no emulador Android.

### R1-Q3 — Autoridade na reconciliação

Depois de uma ação local imediata, o servidor pode validar os fatos e devolver um resultado reconciliado que ajuste a cópia local e os valores derivados?

Exemplo: dois aparelhos marcam o mesmo hábito no mesmo dia; após sincronizar, permanece um cumprimento e uma concessão de XP.

Recomendação: sim, com fatos reconciliados pelo servidor e projeções locais recalculadas a partir deles; feedback de rejeições e semântica do XP serão detalhados em seguida.

Resposta: sim, recomendação aceita pelo Pedro. Ver ADR-015.

### R1-Q4 — Logout offline

Quando há registros ainda não enviados, qual experiência deve prevalecer: exigir sincronização para concluir a saída; sair mantendo pendências isoladas para a mesma conta; ou permitir descarte após confirmação explícita?

Recomendação: proteger os registros por padrão e exigir sincronização no fluxo normal de saída. Se houver opção de descarte, ela precisa ser uma escolha explícita. Manter dados após logout é alternativa válida, mas exige definir seu isolamento e recuperação.

Resposta: Pedro escolheu a opção B — permitir sair e preservar as pendências isoladas para recuperação pela mesma conta. Esta escolha substitui a recomendação inicial do entrevistador. Ver ADR-016.

## Rodada técnica 2 — resolvida

### R2-Q5 — Reentrada após logout

Depois de sair deliberadamente, a reentrada pode exigir internet para autenticar novamente, mesmo que existam pendências guardadas? A alternativa é adicionar um modo de reentrada local, como desbloqueio biométrico, com contrato próprio.

Recomendação: exigir login online após logout. Enquanto a sessão local não tiver sido encerrada, o uso offline normal continua disponível, conforme o spec existente.

Resposta: recomendação aceita pelo Pedro — reentrada online após logout.

### R2-Q6 — Retenção das pendências

As pendências preservadas devem ficar sem expiração automática até sincronização confirmada, descarte explicitamente escolhido ou exclusão confirmada da conta?

Recomendação: sim. Os prazos de refresh token, backup e tombstone não devem ser usados como prazo para descartar a única cópia de uma alteração.

Resposta: recomendação aceita pelo Pedro — sem expiração automática das pendências.

### R2-Q7 — Troca de conta

Com pendências guardadas da conta A, pode-se entrar e usar a conta B imediatamente, mantendo os dados de A indisponíveis para B?

Recomendação: sim. A recuperação e o envio das pendências de A exigem autenticação como A; não basta autenticar qualquer conta no mesmo aparelho.

Resposta: recomendação aceita pelo Pedro — troca de conta permitida com isolamento.

### R2-Q8 — Rejeição definitiva no sync

Quando o servidor rejeitar definitivamente uma alteração offline, podemos preservar o conteúdo recuperável e mostrar um aviso discreto com motivo e opção de corrigir ou descartar?

Recomendação: sim. Falha de rede permanece pendência com retry; duplicação resolvida automaticamente permanece silenciosa; rejeição definitiva não deve parecer um salvamento concluído. Esse feedback não exige um modal de resolução de conflito.

Resposta: recomendação aceita pelo Pedro — rejeição definitiva recuperável e visível de forma discreta.

### R2-Q9 — Primeiro marco utilizável

Podemos considerar o primeiro marco como conta, um hábito diário, Briefing mínimo e sincronização real entre iPhone 16e e emulador Android, incluindo persistência após fechar/reabrir o app?

Recomendação: sim. Agenda, tarefas e voz continuam no escopo final da Fase 1 e chegam em incrementos seguintes; a investigação de voz pode ocorrer cedo em paralelo. O primeiro marco não inicia automaticamente a medição dos 30 dias da Fase 1 completa.

Resposta: sim — primeiro marco aprovado com esse recorte e essas condições.

### R2-Q10 — Quatro semanas

Podemos contar quatro semanas a partir do início registrado da implementação e usar o vencimento como revisão de resultados e causas de atraso, em vez de migrar automaticamente para BaaS?

Recomendação: sim. Avaliar manter o caminho, reduzir o próximo recorte ou mudar a infraestrutura com base em evidências. A manutenção da stack em R1-Q1 não revogou o ADR-014; esta pergunta propõe explicitamente revisar sua consequência automática.

Resposta: sim — revisão do ADR-014 aprovada. A contagem começa no início registrado da implementação, ainda não ocorrido nesta entrevista.

## Rodada técnica 3 — resolvida em 25/09/2026

A leitura de specs/00, 02, 03, 04 e 06 confirmou regras já fixadas: um cumprimento/XP por hábito e dia; quantidades acumulam; desfazer reverte XP sem devolver o teto consumido; exclusão vence edição; edições usam resolução automática. As perguntas abaixo fecham semânticas ausentes, sem pedir escolhas de UUID, tabelas ou algoritmo ao Pedro.

### R3-Q11 — Marcar e desmarcar em aparelhos diferentes

Offline, o iPhone marca e depois desmarca o hábito; o Android, sem conhecer esse desfazer, marca o mesmo hábito/dia. O resultado deve ficar desmarcado? Uma marcação feita depois de o aparelho já ter incorporado o desfazer pode voltar a cumprir o hábito?

Recomendação: desfazer vence a marcação concorrente que desconhecia a correção; depois de incorporar a correção, remarcar é permitido. Evita ressuscitar marcações por um envio atrasado, mas pode retirar a marcação concorrente do outro aparelho. A decisão trata de desfazer cumprimento, não de restaurar um hábito excluído.

Resposta: recomendação aceita pelo Pedro em 25/09/2026.

### R3-Q12 — Quantidades entre aparelhos

Registrar 0,5 L no iPhone e 0,7 L no Android deve produzir 1,2 L; desfazer o lançamento de 0,5 L deve preservar os 0,7 L?

Recomendação: sim. Cada lançamento intencional contribui uma vez; repetir seu envio não acrescenta quantidade. Dois lançamentos intencionais de mesmo valor continuam contando separadamente. Isso exige distinguir contribuições e suas reversões, em vez de resolver a concorrência escolhendo apenas um total diário.

Resposta: recomendação aceita pelo Pedro em 25/09/2026.

### R3-Q13 — Edições em campos diferentes

Se o iPhone muda o título de uma tarefa e o Android muda seu prazo, offline, as duas mudanças devem sobreviver à sincronização?

Recomendação: preservar as duas quando os campos forem independentes; não sobrescrever o registro inteiro com uma cópia antiga. Disputa sobre o mesmo campo continua com resolução automática, cujo critério temporal precisa ser tornado consistente no contrato. Campos dependentes, como meta e unidade, devem ser validados juntos; esta proposta não autoriza combiná-los cegamente.

Resposta: recomendação aceita pelo Pedro em 25/09/2026.

### R3-Q14 — XP ao corrigir e refazer

Em uma sequência no mesmo aparelho, marcar um hábito dá 10 XP, desmarcar reverte para 0 e remarcar deve restaurar os 10 XP originais?

Recomendação: restaurar a concessão original, preservando seu valor e dia, sem criar outro prêmio ou consumir o teto outra vez. Para tarefas, aplicar a mesma regra quando houve reversão dentro das 24 horas já definidas; se o XP não foi revertido, concluir novamente não acrescenta nada. Isso mantém a regra já existente de não devolver o teto ao desfazer.

Resposta: recomendação aceita pelo Pedro em 25/09/2026.

## Rodada técnica 4 — resolvida em 25/09/2026

Leitura factual: fuso afeta somente registros futuros e `day_key` existente é imutável. A recorrência de tarefas já segue a data prevista, mantém uma ocorrência aberta e pula vencidas. Não reabrir essas escolhas. As decisões abaixo não escolhem bibliotecas nem formatos de armazenamento.

### R4-Q15 — Duas edições do mesmo campo

O iPhone altera um título às 10h offline; o Android altera esse título às 11h e sincroniza. Às 12h chega a alteração do iPhone, feita sem conhecer a do Android. Ela pode substituir o título que já estava no servidor?

Recomendação: no v1, para alterações efetivamente concorrentes do mesmo campo, prevalece a última alteração aceita pelo servidor. A consequência é que uma edição feita antes pode vencer por chegar depois; essa ordem não é apresentada como horário real da intenção. Reenvio não é edição nova. Quando uma ação já incorporou a anterior, respeitar essa sequência conhecida. A regra específica de desfazer cumprimento de Q11 continua prevalecendo sobre esse desempate geral.

Resposta: sim, recomendação aceita pelo Pedro em 25/09/2026.

### R4-Q16 — Mudança de agenda de um hábito existente

Ao trocar um hábito diário para segunda/quarta/sexta, a nova agenda pode valer somente a partir do próximo dia lógico, preservando a avaliação de hoje e dos dias anteriores?

Recomendação: sim. Preservar a agenda válida em cada período evita reescrever faltas e ofensivas; começar amanhã evita alterar a avaliação de um dia em andamento. O custo é registrar a vigência das agendas e esperar a próxima virada para a nova regra valer. Esta recomendação substitui apenas a proposta ainda não aprovada de REQ-HAB-007, que oferecia vigência hoje ou recálculo de todo o histórico com aviso. Hábito recém-criado continua devido hoje quando sua agenda permitir.

Resposta: sim, recomendação aceita pelo Pedro em 25/09/2026.

### R4-Q17 — Mudança de meta quantitativa

Hoje a meta é 2 L e já foi cumprida; à tarde você aumenta para 3 L. Podemos manter hoje cumprido e exigir 3 L somente a partir do próximo dia lógico?

Recomendação: sim, preservando também as metas aplicáveis aos dias anteriores. Evita retirar cumprimento/XP devido à mudança de meta durante o dia; em contrapartida, corrigir a meta de um hábito já existente também só afeta o próximo dia. Não autoriza conversão de unidade, troca de tipo ou reinterpretação de lançamentos antigos.

Resposta: sim, recomendação aceita pelo Pedro em 25/09/2026.

### R4-Q18 — Prazo sem horário e virada do dia

À 00h30 de sexta-feira, uma tarefa com prazo quinta-feira, sem horário, já deve aparecer atrasada, embora o registro de hábitos ainda pertença à quinta até a virada padrão das 04h?

Recomendação: sim. Datas e grupos de tarefas seguem o calendário civil do fuso do perfil; hábitos e contabilização de XP seguem o dia lógico. A data sem horário permanece a mesma data após viagem; tarefas com hora continuam preservando o instante conforme o spec. Isso exige distinguir data civil de instante, em vez de aplicar indistintamente um prazo UTC a ambos.

Resposta: sim, recomendação aceita pelo Pedro em 25/09/2026.

## Rodada técnica 5 — resolvida em 25/09/2026

Na abertura desta rodada, já estavam definidos o calendário previsto da recorrência, o pulo de vencidas e uma ocorrência aberta por série ativa; a ofensiva negativa avançava sem recaída e a recaída não retirava XP. O congelamento ainda era proposta. As respostas abaixo fecharam as interações e sua adoção.

### R5-Q19 — Limite de uma série recorrente

Uma tarefa tem cinco ocorrências diárias previstas de segunda a sexta. Ao concluir a primeira atrasada na quinta, as datas puladas de terça e quarta devem consumir o limite, sem prolongar a série para garantir cinco conclusões?

Recomendação: sim; contar as posições previstas no calendário, inclusive as puladas. Isso mantém o término planejado, mas pode resultar em menos conclusões efetivas. Uma meta de realizar algo cinco vezes é um comportamento diferente.

Resposta: recomendação aceita pelo Pedro em 25/09/2026.

### R5-Q20 — Desfazer conclusão depois de gerar a próxima ocorrência

Concluir segunda criou terça. Podemos retirar a próxima ocorrência e reabrir segunda apenas enquanto a próxima não tiver sido editada, concluída ou recebido outra intervenção do usuário?

Recomendação: sim. Se a sucessora permanece intocada, desfazer substitui a sucessora pela anterior reaberta. Se já foi usada, impedir esse desfazer e explicar o motivo, preservando o trabalho posterior. É uma nova exceção explícita à regra geral de desmarcar; reduz a liberdade de correção para manter uma ocorrência aberta sem apagar dados. Se o uso da sucessora em outro aparelho só for descoberto na sincronização, aplicar o feedback de rejeição de Q8. Quando o desfazer for permitido, manter a regra de XP existente: reversão em até 24h; depois desse prazo o XP permanece.

Resposta: recomendação aceita pelo Pedro em 25/09/2026.

### R5-Q21 — XP diário de hábito negativo

Em um hábito como não fumar, os 10 XP diários de cumprimento devem exigir a ação explícita "resisti hoje", mesmo que a ofensiva avance automaticamente sem recaída?

Recomendação: sim. Ausência de recaída preserva o comportamento automático já previsto para a ofensiva do hábito, mas não gera os 10 XP diários nem um registro explícito para a ofensiva global. Registrar "resisti hoje" concede uma vez pelas regras normais. Isso exige registro para o prêmio diário; os bônus por marcos de ofensiva já previstos continuam válidos e não estão sendo retirados por esta proposta.

Resposta: recomendação aceita pelo Pedro em 25/09/2026.

### R5-Q22 — Dois dias de proteção por mês

Podemos adotar dois dias lógicos protegidos por conta a cada mês civil, cobrindo conjuntamente as ofensivas avaliadas por dia que precisariam de proteção?

Recomendação: sim, automaticamente e sem acumular saldo entre meses. Se três hábitos devidos faltarem no mesmo dia, gastar uma unidade para preservar essas séries e, quando necessário, a global. O dia protegido não conta como cumprimento nem concede XP; uma série de seis permanece em seis até o próximo cumprimento. Aplicar às ofensivas avaliadas por dia, não às metas semanais no v1. Recaída explícita não é ausência a proteger e continua zerando a ofensiva negativa. A cota por conta é mais simples de explicar que duas por hábito; a UI informa o uso depois, sem interromper o usuário.

Resposta: recomendação aceita pelo Pedro em 25/09/2026.

### R5-Q23 — Exceção para agendas semanais

Ao mudar de três para duas vezes por semana na quinta-feira, podemos manter a regra antiga até o fim da semana e iniciar a nova na segunda-feira seguinte?

Recomendação: sim. Propor uma exceção explícita à Q16 para mudanças de agenda que entram, saem ou alteram o modo de N vezes por semana: valer na próxima segunda-feira, na virada do dia lógico. Isso preserva a semana como período de avaliação, mas faz a mudança esperar mais. Outras mudanças de agenda e de meta quantitativa continuam seguindo o próximo dia lógico. A exceção ainda não está incorporada como regra nos specs.

Resposta: recomendação aceita pelo Pedro em 25/09/2026; exceção incorporada ao ADR-018 e aos specs.

## Rodada técnica 6 — respostas registradas em 25/09/2026

As três primeiras perguntas fecham interações de domínio já discutidas. As duas últimas detalham o primeiro marco aprovado; não antecipam Agenda Google, tarefas ou voz. Depois de fechado esse recorte, schema e protocolos exigem elaboração técnica, não votação sobre cada campo ou algoritmo. Contratos de capacidades posteriores serão detalhados em seus incrementos, sem serem considerados implicitamente aprovados.

### R6-Q24 — Devolver proteção após corrigir o histórico

Segunda consumiu uma proteção para dois hábitos. Na quarta, você registra retroativamente que cumpriu ambos. Podemos devolver a unidade à cota do mês original?

Recomendação: sim, somente quando nenhuma ofensiva daquele dia ainda depender da proteção. Corrigir apenas um dos dois hábitos não basta. A unidade pode proteger outra falta do mesmo mês, mas não migra para o mês seguinte. Isso não altera a regra de não devolver teto de XP ao desfazer.

Resposta: recomendação aceita pelo Pedro. Ver REQ-GAM-011a.

### R6-Q25 — Mudança de agenda/meta feita offline

Você aumenta a meta de 2 L para 3 L offline na segunda e só sincroniza na quinta. Outro aparelho já avaliou terça e quarta com 2 L. Podemos efetivar a mudança somente depois de o servidor aceitá-la, a partir do próximo dia lógico ou da próxima segunda-feira, conforme a regra aplicável?

Recomendação: sim no v1. Permitir preparar a edição offline, mostrando "aguardando conexão"; após aceitação, informar a data de vigência. Criar hábitos e registrar cumprimentos continuam disponíveis offline. Esta proposta acrescenta uma condição às Q16/Q17/Q23 e é uma exceção expressa à disponibilidade offline genérica das alterações de regra. A alternativa é manter a vigência prevista offline e aceitar correções posteriores de cumprimento/ofensiva/XP nos dias intermediários.

Resposta: “Recomendado proximo dia logico”. O esclarecimento Q29 abaixo confirma a preservação da exceção semanal; ver REQ-HAB-007b e ADR-018.

### R6-Q26 — Tipo e unidade com histórico

Depois do primeiro registro, tipo e unidade de um hábito podem ficar fixos? Por exemplo, para passar de litros a mililitros, arquivar o hábito e criar outro, preservando o histórico anterior.

Recomendação: sim no v1. Antes de existir histórico, permitir corrigir a configuração validando os campos relacionados; depois, mudar o significado exige outro hábito, que começa outra série. Isso evita conversões e reinterpretação do histórico. Alterar apenas a meta numérica continua permitido pelas regras de vigência.

Resposta: recomendação aceita pelo Pedro. Ver REQ-HAB-007.

### R6-Q27 — Onboarding e Briefing do primeiro marco

Podemos começar com onboarding de fuso/início do dia e primeiro hábito binário diário (pulável), seguido de Briefing com saudação, hábitos e XP básico?

Recomendação: sim. Manter conta, persistência, sync e logout já aprovados. XP básico inclui concessão única, teto e desfazer/refazer, sem exigir interface de níveis, ofensivas, proteções ou conquistas neste marco. Essas capacidades entram em incrementos seguintes da Fase 1, assim como Agenda, tarefas, voz e seus pedidos de permissão/consentimento. O recorte não deve mostrar funcionalidades indisponíveis nem pedir acesso ao microfone/Google antecipadamente; consentimento de telemetria deve existir antes de coletá-la, caso esteja habilitada. Onboarding continua retomável e o Briefing mantém estado útil quando a criação do hábito for pulada.

Resposta: recomendação aceita pelo Pedro. Recorte incorporado aos specs 01/04/08 e ao plano de execução.

### R6-Q28 — Visual provisório no Briefing mínimo

Podemos liberar o Briefing do primeiro marco com tokens provisórios neutros, sem esperar a escolha da direção visual definitiva?

Recomendação: sim, como exceção específica ao bloqueio de REQ-DS-000. Manter os tokens centralizados, temas claro/escuro, acessibilidade e estados de interface já exigidos. O spec/11 permite valores provisórios nas primeiras telas, mas hoje bloqueia a parte visual do Briefing. Aceitar esta proposta libera somente o recorte funcional mínimo; não aprova identidade visual definitiva nem estilos inventados por tela.

Resposta: “Eu estou fazendo o design do prototipo, pode deixar em aberto ate eu fechar ele”. Manter o gate visual de spec/11; não adotar a exceção recomendada.

### Q29 — Q25 preserva a exceção semanal de Q23?

Esclarecimento necessário porque “próximo dia lógico” poderia substituir o corte semanal previamente aprovado.

Resposta expressa: “Manter Q23: metas e agendas diárias no próximo dia lógico; mudanças envolvendo agenda semanal na próxima segunda-feira, após aceitação do servidor (recomendado).”

Resultado: a condição de aceitação do servidor vale para ambos os cortes, sem aplicar uma mudança semanal no meio da semana.

## Registro das próximas respostas

Informação operacional registrada na etapa de stack/build em 25/09/2026: Pedro informou **não ter assinatura ativa do Apple Developer Program**. Isso não altera a escolha do iPhone 16e como aparelho principal; o build físico via EAS depende da assinatura ou de uma alternativa local com Mac. Não houve autorização de compra nem criação de conta. Ver a pesquisa de stack/build.

Após cada rodada, registrar escolhas, razões e perguntas desbloqueadas. Criar glossário e ADRs conforme houver definições resolvidas; atualizar os contratos afetados sem confundir propostas da auditoria com decisões do Pedro.


## Esclarecimentos do recorte de exclusão — 30/09/2026

- **Q30:** Pedro escolheu reverter o XP das concessões do hábito excluído, sem devolver o orçamento consumido, preservando os registros técnicos necessários à sincronização. Substitui explicitamente o caso antigo de spec/04 §7 que preservava XP após exclusão. O histórico de produto deixa de estar disponível; fatos/contextos, decisões, transições e recibos técnicos seguem spec/00 §12 e desaparecem com a exclusão da conta.
- **Q31:** Pedro escolheu prêmio inteiro ou nenhum XP: confirmar o cumprimento; conceder 10 somente quando couber integralmente no saldo do teto. Sem prêmio parcial. A decisão inicial sem prêmio permanece no desfazer/refazer.


## Limites operacionais da API — 30/09/2026

- **Q32:** Pedro aprovou quotas iniciais configuráveis: 120 requisições/minuto por conta; 300/minuto por IP na API. Por IP: login 10/minuto, cadastro 5/minuto, solicitação de recuperação 3/15 minutos, confirmação 10/minuto e refresh/revoke 60/minuto cada. Excesso retorna 429 com Retry-After sem descartar alterações locais.


## Recuperação operacional — rodada 1, 01/10/2026

Entrevista com a skill grilling em andamento. As respostas abaixo fecham objetivos; mecanismo, parâmetros e procedimento ainda serão detalhados antes da confirmação do plano completo e da implementação.

- **Q33 — Perda aceitável em desastre:** Pedro respondeu **A**. Preservar todas as transações já confirmadas pela API mesmo com perda total da VPS primária; exigir cópia durável em destino independente antes de confirmar. A indisponibilidade do destino pode fazer a sincronização esperar. Não foi aceita uma janela de perda nesse cenário. A escolha exige proteção além de dump periódico assíncrono.
- **Q34 — Prazo de recuperação:** Pedro respondeu **A**. Meta inicial de até **24 horas** para reconstruir o ambiente, restaurar os dados, verificar a API e liberar a sincronização. Meta operacional a comprovar em ensaio; o tempo do teste local não equivale a RTO medido em produção.

Perguntas desbloqueadas: topologia de proteção externa compatível com RPO zero/RTO24h; contenção de restauração incompleta e uso local durante o incidente; política de sessões/links após recuperação integral. Fornecedor, orçamento, agenda, retenção da cadeia física/WAL, alertas e provisionamento continuam sem definição concluída. Nenhuma política de replay de operações confirmadas foi aprovada.


## Recuperação operacional — rodada 2, 01/10/2026

Pedro respondeu **A** nas três perguntas. Entrevista em andamento; estas escolhas não concluem o plano nem comprovam RPO/RTO no ambiente real.

- **Q35 — Estrutura remota:** receptor contínuo de WAL fora da VPS primária, acompanhado de backup físico recuperável. Reconstruir o PostgreSQL a partir dessa base e cadeia de WAL; não manter um segundo banco completo continuamente aplicando WAL neste recorte. Exigir destino independente disponível antes de confirmar as transações protegidas.
- **Q36 — Recuperação incompleta:** manter a API bloqueada para os clientes enquanto a completude não for comprovada. A conta local ativa continua permitindo leitura e novos registros locais, preservando envelopes e fila. Não instalar snapshot antigo nem reenviar automaticamente operações acknowledged para tentar reconstruir o histórico. Isolamento entre contas e regras de logout permanecem.
- **Q37 — Após recuperação integral:** invalidar sessões, access/refresh tokens e links de recuperação anteriores e exigir nova autenticação online para comunicação remota. Preservar a senha recuperada correta, o SQLite e as pendências. Não exigir troca de senha nesse caminho integral nem tratar invalidação remota como autorização para apagar/bloquear os dados locais.

Perguntas desbloqueadas: cadência das bases, significado da retenção de30 dias para a cadeia física/WAL, canal de alerta independente da VPS e frequência dos ensaios operacionais. A confirmação do plano completo continua pendente. Detalhes de sincronismo, cauda parcial, timelines, timeout/resultado incerto e expurgo por dependência serão elaborados e testados como engenharia; configurar o receptor isoladamente não comprova perda zero.


## Recuperação operacional — rodada 3, 01/10/2026

Pedro respondeu **A** em Q38 a Q41. Entrevista em andamento; ainda falta confirmar o plano completo antes de implementar seus mecanismos.

- **Q38 — Cadência:** base física completa diária e dump lógico diário, às **03:00 em America/Sao_Paulo**, mantendo a recepção de WAL continuamente. A base física atende à recuperação com WAL; o dump lógico é uma cópia auxiliar e não comprova sozinho a preservação das transações confirmadas.
- **Q39 — Retenção:** janela contínua recuperável de **30 dias**. Conservar também a base âncora anterior ao início dessa janela e o WAL necessário, mesmo quando esses arquivos ultrapassarem 30 dias. Expurgar por dependência da cadeia, não apenas pela idade dos arquivos. Isso amplia a formulação anterior de retenção de arquivos; restaurar um ponto histórico continua sujeito à contenção de Q36.
- **Q40 — Alertas:** canal por **e-mail**, com detecção fora da VPS primária. Destinatário e credenciais serão configurados no provisionamento, sem registrar seus valores nos documentos ou na memória.
- **Q41 — Ensaios:** recuperação integral em ambiente isolado **mensalmente e a cada release major**, verificando integridade, comportamento da API e tempo total até a liberação. A frequência mensal complementa a exigência já existente por release major; não significa que RPO zero ou RTO de 24 horas estejam comprovados em produção.

Perguntas desbloqueadas: critérios iniciais de alerta e custódia dos segredos necessários à reconstrução após perder a VPS. Fornecedores, custos e instalação externa ficam para o provisionamento após a prova local; nenhuma compra, publicação ou envio de e-mail foi executado nesta entrevista. A confirmação de entendimento do recorte local e do procedimento operacional permanece pendente.


## Recuperação operacional — rodada 4, 01/10/2026

Pedro respondeu **A** em Q42 e Q43. Decisões registradas; a confirmação de entendimento do plano consolidado ainda está pendente.

- **Q42 — Critérios iniciais de alerta:** verificar disponibilidade da API e do receptor de WAL a cada **60 segundos**, alertando após **duas falhas consecutivas**; alertar se o último backup físico ou lógico válido ultrapassar **26 horas**; alertar imediatamente quando uma execução de backup ou ensaio falhar; avisar com armazenamento em **80%** e elevar para crítico em **90%**. Enviar e-mail na abertura, agravamento e resolução do incidente, sem repetir enquanto o estado permanecer igual. Parâmetros configuráveis. O critério por idade cobre também a ausência silenciosa de execução agendada.
- **Q43 — Custódia:** guardar credenciais, configurações sensíveis e eventuais chaves de criptografia em **cofre de senhas externo aos servidores**, acessível por Pedro mesmo após perder a VPS. Documentação guarda apenas referências; valores serão configurados no provisionamento. Não foi escolhido fornecedor de cofre nem fornecido qualquer segredo.

Próximo ponto: confirmar entendimento do [plano consolidado do recorte](../recuperacao-operacional/spec.md). Ele distingue o primeiro incremento local, as provas seguintes e as dependências antes da operação externa. A entrevista deste recorte não autoriza compras ou publicação, não conclui o M1 e não substitui o gate visual de Q28.


## Recuperação operacional — entendimento confirmado, 02/10/2026

Pedro confirmou o plano consolidado com “Pode comecar o recorte 1”. Iniciar contenção e retomada integral no ambiente local, nas fronteiras HTTP/Session/AccountStore, SQLite/PostgreSQL e operação externa de armazenamento já descritas. Q33–Q43 consolidadas no [ADR-019](../../docs/adr/0019-recuperacao-operacional-sem-perda-de-confirmacoes.md) e spec/07. Provisionamento, compras, exposição externa e garantias medidas em produção permanecem etapas posteriores.


## Provisionamento externo — Q44–Q46, 02/10/2026

- **Q44 — Ambiente existente:** Pedro confirmou VPS disponível na **Hostinger, Campinas/SP**, com **2 vCPU, 8 GB RAM, 100 GB disco, Ubuntu 24.04 e Coolify 4.3.23**. São informações declaradas pelo operador; utilização livre, arquitetura/configuração e acessos ainda não foram inspecionados no host. Não há necessidade confirmada de contratar outro primário.
- **Q45 — Orçamento:** Pedro não tem teto mensal mensurado; pediu recomendação mais específica de abordagens/custos. Preparar proposta com fontes oficiais, receptor/detector e ensaios discriminados. Nenhum preço/teto/fornecedor adicional foi aprovado.
- **Q46 — Cofre e e-mail:** Pedro ainda não possui cofre externo e pediu sugestões; já usa **Resend**. Bitwarden Free cloud foi recomendado, com Premium opcional; a escolha de cofre ainda não foi confirmada. Resend tem SMTP compatível com o contrato, mas plano/quota/domínio/remetente/destinatário e credenciais operacionais continuam a conferir pelo canal privado.

Referências: [caderno de provisionamento](../../api/ops/external-provisioning.md) e [preparo/evidências](../../docs/analises/2026-10-02-preparacao-do-provisionamento.md). Esta rodada registra dados do ambiente e solicitações de recomendação; não autoriza contratação ou exposição nem confirma RPO/RTO externo.


## Proposta operacional — Q47/Q48, 02/10/2026

- **Q47:** Pedro escolheu o perfil A como referência enxuta, com **artefatos locais primeiro e contratação/orçamento depois**. Pediu comparar também outra VPS Hostinger e Cloudflare R2; informou já ter storage, sem fornecer capacidade/configuração/credenciais. Não escolheu AWS/DO como fornecedores definitivos nem autorizou compra/upload/exposição. Avaliar R2 como cópia auxiliar, mantendo a condição de WAL síncrono durável de Q33/Q35; qualquer substituição dessa condição exigiria decisão explícita.
- **Q48:** Pedro escolheu **Bitwarden Free hospedado pelo Bitwarden**. Configuração de conta, recuperação/2FA e injeção privada de segredos ainda serão realizadas pelo canal apropriado; nenhum segredo foi solicitado.

A [proposta](../../docs/analises/2026-10-02-proposta-de-infraestrutura.md) contém cotações para comparação, não orçamento contratado. Prosseguir com pacote local/ensaios antes da escolha final dos fornecedores e do aceite externo.

## Retenção física do feed — Q49/Q50, 04/10/2026

Pedro respondeu **A** nas duas perguntas:

- **Q49 — Abrangência:** retenção de 90 dias para todos os envelopes de transação do feed, incluindo tombstones. Preservar estado atual, fatos necessários à reconciliação, histórico técnico de XP, recibos e IDs excluídos. Snapshot válido continua reservando o feed após H; a janela não expira pendências locais.
- **Q50 — Execução:** rotina automática diária, configurável e em lotes limitados. Preparar implementação e testes locais neste recorte; instalação externa continua no seu gate próprio.

As escolhas foram propagadas para spec/06, spec/13 e README dos contratos. Não há pergunta de produto adicional para o escopo delimitado. Pedro confirmou o entendimento do [plano consolidado](../retencao-feed/spec.md) e as fronteiras de teste com “sim” em 04/10/2026. [Implementação local e validação](../../docs/analises/2026-10-04-retencao-fisica-do-feed.md). Corrupção física, cofre indisponível e conflitos de identidade são recortes independentes; não apagar dados técnicos de domínio sob a política de expurgo do feed.


## Recuperação de exceções — Q51–Q53, 07/10/2026

Pedro escolheu **A** nas três perguntas:

- **Q51 — Banco local ilegível:** preservar arquivos, bloquear a base afetada e permitir nova tentativa após corrigir a causa/atualizar. Controle de instalação ilegível bloqueia abertura inteira. Reparo físico, exportação e reconstrução assistida ficam em recorte próprio; não houve aprovação de reset ou descarte de pendências irrecuperáveis.
- **Q52 — SecureStore indisponível:** sessão já ativa com controle e banco saudáveis mantém leitura e novas alterações locais. Preservar referências às credenciais e pausar acesso remoto até recuperar o cofre. Logout incompleto/encerrado, login novo e refresh incerto conservam os bloqueios/regras anteriores. SecureStore do dispositivo é distinto de Bitwarden operacional.
- **Q53 — Identidade ainda sem prova após consulta ao servidor:** preservar operação e dependentes bloqueados com diagnóstico para intervenção técnica; independentes continuam. Não descartar a intenção incerta, gerar nova identidade ou reenviar automaticamente. Rejeição definitiva comprovada e confirmação correspondente conservam as garantias existentes.

Respostas incorporadas aos specs 01/06/13 e README dos contratos. [Diagnóstico verificado por leitura](../../docs/analises/2026-10-07-recuperacao-de-excecoes.md) e [plano consolidado para confirmação](../recuperacao-excecoes/spec.md). Ordem recomendada: identidade/recibos, cofre, abertura local. Não há outra pergunta de produto na fronteira delimitada; entendimento e fronteiras de teste ainda aguardam confirmação antes da implementação. M1/tarefa 05 e gates existentes permanecem abertos.
