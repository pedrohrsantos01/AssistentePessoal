# Recuperação de snapshots e migrations — 28/09/2026

## Resultado

Continuação autorizada da [tarefa 05](../../.scratch/primeiro-marco/issues/05-completar-sessao-e-recuperacao.md), ampliando REQ-SYN-007/012/013 e M1-13/18. O app preserva a base utilizável durante a cópia, reinicia snapshots expirados de forma limitada e reconhece pendências somente com recibos compatíveis com o corte H. A abertura de bancos foi protegida separadamente: [relatório de migrations](2026-09-28-abertura-segura.md), commit `4df26bc`.

Não houve alteração de schema, dependências, versões ou formatos HTTP. As tabelas de staging e campos de progresso já pertenciam ao modelo. M1 e tarefa 05 continuam abertos.

## Comportamentos verificados

1. **Cópia por página:** cada página é validada e persistida no staging da conta antes de buscar a próxima. A base e as intenções permanecem disponíveis. Conferir identidade do snapshot, H, quantidade, término das páginas, revisões das entidades e ciclos de cursor; duplicatas de entidade são recusadas pela chave do staging.
2. **Interrupção e expiração:** depois de interrupção, a próxima recuperação pede manifesto novo e substitui apenas o staging anterior. Uma resposta `404 resource_inaccessible` ou `410 snapshot_expired` reinicia imediatamente uma vez; se repetir, o scheduler recebe `snapshot_retry_required` e aplica seu backoff/limite existente. Não há loop imediato ilimitado nem descarte de intenções.
3. **Recibos completos:** lotes de até 50 IDs exigem correspondência exata, sem respostas faltantes, duplicadas ou estranhas. Recibos aceitos/reconciliados depois de H são recusados nesse corte. Escritas locais durante as requisições são incluídas em nova consulta antes da troca; `notProcessedAtH` conserva a intenção.
4. **Troca atômica:** base, reconhecimentos, projeção e cursor confirmam juntos. Falha ao recompor a projeção desfaz todos esses efeitos e mantém o histórico de rejeições/resoluções. Após confirmar, ler o feed depois de H antes de reenviar pendências, reconhecendo resultados já processados sem sobrepor uma edição posterior.
5. **Paginação e isolamento:** o pull recusa mudança de H durante o ciclo, páginas sem progresso e ciclos de cursor. A API mantém o corte entre páginas e devolve 404 para um cursor de snapshot inválido/de outra conta. Cursor inválido de pull continua pedindo resync. Snapshot expirado recusa tanto páginas como consultas de recibos.
6. **Abertura segura:** histórico Drizzle desconhecido ou falha de migration gera erro tipado e interrompe a abertura. Testes de evolução descartável demonstram rollback, retry e preservação de pendências de ambas as contas e do fence de logout. Não há reconstrução ou reparo destrutivo automático.

Uso e detalhes físicos: [README do app](../../app/README.md), [spec/00 §12.3](../../specs/00-modelo-de-dados.md) e [spec/13 §13](../../specs/13-contrato-primeiro-marco.md).

## Validação executada

| Verificação | Resultado |
|---|---|
| `pnpm typecheck` e `pnpm lint`, em `app/` | Aprovados |
| `pnpm test`, em `app/` | 60 testes, zero falhas; 16 novos neste recorte |
| `api/gradlew.bat -p api check bootJar --no-daemon` | Aprovado; 30 testes Java, incluindo modularidade |
| Cenários TypeScript iniciados pelo Gradle | Seis aprovados: sync, sessão, senha, scheduler, rejeições e snapshots |
| Bundle Android de `openExpoRuntime` | Gerado, 753 módulos; não representa execução em aparelho |

Os [testes de snapshot](../../app/test/snapshot.test.ts), [paginação](../../app/test/pagination.test.ts) e [migrations](../../app/test/migrations.test.ts) usam armazenamento SQLite real, com transporte/falhas externas controlados. Os novos testes expuseram, antes das correções, a interrupção por expiração, ausência de validação exata dos recibos, envio antes do feed posterior a H, escrita tardia no staging, aceitação de schema desconhecido e cursores sem progresso/corte divergente.

O [cenário integrado](../../app/test/integration/snapshots.test.ts) usa API, Postgres e dois bancos SQLite reais. Produz 501 mudanças, recebe 500 + 1 envelopes com H fixo apesar de uma escrita entre páginas, materializa 502 entidades em páginas de 500 + 2 e verifica que uma edição posterior não altera a cópia. Uma operação aceita depois de H continua `notProcessedAtH` nesse snapshot. Durante outra cópia, cria uma ação offline e perde a segunda resposta; reabrir preserva as 54 pendências. A nova cópia consulta recibos em lotes de 50 + 4, envia somente a intenção ainda ausente e converge com o segundo cliente em 502 hábitos, conservando a edição mais recente de B.

A suíte ampliada também encontrou a resposta 409 da API para cursor de snapshot de outra conta. O acesso já era negado; a correção passou a devolver o 404 previsto. O teste HTTP de expiração em [RuntimeTests](../../api/src/test/java/dev/ritmo/RuntimeTests.java) usa vencimento apenas do snapshot da fixture, sem esperar quinze minutos ou alterar dados de outra conta.

Evidências locais ignoradas pelo Git: `.scratch/runtime/snapshot-api-final.log`, `.scratch/runtime/snapshot-bundle.log`, `api/build/snapshot-integration.log` e XML/HTML em `api/build/test-results/test/` e `api/build/reports/tests/test/`. Foram usados Java 21 e PostgreSQL/SMTP descartáveis. O bundle apresentou o aviso de ambiente sobre `NO_COLOR`/`FORCE_COLOR`, sem falha de geração. Não houve acesso à VPS ou envio externo.

## Limites e próximo recorte

- Retomada de snapshot reinicia pelo manifesto; não retoma a página exata da cópia anterior. O swap ainda lê o staging e recompõe as projeções em memória; não foi estabelecido um limite de escala nem feita uma otimização para milhões de entidades.
- Os testes de migration partem da base inicial real e adicionam uma evolução de fixture. Cada migration futura de produção precisa da própria prova de preservação; reparo de corrupção física, exportação e restauração de backup não foram implementados.
- Não houve novo APK nem teste HTTP nativo. Android/iPhone e UI de recuperação permanecem pendentes; o protótipo continua com Pedro.
- M1-13 ainda não inclui aceitação de exclusão/tombstones. Matriz completa de concorrência/relógios/fusos, conflitos de identidade incertos, retenção e operação real continuam abertos.
- Próximo passo recomendado: modo somente leitura local quando a API exigir atualização (REQ-SYN-014). Depois, HTTP real no harness Android. Rate limiting, segredos, SMTP/domínio reais, backup/restore e deploy seguem obrigatórios antes de exposição externa.
