# Durabilidade e recuperação pós-base

Status: ready-for-agent
Blocked by: 01-conter-e-retomar-api.md

Origem: [plano confirmado](../spec.md), REQ-NFR-004 e [ADR-019](../../../docs/adr/0019-recuperacao-operacional-sem-perda-de-confirmacoes.md).

## Critérios de aceite

Base física anterior a confirmações; WAL síncrono em receptor independente; perda do primário e reconstrução preservam dados confirmados, incluindo cauda parcial. Cancelamento/timeout/replay não produzem falsa confirmação. Cadeia incompleta não é liberada.

## Fronteiras e validação

HTTP/Session/AccountStore públicos, SQLite/PostgreSQL reais e fronteiras operacionais externas, aprovadas com o plano. Testes de negócio não consultam tabelas privadas. Checks de CLAUDE.md e relatório com limites obrigatórios. Sem UI provisória, compra ou publicação externa por inferência.

## Resultado

Concluída: não.

## Comments

02/10/2026: plano confirmado; executar respeitando dependências. Somente o recorte 1 foi iniciado.
