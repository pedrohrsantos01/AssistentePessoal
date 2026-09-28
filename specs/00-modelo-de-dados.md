# spec/00 — Modelo de dados

Este é o contrato de schema **da Fase 1**. **Nenhuma tabela ou coluna da Fase 1 pode ser criada fora daqui.** As tabelas dos módulos de Fase 2A estão nos specs dos respectivos módulos (`09-noticias.md` §8, `10-esportes.md` §5) e só entram quando aquela fase começar. Mudança exige migration + atualização deste arquivo no mesmo commit.

**Estado da revisão — 25/09/2026:** §§1–10 preservam o inventário anterior da Fase 1, ainda incompleto. Os invariantes aprovados em §11 são vinculantes; §12 propõe a representação do primeiro marco e explicita as substituições necessárias. Não gerar migrations diretamente do inventário antigo. Quantidades, recorrência e proteção de ofensivas ainda exigem desenho próprio em seus incrementos. Não há aplicação nem migrations nesta etapa documental.

SQLite e Postgres têm **representações diferentes ligadas por contratos explícitos** (§12). Credenciais são exclusivas do servidor/SecureStore; intenções pendentes pertencem ao aparelho; fatos canônicos são replicados por projeções permitidas. UUID e instantes usam tipos nativos no Postgres e texto no SQLite; diferenças não se limitam aos tipos.

Migrations do backend são Flyway, em `/api/src/main/resources/db/migration/`. Migrations locais do app são Drizzle. As duas evoluem **no mesmo commit** quando uma mudança afeta os dois armazenamentos; uma tabela privada do servidor não exige uma cópia local.

As tabelas do módulo Agenda estão em `specs/12-agenda.md` §7; as dos módulos de Fase 2A, nos specs 09 e 10.

---

## 1. Convenções de todas as tabelas

Toda tabela de domínio tem:

| Coluna | Tipo | Regra |
|---|---|---|
| `id` | uuid v7 | gerado no cliente para entidades criadas pelo app; entidades exclusivas do servidor ainda exigem delimitação |
| `user_id` | uuid | FK → `users.id`; base de toda policy RLS |
| `created_at` | timestamptz | UTC |
| `updated_at` | timestamptz | UTC; atualizado em toda escrita |
| `deleted_at` | timestamptz null | soft delete |
| `sync_version` | integer | incrementa a cada escrita; usado na reconciliação |

---

## 2. Conta

### `users`
| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid | UUID v7 gerado no cadastro |
| `email` | text | |
| `display_name` | text | |
| `timezone` | text | IANA, ex. `America/Belem`. **Fonte da verdade do dia lógico** |
| `day_start_hour` | int | default `4`. Ver glossário do PRD |
| `plan` | text | `free` \| `pro`. Sempre `free` no v1 (ADR-006) |
| `onboarded_at` | timestamptz null | |
| `streaks_enabled` | boolean | default `true`. Usuário pode desligar ofensiva inteira |
| `ai_consent_at` | timestamptz null | consentimento para envio de conteúdo ao provedor de LLM |
| `analytics_consent_at` | timestamptz null | opt-in de telemetria de produto (REQ-NFR-003) |
| `password_hash` | text | bcrypt/argon2. Nunca sai da camada de identity |

---

## 3. Hábitos

### `habits`
| Coluna | Tipo | Notas |
|---|---|---|
| `title` | text | |
| `icon` / `color` | text | |
| `type` | text | `binary` \| `quantitative` \| `negative` |
| `target_amount` | numeric null | só para `quantitative` (ex.: 2 de água) |
| `unit` | text null | ex. `L`, `páginas`, `min` |
| `schedule_kind` | text | `daily` \| `weekdays` \| `times_per_week` \| `interval` |
| `weekdays` | int[] | `[1..7]`, ISO (1=segunda). Só para `weekdays` |
| `times_per_week` | int null | só para `times_per_week` |
| `interval_days` | int null | só para `interval` (ex.: a cada 3 dias) |
| `reminder_times` | text[] | `["07:30","21:00"]`, hora local |
| `archived_at` | timestamptz null | hábito pausado, some do Briefing mas mantém histórico |
| `sort_order` | int | |

### `habit_logs`
| Coluna | Tipo | Notas |
|---|---|---|
| `habit_id` | uuid | |
| `day_key` | text | `YYYY-MM-DD` no fuso do usuário |
| `status` | text | `done` \| `skipped` \| `partial` |
| `amount` | numeric null | total diário do hábito quantitativo, derivado das contribuições vigentes; não substitui a representação dos lançamentos individuais |
| `logged_at` | timestamptz | quando de fato registrou (pode ser retroativo) |
| `source` | text | `manual` \| `assistant_text` \| `assistant_voice` \| `notification` |

**Constraint crítica:** `unique (habit_id, day_key) where deleted_at is null`.
Ela impede múltiplas linhas ativas para o mesmo hábito/dia, mas não garante sozinha a idempotência de XP nem preserva lançamentos de aparelhos diferentes. Desmarcar e remarcar não pode criar outra identidade lógica de cumprimento. O contrato de §11 deve orientar a revisão dessa representação.

### `habit_streaks` (cache derivado, nunca fonte da verdade)
`habit_id` (PK), `current_streak` int, `longest_streak` int, `last_done_day_key` text, `freezes_used_this_month` int, `computed_at`.

**Revisão exigida por R5-Q22 e R6-Q24:** `freezes_used_this_month` por hábito não representa a cota aprovada. Proteções pertencem à conta e ao dia lógico protegido; a cota é mensal e uma unidade pode cobrir várias séries. Correção que elimina toda necessidade de proteção devolve a unidade ao mês original (REQ-GAM-011a). A estrutura física fica para o incremento de ofensivas; o comportamento retroativo já foi decidido.

> Recalculável a partir dos fatos de hábitos, regras vigentes e proteções canônicas; somente `habit_logs` não basta para as decisões aprovadas. Deve existir um comando `recomputeStreaks(userId)` usado em teste e em recuperação.

---

## 4. Tarefas

### `tasks`
| Coluna | Tipo | Notas |
|---|---|---|
| `title` | text | |
| `notes` | text null | |
| `status` | text | `todo` \| `doing` \| `done` \| `canceled` |
| `priority` | text | `none` \| `low` \| `medium` \| `high` |
| `due_at` | timestamptz null | instante do prazo com hora; não representa sozinho a data civil de um prazo sem hora |
| `due_is_all_day` | boolean | `true` = só data civil importa, sem horário; sua representação separada ainda deve ser incorporada ao schema conforme R4-Q18 |
| `parent_task_id` | uuid null | subtarefa (1 nível apenas no v1) |
| `recurrence_rule` | text null | RRULE (RFC 5545), subconjunto suportado em `specs/03-tarefas.md` §4 |
| `recurrence_parent_id` | uuid null | aponta para a tarefa-modelo da série |
| `completed_at` | timestamptz null | |
| `sort_order` | int | |

### `task_tags` e `tags`
`tags`: `name`, `color`. `task_tags`: `task_id`, `tag_id` (PK composta).

---

## 5. Gamificação

### `xp_events` — concessões com valor preservado; reversão/restauração em revisão
| Coluna | Tipo | Notas |
|---|---|---|
| `amount` | int | sempre positivo |
| `source_type` | text | `habit_log` \| `task_completion` \| `streak_milestone` \| `achievement` |
| `source_id` | uuid | referência à origem canônica; deve identificar o mesmo fato lógico após reconciliação e desfazer/refazer, sem depender de IDs locais concorrentes |
| `day_key` | text | dia lógico em que o XP contou |
| `module` | text | `habits` \| `tasks` — usado no teto diário por módulo |

**Constraint crítica de idempotência:** `unique (user_id, source_type, source_id)`.
Reprocessar o mesmo fato não pode gerar XP em dobro; a constraint exige que o mapeamento da origem canônica já esteja resolvido. Desfazer um registro **não** apaga a concessão. Refazer restaura o valor e o dia originais sem consumir novamente o teto (REQ-GAM-003a). A representação do histórico dessas transições ainda precisa ser definida; o campo de estado abaixo não é sozinho uma trilha de histórico.

| `reverted_at` | timestamptz null | quando o evento de origem foi desfeito |

XP válido = `sum(amount) where reverted_at is null`.

### `achievements` (catálogo, seed estático) e `user_achievements`
`achievements`: `code` (único, ex. `streak_7`), `title`, `description`, `icon`, `xp_reward`, `criteria` (jsonb).
`user_achievements`: `achievement_id`, `unlocked_at`, `day_key`. `unique (user_id, achievement_id)`.

### `user_progress` (cache derivado)
`user_id` (PK), `total_xp`, `level`, `xp_into_level`, `xp_to_next_level`, `global_streak_days`, `computed_at`.

---

## 6. Assistente

### `assistant_actions` — trilha de auditoria, obrigatória
| Coluna | Tipo | Notas |
|---|---|---|
| `conversation_id` | uuid | |
| `input_mode` | text | `text` \| `voice` |
| `transcript` | text null | o que o STT entendeu |
| `tool_name` | text | ex. `create_task` |
| `tool_args` | jsonb | argumentos exatos |
| `status` | text | `proposed` \| `confirmed` \| `executed` \| `rejected` \| `reverted` |
| `entity_type` / `entity_id` | text / uuid null | o que foi criado ou alterado |
| `before_snapshot` | jsonb null | estado anterior, para desfazer |
| `error` | text null | |
| `model` | text | modelo usado |
| `tokens_in` / `tokens_out` | int | para controle de custo |
| `latency_ms` | int | |

### `ai_usage_quota`
`user_id`, `period_day_key`, `requests_count`, `tokens_total`, `stt_seconds`.

---

## 7. Infra de sincronização

### `sync_mutations` (só local, nunca sobe como tabela)
`id`, `entity_type`, `entity_id`, `operation` (`insert`|`update`|`delete`), `payload` jsonb, `created_at`, `attempts`, `last_error`, `status` (`pending`|`sent`|`failed`).

### `sync_state` (só local)
`last_pulled_at`, `device_id`.

---

## 8. Diagrama de relações

```
users 1──n habits 1──n habit_logs
users 1──n tasks  1──n tasks (subtarefa / recorrência)
users 1──n xp_events ──> (habit_logs | tasks | achievements)
users 1──1 user_progress
users 1──n user_achievements n──1 achievements
users 1──n assistant_actions
```

## 9. Índices obrigatórios

- `habit_logs (user_id, day_key)` — monta o card de hábitos do Briefing
- `habit_logs (habit_id, day_key)` — cálculo de ofensiva
- `tasks (user_id, status, due_at)` — listagem principal
- `xp_events (user_id, day_key, module)` — teto diário de XP
- O pull do primeiro marco usa `(user_id, revision)` no feed de §12; `updated_at` isolado não é um cursor seguro

## 10. Isolamento (Postgres puro)

Sem BaaS, o isolamento é responsabilidade da aplicação — com RLS como rede de segurança. Ver `CLAUDE.md` §5 para as três camadas obrigatórias.

- Toda tabela de domínio: `ENABLE ROW LEVEL SECURITY` com policy `using (user_id = current_setting('app.user_id')::uuid)`
- Um interceptor de transação executa `SET LOCAL app.user_id = ?` a partir do JWT, no início de toda transação autenticada
- A conexão da aplicação **não** usa role superusuário, senão a RLS é ignorada silenciosamente. Role dedicada, sem `BYPASSRLS`
- Migrations rodam com role separada, essa sim com privilégio de DDL
- `xp_events`: a aplicação nunca altera o valor ou dia da concessão original; a representação de reversão/restauração deve preservar o histórico (REQ-GAM-003a)
- Cada módulo tem teste de vazamento entre usuários (Definition of Done)

## 11. Invariantes aprovados para a revisão do modelo

Origem: [ADR-017](../docs/adr/0017-reconciliacao-de-registros-e-correcoes.md), [ADR-018](../docs/adr/0018-vigencia-das-regras-de-habitos.md) e respostas R3–R6/Q29 de 25/09/2026. Esta seção fixa o comportamento a representar, não introduz tabelas implicitamente.

| Conceito | Garantia exigida |
|---|---|
| Cumprimento diário | Uma identidade lógica por conta, hábito e dia, preservada na reconciliação e no ciclo desfazer/refazer |
| Lançamento quantitativo | Cada contribuição intencional é distinguível e conta uma vez; sua reversão retira apenas aquela contribuição |
| Marcação após desfazer | Distinguir a ação que já incorporou a correção de outra concorrente que a desconhecia; horário isolado não prova essa relação |
| Edição de campos | Preservar mudanças em campos independentes e validar grupos de campos relacionados |
| Concessão de XP | Uma identidade por fato elegível canônico, com valor e dia preservados em reversão/restauração e sem novo consumo do teto |
| Envio repetido | Retry não é nova ação, contribuição ou concessão, mesmo após reconciliação |
| Ordem de aceitação | No mesmo campo concorrente, prevalece a última alteração aceita pelo servidor; retries não recebem nova posição e a sequência conhecida precisa ser respeitada |
| Agenda e meta | Após aceitação pelo servidor, regra geral no próximo dia lógico e transições de agenda semanal na próxima segunda-feira lógica; preservar regras históricas e não ativar proposta offline antecipadamente (Q25/Q29) |
| Tipo e unidade | Fixos após o primeiro registro; mudança de significado exige novo hábito, sem converter o histórico (Q26) |
| Prazo sem hora | Data civil preservada após mudança de fuso; o modelo precisa distingui-la de um instante UTC |
| Prazo com hora | Instante preservado ao mudar o fuso de exibição; não usar a data de prazo como dia lógico automático do XP |
| Posição de série recorrente | Posições puladas consomem o limite previsto; geração concorrente/retry não duplica sucessora, e desfazer precisa preservar trabalho posterior (REQ-TAR-005a/b) |
| Proteção de ofensiva | Cota por conta/mês e consumo por dia lógico compartilhado; devolver ao mês original apenas quando nenhuma série depender da proteção; sem acúmulo, cumprimento ou XP |
| Hábito negativo | Distinguir ausência de recaída, registro explícito de resistência e recaída; apenas o explícito origina os 10 XP diários e conta como registro para a global |

Antes de fechar o schema, definir a representação e as constraints correspondentes, o mapeamento local/servidor e os resultados de confirmação do sync. Escolhas de tabelas, IDs físicos e algoritmos são responsabilidade de engenharia; qualquer mudança no comportamento acima exige decisão explícita. O resto das lacunas da auditoria permanece em acompanhamento.

## 12. Proposta de representação do primeiro marco

**Baseline de engenharia m1.1**, vinculada ao [contrato técnico](13-contrato-primeiro-marco.md) e aos [contratos executáveis](../contracts/primeiro-marco/README.md). O [DDL Postgres](../contracts/primeiro-marco/postgres.sql) e o [DDL SQLite](../contracts/primeiro-marco/sqlite.sql) concretizam esta seção; são contratos de referência, ainda não migrations Flyway/Drizzle aplicadas à aplicação. O primeiro marco usa hábitos binários diários e XP básico. Não criar tabelas vazias para todos os módulos futuros.

### 12.1 Propriedade, identidade e tipos

- `accountId` no protocolo corresponde a `users.id` e a `user_id` nas tabelas. `users` é a raiz: não tem FK `user_id` para si mesma.
- Entidades criadas offline e operações usam UUID v7 gerado no app. Contas, sessões, estados diários canônicos e concessões são identificados pelo servidor. Seus IDs não são segredos nem concedem acesso.
- A identidade do cumprimento é `(user_id, habit_id, day_key)`. Um `habit_day_id` canônico, atribuído uma vez pelo servidor, referencia essa chave em XP. O cliente usa a chave composta antes do primeiro ack e incorpora o ID sem criar outro cumprimento.
- FK entre dados de uma conta inclui `user_id`: uma referência a `habit_id`, recibo ou desfazer de B não pode ser ligada a A. Não confiar somente em UUID globalmente único.
- Revisões são inteiros de 64 bits no servidor; no JSON, usar **strings decimais**, evitando perda de precisão no JavaScript. Comparar como inteiros, nunca lexicalmente. `day_key` é data lógica, não instante; preservá-la como `YYYY-MM-DD`.
- `created_at`/`updated_at` e tombstones pertencem às entidades mutáveis; fatos, recibos e transições não recebem soft delete genérico. Eles exigem retenção/exclusão própria. As colunas comuns de §1 não são copiadas cegamente para toda tabela.

### 12.2 Postgres: escrita canônica e dados privados

Todas as linhas privadas de domínio têm `user_id`, isolamento e índices por conta. Campos abaixo são específicos além dessa propriedade. `revision` representa a aceitação na conta, compartilhada por todos os efeitos da mesma transação.

| Tabela proposta | Campos essenciais | Chave e garantia |
|---|---|---|
| `users` | `id`, `email`, `password_hash`, `display_name`, `timezone`, `day_start_hour`, `plan`, `onboarded_at`, `analytics_consent_at`, `created_at`, `updated_at`, `deleted_at`, `revision` | PK `id`; unicidade de e-mail conforme normalização a fixar no schema de Identity. Hash nunca sai de Identity. Primeiro marco mantém `plan=free` |
| `identity_sessions` | `id`, `device_id`, `revoke_secret_hash`, `expires_at`, `revoked_at`, `created_at` | Sessão/família de refresh; segredo limitado de revogação não autentica nem permite leitura |
| `identity_refresh_tokens` | `id`, `session_id`, `token_hash`, `expires_at`, `used_at`, `revoked_at`, `replacement_id` | Hash único; consumir/rotacionar atomicamente, preservar evidência de uso; nunca persistir token em claro |
| `identity_password_resets` | `id`, `token_hash`, `expires_at`, `used_at` | Token de uso único; validade de uma hora; confirmar invalida outros links abertos da conta e revoga sessões antigas |
| `habits` | `id`, `title`, `icon`, `color`, `sort_order`, `type`, `schedule_kind`, `start_day_key`, `creation_time_context`, `created_at`, `updated_at`, `deleted_at`, `revision` | PK `(user_id,id)`; M1 aceita somente `binary/daily`; data inicial preserva criação offline. Título obrigatório e único entre ativos conforme REQ-HAB-001 e spec/02 §5, caso 11; metadados atualizados por patch |
| `habit_day_states` | `id`, `habit_id`, `day_key`, `done`, `revision` | PK `(user_id,id)`; UNIQUE `(user_id,habit_id,day_key)` **sem filtro de estado ativo**; ID preservado em desfazer/refazer. Estado recalculável dos fatos |
| `habit_binary_facts` | `operation_id`, `habit_day_id`, `kind` (`mark/unmark`), `occurred_at`, `time_context`, `accepted_revision` | PK `(user_id,operation_id)`; um fato por intenção aceita; append-only durante vida da conta |
| `habit_mark_context` | `mark_operation_id`, `undo_operation_id` | PK das três colunas com `user_id`; referências a fatos da mesma conta/dia, com tipos conferidos pelo domínio. Materializa `observedUndoIds`; sem inferir contexto por timestamp |
| `xp_award_decisions` | `source_type`, `source_id`, `outcome` (`granted/limit_reached`), `xp_event_id` nullable, `revision` | PK `(user_id,source_type,source_id)`; primeira avaliação elegível imutável. `granted` exige concessão; `limit_reached` não permite criar uma no refazer |
| `xp_events` | `id`, `source_type`, `source_id`, `amount`, `day_key`, `module`, `budget_cost`, `active`, `revision` | PK `(user_id,id)`; UNIQUE `(user_id,source_type,source_id)`; no M1 origem `habit_log` aponta a `habit_day_states.id`. Valor, dia e custo originais imutáveis; `amount>0` |
| `xp_transitions` | `operation_id`, `xp_event_id`, `kind` (`grant/reverse/restore`), `accepted_at`, `revision` | UNIQUE `(user_id,operation_id,xp_event_id)`; mudança de estado e histórico na mesma transação. Sem apagar concessão ao desfazer |
| `xp_daily_budgets` | `day_key`, `module`, `consumed`, `revision` | PK `(user_id,day_key,module)`; `consumed>=0`, derivável de concessões originais/custos; reversão/restauração não alteram consumo. Fórmula do limite em REQ-GAM-002 |
| `sync_account_state` | `last_revision`, `feed_epoch` | PK `user_id`; linha bloqueada durante cada aceitação. Revisão atribuída após lock, sem publicar operação ainda não confirmada |
| `sync_operation_receipts` | `operation_id`, `device_id`, `client_sequence`, `payload_hash`, `outcome`, `accepted_revision`, `result`, `processed_at` | PK `(user_id,operation_id)`; UNIQUE `(user_id,device_id,client_sequence)`; conteúdo e resultado imutáveis. Rejeição definitiva também tem recibo; falha transitória/dependência ausente não encerra operação |
| `sync_changes` | `revision`, `committed_at`, `envelope` | PK `(user_id,revision)`; envelope imutável com todos os efeitos e resultados públicos das operações de origem. Sem senhas/tokens/hashes privados; paginação nunca corta uma transação |
| `sync_deleted_ids` | `entity_kind`, `entity_id`, `deleted_revision` | PK `(user_id,entity_kind,entity_id)`; informação mínima impede recriação por clientes antigos após expirar o feed |

`sync_changes` e o protocolo **não** expõem tabelas inteiras. Perfil, hábito, cumprimento com contexto, concessões/transições e consumo de orçamento têm representações próprias permitidas. O orçamento consumido não é um total de XP editável pelo cliente; `user_progress` continua cache local derivado.

O feed retém tombstones por 90 dias. Recibos mínimos e IDs excluídos sobrevivem a essa janela enquanto a conta existir, sem reter payloads sensíveis desnecessários; a exclusão confirmada da conta abrange também esses dados. A compactação de fatos/contextos depende de prova de preservação da reconciliação; não descartar contexto porque seu dia é antigo.

Cadastro/login/reset antecedem a autenticação e usam repositórios privados de Identity com consultas restritas à operação. Não aceitar `user_id` externo para contornar RLS. Definir/testar a role desses acessos separadamente da role de domínio; a conexão comum não deve ser superusuária, dona das tabelas ou ter `BYPASSRLS`. Policies de domínio cobrem leitura e escrita. O DDL e seus testes devem demonstrar essa fronteira.

### 12.3 SQLite e SecureStore: cópia permitida e intenções locais

Um banco por conta, selecionado somente após autenticar o `accountId`; depois, a sessão local mantida permite uso offline. Logout fecha seu acesso e troca de conta nunca mescla bases. A identidade da instalação fica separada da identidade da conta.

| Representação local | Conteúdo e regra |
|---|---|
| `account_profile` | Somente campos públicos necessários ao app: `id`, nome, fuso/início do dia, plano, onboarding e consentimento de telemetria, com revisão. Sem `password_hash`, tokens ou segredos de revogação |
| `canonical_habits` | Snapshot confirmado dos campos de hábito de §12.2 e revisão; novas criações offline ainda não confirmadas pertencem às intenções/projeções |
| `canonical_habit_days` | Chave hábito/dia, ID canônico quando conhecido, `done`, `known_undo_ids`, revisão; as marcações pendentes conservam o contexto de quando foram feitas |
| `canonical_xp_events` / `canonical_xp_transitions` | Concessões/histórico confirmados; `amount`, dia, origem, custo, estado e revisões recebidos somente do servidor |
| `canonical_xp_decisions` | Avaliação confirmada por origem, incluindo ausência de prêmio por limite; necessária para não projetar novo prêmio no refazer |
| `canonical_xp_budgets` | Consumo confirmado por dia/módulo e revisão; base para projeção offline, nunca enviado como fato calculado pelo cliente |
| `sync_mutations` | `operation_id` PK, `device_id`, `client_sequence` único na conta/instalação, envelope e dependências, estado (`pending/in_flight/retry_wait/deferred/blocked_local/rejected/acknowledged`), `attempts`, `next_attempt_at`, erro tipado e resultado confirmado. `in_flight` volta a retry após reinício, com mesmo conteúdo/ID |
| `sync_state` | Cursor de pull opaco, versão local, próxima sequência, progresso de onboarding e referência à recuperação em curso. Ack isolado não avança cursor |
| `habit_views` / `xp_view` | Projeções de base canônica mais intenções ainda pendentes; reconstruíveis. Ação rejeitada sai da projeção aplicada, mas seu conteúdo continua recuperável na fila |
| Staging de snapshot | Outra base da mesma conta, associada a snapshot/cursor `H`; não substitui a fila. Troca apenas após validar a cópia completa, com recuperação de interrupção |
| SecureStore | Access/refresh da sessão ativa e credencial limitada de revogação pendente. SQLite contém somente referências opacas; nenhum segredo no envelope de sync |

Nas bases canônicas, comparar revisões por entidade antes de substituir dados; uma página de pull antiga não regride um fato mais novo já recebido por ack. Na aplicação da página, atualizar base, confirmações de operações, projeções e cursor atomicamente. No snapshot, consultar os recibos pendentes vinculados ao corte `H` antes de recompor a projeção (spec/13 §7). Registro local cria intenção e projeção na mesma transação. As credenciais no SecureStore exigem rotina de recuperação própria; não alegar transação atômica entre SecureStore e SQLite.

Concretização do retry em 28/09/2026: antes do push, `attempts` e `next_attempt_at` são persistidos junto ao estado `in_flight`; um reinício conserva o envelope e a espera. Até dez tentativas transitórias, usar `retry_wait` (ou `deferred` para dependência ainda ausente); ao esgotar, `blocked_local` com `error.code = retry_exhausted` representa o estado público `failed`. Esse bloqueio não é rejeição do servidor: mantém intenção e projeção pendentes. A ação explícita de tentar novamente restaura `pending`, zera tentativas/erro/prazo e conserva ID, sequência, conteúdo e dependências. Rejeições definitivas não são reativadas por essa ação. Usa os campos e estados existentes, sem mudança de schema ou migration.

Recuperação local em 28/09/2026: `error` também comporta `resolution: {kind: "discarded"}` ou `resolution: {kind: "corrected", replacementOperationId: UUID}`. Esse metadado é exclusivo do cliente, não integra erro/recibo HTTP; `result` conserva o recibo do servidor, e o envelope antigo nunca é reescrito. `rejected` identifica rejeição recebida; `blocked_local`/`dependency_rejected` identifica filha impedida localmente; `blocked_local`/`context_limit_reached` preserva intenção acima de 4096 referências, fora da projeção e do envio. A resolução retira o item dos avisos em aberto, sem apagar silenciosamente as filhas ou o histórico. Repetição de recibo preserva essa resolução.

Novas operações de correção, sequências, vínculos e projeções são gravados na mesma transação SQLite. Remapear `dependsOn`, `observedUndoIds` e o hábito de uma criação substituta, incluindo correção da filha em sessão posterior. Preservar `occurredAt` original por padrão; correção explícita pode fornecer instante corrigido, sujeito à validação normal. Nenhuma data é reinterpretada automaticamente. A implementação usa os campos existentes; não houve mudança de schema ou migration neste incremento.

Essa proposta substitui, no M1, `habit_logs` como única fonte de histórico e o antigo `sync_state.last_pulled_at` como cursor. O ID canônico preserva o papel lógico de `source_type=habit_log`; nomes físicos podem ser ajustados no DDL sem mudar o comportamento.

### 12.4 Critérios antes das migrations

1. Schemas completos dos comandos/respostas, limites de campos, normalização/hash canônicos e política para dependências rejeitadas; exemplos devem usar revisões string.
2. DDL com constraints e FKs por conta; índices para consulta do Briefing, fatos/contextos, recibos e feed. Consultas representativas e teste de isolamento das roles, incluindo escrita indevida.
3. Snapshot estável e recuperação documentados: formato/token, persistência/expiração no servidor e retomada/swap no aparelho. Não paginar uma leitura viva como se fosse snapshot consistente.
4. Fixtures compartilhadas entre domínio Java/TypeScript e migrations locais de recuperação. A proposta não prova que implementações nas duas linguagens concordam.
5. Revisar política de XP quando o saldo não comporta o prêmio nominal (§5 do contrato) antes de implementar casos que a tornem observável.

Ficam fora do schema do M1: contribuições quantitativas, versões de agenda/meta, proteções de ofensivas, séries de tarefas, Agenda, IA e notificações. As decisões de produto já aceitas para esses incrementos continuam em §11 e nos respectivos specs; não são requisitos esquecidos nem módulos autorizados a surgir incompletos.

### 12.5 Concretização da baseline m1.1

Os arquivos de contrato acima são parte deste modelo, não tabelas criadas fora dele. O DDL explicita nullability, defaults, chaves e índices. A versão refinada acrescenta:

| Representação | Detalhe físico |
|---|---|
| Normalização de conta/hábito | `users.email_key`; `habits.title_key` e `normalization_version=1`; regras em contracts/primeiro-marco/README.md |
| Contexto de marcação | `habit_mark_context.habit_day_id` participa das duas FKs, impedindo referenciar fatos de outro dia/conta; tipos mark/unmark continuam validados no domínio |
| Orçamento | `xp_daily_budgets.due_habit_count`; limite calculado por `max(150,15N)`, consumo persistido separado de XP válido |
| Recibo | `affected_keys` identifica projeções a reler num retry sem reter versões antigas de todos os payloads |
| `sync_batches` | PK `(user_id,batch_id)`, `payload_hash` SHA-256 e `created_at`; detecta corpo diferente com a mesma chave de lote, mesmo após aceitação parcial |
| `sync_snapshots` | PK `(user_id,id)`, revisão H, época do feed, expiração e quantidade de entidades; manifesto só publicado após materialização consistente |
| `sync_snapshot_items` | PK `(user_id,snapshot_id,position)` e entidade permitida em JSON; FK composta para o manifesto, exclusão ao expirar |

No SQLite, os nomes `canonical_*` de §12.3 descrevem representações lógicas. A implementação física do contrato usa `canonical_entities(account_id,kind,entity_key,revision,payload)` e `projected_views`; schemas tipados de cada `kind` continuam obrigatórios. Isso não cria uma API de CRUD genérico. `account_storage` impõe uma conta por banco e FKs impedem anexar intenções de outra conta. `snapshot_staging` reside nesse mesmo banco, permitindo trocar base/cursor/confirmações numa transação, sem depender de renomear arquivos WAL.

Um armazenamento separado de controle da instalação contém somente `selected_account_id`, `session_generation`, `session_state` (`active/logging_out/locked`) e referências opacas às chaves do SecureStore, além da identificação da instalação. Nunca contém senha ou token. Sua representação/migration é local e segue o procedimento de recuperação definido no contrato; não é sincronizado.

O DDL Postgres inclui policies de domínio com `USING` e `WITH CHECK`, mas não grants permissivos de produção. Roles, acesso pré-autenticação de Identity e seus testes fazem parte da primeira migration executável. SQL foi analisado sintaticamente; policies e transações Postgres ainda precisam ser exercitadas no banco real. SQLite foi executado em memória com verificações de constraints e rollback, sem validar o adapter Expo.

Fechamento dos itens de §12.4: schemas/exemplos e estratégia de snapshot documentados; política de saldo parcial demonstrada fora do caminho válido do M1, que só concede 10 XP por hábito diário sem reduzir N. Testes Java/TypeScript, migrations, roles e build continuam trabalho da implementação. Não marcar essa implementação concluída por ter validado os contratos.

### 12.6 Aplicação inicial de migrations e permissões

Em 25–26/09/2026, V1 Flyway e a migration 0000 Drizzle concretizaram o DDL da §12.5. V2 separou grants de `ritmo_identity` e `ritmo_domain`, ativou RLS de perfil em `users` e restringiu domínio às colunas públicas do perfil. Roles não são donas das tabelas; somente Identity acessa hashes/sessões. Migração de domínio e contexto de conta são independentes do caminho pré-autenticado. Evidências e limites: [primeiro recorte executável](../docs/analises/2026-09-26-primeiro-recorte-executavel.md). Nenhum campo de domínio adicional foi introduzido.

### 12.7 Controle local de sessão — 26/09/2026

A migration `app/drizzle-control/0000_installation.sql` cria um SQLite separado (`installation.db`). `installation_control` tem `singleton=1`, `device_id`, `selected_account_id`, `session_generation`, `session_state`, `credentials_key` e `revoke_key`. `protected_keys(key,purpose,account_id,session_id)` registra referências opacas antes de gravar no SecureStore, para limpar escritas interrompidas e manter revogações pendentes. Não armazena senha, access, refresh nem segredo de revogação; não participa de sync. A geração avança ao encerrar/ativar uma sessão; cada conjunto renovado usa outra chave protegida. IDs de conta e sessão permitem conferir o conjunto antes de reabrir a conta.

Antes de enviar refresh, `credentials_key` passa a null duravelmente; uso local permanece `active`. O novo conjunto é gravado em outra chave e só então seu ponteiro é publicado. Se a resposta se perde ou a gravação falha, o token antigo não é reutilizado após reinício: exigir login online, preservando dados locais. O registro de revogação original permanece independente desse ponteiro. Escritas de SecureStore são serializadas; o fence SQLite de logout acontece antes de qualquer espera. Falha nesse fence não é anunciada como logout concluído.

São migrations locais, sem alteração do schema do servidor; nenhuma Flyway vazia foi adicionada. Os bancos por conta existentes não são apagados nem recriados.

Recuperação concretizada em 27/09/2026 sobre `identity_password_resets` já existente na V1: token somente como hash, consumo dos links e revogação das famílias na transação da senha. Nenhuma coluna/tabela nova. [Evidências e limitações](../docs/analises/2026-09-27-recuperacao-de-senha.md).
