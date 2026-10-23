# Plano de execução — Fase 1

**Revisão em 25/09/2026:** o primeiro marco foi aprovado em R2-Q9 e detalhado em R6-Q27 da [entrevista](.scratch/fundacao/entrevista.md). Sua [especificação de entrega](.scratch/primeiro-marco/spec.md) referencia o contrato técnico e os impedimentos restantes. A sequência antiga é inventário em revisão; não é uma ordem obrigatória e não autoriza adiar sync para depois do primeiro módulo.

Entregue **em fatias verticais**: cada entrega termina com comportamento verificável de ponta a ponta. Uma etapa preparatória isolada não equivale ao aceite do primeiro marco.

Ao iniciar uma fatia, leia `CLAUDE.md` e o spec citado.

## Primeiro marco aprovado — conta, hábito diário, Briefing mínimo e sync

**Objetivo:** Pedro usa o recorte no iPhone 16e e confirma a mesma conta no emulador Android, com persistência local e convergência real. Agenda, tarefas e voz permanecem na Fase 1 e chegam em incrementos seguintes; a investigação de voz pode ocorrer cedo.

**Q65, 21/10/2026:** para este aceite, iPhone16e passa a usar a PWA no Safari/Tela de Início e Android mantém o app React Native. Instalação/links/validação nativa iOS ficam na [entrega posterior](.scratch/aceite-m1/issues/05-validar-ios-nativo.md), sem bloquear M1 funcional. Persistência e limitações web seguem spec/14; gates Android e operacionais existentes permanecem.

| Cenário de aceite | Resultado exigido |
|---|---|
| Entrar na mesma conta nos dois clientes | Dados associados à conta correta, respeitando o isolamento de usuários |
| Interromper onboarding ou pular primeiro hábito | Retomar o passo; Briefing útil com ação de criar hábito |
| Criar um hábito binário diário e registrar seu cumprimento sem rede | Alterações locais imediatas e XP provisório visíveis no Briefing mínimo |
| Fechar e reabrir o app antes de sincronizar | Hábito, registro e pendências preservados |
| Reconectar e sincronizar com o segundo cliente | Ambos convergem sem perda ou duplicação; duas marcações do mesmo hábito/dia produzem um cumprimento e uma concessão de XP |
| Desfazer concorre com marcação; depois remarcar conscientemente | Aplicar ADR-017; restaurar prêmio original sem consumir o teto novamente |
| Sair offline com pendências e autenticar online na mesma conta | Pendências recuperadas conforme ADR-016, sem expiração automática |
| Servidor rejeitar definitivamente uma alteração | Conteúdo recuperável e aviso discreto conforme REQ-SYN-017 |

Conta, onboarding, hábito binário diário, XP básico, persistência, sync e Briefing mínimo precisam ser exercitados juntos. Comportamentos de onboarding/concorrência estão definidos; [spec/13](specs/13-contrato-primeiro-marco.md) concretiza a proposta técnica, com cenários de falha, e spec/00 §12 mapeia os dados. Schemas executáveis, versões compatíveis e validação real ainda são necessários; nenhum desses documentos comprova implementação.

**Dependência visual atualizada em 10/10/2026:** protótipo recebido e direção consolidada em [spec/11](specs/11-design-system.md); o [recorte 01 de interface](docs/analises/2026-10-09-interface-primeira-jornada.md) implementa a primeira jornada nativa sobre o núcleo existente. O [recorte 02](docs/analises/2026-10-09-interface-gestao-de-habitos.md) também entrega gestão/edição/ordem/exclusão com offline e API real. [Sessão e abertura (03)](docs/analises/2026-10-10-interface-sessao-e-recuperacao-local.md) e [resultados de sync (04)](docs/analises/2026-10-10-interface-resultados-de-sincronizacao.md) concluídos localmente com ensaios Android visíveis. Próximo recorte: recuperação de senha (05), conforme os [recortes M1](.scratch/interface-m1/spec.md). A matriz integral nos aparelhos e a operação externa continuam pendentes. Níveis, ofensivas, proteções, conquistas, Agenda, tarefas e voz não são exigidos antes deste marco.

**Revisão de prazo:** registrar a data de início da implementação e revisar o resultado após quatro semanas conforme ADR-014. Implementação iniciada em **25/09/2026, 18:22**; revisão em **23/10/2026**, registrada na tarefa 04. A revisão não troca automaticamente o backend por BaaS.

**Validação da Fase 1:** o aceite deste recorte não inicia automaticamente os 30 dias das métricas completas do PRD.

## Trilha adicional — PWA do M1, planejada em 21/10/2026

Q61–Q65 aprovam alvo, política web e nova combinação de clientes em [spec/14](specs/14-pwa-primeiro-marco.md). React Native continua; o aceite nativo iOS é posterior conforme Q65. Planejamento e prova técnica01 local executados; não houve migração do nativo/publicação. A PWA viabiliza o caminho de uso sem a distribuição nativa iOS adiada em Q55.

Sequência proposta: prova delimitada de portabilidade/armazenamento → fechamento dos contratos do navegador → primeira jornada vertical com API real → estados e gestão completos → atualização/concorrência/recuperação → validação visual e acessibilidade → publicação e aceite web. As [tarefas locais](.scratch/pwa-m1/spec.md) detalham dependências e resultados verificáveis. A [prova01](docs/analises/2026-10-21-prova-tecnica-pwa.md) foi concluída no aceite delimitado local: React/Vite/Dexie/Workbox, Chrome visível, commit/rollback, reabertura offline e abas/suspensão. Próximo recorte: [02 — fechar contratos web](.scratch/pwa-m1/issues/02-fechar-contratos-do-navegador.md), ainda needs-info para HTTPS público e evidência Safari física. Contrato02a e servidor09 já foram aplicados; adapters/schemaV1/coordenação10 têm [relatório de prova local](docs/analises/2026-10-23-prova-coordenacao-web.md), sem aceitar a jornada de produto. O [pacote local11](web/ops/https-iphone.md) prepara hospedagem e roteiro02c; o [cliente técnico12](.scratch/pwa-m1/issues/12-preparar-controles-do-ensaio-iphone.md) fornece os controles por toque e artefato separado para o ensaio físico02c. Domínio/ambiente e participação no aparelho permanecem pendentes. A [ADR-020](docs/adr/0020-pwa-com-frontend-web-proprio.md) mantém a escolha aprovada; o ensaio não aceita M1 ou iPhone.

Safari, Tela de Início e Android convergem pelos contratos existentes; banco local não é transferido automaticamente. A prova web alimentará o aceite conjunto M1, sem aceitar build nativo iOS ou iniciar os 30 dias da Fase1 completa. Domínio/DNS/Resend e operação externa seguem nas tarefas existentes, sem contratação por este plano. [Análise e alternativas](docs/analises/2026-10-21-plano-pwa-m1.md).

## Inventário anterior — decomposição e dependências em revisão

Os identificadores de fatia abaixo foram preservados para rastrear os documentos anteriores. Não executar esta lista como sequência fechada. Sync e Briefing mínimo já foram antecipados pelo marco aprovado; os demais recortes ainda precisam de revisão de dependências e critérios de aceite.

---

### Fatia 0A — Fundação do backend
**Objetivo:** API sobe no Coolify, banco existe, backup restaurado com sucesso.
- Java 21 + Spring Boot 4.1.1 + Spring Modulith 2.1.1, apenas módulos necessários ao recorte, `ModularityTests` no CI
- Postgres em container, Flyway com o schema de `spec/00`, RLS ativada e role sem `BYPASSRLS`
- Deploy no Coolify, TLS, segredos, Postgres **não** exposto à internet
- **REQ-NFR-004: restaurar o backup num container limpo e subir a API contra ele.** Esta é a condição de saída, não um extra
- `GET /api/v1/health` respondendo em HTTPS
- **Pronto quando:** `./gradlew check` passa, a API está no ar e o backup foi restaurado com sucesso uma vez

### Fatia 0B — Fundação do app
**Objetivo:** app roda, banco local existe, CI verde.
- Escrever `specs/11-design-system.md` com os tokens fechados **antes** de qualquer tela (depende da Q5)
- Expo + TS strict + Expo Router + NativeWind + tokens de tema
- `expo-sqlite` + Drizzle, migration a partir do mapeamento local de `spec/00` §12, sem copiar tabelas privadas do servidor
- Jest configurado, CI no GitHub Actions
- **Pronto quando:** `pnpm test` e `pnpm typecheck` passam e o app abre em tela vazia

### Fatia 1 — Conta
**Spec:** 01
- Backend: cadastro, login, hash de senha, JWT curto + refresh rotacionado e revogável, Bucket4j no login
- Interceptor que aplica `SET LOCAL app.user_id` por transação
- **Teste de vazamento entre usuários** — usuário A não enxerga dado de B (`CLAUDE.md` §5)
- App: telas de cadastro e login, token em `expo-secure-store`, logout preservando pendências isoladas sem expiração automática; reentrada exige autenticação online como a conta de origem (ADR-016; spec/01)
- **E-mail e senha apenas** (ADR-011). **Sem modo convidado** (ADR-010)
- Onboarding de 5 telas, retomável
- **Pronto quando:** dá para entrar, sair e voltar sem perder dado local, e o teste de vazamento passa

### Fatia 2 — Hábitos, caminho feliz
**Specs:** 02, 00
- Criar hábito binário diário, tela de gestão, marcar e desmarcar
- Repositório local e uso offline, com sync exercitado junto ao primeiro hábito no marco aprovado
- Testes de domínio de `day_key`
- **Pronto quando:** dá para usar o app de verdade por um dia inteiro

### Fatia 2.5 — Agenda
**Spec:** 12
- OAuth do Google server-side, refresh token cifrado, escopo `calendar.readonly`
- Sincronização incremental por `syncToken`, canal de `watch` com renovação, fallback de 15 min
- Seleção de calendários, tela de agenda, tratamento de recorrência e cancelamento
- **Pronto quando:** seus compromissos reais de hoje aparecem corretos, inclusive os recorrentes

### Fatia 3 — Briefing
**Specs:** 08, 11
- Registro de providers, error boundary por card, carregamento progressivo
- Cards de saudação, agenda, hábitos e tarefas, acionáveis no próprio card
- **É a home do app** e absorve a antiga tela Hoje (ADR-009)
- Direção Q5 consolidada em 09/10/2026; seguir spec/11 e os recortes M1. A validação visual/nativa continua necessária
- **Pronto quando:** dá para viver o dia inteiro sem sair da home, e adicionar um card novo é registrar um provider

### Fatia 4 — Engine de gamificação
**Spec:** 04
- `xp.ts`, `streak.ts`, `level.ts` como funções puras, com 100% de cobertura
- `xp_events` com idempotência e teto diário
- Ofensiva por hábito e global, com congelamento
- UI de XP, nível e ofensiva na home
- **Pronto quando:** `streak.test.ts` cobre todos os casos do spec/04 §8

### Fatia 5 — Sincronização
**Ordem substituída:** a fundação de sync integra o primeiro marco; esta posição histórica não permite adiar sua implementação. A ampliação para outros módulos acompanha cada entrega correspondente.
**Spec:** 06
- Fila de mutações, push, pull incremental, tombstones, resolução de conflito
- Testes de reinício no meio do push e de log duplicado
- **Pronto quando:** dois dispositivos (ou dois simuladores) convergem sem perda

### Fatia 6 — Tarefas, caminho feliz
**Spec:** 03
- CRUD, listagem por grupo, conclusão com XP
- Sem recorrência ainda
- **Pronto quando:** substitui o app de tarefas atual do Pedro no uso diário

### Fatia 7 — Recorrência e prazo
**Spec:** 03 §REQ-TAR-005/006
- Subconjunto de RRULE, ocorrência única aberta, editar "esta" vs "esta e as próximas"
- **Pronto quando:** os 10 edge cases de `spec/03 §3` têm teste

### Fatia 8 — Notificações locais
**Specs:** 02 §REQ-HAB-008, 03 §REQ-TAR-010
- **Comece pela spike REQ-HAB-008b** em aparelho real: a ação rápida consegue registrar sem abrir o app?
- Orçamento de 64 notificações repartido (40 hábitos / 24 tarefas), com agrupamento no estouro
- Agendamento, reagendamento a cada foreground, silêncio noturno
- **Pronto quando:** lembretes chegam corretamente por 7 dias seguidos em teste real

### Fatia 9 — Assistente por texto
**Spec:** 05
- Edge function `/assistant`, contrato de 7 tools, validação Zod no cliente, confirmação, desfazer, auditoria
- Teste de injeção de prompt
- **Pronto quando:** "cria tarefa de pagar o boleto amanhã" funciona ponta a ponta

### Fatia 10 — Assistente por voz
**Spec:** 05 §3
- Spike de STT para decidir Q2, gravação, transcrição editável, fallback
- Instrumentar a métrica de 6 s (p75)
- **Pronto quando:** a métrica é medida em uso real por uma semana

### Fatia 10.5 — Acabamento do Briefing
**Spec:** 08
- Card de fechamento do dia, notificação de briefing matinal, reordenação e ocultação de cards
- Virada do dia lógico com o app aberto (REQ-GAM-008a)

### Fatia 10.9 — Acabamento geral
**Spec:** 07
- Estados vazio/erro/carregando revisados, acessibilidade, i18n, Sentry, PostHog
- Exportação e exclusão de conta
- Revisão de **toda** string contra REQ-GAM-017
- **Pronto quando:** o checklist de Definition of Done do `CLAUDE.md` passa em todas as telas

---

## Ordem que **não** funciona

Não faça: "todo o backend", depois "todas as telas", depois "o sync". O primeiro marco exercita o caminho completo; contratos de fatos e de gamificação precisam ser compatíveis desde a fundação. O inventário anterior será decomposto a partir desse marco, sem tratar sua numeração histórica como ordem de entrega.

## Portão de validação

**30 dias de uso real da Fase 1 completa antes de promover a fase.** Meça contra as metas do `PRD.md` §4, incluindo voz. O primeiro marco parcial não inicia automaticamente essa medição nem impede concluir os demais incrementos da Fase 1.

Se o app não segurou 25 dos 30 dias, **não adicione Notícias nem Esportes** — eles vão mascarar o problema com novidade em vez de resolver. Investigue o core primeiro.

---

# Fase 2A — Consumo

Só começa depois do portão acima.

### Fatia 11A — Notícias: segurança e fontes
**Spec:** 09 §3 e §4
- Cadeia de validação de URL completa: formato, SSRF por IP resolvido, Safe Browsing, TLS, limites de busca, typosquatting
- Descoberta de feed, prévia antes de aceitar, catálogo curado inicial
- Tela de gestão de fontes no perfil; reverificação de 7 dias
- **Faça esta fatia antes da coleta.** Testes de SSRF em `news.security.test.ts` são o critério de aceite, não um extra
- **Pronto quando:** todos os casos 1 a 4 do spec/09 §10 têm teste passando

### Fatia 11B — Notícias: coleta, classificação e entrega
**Spec:** 09 §2, §5, §6, §7
- Taxonomia, seleção de temas no onboarding e nas configurações
- `@Scheduled` a cada 2h, deduplicação, corroboração, retenção de 30 dias
- Classificação + 3 bullets numa chamada, com schema validado e regra antialucinação
- Score de relevância, diversidade, card de 3 a 5 itens no Briefing
- Isolamento do resumidor (sem tools) e teste de injeção de prompt
- **Pronto quando:** você lê seu briefing de manhã no app em vez de abrir 5 sites

### Fatia 12 — Push remoto
**Spec:** 10 §3
- Expo Push, tabela `push_tokens`, limpeza de token inválido
- Edge function de envio, com teste de entrega em dispositivo real
- **Pronto quando:** um push disparado por cron chega no aparelho de forma confiável

### Fatia 13 — Esportes
**Spec:** 10
- Spike de provedor (REQ-ESP-001), interface `SportsProvider`
- Seleção de times, calendário, tabela
- Polling só durante partida ao vivo, dedupe de evento, retratação de VAR
- Cards de jogo hoje / ao vivo / resultado no Briefing; modo "estou assistindo"
- **Pronto quando:** um jogo inteiro do seu time é acompanhado sem nenhuma notificação duplicada, errada ou perdida

### Fatia 14 — Custo e estabilidade
- Dashboard de custo somando IA do assistente, resumo de notícias e chamadas ao provedor esportivo
- Alerta se qualquer um passar do orçamento mensal definido
- **Pronto quando:** você sabe quanto o app custa por mês sem abrir o console de ninguém
