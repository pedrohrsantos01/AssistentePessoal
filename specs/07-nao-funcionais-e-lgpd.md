# spec/07 — Requisitos não funcionais, privacidade e LGPD

---

## 1. Desempenho

| Métrica | Meta |
|---|---|
| Cold start até o Briefing interativo | ≤ 2,0 s (aparelho mediano Android) |
| Resposta visual ao marcar hábito | ≤ 100 ms |
| Toque no FAB → registro salvo por voz | ≤ 6 s (p75) |
| Busca em 5.000 tarefas | ≤ 200 ms |
| Tamanho do app | ≤ 60 MB |
| Consumo de bateria em uso normal | sem processo em background além de notificação local |

Listas sempre virtualizadas (`FlashList`). Nenhuma query síncrona na thread de UI.

## 2. Confiabilidade

- Crash-free sessions ≥ 99,5%
- Perda de dado do usuário: **zero tolerância**. É o único tipo de bug que justifica hotfix imediato
- **Backup: é seu agora.** Backup agendado do Postgres pelo Coolify, com retenção de 30 dias e destino fora do próprio VPS
- **REQ-NFR-004 — Restauração testada.** Restaurar o dump num container limpo e subir a API contra ele é item do **Definition of Done da Fatia 0**, não boa intenção. Backup que ninguém restaurou não é backup. Repetir o teste a cada release maior
- Adicionalmente, exportação local em JSON a cada 7 dias no armazenamento do dispositivo

## 3. Observabilidade

- **Sentry** para crash e erro, com breadcrumb das últimas ações e **sem PII** no payload
- **PostHog** para produto, com os eventos mínimos: `app_opened`, `onboarding_completed`, `habit_created`, `log_created` (com `source`), `task_completed`, `assistant_invoked`, `assistant_action_confirmed`, `assistant_action_reverted`, `level_up`, `streak_broken`, `sync_failed`
- Dashboard semanal de custo de IA (REQ-IA-016)
- Nenhum evento carrega título de tarefa, de hábito ou conteúdo de transcrição

## 4. Segurança

- **Isolamento por usuário em três camadas** — filtro no repositório, RLS no Postgres, teste de vazamento por módulo. Ver `CLAUDE.md` §5 e spec/00 §10. Com backend próprio, esta é a superfície de risco número um
- JWT de acesso curto (15 min) + refresh rotacionado e revogável; tokens em `expo-secure-store`
- Senha com hash forte (argon2id ou bcrypt com custo adequado). Nunca MD5, SHA, nem hash sem sal
- **Bucket4j** em todo endpoint exposto, com limite por `user_id` e por IP no login (defesa contra força bruta)
- Bean Validation em **toda** entrada de API. Nunca confiar no cliente
- Refresh token do Google Calendar cifrado em repouso, chave nos secrets do Coolify
- TLS gerenciado pelo Coolify; HSTS ativo; porta do Postgres **não** exposta à internet
- Certificate pinning e SQLite local criptografado: fora do v1
- Dependências auditadas no CI (`pnpm audit` e `./gradlew dependencyCheckAnalyze`), build falha com vulnerabilidade alta

## 5. LGPD

O app trata **dado pessoal** e, com a Fase 2, passará a tratar **dado sensível de saúde** e financeiro. As obrigações abaixo valem desde o v1.

| Obrigação | Como cumprimos |
|---|---|
| Base legal | Consentimento (art. 7º, I) para uso do app e consentimento **separado e específico** para envio de conteúdo ao provedor de IA |
| Finalidade e minimização | Só coletamos o necessário para as funções descritas no PRD. Nada de coleta "por garantia" |
| Acesso e portabilidade | Exportação em JSON (REQ-CTA-012) |
| Eliminação | Exclusão de conta no app, com job próprio de exclusão física em até 30 dias (REQ-CTA-011). Com backend próprio, o job é responsabilidade sua: precisa ter teste e monitoramento |
| Transparência | Política de privacidade em pt-BR, em linguagem simples, acessível dentro do app e antes do cadastro |
| Subprocessadores | Listar explicitamente: provedor de VPS, Google (Calendar), provedor de LLM, provedor de STT, Sentry, PostHog — com país de processamento |
| Transferência internacional | Declarada, já que LLM e infraestrutura processam fora do Brasil |
| Incidente | Plano escrito de resposta e comunicação à ANPD e ao titular |
| Menores | O app **não** é destinado a menores de 18 anos no v1; declarado nos termos |

**REQ-NFR-001** — Nenhum dado do usuário é usado para treinar modelo, nosso ou de terceiro. Isso é declarado na política e verificado na configuração do provedor (opt-out de treinamento).

**REQ-NFR-002** — Analytics não recebe conteúdo, apenas eventos e metadados.

**REQ-NFR-003 — Consentimento de analytics.** Telemetria de produto (PostHog) exige **opt-in explícito**, apresentado junto do consentimento de IA no onboarding, com recusa possível e sem penalidade. Registrar em `users.analytics_consent_at`. Crash reporting (Sentry) roda sob legítimo interesse por ser essencial à segurança do serviço, é declarado na política e também é desligável nas configurações. Sem consentimento, **nenhum** evento é enviado — nem anonimizado.

## 6. Acessibilidade

- Alvo de toque ≥ 44 pt
- Contraste mínimo WCAG AA (4,5:1 em texto normal)
- `accessibilityLabel` e `accessibilityRole` em todo controle
- Suporte a fonte grande do sistema sem quebra de layout até 200%
- Nada comunicado só por cor (hábito cumprido tem ícone, não só cor)
- Suporte a `prefers-reduced-motion`: celebrações viram estado estático
- VoiceOver e TalkBack testados nos fluxos de marcar hábito e concluir tarefa

## 7. Internacionalização

pt-BR apenas no v1, mas **sem string hardcoded**. Datas, números e plurais via `Intl`. Nenhuma concatenação de frase que impeça tradução futura.

## 8. Qualidade e entrega

**Ambientes de validação inicial (24/09/2026, entrevista R1-Q2):** iPhone 16e do Pedro para uso real e emulador Android como segundo cliente de teste. Esses ambientes devem comprovar a convergência da mesma conta. Versões dos sistemas e o caminho de build/distribuição serão definidos na preparação técnica.

- Cobertura mínima: **100%** em `features/*/domain/` e `core/sync/`; 60% no restante
- E2E no Maestro para: onboarding completo, criar e marcar hábito, criar e concluir tarefa, registro por voz, ciclo offline → online
- CI no GitHub Actions: app (typecheck, lint, teste) e API (`./gradlew check`, incluindo `ModularityTests`)
- Deploy da API pelo Coolify a partir do repositório; migrations Flyway aplicadas no start
- Distribuição do app via EAS Build; TestFlight e canal interno da Play Store
- Feature flags simples por tabela de config remota, para desligar a IA sem publicar nova versão

## 9. Escala alvo

V1: 1 usuário, numa VPS. Arquitetura preparada para alguns milhares sem reescrita — Spring Modulith com fronteiras explícitas é justamente o que permite extrair um módulo depois, **se** um dia precisar. **Não otimize além disso.** Nenhum cache distribuído, nenhuma fila, nenhum microserviço, nenhum Kubernetes na Fase 1.
