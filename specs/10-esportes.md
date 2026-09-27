# spec/10 — Esportes

**Prioridade:** Fase 2A. **Não implementar antes do fim da Fase 1.**

Este módulo foi cortado na v2.0 do PRD e reinstaurado na v2.1 — ver ADR-001 para o raciocínio completo. O que mudou não foi o módulo, foi a escala: para um usuário com dois ou três times, a arquitetura é trivial.

---

## 1. O que entra

Acompanhamento dos times favoritos do usuário: próximos jogos, notificação em tempo quase real de eventos da partida, resultado e tabela.

**Não entra:** todos os jogos de todos os campeonatos, estatística avançada, notícia de clube (isso é o módulo Notícias, com feed do time), fantasy, aposta.

## 2. Provedor de dados

**REQ-ESP-001 — [DECISÃO PENDENTE]** Escolher em spike de 1 dia entre API-Football (api-sports.io), football-data.org e TheSportsDB, avaliando: cobertura de Brasileirão, Copa do Brasil e Libertadores; latência real de atualização de eventos; limite do tier gratuito; e — para o caso comercial — se o contrato permite redistribuição.

**REQ-ESP-002** — O provedor fica atrás de uma **interface de domínio** (`SportsProvider`), com implementação trocável. Provedor de dados esportivos é a dependência mais instável do projeto: preço muda, cobertura muda, API é descontinuada. Nunca acople o app diretamente.

**REQ-ESP-003** — Cache agressivo no Postgres: calendário, times e tabela são buscados uma vez por dia. Só partida ao vivo é consultada com frequência.

## 3. Tempo real — a arquitetura honesta

O PRD original prometia 5 segundos. Isso não depende de nós: depende de quando o provedor publica o evento. **A meta é 60 segundos** a partir do momento em que o evento aparece na API.

```
@Scheduled (a cada 1 min)
   └─▶ SportsPollService
        ├─ há partida de time favorito ao vivo? (consulta o próprio banco)
        │    └─ não → retorna em ~5ms, custo zero
        └─ sim → busca eventos no provedor
                 ├─ diff contra eventos já conhecidos
                 └─ evento novo → Expo Push para os dispositivos do usuário
```

**REQ-ESP-004 — Polling só durante partida ao vivo**, com janela de 10 minutos antes do apito e 20 minutos depois do fim previsto. Fora disso, o cron retorna imediatamente sem chamar o provedor. É isto que mantém o custo em zero na maior parte do ano.

**REQ-ESP-005 — Sem Redis, sem broker, sem worker dedicado.** `@Scheduled` + Expo Push. Se um dia houver milhares de usuários, aí sim se reavalia — e nem então o gargalo seria fila, seria quota do provedor.

**REQ-ESP-006 — Deduplicação de evento obrigatória.** Chave única `(match_id, event_type, minute, player_id)`. Poll repetido não pode notificar o mesmo gol duas vezes. Esta é a falha número um de app de placar.

## 4. Notificações

**REQ-ESP-007** — Tipos, cada um ligável e desligável individualmente: início da partida, gol, cartão vermelho, intervalo, fim de jogo, escalação divulgada, lembrete 1h antes do jogo.

**REQ-ESP-008 — Retratação de evento.** Se o provedor remover um evento (gol anulado no VAR, correção de marcador), o app envia uma notificação de correção e atualiza o placar. Notificação de retratação **não** é opcional: já mandamos "GOL" para o celular do usuário, ele precisa saber.

**REQ-ESP-009 — Modo silencioso de jogo.** Opção "estou assistindo": suspende notificações de gol durante a partida, para não entregar o lance antes da TV, que costuma ter 30 a 60 segundos de atraso. Mantém só o resumo no fim.

**REQ-ESP-010** — Notificação de esporte **ignora** o silêncio noturno (REQ-GAM-021), porque jogo de Libertadores às 23h é o caso de uso. Mas isso é configurável.

## 5. Dados e tela

`favorite_teams` (`team_id` do provedor, `name`, `crest_url`, `is_primary`), `matches` (cache), `match_events` (com a constraint de dedupe), `push_tokens` (`user_id`, `expo_token`, `device_id`, `last_seen_at`).

Telas: lista de próximos jogos, tela de partida ao vivo com linha do tempo de eventos, tabela do campeonato, seleção de times nas configurações e no onboarding.

## 6. Edge cases mapeados

1. **Gol anulado no VAR depois do push** → REQ-ESP-008
2. Partida adiada, suspensa ou abandonada → status próprio, notificação de mudança, polling encerrado
3. Prorrogação e pênaltis → eventos com tipo distinto; o placar de pênaltis não soma ao placar normal
4. Confronto de ida e volta → mostrar agregado quando o provedor fornecer; se não fornecer, **não calcular por conta própria**
5. Dois times favoritos jogando no mesmo horário → notificações identificam o time no título; nunca ambíguo
6. Dois times favoritos jogando **entre si** → uma única partida, sem notificação duplicada
7. Off-season → sem jogo, card do Briefing some, polling zerado
8. Times homônimos (São Paulo FC vs São Paulo Crystal) → seleção por escudo e campeonato, nunca só por nome
9. Provedor fora do ar durante a partida → app mostra "dados indisponíveis" no card ao vivo, sem inventar placar; retoma quando voltar
10. Mudança de fuso do usuário durante viagem → horário de jogo sempre exibido no fuso atual do dispositivo, com o fuso indicado
11. Token de push inválido (app reinstalado) → limpar em resposta ao erro do Expo, para não acumular tokens mortos
12. Usuário sem nenhum time favorito → módulo inteiro fica oculto, incluindo o card do Briefing
13. Partida que o provedor esquece de encerrar → timeout de 3h após o início força o encerramento do polling

## 7. Fora de escopo

Vídeo, narração, estatística avançada, múltiplos esportes além de futebol no v1, comparação entre jogadores, notificação de mercado de transferências, qualquer integração com casa de aposta.
