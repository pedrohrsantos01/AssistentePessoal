# Durabilidade e recuperação pós-base

Status: ready-for-agent
Blocked by: 01-conter-e-retomar-api.md

Origem: [plano confirmado](../spec.md), REQ-NFR-004 e [ADR-019](../../../docs/adr/0019-recuperacao-operacional-sem-perda-de-confirmacoes.md).

## Critérios de aceite

Base física anterior a confirmações; WAL síncrono em receptor independente; perda do primário e reconstrução preservam dados confirmados, incluindo cauda parcial. Cancelamento/timeout/replay não produzem falsa confirmação. Cadeia incompleta não é liberada.

## Fronteiras e validação

HTTP/Session/AccountStore públicos, SQLite/PostgreSQL reais e fronteiras operacionais externas, aprovadas com o plano. Testes de negócio não consultam tabelas privadas. Checks de CLAUDE.md e relatório com limites obrigatórios. Sem UI provisória, compra ou publicação externa por inferência.

## Resultado

Concluída: sim — 02/10/2026.

## Comments

02/10/2026: plano confirmado; executar respeitando dependências. Somente o recorte 1 foi iniciado.


### Entregue em 02/10/2026

Barreira de publicação antes/depois das rotas, marcador vazio com flush local/feedback do receptor síncrono e slot designado; erros de início/commit incerto retornam 503. Base física verificada, receptor contínuo e preparação isolada por alvo/pausa. Cinco WalRecoveryTests reais provam perda abrupta, cauda parcial, contas/senha/tombstone/XP/recibos, cancelamento/timeout sem falsa confirmação, falta de espaço, recusa de base/cauda corrompida ou ausente e segunda perda atravessando timeline com a base original. Dono operacional sem superprivilégio e sem estatísticas no runtime também verificado.

App typecheck/lint + 94 testes; API check 58 aprovados/1 nativo ignorado. [Relatório e limites](../../../docs/analises/2026-10-02-wal-e-recuperacao-fisica.md), [procedimento](../../../api/ops/wal-recovery.md). Prova local; RPO/RTO externos e inventário/seleção de alvo conservador fora do primário permanecem pendentes. Próximo: tarefa 03; M1 continua aberto.
