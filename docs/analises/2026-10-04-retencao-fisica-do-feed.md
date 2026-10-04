# Retenção física do feed e retomada segura — 04/10/2026

Estado: implementação local concluída e verificada. Tarefa de retenção concluída; M1 e aceite externo continuam abertos.
Origem: [Q49/Q50](../../.scratch/fundacao/entrevista.md), [plano confirmado](../../.scratch/retencao-feed/spec.md) e [tarefa](../../.scratch/retencao-feed/issues/01-expurgar-feed-e-snapshots.md).
Requisitos: REQ-SYN-007/009/010; preserva REQ-SYN-013/017.

## Resultado implementado

O executor diário remove envelopes com mais de 90 períodos de 24 horas, incluindo tombstones, e itens/manifestos de snapshots expirados. A V5 registra por conta o prefixo removido e a agenda de manutenção. Limite e exclusão participam da mesma transação com RLS e filtro explícito. Um cursor abaixo do limite recebe o 409 resync_required já existente; um cursor no limite continua pelo sufixo.

A primeira revisão recente impede avançar, mesmo se revisões posteriores tiverem timestamps antigos. Snapshots válidos reservam o feed depois de H. Criação, páginas, recibos e expurgo compartilham a trava da conta; páginas/recibos revalidam expiração depois da espera. Itens são removidos em lotes e só depois se exclui o manifesto vazio.

Identity enumera somente IDs com seu login atual. Manutenção usa conexões separadas com timeouts próprios e o login de domínio atual. A função operacional é SECURITY INVOKER, restrita ao contexto app.user_id; sem EXECUTE para PUBLIC/Identity e sem BYPASSRLS. O protocolo m1.1 e o schema SQLite permanecem compatíveis.

Agenda, faixas numéricas, timeouts, quarentena, logs, diagnóstico e retomada: [runbook](../../api/ops/sync-retention.md). Próxima execução/conclusão persistem no banco. Pendência de lote continua nos ciclos seguintes; reinício pode perder a posição de enumeração em memória, preservando o progresso da conta. Duas instâncias serializam; falhas têm diagnóstico por classe, sem dados da conta.

## Provas de comportamento

Os testes foram escritos nas fronteiras confirmadas: HTTP/cliente, PostgreSQL/SQLite, relógio e ciclo de vida da API/rotina operacional. As contagens SQL comprovam retenção física e privilégios; hábitos, XP, recibos e ressincronização são verificados pelas interfaces públicas.

- Executor real remove 501 envelopes antigos. Cursor renovado após 89 dias, ainda apontando para a revisão 500, recebe resync após remover até 501; cliente em 501 lê a revisão 502.
- Snapshot expirado some fisicamente e permite nova cópia. Página e recibos em espera revalidam a expiração após adquirir a trava.
- Snapshot de 502 entidades conserva duas páginas em H=501 durante expurgo limitado e escritas em 502/503; recibo posterior a H retorna notProcessedAtH e o sufixo permanece completo.
- Corte exato de 90 dias permanece retido, inclusive com conexão em America/New_York atravessando horário de verão. Uma revisão recente interrompe o prefixo sem saltar para uma posterior mais antiga.
- Falha SQL real durante DELETE mantém feed e limite; tentativa seguinte pode concluir. Uma conta com falha continua devida e o executor real limpa outra conta. Limites inválidos falham antes de alterar o controle. Contexto A não expurga/lê B; Identity/PUBLIC não ganham execução.
- SQLite fechado/reaberto conserva base, fila e rejeições antes e depois do expurgo real. A primeira cópia nova expira durante o fluxo e reinicia com 404, preservando intenções. O recibo antigo de uma confirmação perdida evita reenviar a marcação; XP e reversão não duplicam, tombstone não ressuscita e orçamento consumido é mantido.
- A chave de lote antiga aceita seu corpo original como replay e recusa outro corpo com idempotency_key_conflict.
- Upgrade de base V4 preenchida aplica V5 com limite inicial zero e agenda devida, sem apagar feed; replay preserva o recibo e a revisão originais.
- Reiniciar a API durante trabalho incompleto conserva prefixo/progresso; dois executores retomam a limpeza. Conta concluída aguarda seu prazo diário. Quarentena pausa expurgo.
- Flag de ativação inválida impede startup, evitando desligamento silencioso.

Ciclos vermelhos observados antes das respectivas correções: feed antigo não removido; manifesto expirado não removido; leituras não aguardavam trava; intervalo de dias civis removia o limite exato ao atravessar DST; flag yes desligava silenciosamente o job. Cada falha foi corrigida e seu teste passou. Cenários de retomada usam o cleaner de produção; não simulam limpeza com DELETE em fixture.

## Validação final

- App: typecheck, lint e 94 testes aprovados.
- Contratos: OpenAPI 3.1.1, 52 schemas, 11 endpoints, 49 fixtures, 27 statements PostgreSQL parseados, 8 checks SQLite e 11 checks de domínio aprovados. Essa validação de contrato é distinta da execução real.
- API: check completo aprovado em 14m14s: 84 testes JUnit, 83 aprovados e um Android nativo opt-in ignorado; zero falhas/erros. Inclui ModularityTests, imagem, HTTP/PostgreSQL/SQLite, retenção e recuperação WAL. Os 13 testes Python de operação também passaram.
- Migration V5 exercitada em PostgreSQL real, inclusive upgrade de V4 preenchida e roles runtime restritas. Links/UTF-8 e diff preparados/revisados sem erros; artefatos e documentação acompanham o mesmo commit.

Os logs de teste ficam em api/build, ignorados pelo Git. A fixture móvel produz retention-mobile-integration.log.

## Limites e próximos trabalhos

A entrega é local. M1 e tarefa 05 continuam abertos: recuperação de exceções ainda exige seu contrato, UI depende do protótipo Q28, SMTP/deep link real, rota de distribuição iOS e aceite iPhone 16e/Android continuam pendentes. Instalação/observação da rotina no Coolify é aceite externo próprio.

Não há compactação de hábitos, fatos, contextos ou histórico técnico de XP. Exclusão de conta segue contrato separado. Recibos, hashes de lotes e IDs excluídos permanecem enquanto a conta existir. Esta conclusão não inicia a avaliação de 30 dias da Fase 1 completa.

## Referências

[Modelo físico](../../specs/00-modelo-de-dados.md), [migration V5](../../api/src/main/resources/db/migration/V5__sync_feed_retention.sql), [prova HTTP/PostgreSQL](../../api/src/test/java/dev/ritmo/SyncRetentionTests.java), [ciclo de vida da API](../../api/src/test/java/dev/ritmo/RetentionLifecycleTests.java) e [cliente SQLite](../../app/test/integration/retention.test.ts).

A janela por horas segue a [aritmética de instantes documentada pelo PostgreSQL 18](https://www.postgresql.org/docs/18/functions-datetime.html). Conexões de manutenção respeitam a precedência dos [parâmetros de URL do pgJDBC](https://jdbc.postgresql.org/documentation/use/); limites JDBC não substituem atomicidade/retomada. Referências de RLS, função e agendamento no runbook.
