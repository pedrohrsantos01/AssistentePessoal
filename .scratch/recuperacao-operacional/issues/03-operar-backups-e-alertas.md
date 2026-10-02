# Backup, retenção e alertas

Status: ready-for-agent
Blocked by: 02-provar-wal-pos-corte.md

Origem: [plano confirmado](../spec.md), REQ-NFR-004 e [ADR-019](../../../docs/adr/0019-recuperacao-operacional-sem-perda-de-confirmacoes.md).

## Critérios de aceite

Implementar/testar agenda e cadeia Q38/Q39, retenção por dependência, detector e deduplicação Q40/Q42, procedimento e ensaio Q41 com segredos referenciados Q43. Não afirmar provisionamento externo.

## Fronteiras e validação

HTTP/Session/AccountStore públicos, SQLite/PostgreSQL reais e fronteiras operacionais externas, aprovadas com o plano. Testes de negócio não consultam tabelas privadas. Checks de CLAUDE.md e relatório com limites obrigatórios. Sem UI provisória, compra ou publicação externa por inferência.

## Resultado

Concluída: sim, localmente em 02/10/2026.

## Comments

02/10/2026: plano confirmado; executar respeitando dependências. Somente o recorte 1 foi iniciado.


02/10/2026: dependência 02 concluída localmente; próximo recorte recomendado. Além da agenda/retencão/detector, consolidar inventário imutável, congelamento/publicação da cadeia e seleção/custódia de alvo conservador no destino independente. A fixture 02 protegeu um alvo registrado antes da perda; produção não pode depender de consultar o primário perdido. [Evidências](../../../docs/analises/2026-10-02-wal-e-recuperacao-fisica.md). Não liberar operação externa antes dos gates 03/04.

02/10/2026: recorte 3 concluído localmente. Jobs finitos de agenda/catálogo/retencão/probe/monitor/ensaio e inventário congelado implementados. Alvo selecionado pela cadeia independente após perder o primário, sem fonte viva, nas timelines 1/2; CRC/cauda/padding/história inválidos recusam seleção e expurgo. Falha não substitui sucesso nem autoriza remover a âncora; detector mantém dedupe após restart e não confirma e-mail falho. [Runbook](../../../api/ops/operations.md) e [evidência/limites](../../../docs/analises/2026-10-02-ciclo-operacional-de-backups.md). App typecheck/lint + 94 testes; API check 58 aprovados/1 Android opt-in ignorado + 8 operacionais. Ensaio local cronometrado 285,688 s. Próximo: 04 (fornecedores/custos/acessos/supervisor/TLS/cofre/e-mail/aceites reais); sem provisão externa, janela real ou RTO aceito. M1/UI/aparelhos seguem abertos.
