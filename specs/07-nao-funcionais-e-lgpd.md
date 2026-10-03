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

### 2.1 Ensaio de backup/restauração — 30/09/2026

[Procedimento local](../api/ops/backup-restore.md) e [evidência de REQ-NFR-004](../docs/analises/2026-09-30-backup-e-restauracao.md): dump custom completo, checksum, banco destino vazio, grupos/logins separados recompostos, ACLs/RLS e histórico Flyway preservados, API real iniciada após encerrar a origem. Verificar dados de conta/hábito/XP, recibos, tombstones, isolamento e envio de intenções SQLite ainda não confirmadas no corte. Não sobrescrever backup nem limpar automaticamente banco destino ocupado.

O ensaio local não provisiona backup agendado, destino externo ou retenção de produção. Esses requisitos de §2 continuam obrigatórios antes da operação externa.

### 2.2 Recuperação pós-corte — Q33–Q43, confirmada em 02/10/2026

[ADR-019](../docs/adr/0019-recuperacao-operacional-sem-perda-de-confirmacoes.md) e [plano de execução](../.scratch/recuperacao-operacional/spec.md): RPO zero para transações confirmadas pela API na perda total da VPS primária, com WAL durável em destino independente antes da confirmação; RTO alvo até 24 h para reconstrução, restauração, verificações e reabertura. Sem fallback assíncrono; indisponibilidade do receptor pode impedir confirmação remota.

Base física completa e dump lógico diários às 03:00, America/Sao_Paulo; WAL contínuo. A retenção de 30 dias de §2 significa **janela PITR recuperável**, incluindo base âncora e WAL necessários anteriores ao início da janela. Expurgo por dependência. Ensaio integral mensal e por release major, com integridade, API e duração verificadas.

Quarentena bloqueia todas as rotas de clientes até comprovar completude. Conta local ativa conserva leitura, novas intenções, SQLite e envelopes. Não instalar snapshot antigo nem reenviar acknowledged para reconstruir perdas. Após recuperação integral, invalidar access/refresh, sessões e links antigos e exigir novo login, preservando senha correta e dados locais. Detalhamento de contenção/reativação em spec/13 §19.

Alertas por e-mail com detector fora da VPS primária: probes 60 s/duas falhas consecutivas; backup físico ou lógico válido >26 h; execução falha imediatamente; disco 80% aviso/90% crítico. Configuráveis, com e-mail na abertura/agravamento/resolução, sem repetição do mesmo estado. Segredos/configurações sensíveis e eventuais chaves em cofre externo aos servidores, acessível após perder a VPS; documentos contêm só referências.

**Implementação e aceite em andamento:** o dump já testado não comprova RPO zero pós-corte. [Recorte 2 local](../docs/analises/2026-10-02-wal-e-recuperacao-fisica.md) comprovou WAL síncrono/cauda/timelines e recusa de confirmação sob cancelamento/timeout/falta de espaço, com recuperação física e API real. [Configuração e limites](../api/ops/wal-recovery.md): RITMO_REQUIRE_WAL obrigatório na exposição; a barreira não verifica a base/retencão. [Incremento 3 local](../docs/analises/2026-10-02-ciclo-operacional-de-backups.md) concretiza inventário/seleção de alvo fora do primário, agenda, expurgo e detector/alertas em [jobs finitos](../api/ops/operations.md). A prova não instala cron/supervisor/monitor externo nem aceita SMTP/PITR/RTO de produção; esses critérios permanecem no incremento 4. Fornecedor/custos/acessos/configuração reais ficam para provisionamento após a prova local. Manter a operação externa bloqueada até esses critérios passarem. O [preparo do recorte 4](../api/ops/external-provisioning.md) organiza inventário/custos, pacote, instalação isolada e aceite; Q44 confirmou VPS Hostinger/Campinas e Q46 informou Resend; Q47 autorizou artefatos locais no perfil A e adiou fornecedores/orçamento; Q48 escolheu Bitwarden Free. [Relatório local](../docs/analises/2026-10-02-preparacao-do-provisionamento.md). Não configura nem aceita o ambiente externo.

A [imagem local da API](../api/ops/container-deployment.md) concretiza a primeira parte de 4B: build na raiz com contrato/migrations, Java 21 fixado, execução sem privilégios e WAL/quarentena ativos por padrão. [Prova por Docker/PG/HTTP e checks completos](../docs/analises/2026-10-02-imagem-de-implantacao-da-api.md). Os pacotes de supervisão e agenda nativas têm provas locais; transporte privado/detector têm [prova local](../docs/analises/2026-10-03-transporte-privado-do-probe.md); proxy/TLS e todas as provas externas continuam pendentes; a imagem sozinha não aceita REQ-NFR-004 externo nem M1.

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

### 4.1 Rate limiting do primeiro marco — Q32, 30/09/2026

Valores iniciais aprovados, configuráveis por ambiente:

| Escopo | Capacidade e reposição | Identidade |
|---|---|---|
| Rotas autenticadas da API | 120/minuto | `user_id` do JWT validado, compartilhado entre aparelhos/rotas |
| Toda a API `/api/v1/` | 300/minuto | IP do peer, inclusive requisições inválidas/recusadas |
| Login | 10/minuto | IP |
| Cadastro | 5/minuto | IP |
| Solicitar recuperação | 3/15 minutos | IP, sem distinguir existência do e-mail |
| Confirmar recuperação | 10/minuto | IP |
| Refresh / revoke | 60/minuto cada | IP, buckets independentes |

Bucket4j usa capacidade inicial cheia e reposição contínua (greedy). Cada requisição custa um token; um push com até 50 operações continua sendo uma requisição. Requisições recusadas não alteram dados de domínio, credenciais ou recibos nem descartam fila. Cotas da API e do endpoint são cumulativas; trocar endereço/e-mail/dispositivo no corpo não cria orçamento novo. Rotas anônimas não inferem conta de campos enviados.

Excesso retorna HTTP 429, `rate_limited` e `Retry-After` em segundos inteiros arredondados para cima. Não dormir/bloquear a thread para esperar reposição. O app conserva intenções e segue o backoff existente. A resposta de recuperação continua uniforme para conta existente/inexistente.

Implementação inicial local em memória, uma instância de API conforme §9. Reinício de processo restaura a capacidade inicial; não representa quota persistente nem proteção distribuída. Armazenamento de buckets é limitado, sem evicção antecipada de dívida: pressão de cardinalidade recusa novas identidades com 503/Retry-After até haver espaço seguro. Não gravar IP/credenciais/payload em logs/banco/memória durável.

Por padrão, cabeçalhos de IP encaminhado não são confiáveis: a origem é o peer TCP. Identificação por proxy depende de configuração explícita de peers confiáveis no recorte operacional antes da exposição externa. Não aceitar IP arbitrário de `X-Forwarded-For`, `Forwarded` ou campo do corpo.

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


## Evidência de contenção e retomada — 02/10/2026

Recorte 1 local de REQ-NFR-004 concluído: quarentena, preparação de credenciais e retomada preservando SQLite/pendências comprovadas por HTTP/PostgreSQL/SMTP/SQLite reais. [Relatório e limites](../docs/analises/2026-10-02-contencao-e-retomada-operacional.md). Em quarentena, spec/13 §19 prevalece sobre a cobrança normal de quotas: resposta 503 antes dos filtros de requisição. Durabilidade pós-base/WAL, RPO/RTO medidos e operação externa continuam pendentes.

03/10/2026 — supervisão local 4B: [serviço/controle nativos](../api/ops/receiver-supervision.md) com inibição persistente, verificação de supervisor/filho/UID/cgroup/escritor e guarda exclusiva durante todo o freeze. [Ensaios reais e limites](../docs/analises/2026-10-03-supervisao-do-receptor-wal.md) cobrem reconexão/crash, perda do primário, Stop/Start/reboot, congelamento/restauração, impostor e erro de armazenamento. A agenda tem prova local no incremento seguinte; transporte/detector/proxy e todo o aceite externo continuam pendentes; REQ-NFR-004/M1 não estão encerrados.


03/10/2026 — agenda nativa local 4B: [pares service/timer e evidências privadas](../api/ops/linux-scheduling.md) executam jobs finitos por minuto, preservam exclusão/Persistent/boot e falhas/tentativas sem término até reconhecimento. Probe/detector verificam ausência de agenda e falha de execução, com regras Q42 e dedupe. [Ensaios e limites](../docs/analises/2026-10-03-agenda-operacional-linux.md). Transporte privado, vigilância do detector/canal, proxy/TLS, instalação e todo o aceite externo permanecem pendentes; REQ-NFR-004/M1 abertos.
