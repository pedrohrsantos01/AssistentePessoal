# PRD — Ritmo (nome de trabalho)

**Versão:** 3.0
**Data:** 14/09/2026
**Autor:** Pedro
**Status:** Escopo da Fase 1 aprovado; contratos da fundação em esclarecimento antes da implementação.
**Revisão da fundação:** 24–25/09/2026 — decisões registradas na [entrevista](.scratch/fundacao/entrevista.md).
**Mudanças da 3.0:** backend próprio em Spring Modulith substitui o Supabase; Agenda entra na Fase 1; Notion cortado; capacidades novas do assistente incorporadas.

> Este documento é a fonte da verdade sobre **o que** construir e **por quê**.
> O **como** está em `CLAUDE.md` (stack e convenções) e em `specs/` (requisitos detalhados).
> Agentes de código devem ler `CLAUDE.md` primeiro, depois o spec do módulo em que vão trabalhar.

---

## 1. Problema

Quem tenta se organizar hoje usa um app para tarefas, outro para hábitos, outro para treino e outro para dinheiro. O custo não é o preço das assinaturas — é o **atrito de registro**. Cada app exige abrir, navegar até a tela certa, preencher campos e salvar. Multiplicado por quatro apps e por vários registros ao dia, o usuário abandona o registro, os dados ficam incompletos, os relatórios perdem sentido e ele abandona os apps.

O problema central não é "faltam funcionalidades". É: **registrar a própria vida custa caro demais em toques e em atenção.**

## 2. Tese do produto

> Um app que **te entrega algo antes de pedir qualquer coisa**, e no qual registrar a própria vida custa uma frase falada.

Três consequências que orientam toda decisão de escopo:

1. **O briefing diário é a tela inicial e o coração do produto.** Ao abrir o app, o usuário recebe antes de dar: o que tem hoje, seus hábitos, as notícias que importam para ele e se o time dele joga. Registro vem depois de já ter recebido valor, nunca como pedágio de entrada.
2. **O assistente de voz é o produto, não uma feature.** Se registrar um hábito por voz não for mais rápido que registrar por toque, metade da tese cai. Dado que sustenta a aposta: apps com assistente de IA embarcado retêm em D30 cerca de 9,1% contra 5,8% da média global (Mixpanel Benchmark Report, 2026).
3. **Todo módulo é de produção ou de consumo, e o app precisa dos dois.**
   - **Produção** (hábitos, tarefas, treinos, finanças): o usuário registra, o valor acumula com o tempo. Custa esforço.
   - **Consumo** (briefing, notícias, esportes): o app entrega, o valor é imediato. Custa zero esforço.

   Módulos de consumo são o motivo de abrir; módulos de produção são o motivo de ficar. Um app só de produção vira dívida diária e é abandonado. Um app só de consumo não constrói nada. O diferencial deste produto é ter os dois na **mesma tela**.

## 3. Público

**Usuário primário (v1):** Pedro — desenvolvedor pleno, 1 pessoa, uso real e diário. O v1 é validado por uso próprio, não por métricas de aquisição.

**Prioridade entre objetivos (24/09/2026, entrevista R1-Q1):** em conflitos entre chegar ao uso diário e elaborar uma solução para aprendizado ou portfólio, o uso diário prevalece. A stack Java/Spring já escolhida é mantida; complexidade adicional deve atender a uma necessidade concreta da fase atual.

**Usuário-alvo futuro (v3+, se comercializar):** profissional brasileiro de 25–40 anos que já tentou pelo menos dois apps de organização e abandonou; tem rotina irregular; usa o celular como sistema operacional da vida.

**Não é para:** times e empresas. Este produto é single-player. Colaboração é não-escopo permanente até decisão contrária explícita.

## 4. Objetivos e métricas de sucesso

### Fase 1 — validação por uso próprio (obrigatória antes de qualquer outro módulo)

| Métrica | Meta | Como medir |
|---|---|---|
| Dias com pelo menos 1 registro | ≥ 25 dos 30 primeiros dias | evento `log_created` |
| Registros feitos por voz | ≥ 40% do total | `source = assistant_voice` |
| Tempo do toque no FAB até o registro salvo | ≤ 6 s (p75) | timer instrumentado |
| Ações do assistente desfeitas ou corrigidas | ≤ 10% | `assistant_action.reverted` |
| Crash-free sessions | ≥ 99,5% | Sentry |

**Critério de saída da Fase 1:** se Pedro não usar o app por 25 dos 30 primeiros dias, **não se adiciona módulo novo** — investiga-se por que o core não segurou.

### Primeiro marco utilizável e revisão de quatro semanas

Aceito em R2-Q9 e detalhado em R6-Q27: conta, onboarding retomável de fuso/início do dia, primeiro hábito binário diário pulável e Briefing mínimo com saudação, hábitos e XP básico, com sincronização real entre o iPhone 16e e o emulador Android. O aceite exige criar e registrar offline, preservar os dados após fechar/reabrir o app e convergir entre os dois clientes sem perda nem duplicação de cumprimento/XP. Logout e reentrada obedecem ao ADR-016. O recorte e seus cenários verificáveis estão no [plano de execução](PLANO-DE-EXECUCAO.md) e na [especificação da entrega](.scratch/primeiro-marco/spec.md).

Interfaces de níveis, ofensivas, proteções e conquistas entram depois, junto aos seus incrementos da Fase 1. Permissões são solicitadas quando a capacidade estiver disponível. R6-Q28 condicionou a direção ao protótipo de Pedro. Em 09/10/2026, Pedro entregou o pacote Claude Design para orientar a implementação; a direção foi consolidada em [spec/11](specs/11-design-system.md), com correções de acessibilidade e [recortes de interface](.scratch/interface-m1/spec.md). Isso libera implementar as telas, sem dar aceite visual/nativo ou concluir o M1.

Agenda, tarefas e voz continuam na Fase 1, em incrementos seguintes. O primeiro marco não inicia automaticamente a avaliação dos 30 dias da Fase 1 completa, que inclui métricas de voz. O ponto de início dessa avaliação será registrado quando a Fase 1 estiver disponível para uso real.

Aceito em R2-Q10: as quatro semanas do ADR-014 contam a partir do início registrado da implementação. O início real foi registrado em **25/09/2026, 18:22 (America/Sao_Paulo)**, na tarefa 04; a revisão será em **23/10/2026**. A entrevista e o saneamento documental não iniciaram essa contagem. O vencimento exige revisão de resultados e causas, sem mudança automática de infraestrutura.

### Métricas de referência do mercado (para quando/se virar produto)

| Categoria | D1 | D7 | D30 |
|---|---|---|---|
| Produtividade | 40–55% | — | 10–18% |
| Finanças | ~30% | — | 10–15% |
| Saúde e fitness | ~20% | 7–8,5% | 3,5–4% |
| Mediana geral do mercado | ~25% | ~13% | ~4–7% |

North star futura: **DAU/MAU ≥ 0,4** (o app precisa ser diário, não semanal).

## 5. Escopo da Fase 1

### Dentro (v1)

- Conta e autenticação (e-mail + senha; login social fora da Fase 1, ADR-011)
- Onboarding
- **Tela Briefing** — a home do app, agregando os módulos ativos
- **Módulo Hábitos**
- **Módulo Tarefas**
- **Módulo Agenda** — integração com Google Calendar (ADR-013)
- Engine de gamificação (XP, nível, ofensiva, conquistas)
- Assistente de IA por texto e voz, com contrato de tools
- Notificações locais agendadas
- Funcionamento offline com sincronização
- Exportação e exclusão de dados (LGPD)

> Na Fase 1 o Briefing mostra agenda, hábitos e tarefas. Ele é construído desde o dia 1 como **superfície pluggável de cards**, para que Notícias e Esportes entrem na Fase 2 sem redesenho. Ver `specs/08-briefing.md`.

### Fora (non-goals) — não implemente mesmo que pareça natural

| Item | Status |
|---|---|
| Módulos Notícias e Esportes | **Fase 2, prioridade máxima** — ver §6 e ADR-001 |
| Módulos Treinos, Finanças, Refeições, Leitura | Fase 2 e 3 — ver §6 |
| Qualquer funcionalidade social, feed, ranking entre usuários, compartilhamento | Fora permanente do v1 |
| Push notifications vindas do servidor | Fora da Fase 1; entra na Fase 2 com Esportes (ADR-003) |
| Integração com wearables, Apple Health, Google Fit | Fase 3 |
| Web app, desktop, widget de home screen, Apple Watch | Fora do v1 |
| Assinatura, paywall, billing | Fora do v1 (ver ADR-006) |
| Múltiplos idiomas | Fora do v1 — pt-BR apenas, mas sem string hardcoded (ver `CLAUDE.md`) |
| Login com Apple e Google | Fora da Fase 1 (ADR-011) — e-mail e senha apenas |
| Sincronização com Notion | **Cortado** (ADR-012) |
| Busca global unificada | Fase 2B |
| Mediação proativa de agenda | Fase 2A, depois de Agenda estar estável |
| OCR de recibo, LLM on-device, wearables | Fase 3 |
| IA que altera dado financeiro ou de saúde sem confirmação | Fora permanente |
| Importação de outros apps (Todoist, Habitica) | Fase 3 |

## 6. Faseamento

**Fase 1 — O motor** (este PRD)
Hábitos + Tarefas + **Agenda** + Briefing + gamificação + assistente + sync. Entrega as quatro engines que todos os módulos futuros reutilizam: XP idempotente, ofensiva com fuso horário, agendamento de lembrete e contrato de tools do assistente.

**Fase 2A — Consumo** (entra logo depois, é barata e é o que te faz abrir o app)
**Notícias** e **Esportes**. Ambas são de custo de domínio baixo, não usam a engine de gamificação e não exigem registro manual nenhum. São o retorno mais rápido por hora investida em todo o roadmap. Specs `08-briefing.md`, `09-noticias.md` e `10-esportes.md`.

**Fase 2B — Expansão de produção**
Treinos (reaproveita rotina/checklist/streak) e depois Finanças. Finanças só entra com **Open Finance** via agregador (Pluggy ou Belvo) — lançamento manual puro não é competitivo: o Brasil já passou de 100 milhões de contas conectadas e 154 milhões de consentimentos ativos, e Organizze e Mobills já importam extrato automaticamente. Ver `specs/98-fase-3-notas.md`.

**Fase 3 — Longa cauda**
Refeições, Leitura, wearables, importação, comercialização.

**Regra de promoção de fase:** um módulo só entra quando o anterior tiver atingido a meta de uso da §4 e estiver com dívida técnica zerada.

## 7. Riscos

| # | Risco | Impacto | Mitigação |
|---|---|---|---|
| R1 | Voz não é mais rápida que toque, e a tese cai | Crítico | Medir p75 desde a primeira semana (métrica da §4). Se falhar, simplificar entrada por toque antes de investir mais em IA |
| R2 | Custo de API de IA sem teto | Alto | Quota por usuário, modelo barato para classificação de intenção, cache. Ver `specs/05-assistente-ia.md` §8 |
| R3 | Gamificação vira exploit ou vira cobrança | Médio | Teto diário de XP, idempotência, ofensiva desativável, copy sem culpa. Ver `specs/04-gamificacao.md` §6 |
| R4 | Sync gera perda ou duplicação de dado | Alto | Local-first com fila de mutações, IDs gerados no cliente, tombstones. Ver `specs/06-sincronizacao.md` |
| R5 | Escopo volta a inflar para 7 módulos | Alto | §5 "Fora" é vinculante. Mudança exige nova versão deste PRD |
| R7 | Backend próprio atrasa a entrega e o projeto morre antes do primeiro valor | Crítico | **Revisão em quatro semanas (ADR-014):** contar do início registrado da implementação, avaliar o primeiro marco da §4 e as causas de atraso; decidir manter o caminho, reduzir o próximo recorte ou rever a infraestrutura com base em evidências |
| R8 | Vazamento de dado entre usuários por falta de RLS automática | Alto | Defesa em 3 camadas e teste de vazamento obrigatório por módulo. Ver `CLAUDE.md` §5 |
| R6 | Dado sensível (saúde, futuramente finanças) vazando para LLM de terceiro | Alto | Minimização de contexto e consentimento explícito. Ver `specs/07-nao-funcionais-e-lgpd.md` |

## 8. Decisões registradas (ADRs)

**ADR-001 — Esportes e Notícias entram na Fase 2A. (Revisa e substitui a decisão de corte da v2.0.)**
A v2.0 cortou Esportes com argumentos de produto comercial: licença de redistribuição de dados, custo de polling em escala, SLA dependente de provedor pago. Nenhum deles se aplica a um app de **um usuário com dois ou três times**: o volume cabe folgado no tier gratuito de provedores como API-Football, e uso pessoal não configura redistribuição.

O argumento de que "consumo passivo não agrega" estava errado na conclusão: num app pessoal, os módulos de consumo são exatamente o que gera o hábito de abrir, porque custam zero esforço de registro (§2.3).

**O que continua valendo do corte original:** o SLA de 5 segundos é inexequível — ele depende do provedor, não da nossa arquitetura. A meta passa a ser **60 segundos** (ver `specs/10-esportes.md` §3). E nada de Redis ou fila na Fase 2: `@Scheduled` no backend + Expo Push resolve o volume de um usuário.

**Condição de comercialização:** se o app for aberto a outros usuários, esta decisão precisa ser reavaliada — aí sim entram licença de redistribuição do provedor de dados esportivos e custo de polling por usuário.

**ADR-002 — Local-first com SQLite, não online-first.**
O app é usado na academia, no mercado e no metrô. Toda escrita vai primeiro para o SQLite local e depois para a fila de sincronização. Consequência: todos os IDs são UUID v7 gerados no cliente.

**ADR-003 — Notificações locais na Fase 1; push de servidor só na Fase 2A.**
Lembrete de hábito e de tarefa é 100% previsível no dispositivo — não precisa de servidor. Push remoto entra junto com Esportes, porque evento de jogo é imprevisível por natureza. Implementação: Expo Push Notifications (gratuito), disparado por `@Scheduled` no backend Spring. Sem broker próprio, sem Redis.

**ADR-004 — Backend próprio em Java + Spring Modulith, na VPS com Coolify. (Substitui a decisão por Supabase das versões 2.x.)**
Três fatores mudaram a conta:
1. O Pedro **já opera uma VPS com Coolify**, que entrega proxy, TLS, deploy por Docker, segredos e backup agendado do Postgres. A maior parte do custo operacional de ter backend próprio já está paga.
2. **Spring Modulith tem a forma do problema.** Um app de módulos com fronteira explícita e comunicação por evento interno é literalmente o desenho deste produto.
3. Os módulos da Fase 2A — coleta de RSS com validação anti-SSRF, resolução de DNS, polling de partida ao vivo — são desconfortáveis em edge function e naturais na JVM.

**Custo aceito:** cerca de uma semana a mais até a Fatia 1, e o isolamento por usuário deixa de ser automático (mitigado em `CLAUDE.md` §5). A revisão de quatro semanas do ADR-014 permite avaliar essa estimativa com resultados reais antes de decidir mudar de infraestrutura.

**ADR-011 — Fase 1 com e-mail e senha apenas.**
OAuth de Apple e Google consumiria mais tempo que todo o resto da autenticação somado — o client secret da Apple é um JWT assinado com chave `.p8` que expira a cada 6 meses. A exigência da App Store de oferecer login Apple só vale se existir outro login social; sem nenhum, não se aplica. Login social entra quando o app for para a loja, possivelmente delegando a um Keycloak no Coolify, com o Spring virando apenas resource server.

**ADR-012 — Notion cortado.**
Sincronização bidirecional com Notion criaria **três** fontes de verdade disputando o mesmo evento: o app, o Google Calendar e o Notion. Conflito a três não tem resolução limpa, e a API do Notion tem limite de taxa restritivo. Decisão: cortado. Se voltar, volta como espelho de mão única (app → Notion).

**ADR-013 — Agenda entra na Fase 1.**
O Briefing promete responder "o que eu tenho hoje" e nenhum módulo alimentava isso: tarefa com prazo não é compromisso. Agenda é, além disso, o módulo de melhor relação valor/esforço do pacote — importa sozinha, exige zero registro manual e alimenta a home desde o primeiro dia.

**ADR-014 — Revisão do primeiro marco em quatro semanas. (Revisado em 24/09/2026, R2-Q10.)**
Contar quatro semanas a partir da data registrada de início da implementação e avaliar as evidências de aceite do primeiro marco (§4), os impedimentos e suas causas. Pedro decide, com base nessa revisão, entre manter o caminho, reduzir o próximo recorte ou mudar a infraestrutura. A falta do marco, por si só, não demonstra que o backend próprio causou o atraso.

Esta revisão substitui a decisão de 14/09/2026 que determinava migração automática para BaaS se o Briefing não estivesse rodando após quatro semanas. Uma eventual migração exige avaliação própria de custo, contratos afetados e plano de transição; não se presume duração de poucos dias. O ADR-004 permanece vigente.

**ADR-005 — A chave da API de IA nunca fica no dispositivo.**
Toda chamada a LLM e a STT passa pelo módulo `ai-orchestrator` no backend, autenticado por JWT, que aplica quota e registra auditoria. O segredo vive no Coolify, nunca no bundle do app.

**ADR-007 — Notícias: link e resumo curto, nunca texto integral.**
O app agrega por RSS e feeds abertos, exibe título, fonte, um resumo próprio de 2 a 3 frases e o link para o original. Nunca reproduz o artigo completo nem substitui a visita à fonte. Para uso pessoal isso já é a prática correta; para uso comercial, é a diferença entre agregador legítimo e violação de direito autoral. A regra é permanente e vale desde o v1 — ver `specs/09-noticias.md` §5.

**ADR-008 — Gatilho de reavaliação comercial.**
No momento em que o app for instalado por qualquer pessoa além do Pedro, três decisões precisam ser reabertas antes do lançamento: licença de dados esportivos (ADR-001), termos dos feeds de notícia (ADR-007) e custo de IA e polling por usuário. Nenhuma delas bloqueia o uso pessoal; todas bloqueiam o comercial.

**ADR-009 — O Briefing é a única tela de uso diário.**
A v2.1 deixou "tela Hoje" e "Briefing" convivendo em specs diferentes, o que faria um agente construir duas telas com o mesmo conteúdo. Decisão: o Briefing absorve a tela Hoje. As telas de hábitos e tarefas passam a ser de **gestão**, não de uso diário. Na revisão de 24/09/2026, o Briefing mínimo integra o primeiro marco; a antiga posição na Fatia 3 deixa de determinar sua ordem de implementação.

**ADR-010 — Sem modo convidado.**
Conta obrigatória desde a primeira abertura. `user_id` é a base de RLS, de sync e de toda tabela; um usuário local fantasma e a migração posterior de dados custam caro e não trazem nada quando o usuário é um só. Reavaliar apenas se o app for aberto ao público.

**ADR-006 — Sem monetização no v1.**
Objetivo declarado do v1 é uso próprio, portfólio e aprendizado. Mas nenhuma decisão de arquitetura pode inviabilizar billing depois: por isso `user.plan` existe no modelo de dados desde o dia 1, sempre com valor `free`.

**ADRs da revisão da fundação (24–25/09/2026):**

- [ADR-015 — Resposta local e reconciliação dos fatos pelo servidor](docs/adr/0015-autoridade-na-reconciliacao.md): aceita em R1-Q3; complementa o ADR-002.
- [ADR-016 — Logout preserva pendências isoladas por conta](docs/adr/0016-preservar-pendencias-no-logout.md): aceita em R1-Q4; substitui a antiga regra de limpeza integral no logout.
- [ADR-017 — Reconciliação preserva lançamentos e correções](docs/adr/0017-reconciliacao-de-registros-e-correcoes.md): aceita em R3-Q11 a Q14; define desfazer/remarcar, contribuições quantitativas, edições independentes e restauração da concessão original de XP.
- [ADR-018 — Agenda e meta preservam a avaliação histórica](docs/adr/0018-vigencia-das-regras-de-habitos.md): aceita em R4-Q16/Q17; vigência no próximo dia lógico, com próxima segunda-feira lógica para transições de agenda semanal (R5-Q23). Q25/Q29 condicionam ambos os cortes à aceitação pelo servidor. R4-Q15 complementa o ADR-017 com a ordem de aceitação; R4-Q18 separa datas civis de tarefas e dia lógico de hábitos/XP.

## 9. Glossário

O vocabulário canônico está em [CONTEXT.md](CONTEXT.md). As definições de dia lógico, dia devido, ofensiva, ocorrência, ação do assistente e registro foram reunidas nesse arquivo durante a entrevista da fundação, junto da definição de pendência de sincronização. Os detalhes de comportamento continuam nos specs dos módulos.

## 10. Perguntas em aberto

- [ ] **Q1** — Nome definitivo do produto e domínio.
- [ ] **Q2** — Provedor de STT: Whisper via API, Deepgram, ou API nativa do sistema (`expo-speech-recognition`)? A nativa é grátis e offline mas pior com ruído. Decidir na primeira spike. (Ver `specs/05-assistente-ia.md` §3)
- [x] **Q3** — Proteção de ofensivas aprovada em R5-Q22: dois dias lógicos por conta/mês civil, automáticos, sem acúmulo; uma unidade pode preservar várias ofensivas avaliadas por dia e a global, sem incrementar contagem nem dar XP. Não cobre metas semanais nem recaída explícita. R6-Q24 permite devolver a unidade ao mês original quando nenhuma série ainda depender dela; contratos em REQ-GAM-011/011a.
- [ ] **Q4** — Hábito e tarefa recorrente se sobrepõem conceitualmente para o usuário? Proposta atual em `specs/02-habitos.md` §1. Validar em uso real na semana 2.
- [x] **Q5** — Referência visual recebida em 09/10/2026: Holograma padrão, Cockpit/Neo-tokyo selecionáveis, claro/escuro e fontes/tokens consolidados em [spec/11](specs/11-design-system.md). R6-Q28 atendida quanto à direção; implementação e acessibilidade nativas continuam pendentes. Custódia das preferências e áudio têm definição técnica própria antes de persistir; regras novas do handoff não substituem os specs.
- [ ] **Q6** — Resultado da spike REQ-HAB-008b: a ação rápida da notificação consegue registrar sem abrir o app no iOS? Se não, a UI muda.
- [ ] **Q7** — Times e campeonatos acompanhados, para a escolha do provedor esportivo.
- [ ] **Q8** — Google Calendar: quais calendários entram no Briefing? Todos, ou uma seleção? Proposta em `specs/12-agenda.md` §3.
- [ ] **Q9** — Registrar o início da implementação e realizar a revisão de quatro semanas do ADR-014 com evidências do primeiro marco. Início registrado em 25/09/2026; revisão em 23/10/2026 ainda pendente.
