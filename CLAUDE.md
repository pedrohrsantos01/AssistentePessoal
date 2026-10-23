# CLAUDE.md — Instruções do projeto

**Ritmo** — assistente pessoal modular. App React Native, fundação PWA em provas locais e backend Java/Spring Modulith, rodando em VPS própria via Coolify.

**Leia sempre nesta ordem:** este arquivo → `PRD.md` → o spec do módulo da tarefa atual em `specs/`.

---

## 1. Regras invioláveis

1. **Não implemente nada fora da fase atual.** O não-escopo está em `PRD.md` §5. Se a tarefa parecer exigir um módulo de fase futura, **pare e pergunte**.
2. **Não invente requisito.** Se o spec não define o comportamento, procure `[DECISÃO PENDENTE]`. Se não houver, **pergunte** — não escolha sozinho e não deixe `TODO` silencioso.
3. **Não invente tabela, coluna ou campo.** O modelo de dados é `specs/00-modelo-de-dados.md`. Mudança exige migration Flyway nova e atualização do spec no mesmo commit.
4. **Nenhuma consulta sem filtro de usuário.** Toda query de domínio filtra por `user_id`, sempre, sem exceção. Ver §5.
5. **Toda escrita do app passa pela camada local.** Nenhum componente React, nativo ou web, chama a API direto. Ver `specs/06-sincronizacao.md`.
6. **Nenhuma chave de API no cliente.** LLM e STT só pelo backend.
7. **Nenhuma string de UI hardcoded.** Tudo em `src/i18n/pt-BR.ts`, mesmo com um idioma só.
8. **Nenhum `any` no TypeScript, nenhum `Object`/raw type no Java.** TS em `strict`.
9. **Nada de valor visual literal.** Cor, espaçamento, fonte e raio só pelos tokens (`specs/11-design-system.md`).
10. **Fatia vertical, não camada.** "Hábito funcionando ponta a ponta com teste", não "todo o backend, depois todas as telas".
11. **Teste junto, não depois.** Regra de negócio nasce com teste no mesmo commit.
12. **Uma sessão, uma tarefa delimitada.** A tarefa pode atravessar app e backend quando isso for necessário para seu comportamento de ponta a ponta. Evite mudanças sem relação entre si; a separação de linguagens não autoriza adiar sync nem substituir a entrega vertical por camadas isoladas.

## 2. Stack

### App (`/app`)
- Expo (managed) + React Native + TypeScript strict
- Expo Router, NativeWind v4, Reanimated 4 e Gesture Handler nas versões compatíveis com SDK 57
- Zustand (estado de UI) + TanStack Query (só para dado remoto não-local)
- `expo-sqlite` + **Drizzle ORM** para persistência local
- `expo-notifications` (locais) e Expo Push (remotas, a partir da Fase 2A)
- `expo-secure-store` (token), `expo-web-browser` (abrir link); áudio será selecionado no incremento de voz, sem instalar o antigo `expo-av` no primeiro marco
- Sentry (erro) e PostHog (produto, com opt-in)

### PWA (frontend web próprio; provas técnicas em `/web`, produto ainda pendente)
- React DOM + TypeScript strict + Vite + React Router, conforme [ADR-020](docs/adr/0020-pwa-com-frontend-web-proprio.md), aceito em 21/10/2026
- IndexedDB com Dexie para persistência local; Workbox para o service worker/cache de recursos
- HTML/CSS com tokens, textos e referência Ritmo-App; lógica pura/contratos compartilhados quando desacoplados
- API Java existente e hospedagem estática; Expo Web, expo-sqlite web e Dexie Cloud não integram essa variante
- Q67–Q69 aprovadas no [ADR-021](docs/adr/0021-fronteira-de-sessao-e-armazenamento-web.md): mesma origem HTTPS; credenciais em cookies HttpOnly/Secure fora do JS; controle+domínio no mesmo IndexedDB com partição por conta e aparência em banco separado. Sessão opaca escolhida em Q71/ADR-022; contrato02a especificado em [contracts/pwa-m1](contracts/pwa-m1/README.md) e spec/00, com servidor/V6 aplicados no recorte09 e prova local de cookies/autorização; adapters IndexedDB/coordenação implementados no recorte10 em prova local; jornada de produto e Safari continuam pendentes; nativo permanece bearer/SQLite
- Q70–Q74 no [ADR-022](docs/adr/0022-sessao-opaca-e-entrada-por-instalacao-web.md): instalação nova exige login online próprio, sessão opaca no Java, rascunho somente na aba; sessão remota30dias de inatividade/90dias absolutos e até quatro contextos locais. Não reaproveitar cookie copiado sem controle local nem persistir rascunho como intenção de domínio. Expiração remota preserva sessão local ainda ativa e pendências; limite de contextos pausa nova entrada até recuperação, sem descartar intenções
- A [prova01](docs/analises/2026-10-21-prova-tecnica-pwa.md) fixa versões e verifica o ensaio local no Chrome; não aceita Safari físico ou jornada M1. Servidor/V6 estão no recorte09; adaptersV1, abas e atualização têm a prova local do recorte10, com [relatório próprio](docs/analises/2026-10-23-prova-coordenacao-web.md). A jornada de produto e o aceite físico continuam seguindo spec/14. O [pacote HTTPS/iPhone11](web/ops/https-iphone.md) contém referências locais de hospedagem e roteiro físico; não publica o build técnico. Não copiar APIs síncronas de Drizzle ou SecureStore para o navegador

### Backend (`/api`)
- **Java 21 + Spring Boot 4.1.1 + Spring Modulith 2.1.1**. Revisão técnica de 25/09/2026: Boot 3.5 encerrou suporte aberto; a arquitetura Java/Spring permanece, sem código legado a migrar
- **Spring AI** para orquestração de LLM: templates de prompt, tool calling e troca de provedor
- Spring Security com **JWT stateless** (access + refresh)
- **PostgreSQL** em container, migrations com **Flyway**
- **Bucket4j** para rate limiting nos endpoints expostos
- `@Scheduled` (ou Quartz, se precisar de persistência de job) para coleta de notícias e polling esportivo
- Bean Validation em **toda** entrada de API e em **toda** saída de LLM destinada ao banco

### Infra
- VPS própria com **Coolify**: deploy por Docker, proxy reverso, TLS, segredos e backup agendado do Postgres
- Um serviço para a API, um para o Postgres, ambos no Coolify

Baseline completa, fontes e comandos futuros: [stack e build do primeiro marco](docs/analises/2026-09-25-stack-e-build-primeiro-marco.md). Expo 57.0.25 / React Native 0.86.3 / React 19.2.3 / TypeScript 6.0.3 / Drizzle 0.45.3 são versões selecionadas para resolver e testar no scaffold; resolvidas nos lockfiles da aplicação em 25–26/09/2026. Spring AI e módulos futuros não entram como dependências vazias do M1.

## 3. Estrutura de pastas

```
/app                          # React Native
  src/
    app/                      # rotas (Expo Router)
    features/
      briefing/               # registro de card providers
      habits/  tasks/  agenda/
      gamification/domain/    # xp.ts, streak.ts, level.ts — puro
      assistant/
    core/
      db/ sync/ notifications/ telemetry/
    ui/ theme/ i18n/

/api                          # Spring Modulith
  src/main/java/dev/ritmo/
    RitmoApplication.java
    shared/                   # tipos e utilitários compartilhados
    identity/                 # usuário, auth, JWT
    habits/                   # um módulo Modulith por domínio
    tasks/
    agenda/
    gamification/
    aiorchestrator/
    sync/
  src/main/resources/db/migration/    # Flyway

/specs
```

**Regra de módulo (Spring Modulith):** cada pacote expõe uma API pública pequena para comandos/consultas e publica eventos de aplicação. Nunca acessar serviço interno ou repositório de outro módulo. No primeiro marco, aceitação do hábito, efeito obrigatório de XP e recibo precisam participar da mesma transação; listener assíncrono após commit não cumpre essa garantia (spec/13 §1/5). O teste `ModularityTests` com `ApplicationModules.of(RitmoApplication.class).verify()` verifica as fronteiras no CI.

**Regra de domínio no app:** `features/*/domain/` não importa de `app/`, nem de `core/db`. Regra de negócio é função pura que recebe dados e devolve dados.

## 4. Convenções

- **IDs**: entidades criadas pelo app usam UUID v7 gerado no cliente. Um UUID não garante sozinho idempotência entre aparelhos: cumprir o mesmo hábito/dia, reenviar uma contribuição e restaurar XP têm identidades próprias conforme ADR-017 e `specs/00-modelo-de-dados.md` §11. O mapeamento físico e as entidades de origem exclusiva do servidor ainda estão em revisão; não inventar exceções silenciosamente.
- **Datas**: instantes são armazenados em UTC; prazos sem hora representam datas civis, preservadas ao mudar de fuso (`specs/03-tarefas.md`, R4-Q18). Hábitos e XP usam `day_key` (`YYYY-MM-DD`) calculado no fuso e início de dia do perfil. Não confundir a virada civil de tarefas com o dia lógico, nem derivar `day_key` de um timestamp UTC numa query. Agenda e meta devem respeitar a vigência histórica do ADR-018.
- **Dinheiro** (Fase 2B): `long` em centavos. Nunca `double`, nunca `float`.
- **Nomes**: `snake_case` no banco, `camelCase` no TS, `camelCase` no Java com `@Column` explícito.
- **API**: versionada em `/api/v1/{modulo}`. Quebra de contrato exige `/v2`, nunca alteração silenciosa.
- **Enums**: `text` com `check` no Postgres, string union no TS, enum Java. **Nunca** enum nativo do Postgres.
- **Exclusão e retenção**: entidades mutáveis sincronizadas usam `deleted_at`; fatos, recibos e transições seguem o contrato próprio de `specs/00-modelo-de-dados.md` §12. Todos os envelopes do feed, incluindo tombstones, têm retenção de 90 dias (Q49); expurgo automático diário, configurável e em lotes limitados (Q50). Preservar o feed após H dos snapshots válidos e não apagar o registro mínimo necessário para impedir ressurreição por aparelho antigo. Exclusão de conta abrange todas essas representações.
- **Commits**: Conventional Commits citando o ID do requisito — `feat(habits): marca hábito como feito (REQ-HAB-004)`. Código e testes da mesma intenção ficam juntos. Para documentação ou infraestrutura sem requisito de produto, cite a tarefa/documento de origem com `Refs:` no corpo, sem inventar ID. Detalhes em [Git e commits](docs/agents/git.md).

## 5. Isolamento de dados — leia com atenção

Sem Supabase não há RLS automática. O isolamento passa a ser responsabilidade sua, e é onde um agente vaza dado entre usuários sem ninguém perceber.

**Defesa em três camadas, todas obrigatórias:**

1. **Filtro no repositório.** Nenhum método de repositório aceita buscar sem `userId`. Proibido `findById(id)` em entidade de domínio — só `findByIdAndUserId(id, userId)`.
2. **RLS no Postgres também.** As tabelas têm `ENABLE ROW LEVEL SECURITY` com policy sobre `current_setting('app.user_id')`, e um interceptor executa `SET LOCAL app.user_id = ?` no início de cada transação autenticada. Postgres puro tem RLS — não é exclusividade de BaaS, e aqui ela é a rede de segurança para quando a camada 1 falhar.
3. **Teste de vazamento.** Para cada módulo, um teste que autentica como usuário A e tenta ler o dado do usuário B, esperando 404 ou lista vazia. Módulo sem esse teste não passa no Definition of Done.

## 6. Comandos

```bash
# app
pnpm typecheck
pnpm lint
pnpm test
pnpm contracts:generate
pnpm db:bundle

# api
./gradlew bootRun
./gradlew test              # inclui ModularityTests
./gradlew check
docker compose up -d db     # Postgres local
```

**Antes de dizer que terminou:** no app, `pnpm typecheck && pnpm lint && pnpm test`. Na API, `./gradlew check`. Sem exceção.

Nos testes Android, abrir o emulador e o acompanhamento com janelas visíveis para Pedro. Abrir apenas durante os testes e encerrar ao terminar os processos/janelas iniciados pelo agente, inclusive em falha; preservar processos preexistentes. Preferência confirmada em 08/10/2026.

O app possui a entrada do produto com Expo Router e a primeira jornada e a gestão de hábitos sobre o núcleo local; os harnesses técnicos continuam separados por flags/pacotes. Os checks de app/API são executáveis. Teste visível: `scripts/verify-android-journey.ps1`; comandos efetivos e variantes nos READMEs de app/API. Desenvolvimento persistente continua sujeito ao Termbaker; geração automática de schema não foi adicionada.

## 7. Definition of Done

- [ ] Todos os critérios de aceite do spec passam
- [ ] Teste unitário da regra de negócio; teste de componente da tela; **teste de vazamento entre usuários** (§5)
- [ ] Funciona **offline** e sincroniza ao voltar
- [ ] Estados de carregando, vazio e erro implementados — nada de tela branca
- [ ] Acessível: `accessibilityLabel` em todo controle, alvo de toque ≥ 44pt
- [ ] Migration Flyway aplicada e spec atualizado, se o schema mudou
- [ ] `ModularityTests` verde
- [ ] Sem warning novo

## 8. Como perguntar

Ao travar por ambiguidade, responda neste formato e pare:

```
BLOQUEIO: <requisito>
Ambiguidade: <o que o spec não define>
Opções: (a) ... (b) ...
Recomendo: <a ou b> porque <razão>
```

## Agent skills

### Issue tracker

Especificações de entrega e tarefas são acompanhadas em Markdown local, sob `.scratch/<feature>/`. Ver `docs/agents/issue-tracker.md`.

### Triage labels

Usamos os cinco rótulos padrão de Matt Pocock. Ver `docs/agents/triage-labels.md`.

### Domain docs

Um glossário de domínio em `CONTEXT.md` e decisões arquiteturais em `docs/adr/`, criados conforme as definições forem resolvidas. As decisões existentes no PRD continuam válidas. Ver `docs/agents/domain.md`.

<!-- termbaker:start (auto-managed by Termbaker. Do not edit inside these markers) -->
See @TERMBAKER.md for the capabilities of this Termbaker environment.
<!-- termbaker:end -->

## Memória entre sessões

O vínculo ai-memory, as instruções de continuidade e as skills gerenciadas estão em [AGENTS.md](AGENTS.md). Leia essa seção ao retomar trabalho. Configuração e validação: [guia local](docs/agents/ai-memory.md).


## Recuperação operacional

[ADR-019](docs/adr/0019-recuperacao-operacional-sem-perda-de-confirmacoes.md) acrescenta receptor de WAL/destino independente para preservar confirmações na perda da VPS primária, sem ampliar módulos de domínio. Antes de qualquer API sobre dados recuperados, ativar quarentena externa ao banco; liberação exige recuperação integral, invalidação de sessões/links e chave nova conforme spec/13 §19. Provisionamento e garantia externa continuam sujeitos aos ensaios do plano de recuperação.
