# Provisionamento e aceite externo

Status: needs-info
Blocked by: 03-operar-backups-e-alertas.md

Origem: [plano confirmado](../spec.md), REQ-NFR-004 e [ADR-019](../../../docs/adr/0019-recuperacao-operacional-sem-perda-de-confirmacoes.md).

## Critérios de aceite

Definir fornecedor/custo/capacidade e acessos com Pedro após prova local; configurar TLS/proxy/Coolify/destino/cofre/e-mail/detector. Comprovar agenda, alertas, restauração integral e RTO no ambiente real antes de exposição.

## Fronteiras e validação

HTTP/Session/AccountStore públicos, SQLite/PostgreSQL reais e fronteiras operacionais externas, aprovadas com o plano. Testes de negócio não consultam tabelas privadas. Checks de CLAUDE.md e relatório com limites obrigatórios. Sem UI provisória, compra ou publicação externa por inferência.

## Resultado

Concluída: não.

## Comments

02/10/2026: plano confirmado; executar respeitando dependências. Somente o recorte 1 foi iniciado.
