# Retenção operacional do feed

Contrato confirmado por Pedro em 04/10/2026: [Q49/Q50](../../.scratch/fundacao/entrevista.md), [plano](../../.scratch/retencao-feed/spec.md) e [spec/13](../../specs/13-contrato-primeiro-marco.md). Este runbook concretiza a engenharia do recorte; [provas e estado da validação local](../../docs/analises/2026-10-04-retencao-fisica-do-feed.md).

## Execução e limites

A API executa manutenção em worker próprio, sem endpoint administrativo. A agenda diária é por conta: próxima execução e conclusão persistem em PostgreSQL. Uma execução incompleta continua nos próximos ciclos; uma concluída aguarda 24 horas por padrão. Reinício recomeça a enumeração de IDs, preservando o progresso por conta. Mais de uma instância serializa pela mesma linha de controle.

| Variável | Padrão | Faixa |
|---|---:|---|
| RITMO_SYNC_RETENTION_ENABLED | true | true/false |
| RITMO_SYNC_RETENTION_POLL_MS | 60000 | 100–3600000 |
| RITMO_SYNC_RETENTION_PERIOD_SECONDS | 86400 | 1–604800 |
| RITMO_SYNC_RETENTION_ACCOUNTS | 20 | 1–1000 |
| RITMO_SYNC_RETENTION_BATCH_RECORDS | 500 | 1–5000 |
| RITMO_SYNC_RETENTION_BUDGET_MS | 20000 | 100–60000 |
| RITMO_SYNC_RETENTION_IO_SECONDS | 5 | 1–30 |

O orçamento impede iniciar outra conta depois do prazo; a conta em trânsito pode ultrapassá-lo pelos limites de I/O. Conexões de manutenção usam connectTimeout/socketTimeout próprios, preservando os demais parâmetros JDBC. A transação usa lock_timeout=500ms e statement_timeout=2000ms. Um timeout de COMMIT pode ter resultado incerto: a próxima tentativa consulta o progresso persistido sob trava. Não reduzir synchronous_commit nem a barreira WAL. RITMO_RECOVERY_QUARANTINE=true pausa a rotina.

Identity enumera somente IDs de contas ativas em páginas limitadas com seu login já existente. Expurgo usa o login de domínio já existente, contexto app.user_id e filtro explícito em todas as consultas. A V5 não acrescenta BYPASSRLS nem acesso runtime a dados pessoais.

## Segurança dos cursores e snapshots

A V5 registra feed_compacted_through, retention_next_at e retention_completed_at. Apenas o prefixo contíguo com committed_at estritamente anterior a 90 dias é elegível. A janela usa 2160 horas decorridas (90 × 24), igual ao cursor, independentemente de horário de verão no fuso JDBC. A primeira revisão recente, um gap ou H do snapshot válido mais antigo impede avançar. Não saltar revisões com timestamps fora de ordem. Prefixo e limite são atualizados na mesma transação. Cursor abaixo do limite recebe o 409 resync_required existente; no limite retoma o sufixo.

Manifestos expirados são removidos somente depois de seus itens, em lotes limitados. Um lote remove no máximo batch-records envelopes, batch-records itens e min(batch-records,25) manifestos vazios. A remoção em cascata de um manifesto grande não é usada como atalho. Criação, páginas, recibos e cleaner compartilham a trava por conta; página/recibos revalidam a expiração depois da trava. Nenhuma trava permanece entre requisições HTTP.

Estado canônico, fatos, contextos de desfazer, XP, orçamento, recibos, hashes de lotes e IDs excluídos são preservados. O app conserva base e pendências durante ressincronização; snapshot expirado/ausente reinicia a cópia pelo protocolo m1.1.

## Diagnóstico e retomada

Logs da rotina contêm apenas estado, contagens e classe da falha, sem UUID de conta, SQL, payload, tokens ou dados pessoais. Falha de uma conta não interrompe as demais; seu prazo continua pendente. Falha de enumeração conserva o cursor da página. Reinício não exige restaurar cursor em memória.

Diagnóstico local pode executar a função SQL public.ritmo_expire_sync no contexto de uma conta, com o login de domínio e os mesmos timeouts transacionais. Não conceder EXECUTE a PUBLIC nem ao login Identity. A função é SECURITY INVOKER e rejeita uma conta diferente de app.user_id. Não é API de produto; não usar a role de migração como runtime. O primeiro polling ocorre após poll-ms; não há horário ligado ao backup das 03:00.


Para uma execução local de diagnóstico, use conexão protegida de domínio, o UUID confirmado da conta e transação explícita. O exemplo usa parâmetros do psql; não contém credenciais. A função respeita retention_next_at e pode devolver not_due. Não alterar esse prazo em produção para contornar a agenda.

```sql
\prompt 'UUID da conta para diagnóstico: ' account_id
BEGIN;
SELECT set_config('app.user_id', :'account_id', true);
SET LOCAL statement_timeout='2000ms';
SET LOCAL lock_timeout='500ms';
SELECT public.ritmo_expire_sync(
  :'account_id'::uuid, statement_timestamp(),
  statement_timestamp()+interval '24 hours', 500);
COMMIT;
```

Para apenas observar, na mesma transação/contexto, consultar feed_compacted_through, retention_next_at e retention_completed_at em sync_account_state com WHERE user_id=:'account_id'::uuid. Falha de um lote deve ser seguida de ROLLBACK; nunca atualizar o limite separadamente. Guardar resultados agregados pelo canal operacional privado. As datas podem ser exibidas no fuso da conexão; a elegibilidade do feed usa duração decorrida.

Esta entrega local não comprova ativação no Coolify nem o aceite iPhone/Android.

## Referências técnicas

- [PostgreSQL 18: travas](https://www.postgresql.org/docs/18/explicit-locking.html)
- [PostgreSQL 18: RLS](https://www.postgresql.org/docs/18/ddl-rowsecurity.html)
- [PostgreSQL 18: funções](https://www.postgresql.org/docs/18/sql-createfunction.html)
- [pgJDBC: propriedades de conexão](https://jdbc.postgresql.org/documentation/use/)
- [Spring: agendamento](https://docs.spring.io/spring-framework/reference/integration/scheduling.html)

- [PostgreSQL 18: aritmética de instantes e horário de verão](https://www.postgresql.org/docs/18/functions-datetime.html)
