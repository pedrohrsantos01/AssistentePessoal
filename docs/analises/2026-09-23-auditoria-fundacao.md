# Ritmo — auditoria da documentação e da fundação

Data: 23/09/2026. Base analisada: pacote de especificação v3.0, de 14/09/2026.

Status deste relatório: diagnóstico e recomendações para discussão. Não substitui requisitos aprovados nem resolve silenciosamente decisões de produto.

## 1. Parecer

**A visão de produto está bem desenvolvida; a especificação ainda não está suficientemente consistente para executar o plano inteiro sem inventar comportamentos.** É possível avançar com decisões, provas técnicas e preparação mínima. Não recomendo iniciar as migrations completas nem distribuir as fatias atuais como tarefas fechadas.

O problema predominante não é falta de texto. É a distância entre requisitos detalhados, modelo de dados, contratos entre módulos e ordem de execução. Algumas regras individualmente razoáveis produzem perda de dados ou resultados diferentes quando combinadas.

O PRD se declara aprovado para implementação, mas há oito grupos de bloqueios estruturais, detalhados abaixo. “Bloqueio” significa que a decisão precisa estar fechada antes da implementação que depende dela; não significa paralisar todo o projeto.

### Escopo e método

- Leitura dos 14 arquivos em `specs/`, além de `README.md`, `PRD.md`, `PLANO-DE-EXECUCAO.md`, `CLAUDE.md` e `TERMBAKER.md`.
- Cruzamento de regras, schema, critérios de aceite, fases, dependências, cenários offline e retomada de falha.
- Busca estrutural por definições de requisitos, duplicidades, decisões pendentes e referências antigas.
- Verificação pontual em documentação primária de Google Calendar, Expo, PostgreSQL e RFC 5545; pesquisa separada das referências de Karpathy e Matt Pocock.
- Não há `/app`, `/api`, manifests de dependências, migrations, testes ou CI neste diretório. `git status` informa que ele não é um repositório Git. Os comandos do `CLAUDE.md` descrevem uma estrutura futura.

Portanto, **os achados são defeitos, ambiguidades ou ausências de contrato documental; não são bugs reproduzidos numa aplicação existente**. Não foi possível avaliar qualidade do código, execução, desempenho, acessibilidade real, implantação ou segurança operacional. As linhas citadas correspondem aos documentos originais nesta data.

### O que vale preservar

1. Problema e usuário inicial claros: reduzir o atrito de registro para o uso diário do Pedro.
2. Separação entre escopo atual, fases futuras e exclusões deliberadas.
3. Briefing como centro do produto, evitando duplicar a antiga tela Hoje.
4. Muitos critérios observáveis e casos de borda: fuso, toque duplo, notificações, recorrência, revogação e falhas de rede.
5. Local-first, IA propondo ações, validação de saídas e confirmação para ações de maior consequência.
6. Preocupações concretas com isolamento por usuário, restauração de backup, acessibilidade, custos e gamificação sem culpa.
7. ADRs com motivação e perguntas abertas. Não é preciso reescrever tudo nem trocar a stack para aproveitar essa base.

## 2. Prontidão por área

| Área | Avaliação | O que falta para orientar implementação |
|---|---|---|
| Problema, público e não-escopo | Boa base | Distinguir evidências de hipóteses e retirar contradições de escopo |
| Métricas de validação | Parcial | Início da janela, denominadores, instrumentação e critérios de passagem |
| ADRs e governança | Parcial | Status, responsáveis, precedência e decisões técnicas ainda implícitas |
| Modelo de dados | Bloqueado para migration completa | Separar dados locais/remotos, completar estados e invariantes |
| Conta e ciclo de sessão | Bloqueado para implementação integral | Sessões, recuperação, exclusão, logout offline e estados persistidos |
| Sincronização | Bloqueado | Protocolo, atomicidade, identidade, conflito e recuperação |
| Hábitos | Boa descrição funcional, contrato parcial | Negativos, agenda histórica, incrementos e semântica de pausa |
| Gamificação | Regras extensas, contrato parcial | Autoridade, concessão/reversão, congelamento e reconstrução |
| Tarefas | Parcial | Série recorrente, data sem hora, undo e concorrência |
| Assistente | Boa direção, contrato incompleto | Schemas reais, execução parcial, leitura, auditoria e desfazer externo |
| Agenda | Bloqueado para integração completa | Estado por calendário, janela incremental, datas e escrita idempotente |
| Briefing e design | Parcial; visual explicitamente aberto | Dependências, atualização de cards, preferências e gate visual coerente |
| Não funcionais e operação | Boa lista de intenções | Procedimentos executáveis, parâmetros, responsáveis e critérios por fatia |
| Notícias e Esportes | Suficiente para backlog futuro | Há gaps, mas não devem desviar a fundação da Fase 1 |

## 3. Bloqueios estruturais

### B01 — O plano não respeita as próprias dependências

**Evidência:** `PLANO-DE-EXECUCAO.md:36–75`, `specs/06-sincronizacao.md:3`, `CLAUDE.md:20–22,123–125`, `README.md:13–18`, `specs/11-design-system.md:11–19`.

O primeiro módulo é construído “sem sync ainda”; o spec exige sync junto dele e o Definition of Done exige sincronizar ao voltar. O Briefing precisa de tarefas na Fatia 3, mas elas só aparecem na Fatia 6. A Conta precisa de onboarding com hábitos, Agenda e Briefing antes dessas fatias. A Agenda é importada pelo backend antes de existir o caminho de pull para o SQLite.

Há ainda duas regras de sessão incompatíveis: uma fatia ponta a ponta por sessão no README e uma única camada por sessão no CLAUDE. A Fatia 0B exige tokens visuais fechados, enquanto o design system permite tokens provisórios até o Briefing.

**Consequência:** seguindo literalmente o plano, o implementador precisa criar stubs, antecipar trabalho ou declarar fatias concluídas sem cumprir seus próprios critérios. A ordem obrigatória não é executável como está escrita.

**Fechamento:** definir dependências reais; separar fundação técnica de entrega utilizável; permitir sessões menores dentro de uma mesma fatia, mantendo a aceitação ponta a ponta; trazer o sync mínimo para o primeiro comportamento persistente. O plano proposto está no documento de saneamento.

### B02 — “Mesmo schema” não define o que pode existir ou circular em cada lado

**Evidência:** `specs/00-modelo-de-dados.md:3–9,17–24,30–43,125–163`, `specs/12-agenda.md:17,61–65`, `CLAUDE.md:85–91`.

O spec promete schemas iguais, mas contém senha exclusiva de identity, credencial Google exclusiva do servidor, quotas de IA, filas exclusivamente locais, caches derivados e catálogos globais. `int[]`, `text[]`, `numeric`, `boolean` e `jsonb` também exigem representações explícitas no SQLite; UUID e timestamp não são as únicas diferenças.

“Toda tabela tem `user_id`” e “nenhuma consulta sem usuário” não explicam catálogos globais, `users`, autenticação antes de existir JWT e processos agendados. “O servidor nunca gera ID” não cobre eventos importados do Google sem cliente aberto, sessões e outros fatos originados no servidor.

**Consequência:** migrations espelhadas e sync genérico podem incluir dados que não devem ir ao aparelho, ou impedir integrações previstas. Não há vazamento observado; existe um contrato contraditório que precisa impedir essa implementação.

**Fechamento:** matriz por entidade/campo com proprietário, local de persistência, direção de sync, campos permitidos no transporte, origem de ID e retenção. Definir conversões SQLite/Postgres e constraints completas: nullability, defaults, FKs, unicidade e pertencimento ao usuário. Modelos de persistência e de transporte não precisam ser idênticos.

**Aceite:** um payload de pull não contém senha, refresh token Google, tokens de recuperação ou campos internos; entidades importadas têm identidade estável; catálogo global e dado privado têm políticas distintas e verificáveis.

### B03 — Identity exige estados que não estão modelados

**Evidência:** `specs/01-conta-e-onboarding.md:15–19,35–39,47–53`; `specs/00-modelo-de-dados.md:28–43`; `specs/07-nao-funcionais-e-lgpd.md:65,88`; `specs/06-sincronizacao.md:69`.

Há refresh rotacionado e revogável, link de senha de uso único, retomada de onboarding e eliminação agendada. O schema não especifica a persistência desses processos. Um JWT de acesso stateless não resolve a revogação nem o consumo único de credenciais auxiliares.

Também faltam decisões documentadas para e-mail normalizado/único, entregador de e-mail, deep link da recuperação, reuso de refresh antigo, refresh simultâneo no mesmo aparelho, troca de senha e revogação de outras sessões. Configuração remota, progresso de onboarding e preferências citadas em várias telas não têm representação definida.

**Fechamento:** fechar a máquina de estados e a persistência mínima de identity, incluindo segredo armazenado em forma adequada, expiração, consumo e revogação. Não criar todas as funcionalidades de uma plataforma de identidade; representar apenas os fluxos já exigidos.

**Aceite:** recuperação funciona uma única vez; refresh revogado não renova; reinício não perde o estado de uma exclusão; onboarding retoma no passo correto; cada fluxo tem contrato de erro.

### B04 — O sync ainda é uma lista de políticas, não um protocolo implementável

**Evidência:** `specs/06-sincronizacao.md:12,25–45,60–77`; `specs/00-modelo-de-dados.md:24,159–163`.

Faltam definições centrais:

- Gravação do fato e enfileiramento da mutação precisam ser atômicos. Se houver encerramento entre essas duas operações, um dado pode ficar local para sempre.
- O contrato não informa se o lote é atômico, como confirma cada mutação, quais erros são permanentes e quando pode avançar a fila.
- A chave idempotente é do lote, mas há coalescência e retries. Não está definido quando o conteúdo e a chave se tornam imutáveis nem como guardar os resultados no servidor.
- `updated_at` é usado para LWW, mas depois é substituído pelo horário de recebimento. Uma edição antiga enviada mais tarde pode vencer uma edição mais recente. A política efetiva precisa ser assumida explicitamente.
- O desempate usa `device_id`, mas ele não aparece na entidade nem no envelope persistido de mutação descrito.
- `sync_version` incrementa, porém não há semântica de versão esperada, rejeição de escrita obsoleta ou relação com o cursor.
- Pull por `since`, páginas de 500 e um `last_pulled_at` não definem ordenação estável, empate de timestamp, continuidade sob gravações concorrentes e estado separado por módulo.
- Tombstones vencem em 90 dias sem comportamento definido para um aparelho que volta depois disso. Ele pode tentar reintroduzir dados apagados.

**Fechamento:** exemplos completos de push/pull/erro e um protocolo pequeno: transação local, identidade estável de operação, confirmação, ordem de dependências, cursor opaco e estável, política de conflito por tipo e reset de sync preservando pendências. Não é necessário adotar CRDT ou mensageria distribuída para escrever esse contrato.

**Aceite:** 501 alterações, duas com timestamp igual e outra concorrente ao pull, chegam sem lacuna; morte após commit remoto e antes do ACK não duplica efeito; uma mutação inválida não causa descarte silencioso das demais; retorno após 90 dias não ressuscita exclusão.

### B05 — A identidade técnica não garante unicidade do acontecimento

**Evidência:** `specs/02-habitos.md:58–66,140`; `specs/04-gamificacao.md:25,109`; `specs/06-sincronizacao.md:52–54`; `specs/00-modelo-de-dados.md:74–76,118–123`.

**Cenário de XP:** aparelho A e aparelho B, offline, marcam o mesmo hábito no mesmo dia. Geram logs com UUIDs distintos L1 e L2 e XP com `source_id=L1` e `source_id=L2`. A unicidade de hábito/dia elimina um log, mas a unicidade de XP por `source_id` aceita os dois. Não há regra que remapeie ou reverta o XP ligado ao log descartado. O sistema ainda tolera origem órfã em outro cenário (`specs/04-gamificacao.md:115`).

**Cenário quantitativo:** A registra 0,5 L e B registra 0,7 L para o mesmo dia. Manter o primeiro log descarta um registro legítimo. Aplicar LWW a um total acumulado também pode perder incremento. Duplicação de um comando e dois comandos legítimos precisam de tratamentos diferentes.

**Outros efeitos:** excluir e recriar um log pode gerar uma origem nova; concluir uma ocorrência recorrente em dois aparelhos pode produzir duas próximas ocorrências. UUID v7 resolve geração descentralizada de identificadores, não essas invariantes de negócio.

**Fechamento:** especificar identidade de operação, identidade do cumprimento e identidade da ocorrência; reconciliar XP a partir do cumprimento canônico; tratar incrementos como operações deduplicáveis ou adotar outra política explicitamente aceita. Definir a autoridade da concessão de XP e do teto entre aparelhos.

**Aceite:** o mesmo cumprimento dá 10 XP após qualquer ordem de sync; dois incrementos legítimos preservam a soma; repetir um incremento não soma de novo; uma série nunca termina com duas ocorrências abertas.

### B06 — Logout, erros de autenticação e recuperação podem apagar pendências

**Evidência:** `specs/01-conta-e-onboarding.md:17,59–61`; `PLANO-DE-EXECUCAO.md:31–34`; `specs/06-sincronizacao.md:60–62,78`; `specs/07-nao-funcionais-e-lgpd.md:21–24`.

Logout limpa todo o SQLite, mas a fatia promete entrar/sair sem perder dado local. Não existe fluxo para mutações ainda não sincronizadas. Falha de migration oferece restaurar do servidor, que não contém necessariamente esses dados. O spec usa 401 para indicar conta excluída e mandar limpar o dispositivo; um 401 também pode indicar token expirado ou inválido.

O backup local em JSON a cada sete dias não define onde fica, se pode conter conteúdo sensível, como restaura, como é limpo ao sair/excluir conta nem o que acontece quando o app não é aberto no intervalo.

**Fechamento:** distinguir sessão expirada, refresh revogado e conta eliminada por estados inequívocos; preservar pendências até uma decisão explícita de descarte; projetar recuperação com cópia do banco/filas antes de substituição; estabelecer fluxo para logout offline. Preservar dados e impedir que outra conta os veja são dois requisitos simultâneos.

**Aceite:** criar offline e pedir logout não perde o registro silenciosamente; 401 transitório não apaga SQLite; migration interrompida mantém recuperável o dado que nunca chegou ao servidor.

### B07 — A Agenda não fecha o contrato com o Google Calendar

**Evidência:** `specs/12-agenda.md:21–23,37–47,61–78`; `specs/05-assistente-ia.md:45,54`.

1. `sync_token`, canal e expiração estão em `calendar_accounts`, mas uma conta pode selecionar vários calendários. A listagem de eventos e o watch são por calendário. O estado precisa representar cada coleção sincronizada. [Google: listagem de eventos](https://developers.google.com/workspace/calendar/api/v3/reference/events/list), [Google: canais de notificação](https://developers.google.com/workspace/calendar/api/guides/push).
2. Janela móvel de 90 dias, instâncias de recorrência e sync incremental precisam de estratégia explícita. Não se pode simplesmente combinar `syncToken` com `timeMin`/`timeMax`; os parâmetros compatíveis devem manter consistência com a carga inicial. Falta também trazer eventos que entram na janela sem terem sido alterados. [Contrato oficial de `events.list`](https://developers.google.com/workspace/calendar/api/v3/reference/events/list).
3. Faltam identidade externa composta, metadados de canal para validação/encerramento, tratamento de canais sobrepostos e retomada após reinício. O webhook é um aviso, não o conteúdo atualizado. [Google: push](https://developers.google.com/workspace/calendar/api/guides/push).
4. Dia inteiro precisa preservar data civil e fim exclusivo. Convite não respondido é `attendees[].responseStatus=needsAction`, não simplesmente `event.status=tentative`. Falta representar a resposta do participante e exceções de recorrência de forma fiel. [Recurso Event](https://developers.google.com/workspace/calendar/api/v3/reference/events).
5. O evento criado pelo assistente não define calendário de destino, escopo de escrita exato, efeito de retry após o Google aceitar mas a resposta se perder, nem desfazer após publicação. O spec de IA exige desfazer toda ação; a Agenda não descreve exclusão remota.
6. `calendar_events` mistura cache reconstruível com eventos locais ainda únicos. O próprio spec reconhece a exceção, mas ainda diz que perder a tabela inteira não causa perda. Recuperação deve preservar os pendentes antes de reconstruir o cache.

**Fechamento:** separar conta, estado por calendário, projeção de eventos e comandos locais pendentes. Validar primeiro leitura em dois calendários; definir escrita e compensação antes de habilitar `create_event`.

**Aceite:** dois calendários convergem independentemente; 410 não elimina evento local; evento de dia inteiro não muda de data na viagem; retry não cria dois compromissos; desfazer tem efeito definido antes e depois da publicação.

### B08 — A arquitetura nomeia módulos, mas não define a autoridade e a interface entre eles

**Evidência:** `CLAUDE.md:79–81`; `specs/04-gamificacao.md:5`; `specs/05-assistente-ia.md:11–31`; `specs/06-sincronizacao.md:49–54`; `specs/00-modelo-de-dados.md:190–195`.

O app contém regras puras, o servidor valida entradas e sincroniza fatos, e ambos podem participar da gamificação. Não está definido quem decide o XP final, o teto concorrente, a próxima ocorrência, a validade da data ou a aceitação de uma alteração originada por versão antiga do app.

Também não há envelopes de eventos, garantias de entrega, transações ou política de repetição dos efeitos. A regra “comunicação por evento” não explica consultas síncronas nem como `sync` devolve a decisão de um módulo. Eventos de aplicação não tornam um efeito automaticamente durável ou idempotente.

**Fechamento:** para cada módulo, documentar sua interface: comandos/consultas aceitos, invariantes, resultados, erros, dependências e transação. O módulo de sync transporta e reconcilia; não deve virar um CRUD irrestrito que escreve em tabelas de todos os domínios. Restringir campos mutáveis pelo cliente, especialmente credenciais, quotas, permissões e campos derivados.

As políticas de RLS já são uma boa base. Completar o contexto dos jobs, o fluxo pré-autenticação, as relações pai/filho e testes com a role real. Ausência de `BYPASSRLS` não basta se a conexão for dona da tabela; definir ownership separado ou a aplicação de `FORCE ROW LEVEL SECURITY` quando apropriada. Uma policy `USING` pode fornecer `WITH CHECK` implícito; o problema não é simplesmente faltar essa expressão escrita. [PostgreSQL: RLS](https://www.postgresql.org/docs/current/ddl-rowsecurity.html).

**Aceite:** é possível apontar um único lugar responsável por cada invariante; app e servidor concordam nos exemplos de domínio; nenhuma chamada de sync altera campo exclusivo do servidor ou referencia entidade de outro usuário; o isolamento é testado também em escrita.

## 4. Lacunas a fechar antes do módulo correspondente

### P01 — Hábitos: tempo, agenda histórica e recaída

Referências: `specs/02-habitos.md:38–44,77–82,108–118,137–144`; `specs/00-modelo-de-dados.md:49–82`.

- A agenda por intervalo não tem âncora explícita. `times_per_week` conta semanas, mas a mesma UI/glossário e os marcos de XP falam em dias.
- Editar agenda tem decisão pendente no próprio spec, ausente da lista Q1–Q9 do PRD. “Agenda histórica” e “recalcular tudo pela atual com aviso” não são equivalentes.
- Hábito negativo tem recaída e avanço automático, mas o log só aceita `done`, `skipped`, `partial`. Faltam representação da recaída, concessão de XP, processamento de vários dias sem abrir o app e relação com a ofensiva global.
- Arquivar “congela” ofensiva, mas reativar inicia nova série. Falta preservar episódios de atividade ou outra informação para reconstruir corretamente.
- O cache é descrito como totalmente derivável, mas o recálculo limita-se a 400 dias e depende do recorde materializado. Distinguir recálculo incremental do cold start e reconstrução completa após perda do cache.
- Título único entre ativos é requisito, mas falta a constraint e a normalização definida: espaço, caixa, acento e reativação com título ocupado.

Saída esperada: tabela de transições e exemplos canônicos para esses casos, com estado persistido suficiente. A seleção de uma política é uma decisão de produto, não uma escolha silenciosa do implementador.

### P02 — Gamificação: ledger e cache ainda se confundem

Referências: `specs/04-gamificacao.md:25–35,53–91,109–120`; `specs/00-modelo-de-dados.md:109–130`.

O ledger é chamado de append-only e simultaneamente permite editar `reverted_at`. É preciso escolher entre registro mutável de concessão/reversão ou lançamentos imutáveis de compensação. Ambos podem funcionar; o contrato deve descrever um só.

Faltam definições para: marcar/desmarcar/remarcar a mesma origem; janela de 24h de tarefas versus reversão geral; débito duplo do teto em tarefa rápida; teto consumido mesmo após reversão; teto de dia histórico com quantidade de hábitos diferente; marcos de 2.000 XP versus teto diário de hábitos; módulo do XP de conquista; origem estável dos marcos; XP parcialmente concedido ao cruzar o teto.

Congelamento é proposto “por usuário”, enquanto o cache guarda contagem por hábito. Faltam a abrangência da cota, quais dias a consumiram, relação com ofensiva global/semanal, restauração retroativa e concordância entre aparelhos. `freezes_used_this_month` sozinho não reconstitui essas escolhas.

O catálogo inicial é apenas sugerido, sem códigos, critérios e recompensas fechados. A fórmula de níveis precisa definir nível inicial e se o limiar é acumulado ou incremental; a tabela sugere acumulado, mas a interface precisa torná-lo inequívoco.

Saída esperada: exemplos que calculem XP concedido, XP válido e orçamento consumido separadamente; catálogo mínimo fechado; congelamento decidido ou explicitamente adiado por revisão do escopo.

### P03 — Tarefas: recorrência e datas civis precisam de contrato próprio

Referências: `specs/03-tarefas.md:34–59,90–101`; `specs/00-modelo-de-dados.md:87–101`.

Uma data sem hora não é naturalmente um instante UTC. Se “pagar no dia 25” for convertido em timestamp e reinterpretado em outro fuso, pode aparecer no dia errado. Definir data civil para all-day e instante/fuso para prazo com horário; esclarecer que “hoje” da Agenda/Tarefas e dia lógico de hábitos não são necessariamente iguais.

Recorrência não especifica completamente modelo versus ocorrência, âncora, fuso, contagem de `COUNT` com skips, fim da série, cancelamento, undo após geração da próxima, split ao editar “esta e próximas” e identidade sob concorrência.

A regra de levar dia 31 ao último dia de fevereiro é uma escolha válida de produto, mas diverge do comportamento padrão de datas inválidas na RFC 5545, que as ignora. Deve ser documentada como adaptação explícita, para não delegar acidentalmente outra semântica a uma biblioteca. [RFC 5545, §3.3.10](https://www.rfc-editor.org/rfc/rfc5545#section-3.3.10).

Saída esperada: tabela de casos com entrada, próximo vencimento, identidade da ocorrência e resultado do undo; fluxo de cancelamento e exclusão de pai/subtarefas.

### P04 — O contrato de tools ainda é descritivo

Referências: `specs/05-assistente-ia.md:35–56,74–76,90–107,114–122`; `specs/00-modelo-de-dados.md:136–153`.

O texto anuncia sete tools e lista oito. `create_habit` não traz meta/unidade para quantitativo; `update_task` diz apenas “campos”; `query_data` não define intents, resultado, local de execução ou resposta ao usuário. `create_event` não define calendário, duração padrão no contrato nem data sem hora. Os esquemas precisam incluir enums, limites, obrigatoriedade condicional e erros.

Uma requisição pode produzir várias ações, mas o spec usa `assistant_actions.id` como idempotência do endpoint sem distinguir requisição, tentativa e ação individual. Faltam estados de falha/timeout/cancelamento, política de retry parcial e correlação com custo efetivamente consumido pelo servidor.

Desfazer por snapshot pode sobrescrever uma edição posterior legítima. É necessário conferir versão/efeito atual e definir compensação. A confirmação precisa cobrir o payload que será executado, com invalidação se ele mudar. “Amanhã às 3” é convertido para 15h, mas a tool de criação normalmente não confirma: escolher se pergunta ou exibe confirmação neste caso.

A regra “toda STT pelo backend” conflita com o STT nativo recomendado. O consentimento precisa refletir processamento local e remoto. A autorização de IA deve valer nos endpoints e no dispatch; esconder o FAB não é controle suficiente. A ferramenta de leitura precisa de escopo tão claro quanto as de escrita.

Saída esperada: schemas e exemplos versionados, estados da requisição e das ações, conjunto de frases de avaliação pt-BR, validação de confirmação e undo com edição concorrente. Não é necessário trocar Spring AI ou expandir a conversa para memória longa.

### P05 — Notificações disputam um orçamento já totalmente alocado

Referências: `specs/02-habitos.md:84–97`; `specs/03-tarefas.md:76–77`; `specs/04-gamificacao.md:99–105`; `specs/08-briefing.md:65–67`.

O orçamento interno de 64 está integralmente dividido em 40 hábitos e 24 tarefas, mas há briefing matinal e alerta de ofensiva. Faltam prioridade global, reserva para essas categorias, persistência dos agendamentos, dedupe por ação e cancelamento quando outro aparelho conclui o item.

Um briefing local agendado anteriormente não conhece automaticamente a manchete mais atual se o app não voltar a executar. Definir conteúdo baseado no último estado conhecido e sua alternativa. “Lembretes corretos por sete dias” precisa de condições claras: app fechado, permissão negada, reinício, economia de bateria, troca de fuso e abertura diária ou não.

Saída esperada: um responsável único pelo agendamento e orçamento, política de degradação e spike em aparelho real antes de comprometer a experiência. A quota exata da plataforma deve ser verificada no ambiente/SDK escolhidos; aqui o achado é a contradição dentro do orçamento que o próprio projeto adotou.

### P06 — Privacidade e operação descrevem obrigações, não procedimentos

Referências: `specs/01-conta-e-onboarding.md:49–53`; `specs/07-nao-funcionais-e-lgpd.md:20–24,28–31,45–65,81–88`.

Faltam inventário de dados e retenção para transcrições, argumentos de tools, snapshots, áudios temporários, telemetria, backups e cache de Agenda. “Anonimização imediata” não explica como tratar nomes e conteúdo livre em tarefas ou transcrições. Uma restauração de backup não pode reativar uma conta já eliminada sem política explícita.

A exportação não tem o formato prometido nem mecanismo de restauração. É necessário excluir segredos e definir consistência frente a mutações pendentes. Revogação de consentimento, versão do texto aceito, falha ao revogar Google e configurações de Sentry não estão fechadas. A frase “nenhum evento sem consentimento” precisa esclarecer a diferença entre analytics e crash reporting no mesmo parágrafo.

Operação: faltam frequência efetiva de backup, RPO/RTO, monitoramento da cópia externa, runbook de recuperação, compatibilidade de migrations com rollback, verificação de jobs, health/readiness e entrega de e-mail. O bom requisito de restaurar um backup deve continuar desde a fundação.

Esta auditoria não valida juridicamente as bases legais nem as afirmações de licença do PRD. O documento técnico deve registrar essas premissas e evidências, sem apresentar uso pessoal ou resumo curto como autorização universal de terceiros.

### P07 — A stack precisa de uma combinação reproduzível

Referências: `CLAUDE.md:26–46,104–119`; `specs/07-nao-funcionais-e-lgpd.md:83–87`.

Não há matriz de versões para Expo/React Native/NativeWind/Reanimated/Drizzle nem Spring Boot/Modulith/Spring AI/Gradle/Postgres. Não se deve concluir que são incompatíveis sem essa matriz, mas também não se pode iniciar com “versão mais recente” de cada peça e presumir compatibilidade.

Existe uma defasagem confirmada: `expo-av` está listado para áudio, enquanto o Expo já publicou sua substituição por `expo-audio` e descontinuação de manutenção de `expo-av`. [Changelog oficial do SDK 53](https://expo.dev/changelog/sdk-53).

Saída esperada: versões compatíveis fixadas, runtime/gerenciador de pacotes, lockfiles, build de desenvolvimento em dispositivo alvo, ambientes e comandos reproduzíveis. Registrar quais testes de iOS exigem aparelho/build remoto no ambiente Windows; não tratar a lista de comandos pretendidos como ferramentas já instaladas.

### P08 — As métricas e o gatilho de quatro semanas podem levar à conclusão errada

Referências: `PRD.md:28,43–65,131,169–170`; `PLANO-DE-EXECUCAO.md:96–125`; `specs/07-nao-funcionais-e-lgpd.md:29,65`.

O risco de voz pede medição desde a primeira semana, mas a spike de STT está na Fatia 10. A janela de 30 dias começa no “primeiro uso” ou quando voz/sync estão disponíveis? Registros por voz contam tarefas, hábitos quantitativos e múltiplas ações de uma fala como quê? A taxa de correção tem evento de desfazer, mas correção manual não está instrumentada explicitamente. A meta do PRD fala em registros e o portão do plano fala em dias de uso.

O gatilho de quatro semanas não define data de início, capacidade de trabalho, interrupções nem o que conta como Briefing entregue. Q5 pode bloquear visual, e Agenda pode bloquear por OAuth: nenhum desses atrasos prova isoladamente que o backend próprio foi a causa. A afirmação de que voltar a BaaS custa “dias” não tem experimento que sustente a estimativa.

As estatísticas de retenção e mercado não têm URLs, metodologia e recorte rastreáveis no pacote. Mesmo uma correlação válida de retenção com IA não provaria causalidade para este produto.

Saída esperada: antecipar a investigação de voz; definir baseline de toque e frases representativas; instrumentação mínima desde o primeiro fluxo; janela de validação iniciada numa versão identificada; transformar ADR-014 num checkpoint com diagnóstico de causa e orçamento de esforço. Estatísticas sem fonte ficam marcadas como hipótese, não como fato validado.

## 5. Consistência editorial e rastreabilidade

| Evidência | Problema | Ajuste necessário |
|---|---|---|
| `PRD.md:72` versus `PRD.md:98` e ADR-011 | Login social dentro e fora da Fase 1 | Manter escopo consistente com a decisão aprovada |
| `specs/01-conta-e-onboarding.md:27,33,37` | Máximo de quatro e teto de cinco telas | Um único limite e sequência |
| `specs/01-conta-e-onboarding.md:43,51` | `REQ-CTA-010` define onboarding e exportação | IDs exclusivos, com atualização de referências |
| `specs/01-conta-e-onboarding.md:57,62` | Casos Apple/Google permanecem misturados à Fase 1 | Marcar fase futura sem exigir implementação atual |
| `PLANO-DE-EXECUCAO.md:92,152` | Edge functions após decisão por Spring | Atualizar mecanismo e responsáveis |
| `specs/05-assistente-ia.md:103` | Prompts em `supabase/functions/...` | Caminho coerente com backend aprovado |
| `specs/05-assistente-ia.md:35–46` | Sete tools anunciadas, oito listadas | Lista canônica geradora de schemas/documentação |
| `specs/00-modelo-de-dados.md:98` | RRULE aponta para §4 de tarefas, que é não-escopo | Referenciar REQ-TAR-005 |
| `README.md:24` | Onze fatias anunciadas | O plano tem 15 entradas na Fase 1 e cinco na 2A |
| `PLANO-DE-EXECUCAO.md:81` | Dez edge cases de tarefas | O spec lista doze; preferir IDs estáveis a contagem |
| `specs/09-noticias.md:13,33`, `specs/10-esportes.md:57` versus `specs/01-conta-e-onboarding.md:43` | Módulos futuros voltam ao onboarding | Configuração de módulo posterior, ou revisar o teto explicitamente |
| `specs/08-briefing.md:80` versus `specs/09-noticias.md:116` | Estabilidade do feed por três ou duas horas | Uma política única na Fase 2A |
| `PRD.md:176` versus `specs/09-noticias.md:155` | Resumo de duas/três frases ou três bullets | Alinhar representação |
| `CLAUDE.md:91` versus retenções de sync/notícias | Exclusão física somente na conta versus expiração de retenção | Exceções por categoria de dado |

Além de erros editoriais, há obrigações importantes sem ID próprio, principalmente em não funcionais. Citar apenas o arquivo da feature não mostra se sua busca, arquivamento, recuperação ou casos de erro foram entregues.

Criar uma matriz `requisito → decisão pendente → fatia → teste/evidência → status`. Cobrir também os requisitos hoje pouco explícitos no plano: hábitos quantitativos/negativos e agendas avançadas, histórico, etiquetas/busca/expressão matemática, preferências de cards, recuperação de senha, backups locais e configuração remota. O plano referencia specs inteiros, portanto isso é **ausência de rastreabilidade explícita**, não prova de que esses itens foram intencionalmente cortados.

## 6. Lacunas futuras que devem ficar no backlog

### F01 — Notícias

Referências: `specs/09-noticias.md:71–102,130–176`.

- Isolamento de processo sem credenciais não é a mesma coisa que separar um módulo dentro da JVM com acesso aos segredos do backend. A exigência precisa de desenho coerente quando essa fase chegar.
- Definir validação de URL em toda coleta e imagem/proxy, vínculo entre endereço validado e conexão realizada, parser XML sem recursos externos e limites após descompressão. São requisitos de desenho ainda incompletos, não vulnerabilidades demonstradas.
- Score não especifica normalização de todos os sinais, limiar de corte e precedência matemática das penalidades. Garantir uma vaga a cada tema prioritário pode ser impossível com mais temas do que vagas.
- O schema não explicita associação de usuário a fonte compartilhada, pesos aprendidos de ±20%, estado ETag/Last-Modified e `purpose='news'` mencionado para quota. Definir dados globais versus privados.
- A estimativa de “centavos” precisa de modelo, tokens, dedupe e volume mensuráveis. Validar condições dos fornecedores antes de adotá-los.

### F02 — Esportes

Referências: `specs/10-esportes.md:17–55,61–73`.

- Polling a cada minuto deixa até quase 60 segundos de espera antes de rede, processamento e entrega. A meta ponta a ponta de 60 segundos precisa de percentil, orçamento por etapa e medição.
- A chave `(match_id,event_type,minute,player_id)` pode confundir correção de autor, eventos sem jogador e eventos legítimos semelhantes. A spike precisa examinar IDs, revisões e anulação no provedor real.
- Dedupe de fato não garante envio único. Falta comportamento para interrupção entre detectar, persistir e enviar push; receipts, retry e retratação precisam de estado.
- Favoritos, preferências de notificações e modo “estou assistindo” precisam de contrato persistido e escopo por usuário/dispositivo.

Nenhum desses itens exige implementar Notícias ou Esportes antes de validar o núcleo.

## 7. Aplicação criteriosa de Karpathy e Matt Pocock

A pesquisa com fontes está em [Referências de Karpathy e Matt Pocock](./2026-09-23-referencias-karpathy-matt-pocock.md). Não foi encontrada, nos documentos originais do projeto, uma referência que fixasse qual conjunto de guidelines o usuário pretende adotar.

Para Matt Pocock, há fontes primárias sobre planos em fatias ponta a ponta, dependências, módulos com interface pequena e testes comportamentais. Para Karpathy, é importante separar fontes próprias de adaptações comunitárias popularizadas com seu nome. As recomendações abaixo são aplicação desses princípios ao Ritmo; não regras universais atribuídas literalmente aos autores.

| Princípio | Como já aparece | Ajuste recomendado |
|---|---|---|
| Tornar pressupostos e resultados verificáveis | Perguntas abertas, aceite e ADRs | Registrar os pressupostos encontrados nesta auditoria; não completar lacunas no código |
| Simplicidade orientada ao problema atual | Sem microserviços/Redis; um usuário | Evitar migrations de todas as features antes de provar a primeira; não criar uma plataforma genérica de sync |
| Mudanças pequenas e revisáveis | Intenção de uma fatia por vez | Fatiar por comportamento observável e dependência real, sem exigir backend e app isolados como unidades de entrega |
| Módulos profundos | Domínio puro, card provider, orquestrador separado | Definir interface com invariantes, erros e transações; pastas sozinhas não asseguram isolamento |
| Testar comportamento pela interface | Casos de borda e testes obrigatórios | Priorizar os cenários de perda/duplicação e contrato; cobertura numérica é apoio, não prova de correção |
| Validar cedo a hipótese central | Voz é apresentada como diferencial | Spike e baseline de voz no início, com integração incremental depois |

Não recomendo reescrever em TypeScript o backend Java apenas para “seguir Matt”, nem atribuir a Karpathy a regra rígida de uma camada por sessão sem fonte. Os princípios são de trabalho e desenho; as escolhas de stack precisam do contexto do projeto.

## 8. Condição para começar com confiança

Antes de implementar uma capacidade, seu responsável deve conseguir responder:

1. Qual comportamento concreto será entregue e qual requisito o autoriza?
2. Que dados existem em cada lado, quem pode alterá-los e qual é a identidade do fato?
3. O que acontece offline, com retry, interrupção, outro aparelho e uma versão antiga?
4. Quais decisões estão fechadas e quais partes foram explicitamente adiadas?
5. Que teste ou demonstração vai provar o resultado, incluindo falhas relevantes?

O próximo passo recomendado é sanear os contratos e reordenar as primeiras entregas conforme o [plano de saneamento](./2026-09-23-plano-de-saneamento.md). A fundação estará pronta quando o primeiro fluxo real puder ser implementado e verificado sem decisões implícitas — não quando todos os módulos futuros tiverem documentação extensa.
