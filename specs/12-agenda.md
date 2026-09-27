# spec/12 — Agenda

**Prioridade:** P0 (Fase 1). Entrou nesta fase pelo ADR-013.

É o módulo que responde "o que eu tenho hoje" no Briefing. Diferente de hábitos e tarefas, ele **não pede nada ao usuário**: importa o que já existe.

---

## 1. Escopo

**Na Fase 1:** leitura do Google Calendar, exibição no Briefing e numa tela de agenda, criação de evento pelo assistente.

**Não entra na Fase 1:** edição de evento existente, convidados, salas, videoconferência, Notion (cortado pelo ADR-012), Outlook, Apple Calendar, mediação proativa (Fase 2A).

## 2. Integração com o Google Calendar

**REQ-AGD-001 — OAuth server-side.** O fluxo de consentimento é iniciado pelo app e concluído no backend. O **refresh token nunca chega ao dispositivo** — fica cifrado no Postgres, com a chave nos segredos do Coolify.

**REQ-AGD-002 — Escopos mínimos.** `calendar.readonly` na Fase 1. O escopo de escrita só é solicitado quando a criação de evento pelo assistente for ativada, em consentimento separado. Pedir escopo de escrita antes de precisar é o tipo de coisa que faz o usuário recusar a integração inteira.

**REQ-AGD-003 — Sincronização incremental.** Usar `syncToken` da API do Google. Nunca varrer o calendário inteiro a cada ciclo. Quando o Google invalida o token (erro 410), fazer uma carga completa e obter token novo.

**REQ-AGD-004 — Push do Google.** Registrar canal de notificação (`watch`) para receber aviso de mudança. O canal expira e precisa ser renovado — agendar renovação com folga de 24h antes do vencimento. Sem canal ativo, cai para `@Scheduled` a cada 15 minutos.

**REQ-AGD-005 — Renovação e revogação.** Token expirado é renovado automaticamente. Se o usuário revogar o acesso na conta Google, o módulo entra em estado `disconnected`, o card some do Briefing e aparece um aviso não-bloqueante com botão de reconectar. **Nunca** falha silenciosa.

## 3. Seleção de calendários

**REQ-AGD-006** — Após conectar, o app lista os calendários da conta e o usuário escolhe quais entram no app. Padrão: apenas o calendário primário marcado. [Q8 do PRD — confirmar se é isso mesmo.]

**REQ-AGD-007** — Calendários de aniversário, feriados e assinaturas públicas ficam **desmarcados por padrão**. Eles inflam a agenda e destroem a utilidade do card do Briefing.

## 4. Exibição

**REQ-AGD-008 — Card no Briefing.** Mostra os eventos de hoje ainda não encerrados, no máximo 4, com horário, título e local quando houver. Se o próximo evento começa em menos de 1 hora, ele aparece em destaque com contagem regressiva.

**REQ-AGD-009 — Tela de agenda.** Lista contínua por dia, com rolagem infinita para frente e 30 dias para trás. Sem visão de mês na Fase 1 — visão de mês em tela pequena mostra pouco e custa muito.

**REQ-AGD-010 — Evento de dia inteiro** aparece como faixa no topo do dia, nunca misturado na linha do tempo por horário.

**REQ-AGD-011 — Fuso.** Todo evento é exibido no fuso atual do dispositivo. Evento criado em outro fuso mostra o fuso de origem quando diferente.

## 5. Criação de evento pelo assistente

**REQ-AGD-012** — A tool `create_event` (spec/05) exige **confirmação obrigatória**, sempre. Criar compromisso na agenda de alguém sem confirmar é o tipo de erro que destrói confiança no assistente inteiro.

**REQ-AGD-013** — O evento é criado localmente primeiro, sobe para o Google na sincronização, e a resposta do Google traz o ID canônico. Enquanto não subiu, o evento aparece com marca de pendente.

**REQ-AGD-014** — Se a criação falhar no Google (escopo insuficiente, conta desconectada), o evento local é marcado como falho, com ação de tentar de novo. Nunca some sem avisar.

## 6. Relação com Tarefas

**REQ-AGD-015 — Evento não é tarefa e não vira tarefa automaticamente.** O assistente pode criar uma tarefa *a partir* de um evento se o usuário pedir, mas nada importa compromisso como item de lista. Misturar os dois transforma a agenda numa caixa de entrada e é o erro clássico de app de produtividade.

**REQ-AGD-016 — Evento não gera XP.** Comparecer a uma reunião não é conquista. Ver `specs/04-gamificacao.md`.

## 7. Modelo de dados

| Tabela | Colunas principais |
|---|---|
| `calendar_accounts` | `user_id`, `provider` (`google`), `external_account_id`, `refresh_token_encrypted`, `scopes`, `status` (`active`\|`disconnected`\|`error`), `sync_token`, `watch_channel_id`, `watch_expires_at` |
| `calendars` | `account_id`, `external_id`, `name`, `color`, `is_primary`, `is_selected` |
| `calendar_events` | `calendar_id`, `external_id`, `title`, `description`, `location`, `starts_at`, `ends_at`, `is_all_day`, `timezone`, `status` (`confirmed`\|`tentative`\|`cancelled`), `recurring_event_id`, `origin` (`google`\|`local`), `sync_status` |

**REQ-AGD-017** — `calendar_events` é **cache**, não fonte da verdade, exceto para eventos com `origin = local` ainda não sincronizados. Perder essa tabela inteira não pode causar perda de dado: basta ressincronizar.

## 8. Edge cases mapeados

1. Evento recorrente com exceção numa data (o "cancelado só naquela semana") → a API do Google entrega instâncias; armazenar instância, não a regra
2. Evento movido para outro calendário → chega como exclusão em um e criação em outro; não duplicar no Briefing
3. Evento cancelado por outra pessoa → status `cancelled`, some do card, permanece na tela de agenda riscado por 24h
4. Convite ainda não respondido → aparece com marca de `tentative`; nunca some da visão só por não ter sido aceito
5. Token revogado na conta Google → REQ-AGD-005
6. 410 no `syncToken` → carga completa, sem perder eventos locais pendentes
7. Canal de `watch` expirado sem renovação → cai para polling de 15 min, sem o usuário perceber
8. Evento de 3 dias atravessando o dia de hoje → aparece como faixa em todos os dias que atravessa
9. Calendário com 5.000 eventos futuros → sincronização incremental e janela de leitura limitada a 90 dias à frente
10. Dois dispositivos do usuário sincronizando ao mesmo tempo → a sincronização com o Google acontece **no backend**, uma vez por conta; os dispositivos só fazem pull do nosso banco
11. Usuário sem nenhum calendário selecionado → card some do Briefing, sem estado de erro
12. Evento sem horário de fim → tratar como 1 hora de duração, marcado como estimado
13. Offline → a tela de agenda funciona com o cache local; eventos criados entram na fila normal do spec/06

## 9. Fase 2A — Mediação proativa

Depois que a Agenda estiver estável, o `ai-orchestrator` passa a detectar e avisar sobre:

- **Choque de horário** entre dois eventos confirmados
- **Deslocamento inviável**: dois eventos com locais distintos e intervalo menor que o tempo de trajeto
- **Dia sobrecarregado**: mais de N horas de compromisso, sem intervalo para as tarefas do dia
- **Conflito com hábito**: compromisso ocupando o horário habitual de um hábito com ofensiva ativa

**REQ-AGD-018** — Mediação **sugere, nunca age.** Nenhum reagendamento acontece sem o usuário confirmar.

**REQ-AGD-019** — No máximo **uma** notificação de mediação por dia, entregue no briefing matinal, não em tempo real ao longo do dia.
