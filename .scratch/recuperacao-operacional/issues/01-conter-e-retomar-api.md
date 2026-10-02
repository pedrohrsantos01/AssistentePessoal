# Contenção e retomada integral

Status: ready-for-agent
Blocked by: none

Origem: [plano confirmado](../spec.md), REQ-NFR-004 e [ADR-019](../../../docs/adr/0019-recuperacao-operacional-sem-perda-de-confirmacoes.md).

## Critérios de aceite

API real em quarentena recusa rotas de clientes antes de ler dados/corpo/autenticar. Session/SQLite reabertos preservam projeções, envelopes e novas intenções. Após invalidação administrativa e chave nova, tokens/links antigos falham; novo login/snapshot/recibos retomam sem duplicar XP e sem expor outra conta.

## Fronteiras e validação

HTTP/Session/AccountStore públicos, SQLite/PostgreSQL reais e fronteiras operacionais externas, aprovadas com o plano. Testes de negócio não consultam tabelas privadas. Checks de CLAUDE.md e relatório com limites obrigatórios. Sem UI provisória, compra ou publicação externa por inferência.

## Resultado

Concluída: sim — 02/10/2026.

## Comments

02/10/2026: plano confirmado; executar respeitando dependências. Somente o recorte 1 foi iniciado.


### Entregue em 02/10/2026

Quarentena 503 antes de tocar requisição/dados, preparação administrativa transacional, credenciais anteriores recusadas após chave nova e novo login conservando senha/SQLite. Dois dumps isolados exercitam confirmação pós-corte preservada durante quarentena; cópia histórica não publicada. Pendências novas, replay/XP, segundo cliente e troca de conta verificados. App typecheck/lint + 94 testes; API check com 53 aprovados/1 nativo ignorado, incluindo cinco RestoreTests e ModularityTests.

[Relatório e limites](../../../docs/analises/2026-10-02-contencao-e-retomada-operacional.md), [procedimento](../../../api/ops/recovery.md). Sem prova de RPO zero/WAL/RTO externo neste recorte. Próximo: tarefa 02; M1 continua aberto.
