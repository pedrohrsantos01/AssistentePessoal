# Ritmo — briefing funcional para o Claude Design

Versão 1.0 · 30/09/2026 · preparado para Pedro · idioma da interface: pt-BR.

Este documento é autossuficiente: pode ser anexado ao Claude Design sem acesso ao repositório. Reúne comportamento esperado, telas, situações de erro e limites do protótipo. Os links ao final permitem conferir a origem dos requisitos.

**Objetivo:** produzir um protótipo mobile navegável e um contrato visual que Pedro possa avaliar antes da implementação das telas. Este briefing não fecha a identidade visual, não aprova módulos futuros e não comprova que as telas já existem no app.

## 1. Produto e experiência desejada

**Ritmo é um assistente pessoal modular que entrega algo antes de pedir qualquer coisa.** Ao abrir, a pessoa recebe uma visão útil do dia; registrar a própria vida deve custar poucos toques ou uma frase curta. O problema central é o atrito de registro, não a falta de funções.

O usuário inicial é Pedro, adulto, desenvolvedor e usuário do próprio produto. O alvo futuro é um profissional brasileiro com rotina irregular que já abandonou outros apps de organização. A experiência é individual, sem times, colaboração, feed social ou ranking entre pessoas.

A plataforma é um aplicativo para iOS e Android. O dispositivo principal de Pedro é um **iPhone 16e**; um emulador Android será o segundo cliente de validação. O protótipo deve representar uso de celular, áreas seguras, teclado, retorno de navegação, rolagem e textos longos. Uma representação navegável em navegador pode simular o app, mas a interface deve continuar sendo mobile.

A home chama-se **Briefing** e é a única tela de uso diário. Não criar uma segunda tela “Hoje” com o mesmo conteúdo. Hábitos e tarefas têm áreas de gestão e histórico; as ações frequentes também acontecem diretamente no Briefing. Agenda é compromisso com horário; tarefa é algo a terminar; hábito é comportamento recorrente.

Princípios de experiência:

- Entregar contexto útil antes de solicitar configuração de hábitos, permissões ou integrações adicionais. A conta continua obrigatória para usar o app.
- Registrar e consultar dados locais mesmo sem internet, com indicação honesta de pendências.
- Manter ações curtas, recuperação de erros e desfazer onde o domínio permitir.
- Mostrar poucos cards relevantes, com hierarquia clara; evitar feed infinito ou dashboard cheio de métricas.
- Usar linguagem adulta, acolhedora e factual. Ausência, recaída e perda de série não geram culpa.
- Distinguir salvo no aparelho, confirmado remotamente e recusado.

## 2. Como interpretar escopo e decisões

Use estes rótulos nos conjuntos de telas, anotações e apresentação:

| Rótulo | Significado | Tratamento no protótipo |
|---|---|---|
| **M1 — primeiro marco** | Próxima experiência utilizável, recorte aprovado da Fase 1 | Fluxo principal completo, com erros e acessibilidade |
| **Fase 1 — completa** | Funcionalidades aprovadas, entregues em incrementos posteriores ao M1 | Telas próprias, sem simular disponibilidade no M1 |
| **Fase 2A — planejada** | Notícias, esportes e mediação de agenda, com specs existentes | Conjunto separado de expansão |
| **Hipótese futura / proposta** | Fases 2B/3 ou escolha visual ainda não aprovada | Exploração identificada; não é contrato fechado |

**M1 inclui:** conta por e-mail/senha, recuperação de senha, onboarding retomável de fuso e início do dia, criação opcional do primeiro hábito binário diário, Briefing com saudação/hábitos/XP básico, persistência local, sincronização, sessão e logout.

No M1, a gestão pode editar metadados do hábito, como título, ícone, cor e ordem. Tipos quantitativo/negativo, agendas avançadas, mudança de meta, arquivamento, exclusão e reativação entram depois. Não expor controles dessas capacidades como se funcionassem no M1.

**Fase 1 completa adiciona:** tarefas e recorrências, todos os tipos/agendas de hábitos, histórico, Agenda Google, níveis/ofensivas/proteções/conquistas, assistente por texto e voz, notificações locais, exportação e exclusão de conta. O M1 não inicia sozinho a avaliação de uso de 30 dias da fase completa.

**Fase 2A adiciona:** notícias, futebol e notificações remotas de partidas; mediação somente depois de a Agenda estar estável.

**Fases 2B/3:** treinos, finanças com Open Finance, busca global, refeições, leitura, importação, OCR, wearables e outras possibilidades. Ainda não têm contratos completos; ver seção 17.

**Estado real em 30/09/2026:** existe fundação técnica de conta/hábitos/XP/sync, verificações automatizadas e evidência de HTTP nativo no Android. O M1 ainda não foi aceito como produto utilizável; telas finais e validação no iPhone físico continuam pendentes. A direção visual permanece aberta por decisão de Pedro, Q28.

## 3. Arquitetura de informação e inventário de telas

A estrutura exata de navegação é **proposta de design**, não decisão aprovada. Propor poucos destinos principais, com Briefing sempre fácil de alcançar, gestão de hábitos/tarefas, Agenda e configurações acessíveis. O assistente deve ter uma entrada persistente quando disponível. Não fixar quantidade de abas por conveniência da ferramenta.

Não colocar botões sem ação de voz, Agenda ou tarefas no M1. Essas funções aparecem nos conjuntos da fase correspondente.

| Conjunto | Telas / superfícies necessárias | Escopo |
|---|---|---|
| Conta | Entrada, cadastro, login, solicitar recuperação, retorno por link, nova senha, solicitar novo link | M1 |
| Onboarding | Confirmar fuso/início do dia, primeiro hábito opcional, retomada de etapa | M1 |
| Briefing | Com hábitos, sem hábitos, folga, tudo concluído, offline, pendências, rejeição, leitura protegida | M1 e expansões |
| Hábitos | Lista, criar/editar, estados diários; depois detalhe, lançamentos, retroativo, histórico, arquivados | M1 / Fase 1 |
| Sessão e sync | Estado resumido, atenção a pendência, recusa, correção/descarte, reautenticação, carga inicial | M1 |
| Tarefas | Lista agrupada, criação rápida, detalhe, subtarefas, recorrência, tags, busca, concluídas | Fase 1 |
| Agenda | Conectar Google, escolher calendários, lista, detalhe, confirmar criação, evento pendente/falho | Fase 1 |
| Assistente | Texto, gravação, transcrição editável, esclarecimento, confirmação, resultado parcial, desfazer, histórico de ações | Fase 1 |
| Gamificação | XP; depois nível, ofensivas, proteção, conquistas e configurações | M1 / Fase 1 |
| Configurações | Perfil, preferências, cards, integrações, notificações, consentimentos, uso de IA, privacidade, exportação, exclusão, logout | Conforme capacidade disponível |
| Notícias | Temas, fontes, validação de fonte, cards e atribuição | Fase 2A |
| Esportes | Favoritos, partidas, detalhe ao vivo/resultado, tabela, preferências de alertas | Fase 2A |

Sheets e páginas completas podem ser escolhidas conforme complexidade/acessibilidade. A composição deve preservar os comportamentos abaixo.

## 4. Conta, sessão e privacidade

### Cadastro e login

- E-mail e senha apenas. Sem convidado, Apple ou Google como login na Fase 1. Conectar Google Calendar não autentica a conta do Ritmo.
- Cadastro: nome de exibição (1–80 caracteres), e-mail válido (até 254) e senha (8–128). Orientação de força sem obrigar símbolos.
- Senha nunca aparada ou alterada automaticamente. Exibir/ocultar é proposta de controle acessível.
- E-mail desconsidera espaços externos e caixa; pontos e sufixos “+” não tornam contas equivalentes.
- Erro junto ao campo, preenchimento preservado e carregamento no botão durante autenticação. Cadastro, login e reentrada após logout exigem conexão.
- Política de privacidade pt-BR acessível antes do cadastro e no app; termos declaram público adulto. Não inventar etapa obrigatória de identidade/idade.

### Recuperação de senha

- Resposta uniforme: “Se houver uma conta com este e-mail, enviaremos as instruções.” Não revelar existência nessa resposta.
- Link de uso único, válido por uma hora. Abrir não consome; confirmar nova senha consome.
- Pedir outro link não invalida o anterior. Reset bem-sucedido invalida links anteriores e encerra sessões daquela conta.
- Sucesso leva ao login; reset não cria sessão automaticamente.
- Link inválido, usado ou expirado oferece outro; falha de rede permite retomar.
- Link para outra conta não apaga dados locais nem encerra sessão existente arbitrariamente.

### Sessão, logout e troca de conta

- Renovação normal de sessão é invisível.
- Sessão remota expirada offline mantém uso local. Se o servidor exigir autenticação, pedir login para sync, preservando dados/pendências.
- **Logout deliberado é diferente:** pode ocorrer offline, encerra acesso imediatamente e exige login online para reentrada. Dados/envios ficam isolados pela conta, sem expiração automática.
- Conta B nunca vê, exporta ou envia pendências da A. Não permitir acessar cache de outra conta sem login.
- Se a limpeza segura da saída falhar, manter acesso bloqueado e oferecer retomar a finalização; não reabrir conta automaticamente.
- Erro de autorização/expiração não significa exclusão de conta.

### Consentimentos e dados

- Consentimento de IA e opt-in de analytics são separados; ambos recusáveis sem bloquear funções manuais.
- Microfone/notificações são permissões do sistema distintas e aparecem quando há capacidade e contexto.
- Crash reporting é explicado e desligável em configurações. Analytics não recebe títulos, transcrições ou conteúdo pessoal.
- Política explica finalidades, subprocessadores/países, transferências e ausência de uso para treinamento de modelos. Não inventar provedores ainda não escolhidos.
- Perfil: nome, fuso, início do dia e preferências disponíveis. Ofensivas/notificações/consentimentos fáceis de encontrar quando existirem.
- **Exportação na Fase 1 completa:** todos os dados em JSON, por e-mail ou compartilhamento nativo, em até 24h. Não substituir por PDF/CSV ou resumo.
- Requisito de exportação local JSON a cada sete dias: acesso/armazenamento precisam de contrato operacional; não inventar restauração automática.
- **Excluir conta:** confirmação digitada, anonimização imediata, exclusão física em até 30 dias; revogar sessões/Google. Descartar pendências só por exclusão confirmada, não por erro de login.
- Solicitação, processamento e falha de exportação/exclusão são estados a detalhar; não afirmar que já existem nem inventar reautenticação obrigatória.
- Dados locais não equivalem a backup contra desinstalação. Não sugerir limpar/reinstalar como primeira solução.

## 5. Onboarding e primeira entrega de valor

### M1

1. Após autenticar, confirmar fuso detectado e início do dia, padrão **04:00**, configurável de 0 a 23 horas.
2. Oferecer primeiro hábito **binário diário**, título/ícone/cor, com “Pular” visível.
3. Entrar no Briefing útil mesmo sem hábitos; nunca uma lista em branco sem explicação.

Ao fechar, retomar etapa correta. Depois de criada a conta/iniciada a sessão, concluir etapas offline é permitido. Não pedir microfone, notificações ou Calendar no M1.

### Fase 1 completa

No máximo cinco telas: apresentação curta com demo de voz quando disponível; fuso/início do dia; um a três hábitos sugeridos ou criação própria; Google opcional; permissões contextualizadas após mostrar valor. “Pular” nas etapas opcionais. Consentimentos de IA e analytics distinguíveis sem formulário longo como pedágio.

Módulos posteriores se configuram na primeira abertura de cada módulo, sem ampliar o onboarding global. Sugestões são demonstrativas, não escolhas obrigatórias de Pedro.

## 6. Briefing — a home

Cards independentes carregam progressivamente e podem ser ocultados/reordenados. Saudação fica no topo; ordem manual prevalece sobre automática. Falha de card remoto não derruba cards locais nem a home.

| Card | Conteúdo e ações | Escopo |
|---|---|---|
| Saudação | Nome, data, contexto; ofensiva global só quando disponível/habilitada | M1 / Fase 1 |
| Hábitos | Devidos no período, estado, progresso e registro direto | M1 / Fase 1 |
| XP | Valor básico válido; nível/progresso só depois | M1 / Fase 1 |
| Agenda | Até quatro eventos de hoje não encerrados; horário/título/local; próximo em menos de uma hora destacado | Fase 1 |
| Tarefas | Até cinco atrasadas ou de hoje, conclusão direta, gestão | Fase 1 |
| Fechamento | Após 21h, se tudo concluído, resumo de XP e encerramento positivo | Fase 1 |
| Notícias | Três a cinco matérias relevantes, resumo/fonte/link | Fase 2A |
| Esportes | Jogo do dia, ao vivo ou resultado recente | Fase 2A |

Estados próprios:

- **Primeiro dia sem hábitos:** boas-vindas/CTA de criar no M1; na fase completa, três ações úteis sugeridas conforme disponibilidade.
- **Sem itens devidos:** folga neutra, diferente de erro ou configuração ausente. Quando não houver conteúdo atual, aproveitar resumo do dia anterior ou conquista recente disponível, sem cobrar registros.
- **Tudo concluído:** resumo positivo sem impor mais trabalho.
- **Muitos cards:** mais de dez elegíveis limita a sete visíveis, com “Ver mais”.
- **Offline:** hábitos/tarefas utilizáveis; módulos remotos com cache e indicação de atualização.
- **Remoto indisponível:** erro restrito ao card; dados antigos identificados.
- **Retorno após ausência:** acolher e mostrar o que permanece, sem dias “perdidos” ou punição.
- **Puxar para atualizar:** revalidar cards de rede sem travar registros locais.

Metas: cards locais úteis até 300 ms; cold start interativo até dois segundos; resposta visual ao hábito até 100 ms. Orientam implementação; protótipo simulado não comprova desempenho real.

**Dois calendários coexistem:** às 00:30 de sexta, uma tarefa vencida quinta já pode estar atrasada, enquanto um hábito registrado pertence à quinta pela virada às 04h. Não chamar tudo de “hoje” sem contexto. Com app aberto, atualizar tarefas na meia-noite civil e hábitos/XP na virada lógica automaticamente.

Briefing matinal pode notificar localmente, padrão 07h, configurável/desligável, até uma vez/dia, respeitando silêncio noturno. Abre direto no Briefing e usa a informação do card mais relevante, não texto genérico. Rateio dentro do orçamento global ainda pendente; seção 19.

## 7. Hábitos

### Tipos e criação na Fase 1 completa

| Tipo | Exemplo | Registro | Cumprimento |
|---|---|---|---|
| Binário | Meditar | Fiz / desfazer | Um por hábito/dia |
| Quantitativo | Beber 2 L | Adicionar contribuição | Soma atinge meta vigente |
| Negativo | Não fumar | “Resisti hoje” / “Tive uma recaída” | XP diário exige registro explícito |

Formulário: título obrigatório, tipo, ícone, cor, agenda e lembretes; quantitativo exige meta/unidade. Contrato M1: título até 120 caracteres, só espaços inválido. Não escolher limites novos para campos futuros sem especificação.

Título único entre hábitos ativos da conta, considerando normalização, caixa e espaços. Erro junto ao campo; diferença cosmética não permite duplicação. Conflito descoberto após envio offline preserva preenchimento para corrigir.

Agendas: diário; dias específicos; N vezes/semana sem dias fixos; a cada N dias. Semana começa segunda. Novo hábito devido na criação se agenda permitir. Hábito nunca vira tarefa; tarefa recorrente não tem ofensiva.

### Registro, desfazer e retroativo

- Resposta visual imediata, com gravação local obrigatória; falha retira sucesso/check/XP e informa **não salvo**.
- Duplo toque/dois aparelhos marcando mesmo hábito/dia: um cumprimento/prêmio.
- Desmarcar reverte cumprimento/XP e preserva histórico. Remarcar restaura prêmio original, sem ganho novo.
- Desfazer prevalece sobre marcação do outro aparelho que ainda não incorporou a correção. Nova marcação depois de incorporar desfazer pode restabelecer. Mostrar resultado reconciliado sem culpa.
- Quantitativo: 0,5 L no iPhone + 0,7 L no Android = 1,2 L; retry não duplica. Desfazer 0,5 retira só essa contribuição.
- Meta 2 L: quatro registros de 0,5 dão 10 XP apenas no quarto; 3 L não dão prêmio extra.
- Quota semanal cumprida aceita extras sem XP adicional; ofensiva conta semanas.
- Retroativo: criar nos sete dias lógicos anteriores, nunca futuro/nem antes do início do hábito. Fora da janela, bloquear com explicação.
- Registro legítimo offline não expira por passar sete dias na fila; janela limita criar uma nova correção.
- Retroativo usa regra da data escolhida, pode restaurar série e conta XP naquele dia.

### Edição e histórico

Título/ícone/cor/lembrete não reescrevem histórico. Mudança de **agenda/meta de hábito existente** tem vigência:

| Alteração | Antes de aceite remoto / offline | Depois de aceita |
|---|---|---|
| Meta quantitativa diária | Proposta preservada, meta atual vigente | Próximo dia lógico |
| Agenda sem transição para/de N vezes por semana | Agenda atual vigente | Próximo dia lógico |
| Entrar/sair/mudar N vezes por semana | Quota atual vigente | Próxima segunda-feira lógica |

Exceção semanal vale para agenda, não meta diária. Mostrar regra ativa/proposta, “aguardando conexão”, depois data efetiva. Não garantir previsão offline. Proposta segunda aceita quinta não muda terça/quarta retroativamente.

Hoje/passado mantêm regra original, mesmo ao corrigir meta digitada errada. Após primeiro registro, **tipo/unidade fixos**: arquivar/criar outro para mudar. Antes de histórico, correção permitida com validação. Sem conversão automática de unidade.

Arquivar remove do Briefing/cancela lembretes/preserva histórico e série congelada. Reativar começa nova série, preserva recorde. Excluir exige confirmação/perda do histórico; XP concedido permanece. Fora do M1.

Histórico: heatmap de 12 meses, estados cumprido/parcial/não cumprido/folga/protegido distinguíveis, taxa sobre **dias devidos**, série atual/recorde. Ofensivas desligadas removem sua representação, não o restante útil.

### Negativo e viagem

Sem recaída, série negativa avança na virada lógica. Não dá 10 XP diários nem registro global automático. “Resisti hoje” é registro explícito; recaída interrompe série sem julgamento/subtrair XP ganho. Proteção não apaga recaída. Bônus de marcos continuam separados.

Mudança de fuso detectada no retorno ao app pergunta se atualiza perfil. Vale para futuro; datas gravadas não se deslocam nem inflam/quebram séries.

## 8. Tarefas — Fase 1 completa

### Entrada e gestão

Criação rápida exige só título, padrão “Sem data”, até dois toques desde Briefing, offline. Detalhe: título, notas, status, prioridade, prazo opcional com hora, tags, recorrência, subtarefas. Título até 500 caracteres com indicação do limite.

Grupos: **Atrasadas, Hoje, Amanhã, Próximos 7 dias, Sem data**. Atrasadas primeiro, destaque neutro. Ordenação por prioridade/horário/ordem manual persistida. Concluídas em aba separada, últimos 30 dias.

Prazo sem hora é data civil no fuso do perfil, preservada em viagem: atraso meia-noite, lembrete 09h locais. Prazo com hora é instante fixo, exibido no fuso do perfil, lembrete no horário. Prazo passado permitido/já atrasado. XP da conclusão independe do prazo.

- Conclusão inline; desfazer pelas regras abaixo.
- Sair com edição não salva pede confirmação.
- Excluir confirma, com desfazer por cinco segundos.
- Subtarefas: um nível, sem prazo/XP, progresso 2/5. Concluir pai com filhas abertas confirma concluir todas.
- Tags: criar, renomear, colorir, filtrar individualmente. Excluir tag só retira vínculos.
- Busca local título/notas, sem diferença de acentos: “reuniao” encontra “reunião”; meta até 200 ms para 5.000 tarefas. Sem resultado difere de lista vazia.
- Título “comprar tinta =3*89,90” mostra cálculo 269,70 preservando original. Operações básicas/parênteses; expressão inválida mantém texto, sem erro de criação.
- Datas naturais no título não são interpretadas automaticamente; isso pertence ao assistente.
- Mais de 20 atrasadas permite oferecer reagendar em lote para hoje, sem executar sozinho.

### Recorrência e desfazer

Recorrência diária/semanal/mensal, intervalos, dias, limite por quantidade/data conforme spec. Rótulos humanos, sem expressão técnica exposta.

No máximo uma ocorrência aberta por série. Próxima nasce ao concluir atual, baseada na posição **planejada** anterior, não na data real de conclusão. Posições passadas são puladas; não gerar pilha atrasada. Limite por quantidade conta posições puladas. Dia 31 em mês curto usa último dia. Subtarefas voltam abertas.

Editar: “Só esta” / “Esta e as próximas”. Excluir série explica alcance e preserva histórico concluído.

Desfazer pode remover próxima e reabrir anterior **se próxima não teve intervenção do usuário**. Se editada/concluída, impedir e explicar preservação do trabalho. Sync/lembrete automáticos não contam. Intervenção descoberta no outro aparelho durante reconciliação gera recusa recuperável, sem falso aceite.

XP nenhuma/baixa 5, média 8, alta 12. Desfazer até 24h reverte; depois, XP fica. Refazer não concede de novo; reversão anterior permite restaurar prêmio original.

Vazios: sem tarefas CTA; todas concluídas encerramento positivo; busca vazia mudar consulta. Sem Kanban/Gantt/dependências/anexos/comentários/atribuição.

## 9. Agenda — Fase 1 completa

Só Google Calendar. Conexão opcional, leitura primeiro; escrita em consentimento separado ao ativar/usar criação. Recusar/cancelar preserva demais módulos.

Listar calendários para seleção. **Primário como único padrão marcado é proposta pendente de Q8**; aniversários/feriados/assinaturas públicas desmarcados. Ajuste claro da seleção.

Lista contínua por dia, 30 dias atrás, rolagem à frente; sem grade mensal. Consulta/carga têm janela técnica limitada, não todos os eventos futuros pré-carregados.

- Dia inteiro em faixa no topo; multidiário nos dias atravessados.
- Fuso atual do **dispositivo**; fuso de origem quando diferente. Distinto do perfil para hábitos/tarefas.
- Convite não respondido provisório; cancelado fora do Briefing e riscado na Agenda por 24h.
- Sem fim: duração estimada de uma hora, identificada.
- Exceção recorrente/evento movido não duplicam.
- Sem calendário selecionado, esconder card sem erro.
- Offline: cache com atualização indicada, criação pendente.
- Acesso revogado: desconectado, card oculto, aviso não bloqueante para reconectar.

Criar pelo assistente **sempre confirma**, com título/data/início/fim/fuso/local disponíveis e destino relevante. Salvar local pendente; confirmado Google só após sucesso remoto. Falha mantém evento/motivo/tentar; permissão insuficiente pede autorização.

Nova carga não perde eventos locais pendentes. Evento não gera XP nem vira tarefa; tarefa a partir dele só com pedido explícito. Fora: editar evento, convidados, salas, vídeo, Outlook, Apple Calendar, Notion.

Fase 2A: mediação sugere para choques, deslocamento inviável, excesso de compromissos/conflito com hábito. **Nunca reagenda sozinha.** Até um aviso/dia no Briefing matinal. Limiar de sobrecarga/cálculo de trajeto pendentes.

## 10. Gamificação — XP no M1, restante na Fase 1

XP confirma registro, não é moeda/prêmio financeiro/comparação social. Resultado local pode ajustar-se após reconciliação; não celebrar reenvio.

| Evento | XP |
|---|---|
| Binário / resistência explícita em negativo | 10, uma vez por hábito/dia |
| Quantitativo alcança meta | 10, uma vez |
| Tarefa nenhuma/baixa; média; alta | 5; 8; 12 |
| Marco de ofensiva 7 / 30 / 100 / 365 | 50 / 200 / 500 / 2.000 |
| Conquista | Conforme catálogo ainda a fechar |
| Subtarefa, evento, notícia, jogo | Nenhum |

Teto diário de hábitos: maior entre 150 e 15 vezes hábitos ativos devidos naquele dia; tarefas: 150. Teto não impede registro, apenas novo XP, com aviso discreto. Desfazer não devolve orçamento. Refazer restaura prêmio original/no mesmo dia/sem consumo novo. Ação originalmente sem XP não ganha por refazer.

Tarefa criada/concluída em menos de dez segundos ganha XP normal, consome dobro no teto. Retroativo conta no teto do dia corrigido. Total nunca negativo; correção não apaga histórico. Excluir hábito preserva XP concedido.

Nível derivado do XP válido; curva `100 × n^1,5`, arredondada em múltiplos de dez. Mostrar atual/progresso/próximo com dados coerentes. Celebração até 1,5 s, dispensável com um toque, nunca bloqueante; eventos em sequência, não modais empilhados.

### Ofensivas e proteções

- Por hábito: só dias devidos; N vezes/semana conta semanas. Folga não quebra.
- Global: ao menos um registro explícito de hábito/tarefa por dia lógico. Avanço automático negativo não conta.
- Proteção automática: **dois dias lógicos por conta/mês civil**, sem acumular. Uma unidade protege várias séries diárias/global no mesmo dia.
- Protegido mantém contagem, não incrementa/não cumpre/não dá XP.
- Não protege quota semanal/recaída explícita.
- Informar depois: “Usamos uma proteção ontem”. Sem comprar/ativar/escolher proteção.
- Correção de todas as ausências dependentes devolve unidade ao mês original; parcial não devolve se outra depende. Sem transferir saldo para mês atual.
- Configuração visível retira **toda UI de ofensivas**, mantendo XP/conquistas. Reativar deriva do histórico.
- Conquista funciona offline; desbloqueada não é revogada ao desfazer. Atualização pode reconhecer histórico anterior.

Sem culpa, dias perdidos no retorno, punição/XP retirado por ausência ou estética de aposta. Alerta de série até uma vez/dia, desligável; silêncio de gamificação 22h–07h por padrão. XP futuro de saúde reconhece registro, nunca peso/déficit/restrição.

## 11. Assistente por texto e voz — Fase 1 completa

Entrada persistente, como FAB, para comandos curtos. Não é terapeuta, chat longo, planejador autônomo, escuta permanente ou wake word.

### Jornada

1. Contextualizar/obter consentimento de IA se ausente; voz também pede microfone.
2. Gravar segurando controle, medidor de áudio, máximo 30 s, só primeiro plano; alternativa digitada.
3. Mostrar transcrição editável antes de aplicar intenção.
4. Ambiguidade pede esclarecimento, não adivinha entidade.
5. Confirmar quando exigido; caso contrário, retorno claro da ação.
6. Desfazer por dez segundos; restrições de domínio continuam, como próxima ocorrência já editada.

Voz pode ser simulada, identificada como simulação, sem afirmar STT real/offline. Meta final de registro até seis segundos no p75; evitar série desnecessária de telas.

### Capacidades e confirmação

Criar/concluir/atualizar tarefa; registrar/criar hábito; consultar dados; criar evento; excluir entidade. Sem comandos financeiros/de saúde atuais inventados.

| Situação | Comportamento |
|---|---|
| Tarefa simples ou registro de hábito sem ambiguidade | Aplicar após interpretação, salvo demais condições |
| Criar hábito/entidade recorrente | Sempre confirmar |
| Excluir entidade | Sempre confirmar |
| Criar evento | Sempre confirmar |
| Mais de três ações ou data distante mais de sete dias | Confirmar |
| Várias intenções | Lista ordenada e uma confirmação do conjunto; se uma exige, todas exigem |
| Falha parcial | Mostrar 2/3, motivo; repetir só falha |
| “Academia” ambígua | Apresentar escolhas |
| Módulo indisponível | Explicar limite/alternativa pertinente, como tarefa |
| Futuras alterações financeiras/de saúde | Sempre confirmar |

“amanhã às 3”: spec interpreta 15h em pt-BR; mostrar **15:00** explícito/editável, não esconder suposição. “Dois litros” deve aparecer corretamente como quantidade.

### Falhas e alternativas

- IA recusada: navegação/funções manuais, sem envio à IA.
- Microfone negado/silêncio/ruído: texto/contexto preservado; sem culpa.
- Offline: tarefa simples por título pode usar interpretação local limitada; demais ações por formulários. Sem promessa de voz offline.
- Serviço indisponível/mais de oito segundos: cancelar/seguir manualmente.
- Resposta inválida: após uma tentativa interna de reparo e segunda falha, alternativa manual, sem executar dado não validado. Ação desconhecida é recusada, sem alterar dados.
- Quota 50 pedidos/dia + dez minutos STT/dia: explicar limite/manual; não bloquear hábitos/tarefas.
- Retry não duplica ações nem repete sucessos.
- Consulta em pt-BR mesmo com entrada em inglês.

Uso/custo de IA consultável conforme spec. Histórico de ações permite identificar resultado e reversão posterior, respeitando regras de cada módulo. Pedido “apaga tudo” não autoriza exclusão em massa pelo assistente no v1.

Consentimento explica minimização: contexto da tela/data/fuso, hábitos ativos e tarefas relevantes; sem histórico integral, notas, e-mail ou nome enviados como contexto. Não expor tools/JSON/detalhes do provedor no produto.

## 12. Notificações e permissões

Fase 1: locais para hábitos/tarefas/Briefing. Remotas com esportes na 2A. Permissão após explicar valor; recusa não bloqueia, aviso uma única vez e configurações depois.

- Cumprido não recebe lembrete; arquivar/excluir/mudar horário replanejam.
- Tarefa com hora lembra no horário; sem hora às 09h do prazo.
- **64 locais pendentes**, 40 hábitos/24 tarefas. Priorizar hoje/amanhã/proximidade; mesmo dia prioriza hábito com série ativa.
- Agrupar se necessário, “3 hábitos pendentes hoje”; replanejar na abertura/retorno.
- Ação “Marcar como feito” **condicionada à validação no iOS físico**. Se background não confiável, abre app/aplica sem outra confirmação.
- Preferências/tipos/silêncio/desligar claros. Silêncio de gamificação distinto de partidas.

Não prometer todos os lembretes de meses futuros já agendados. Rateio do Briefing/alerta de ofensiva nas 64 vagas pendente; preferências podem ser desenhadas sem afirmar entrega garantida.

## 13. Offline, sincronização e recuperação — desde o M1

Normal: salvar no aparelho; rede não é necessária para criar hábito/marcar. Fechar/reabrir preserva. Volta à conexão/primeiro plano retoma sync automática.

Resumo de estado e superfície de “alterações que precisam de atenção” são propostas de apresentação; preservação/recuperação são requisitos.

| Estado | Entendimento | Recuperação |
|---|---|---|
| Salvo local/offline | Está no aparelho, envio pendente | Continuar; sincroniza depois |
| Sincronizando | Envios em processamento | Progresso discreto, sem bloquear registro |
| Confirmado | Aceito/reconciliado | Sem outra confirmação |
| Falha transitória | Preservado, tentativa posterior | Automático; depois retry apropriado |
| Resultado desconhecido | Sem confirmação suficiente de aceite/recusa | Reconciliar/repetir original, não corrigir duplicando |
| Recusa definitiva | Precisa atenção, não confirmado | Motivo/conteúdo/corrigir ou descartar quando permitido |
| Dependência recusada | Outra alteração necessária falhou | Relação visível, preservar filhas |
| Sessão exige login | Local mantido, sync suspensa | Autenticar online |
| Primeiro acesso em outro aparelho | Carregando dados da conta | Progresso retomável, sem falso vazio definitivo |
| Atualização obrigatória | Só leitura local | Atualizar; fila/histórico/logout mantidos |

Retry espaçado até cinco minutos; após dez tentativas, falha/retry manual. Espera exigida pelo servidor não é contornada pelo botão. Não é necessário mostrar contador ou HTTP.

Recuperação não é reset geral. Corrigir recusa preserva conteúdo/cria intenção nova válida. Descartar pai não apaga filhas automaticamente: explicar impacto/tratar cadeia, sem fingir aceite.

Resultado incerto não é recusa definitiva. Resposta perdida precisa de reconciliação, sem duplicar operação talvez aceita.

Pendências não expiram: duas semanas offline/muitas operações exigem preservação/progresso. Sem promessa de sync contínua em background; retorna no primeiro plano/conexão.

Conflitos automáticos conforme regras: campos diferentes combinam; mesmo campo usa aceitação do servidor, não relógio; exclusão prevalece sobre edição. Não pedir escolher versões em todo conflito. Ajuste visível reconciliado pode gerar aviso discreto.

### Falhas locais e compatibilidade

- Sem espaço/falha de escrita: **não salvo**, retirar check/XP otimista, manter entrada quando possível e tentar após resolver.
- Base não abre/migração/formato incompatível: proteger recuperação sem apagar, reinstalar ou prometer exportar o que não pode ler. Reparo operacional precisa de contrato.
- Data/relógio incompatível: verificar data/fuso, preservar recusa, sem mudar dia silenciosamente.
- Limite de contexto: preservar, explicar recuperação/suporte; sem falso sync ou divisão automática inventada.
- Efeito essencial incompatível: **leitura local**; desabilitar criar/editar/marcar/corrigir/descartar/sync. Consulta e logout ficam. Restart/retry mesma versão não libera.
- Atualização instalada offline continua protegida até confirmação de compatibilidade online; número de build sozinho não libera.

Não expor SQL/tabelas/tokens/IDs/hash/pilha técnica na UI. Traduzir causa/próxima ação sem perder “não salvo”, “salvo aqui”, “confirmado”.

## 14. Matriz transversal de estados e mensagens

**Microcopy proposta**, para Pedro revisar; comportamentos vêm dos requisitos.

| Situação | Texto / feedback sugerido | Cuidados |
|---|---|---|
| Carregamento | Skeleton da tela | Sem branco/spinner bloqueante prolongado |
| Sem hábito | “Seu primeiro hábito pode começar hoje.” | CTA e continuar |
| Dia sem devidos | “Hoje é um dia de folga para seus hábitos.” | Distinto de nenhuma configuração |
| Salvo offline | “Salvo neste aparelho. Vamos sincronizar quando a conexão voltar.” | Sem aparência destrutiva |
| Falha local | “Não foi possível salvar neste aparelho. Tente novamente.” | Retirar sucesso, manter entrada |
| Regra aguardando | “Alteração salva aqui, aguardando conexão. A regra atual continua valendo.” | Ativa/proposta visíveis |
| Recusa | “Esta alteração precisa da sua atenção.” | Motivo e recuperação contextual |
| Incerto | “Ainda não conseguimos confirmar o envio.” | Reconciliar, não falsa recusa |
| Reautenticar | “Entre novamente para sincronizar. Seus registros neste aparelho foram preservados.” | Distinto de logout |
| Duplicado | “Já existe um hábito ativo com este nome.” | Junto ao campo |
| Teto XP | “Meta de XP do dia atingida.” | Registro continua |
| Série interrompida | “A série foi interrompida. Você pode recomeçar.” | Sem ameaça/XP perdido |
| Proteção | “Usamos uma proteção ontem.” | Não é cumprimento |
| Permissão negada | “Você pode continuar sem lembretes e ativá-los depois.” | Não repetir pop-up |
| IA falhou | “Não foi possível usar o assistente agora. Você pode registrar manualmente.” | Formulários disponíveis |
| Evento falhou | “Este evento ainda não foi confirmado no Google Calendar.” | Motivo/tentar/reconectar |
| Desfazer recorrente bloqueado | “A próxima ocorrência já foi alterada. Este desfazer não pode ser aplicado.” | Preservar trabalho |
| Atualização | “Atualize o Ritmo para voltar a registrar. Seus dados continuam disponíveis para consulta.” | Persistente, escrita desabilitada |
| Sem notícias | “Nada relevante por aqui agora.” | Revisar temas, sem filler |
| Placar antigo | “Última atualização às 21:18. Não foi possível atualizar agora.” | Não rotular como atualizado |

Cada tela cobre estados aplicáveis: normal/pressionado/desabilitado/carregando/vazio contextual/erro/offline/pendente/recusa/sucesso. Preservar foco/posição; informação não só por cor nem aviso ilegível por desaparecer rápido.

## 15. Notícias — Fase 2A, conjunto separado

Valor de consumo, sem XP/feed infinito/comentários/rede social/push de breaking news. Título/fonte/data/imagem quando disponível/resumo/link externo; nunca artigo integral.

### Temas e fontes

Temas/subtemas em dois níveis, seleção expansível; pai seleciona filhos; interesse normal ou prioritário. Ativar exige um tema; pular mantém inativo/card oculto.

Taxonomia sugerida, ajustável: tecnologia (IA, desenvolvimento, segurança, hardware, startups), negócios (economia, mercado, carreira), esportes, ciência/saúde pública, regional (Amapá, Norte, Brasil), cultura (cinema, música, livros). Não apresentar como escolhas já feitas por Pedro.

Fontes separadas dos temas: catálogo verificado/URLs próprias; sem matriz manual fonte × assunto. Até 50 fontes; domínio repetido avisa.

Adicionar: URL HTTPS → validar/descobrir feed → prévia nome/idioma/três títulos recentes → confirmar. Estados verificando/sem feed/falha transitória/URL insegura. Endereço privado, credenciais embutidas, porta não permitida, redirecionamento inseguro/TLS inválido não permitem “aceitar mesmo assim”. Domínio parecido tem tratamento distinto quando a confirmação for permitida.

Gestão: origem, última coleta válida, volume sete dias; pausar/remover/reverificar. Inativa 14 dias é sinalizada, não excluída automaticamente. Revalidação de segurança malsucedida pausa com motivo.

### Conteúdo e falhas

- Três a cinco matérias relevantes não vistas; aberta não reaparece como novidade.
- História em vários veículos: “Também em…”, sem tratar contagem como certificado de verdade.
- Até dois itens/fonte em cinco; até três/subtema. Prioritário garante vaga, mas conflitos de vários prioritários/capacidade pendentes.
- Três bullets de até 20 palavras, somente sobre conteúdo disponível. Sem conteúdo, título/fonte, sem inventar fatos.
- Original estrangeiro pode receber resumo pt-BR, com idioma indicado. Data ausente estimada/identificada. Link externo, sem promessa de detectar/desbloquear paywall.
- “Não me interessa” personaliza de forma limitada (variação de até 20%), com configuração/reset. Sem métricas de engajamento inventadas.
- Sem novidade, estado calmo. Após três dias ausente, últimas 24h, sem backlog.
- Ordem estável; refresh deliberado compreensível. Divergência de duas/três horas na seção 19.
- Fonte falha não bloqueia saudáveis. Cache com atualização; offline sem cache explica ausência.

## 16. Esportes — Fase 2A, conjunto separado

Futebol dos favoritos. Escolher nome/escudo/competição para homônimos. Dois/três times é cenário inicial, não limite aprovado. Pular deixa inativo.

Próximos jogos, hoje, detalhe ao vivo/linha de eventos, resultado, tabelas, alertas. Briefing com jogo relevante/resultado até 12h após fim; prioridade de ao vivo precisa respeitar regra manual da home.

- Horários no fuso do dispositivo; nome/escudo, não só cor.
- Alertas por tipo: início, gol, vermelho, intervalo, fim, escalação, lembrete uma hora antes.
- Meta até 60 s **após publicação do provedor**, não lance no estádio. Sem promessa de transmissão em tempo real/cinco segundos.
- Dois favoritos na mesma partida: um alerta por lance. VAR corrige placar e alerta quando gol foi notificado.
- “Estou assistindo” silencia gols daquela partida e mantém resumo final; não presumir desligamento de todos os alertas.
- Esportes podem alertar à noite por padrão, configurável, distinto de gamificação.
- Adiado/suspenso/abandonado próprios. Prorrogação/pênaltis distintos; agregado só se fornecido.
- Provedor falhou: último dado identificado antigo/indisponível, sem inventar placar/ao vivo.
- Sem jogo/off-season: ocultar card quando apropriado, sem erro/cobrança.
- Push recusado mantém consulta manual. Provedor/cobertura ainda pendentes.

Sem apostas/fantasy/vídeo/todos os esportes/estatística avançada/transferências.

## 17. Visão futura — hipóteses sem contratos fechados

Explica modularidade, não aumenta núcleo nem cria formulários finais. Exploração separada: “Hipótese futura”.

| Capacidade | Intenção documentada | Falta definir |
|---|---|---|
| Treinos — 2B | Rotina/checklist/sessão | Exercícios/licença, kg/lb, força/cardio, descanso, supersets/RIR, rascunho |
| Finanças — 2B após treinos | Visão com Open Finance/agregador | Provedor, contas/cartões, faturas, transferências, parcelas, estornos, competência/caixa |
| Busca global — 2B | Encontrar conteúdo ativo | Pelo menos quatro módulos/volume real; diferente de agir com IA |
| Refeições — 3 | Alimentação/possíveis receitas/compras | Base/licença, medidas, porções |
| Leitura — 3 | Progresso em formatos diferentes | Páginas, posições digitais, áudio, ISBN |
| OCR/QR/importação — 3 | Facilitar entrada, recibos depois de finanças | Fontes, correção, privacidade, qualidade |
| Wearables / processamento no aparelho — 3 | Capacidades quando necessidade real | Consentimento/técnica/revisão de saúde |
| Comercialização | Posterior ao uso pessoal | Preço/billing/licenças/custos/lançamento |

Finanças depende de agregador escolhido, não entrada manual pura. Sem pagamentos/transferências bancárias/crédito inventados. IA financeira/saúde sempre confirma. XP reconhece registro, não peso/déficit/restrição.

## 18. Direção visual, componentes e acessibilidade

**Aberta para proposta/aprovação de Pedro.** Claude pode propor/justificar direção e tokens/componentes; não dizer paleta/fonte aprovadas. Q28 fecha só após revisão do protótipo/incorporação ao contrato visual.

Responder: tipografia, densidade, destaque único/por módulo, cards por borda/sombra/espaço, ilustrações de vazios e celebrações. Evitar decoração que atrapalha registro; funcionar com pouco/muito conteúdo e claro/escuro.

Base: Card, ListItem, Checkbox, Button primário/secundário/fantasma, Chip, Input, Sheet, Skeleton, EmptyState, ErrorState, Toast, ProgressBar, StreakBadge quando disponível. Variantes/estados compartilhados, sem improvisar cada erro.

Tokens propostos: fundos base/elevado/rebaixado; texto principal/secundário/suave/inverso; destaque/variantes; sucesso/aviso/erro/informação; bordas; espaço; raio; tipo; sombras; movimento. Escalas base existentes: espaços 0/4/8/12/16/24/32/48/64, fontes 12/14/16/20/24/32/40, durações 120/200/320 ms. Cores/famílias/raios/ajustes estruturais dependem do protótipo.

Obrigatórios:

- Claro/escuro, mesmos componentes/tokens semânticos.
- Texto com contraste ao menos 4,5:1 nos fundos usados em ambos os temas.
- Toque mínimo 44 pt; controles de ícone com nomes acessíveis.
- Fonte ampliada até 200%, sem cortar campos/botões/informação essencial.
- Texto/ícone além de cor; alternativa legível para heatmap/placar/pendente.
- Ordem/papéis/nomes/anúncios compatíveis VoiceOver/TalkBack; erro/foco junto ao campo.
- Teclado/área segura não cobrem ação; textos longos/plurais pt-BR preservados.
- Transições explicativas até 320 ms; celebração até 1,5 s, dispensável/não bloqueante.
- Redução de movimento: instantâneo/celebração estática; não depender de gesto/animação para entender.
- FAB, quando existir, não cobre último item/ação importante.

Não mostrar stack/banco/código na experiência. Handoff documenta tokens/hierarquia/estados/interações para implementação consistente.

## 19. Lacunas a manter explícitas

Não impedem briefing/exploração. Impedem afirmar que regra ausente está fechada. Separar requisito de proposta; anotar pergunta no cenário afetado.

| Pendência | Consequência para design |
|---|---|
| Q28 e nome definitivo | Paleta, fonte, densidade, navegação/nome de trabalho para Pedro revisar |
| STT/capacidade offline | Simular voz e indicar condição, sem prometer integração |
| Notificação rápida iOS | Variante abre app; background depende de spike física |
| Q8, calendários padrão | Primário pode ser explorado como proposta |
| Briefing/ofensiva nas 64 notificações | Não inventar vagas além das 40/24 previstas |
| Notícias: estabilidade 3h no Briefing/recálculo 2h em Notícias | Desenhar estabilidade/refresh; não decidir janela única |
| Temas prioritários/distribuição de cinco notícias | Vagas/diversidade precisam de política de conflito |
| Assistente: cabeçalho sete tools/tabela oito | Usar tabela de capacidades; sem menu fixo “sete ações” |
| XP restante menor que prêmio | Política de prêmio parcial pendente; não pressupor solução |
| Fuso/início do dia com regra já agendada | Contrato temporal antes de implementar esse caso |
| Tipo/unidade sem histórico vs primeiro registro em outro aparelho | Sem conversão silenciosa; recuperação exige contrato |
| Exportação periódica/exportação/exclusão/reparo da base | Estados operacionais a detalhar; sem promessa de disponibilidade atual |
| Mediação: sobrecarga/trajeto | Sem limiar/provedor inventado; cenário condicionado |
| Fontes/taxonomia/provedor esportivo/conquistas | Exemplos não são escolhas aprovadas |
| Fases 2B/3 | Hipóteses, sem campos/regras bancárias/saúde finais |

Não corrigir fontes canônicas por conveniência do protótipo. Requisito novo exige registro/aprovação; composição visual pode ser proposta sem bloquear esta documentação.

## 20. Jornadas de revisão do protótipo

Critérios de **design**, com dados simulados; não substituem testes reais de armazenamento/API/permissões/sync em dois aparelhos.

| ID | Jornada / resultado | Escopo |
|---|---|---|
| D01 | Cadastro → fuso/04h → pular hábito → Briefing útil/CTA | M1 |
| D02 | Interromper/retomar onboarding; criar Meditar e aparecer na home | M1 |
| D03 | Offline criar/marcar → salvo local; simular reabertura com estado preservado | M1 |
| D04 | Duplo toque um cumprimento/10 XP; desfazer 0; remarcar mesmos 10 | M1 |
| D05 | Rede volta → confirmado/convergente; sem celebrar retry | M1 |
| D06 | Falha local sem check/XP confirmado; entrada/retry | M1 |
| D07 | Título duplicado recusado → motivo/corrigir/descartar, sem perda | M1 |
| D08 | Logout offline encerra acesso; B isolada; A exige login online | M1 |
| D09 | Recuperação: pedido/link expirado/usado/novo/sucesso/login | M1 |
| D10 | Expiração remota offline mantém local; autenticar ao reconectar | M1 |
| D11 | Carga em novo aparelho retomável; falha não vira vazio definitivo | M1 |
| D12 | Atualização exige leitura; novo build offline continua protegido | M1 |
| D13 | 00:30 sexta: tarefa quinta atrasada, hábito pertence à quinta | Fase 1 |
| D14 | Água 0,5 + 0,7 = 1,2 L; desfazer 0,5 mantém 0,7 | Fase 1 |
| D15 | Meta offline proposta/regra antiga; aceite quinta → próxima virada | Fase 1 |
| D16 | Quota semanal aceita quinta → próxima segunda lógica | Fase 1 |
| D17 | Retroativo permitido/restaurar série; futuro bloqueado | Fase 1 |
| D18 | Negativo: resistência/recaída neutra/ausência sem XP automático | Fase 1 |
| D19 | Proteção conjunta; correção parcial mantém/completa devolve mês original | Fase 1 |
| D20 | Desligar séries tira toda sua UI, mantém XP/conquistas | Fase 1 |
| D21 | Tarefa/subtarefas/confirmação; próxima recorrente editada impede desfazer | Fase 1 |
| D22 | Calendar recusado/revogado; evento local/pendente/falho no Google | Fase 1 |
| D23 | Voz simulada/transcrição/ambiguidade/confirmação devida | Fase 1 |
| D24 | Três ações, uma falha → 2/3/retry só falha; IA offline/quota → manual | Fase 1 |
| D25 | Recusar microfone/notificações/IA/analytics separadamente e continuar | Fase 1 |
| D26 | Exportar JSON/excluir digitando confirmação, estados a detalhar | Fase 1 |
| D27 | Notícia tema/fonte/prévia/URL insegura/sem novidade/link original | Fase 2A |
| D28 | Gol/VAR/Estou assistindo/adiado/provedor desatualizado | Fase 2A |
| D29 | Claro/escuro/texto 200%/conteúdo longo/redução de movimento/leitor de tela | Todos |

Dados fictícios: Pedro, Meditar/Ler/Beber água, Revisar proposta/Comprar tinta, Reunião de projeto. Água/leitura como hábitos não ativam módulos futuros. Notícias/jogos identificados demonstrativos, sem fatos atuais/resultados/fontes aprovadas inventadas.

## 21. Entrega esperada do Claude Design

1. **M1 navegável:** entrada/onboarding/Briefing/hábito/sessão/sync, estados críticos, ida/retorno/recuperação.
2. **Extensão Fase 1 separada:** fluxos documentados, crescimento sem redesenhar home.
3. **Fase 2A separada:** exploração identificada. 2B/3 podem ficar como visão anotada, sem telas finais.
4. **Biblioteca/tokens propostos:** claro/escuro, variantes, acessibilidade/movimento.
5. **Mapa e cobertura D01–D29:** representado/anotado/pendente, com localização. Limite da ferramenta vira estado/anotação, não falsa integração.
6. **Handoff por tela:** objetivo, entradas, ações, destino, validação, vazio, erro, efeito visual, restrição de fase.
7. **Decisões para Pedro:** propostas visuais/lacunas, sem dizer resolvidas.

Começar M1/estados transversais; depois expandir. Não reduzir a uma home bonita. Revisão pronta quando pular/negar/falhar/voltar/offline também forem legíveis.

## 22. Fontes e rastreabilidade

Referências para o time; o documento externo não depende de abri-las. Divergência na implementação exige conferir contrato atual, não usar hipótese de design como nova regra.

| Área | Fonte |
|---|---|
| Produto/fases/vocabulário | [PRD](../../PRD.md), [CONTEXT](../../CONTEXT.md) |
| Convenções | [CLAUDE.md](../../CLAUDE.md) |
| Conta/onboarding | [spec 01](../../specs/01-conta-e-onboarding.md) |
| Hábitos | [spec 02](../../specs/02-habitos.md) |
| Tarefas | [spec 03](../../specs/03-tarefas.md) |
| Gamificação | [spec 04](../../specs/04-gamificacao.md) |
| Assistente | [spec 05](../../specs/05-assistente-ia.md) |
| Offline/sync | [spec 06](../../specs/06-sincronizacao.md), [contrato M1](../../specs/13-contrato-primeiro-marco.md) |
| Desempenho/privacidade/acessibilidade | [spec 07](../../specs/07-nao-funcionais-e-lgpd.md) |
| Briefing | [spec 08](../../specs/08-briefing.md) |
| Notícias | [spec 09](../../specs/09-noticias.md) |
| Esportes | [spec 10](../../specs/10-esportes.md) |
| Visual aberto | [spec 11](../../specs/11-design-system.md), [tarefa do protótipo](../../.scratch/primeiro-marco/issues/03-integrar-prototipo.md) |
| Agenda | [spec 12](../../specs/12-agenda.md) |
| Hipóteses | [spec 98](../../specs/98-fase-3-notas.md) |
| Decisões da fundação | [entrevista Q1–Q29](../../.scratch/fundacao/entrevista.md) |
| Autoridade/reconciliação | [ADR-015](../adr/0015-autoridade-na-reconciliacao.md), [ADR-017](../adr/0017-reconciliacao-de-registros-e-correcoes.md) |
| Logout | [ADR-016](../adr/0016-preservar-pendencias-no-logout.md) |
| Vigência de hábitos | [ADR-018](../adr/0018-vigencia-das-regras-de-habitos.md) |
| Formato/limites M1 | [contratos](../../contracts/primeiro-marco/README.md) |
| Evidência técnica sem aceite visual | [relatório Android HTTP](../analises/2026-09-30-http-nativo-android.md) |

Pronto para copiar: [prompt do Claude Design](prompt-claude-design.md).
