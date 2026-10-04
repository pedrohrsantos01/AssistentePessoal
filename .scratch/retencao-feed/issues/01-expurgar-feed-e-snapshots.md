# 01 — Expurgar feed e snapshots com retomada segura e execução diária

Status: needs-info
Blocked by: none

## Resultado esperado

Implementar o [plano consolidado](../spec.md) de Q49/Q50 como uma entrega vertical: expurgo físico, cursor seguro, snapshot consistente e execução automática diária. REQ-SYN-007/009/010; preservar REQ-SYN-013/017 e isolamento de CLAUDE.md §5.

## Pré-requisito de execução

As decisões Q49/Q50 estão aprovadas. Falta somente Pedro confirmar o entendimento do plano consolidado, conforme a skill grilling. Atualizar para ready-for-agent após essa confirmação; não tratar os checks da baseline como evidência de implementação.

## Escopo e critérios de aceite

- Atualizar spec/00 com a representação do limite de revisão removida e acrescentar migration Flyway nova; não editar V1–V4 nem presumir dados ausentes numa base existente.
- Limpar prefixo elegível de envelopes com mais de 90 dias, em lotes por conta, com limite e remoção atômicos. Preservar o sufixo após H de todo snapshot válido.
- Rejeitar com resync_required um cursor abaixo do limite, inclusive um nextCursor recentemente emitido; manter retomada no limite e feed íntegro para clientes atuais.
- Limpar snapshots expirados e itens, sem corrida entre validação do manifesto e leitura de página/recibos.
- Preservar estado canônico, fatos/contextos, XP/orçamento, recibos, hash de lotes e IDs excluídos. Não fazer hard delete de hábitos.
- Implementar execução diária configurável, limitada e segura sob reinício/concorrência; documentar estado/falha/retomada no runbook, com logs sanitizados.
- Provar enumeração operacional mínima e expurgo por conta com RLS/filtro, permissões restritas e testes de vazamento A/B.
- Integrar testes reais de PostgreSQL/HTTP/SQLite: corte de 90 dias, cursor renovado, snapshot paginado concorrente, recibo antigo, fila/rejeições após reabertura, replay sem duplicação e tombstone sem ressurreição.
- Exercitar o executor diário e a retomada do trabalho limitado com relógio/processo como fronteiras externas; falha real não avança o limite nem apaga dados protegidos.
- App typecheck/lint/test, API check incluindo ModularityTests e integração, migration/contratos afetados e links aprovados; relatório registra escopo e limitações.

## Resultado

Concluída: não.

## Comments

04/10/2026 — Q49=A e Q50=A aprovadas por Pedro. Investigação de contratos/código concluída; plano preparado para confirmação de entendimento. Não há implementação ou migration de retenção neste registro. M1 continua aberto.
