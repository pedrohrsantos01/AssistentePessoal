# Backup, retenção e alertas

Status: ready-for-agent
Blocked by: 02-provar-wal-pos-corte.md

Origem: [plano confirmado](../spec.md), REQ-NFR-004 e [ADR-019](../../../docs/adr/0019-recuperacao-operacional-sem-perda-de-confirmacoes.md).

## Critérios de aceite

Implementar/testar agenda e cadeia Q38/Q39, retenção por dependência, detector e deduplicação Q40/Q42, procedimento e ensaio Q41 com segredos referenciados Q43. Não afirmar provisionamento externo.

## Fronteiras e validação

HTTP/Session/AccountStore públicos, SQLite/PostgreSQL reais e fronteiras operacionais externas, aprovadas com o plano. Testes de negócio não consultam tabelas privadas. Checks de CLAUDE.md e relatório com limites obrigatórios. Sem UI provisória, compra ou publicação externa por inferência.

## Resultado

Concluída: não.

## Comments

02/10/2026: plano confirmado; executar respeitando dependências. Somente o recorte 1 foi iniciado.
