# Retenção física do feed — plano para confirmação

Data: 04/10/2026.
Estado: **Q49/Q50 aprovadas; entendimento do plano consolidado aguardando confirmação; implementação não iniciada**.
Origem: [entrevista Q49/Q50](../fundacao/entrevista.md).
Contratos: [sync](../../specs/06-sincronizacao.md), [primeiro marco](../../specs/13-contrato-primeiro-marco.md), [mensagens m1.1](../../contracts/primeiro-marco/README.md) e [modelo de dados](../../specs/00-modelo-de-dados.md).
Vínculo: [tarefa 05 do M1](../primeiro-marco/issues/05-completar-sessao-e-recuperacao.md).

## Decisões fechadas

- Q49: retenção de 90 dias para todos os envelopes do feed, incluindo tombstones; não apenas exclusões.
- Q50: expurgo automático diário, configurável, em lotes limitados.
- Mantêm-se as garantias existentes: snapshot de 15 minutos, reserva do feed após H enquanto válido, pendências sem expiração automática e recibos/hash de lotes/IDs excluídos enquanto a conta existir.
- A janela se aplica ao transporte do feed. Estado canônico, fatos/contextos necessários à reconciliação, histórico técnico de XP e orçamentos não serão apagados neste recorte.

## Diagnóstico verificado no checkout

`Sync.pullCursor` renova a data de emissão a cada resposta. `Sync.pull` verifica idade e época, mas não compara a revisão pedida com um limite de expurgo. Um cursor recente pode apontar para revisões antigas. Remover essas revisões sem a nova proteção permitiria avançar silenciosamente sobre alterações ausentes.

Push, pull e criação de snapshot já serializam pela linha de controle da conta. Página e consulta de recibos do snapshot ainda não compartilham essa trava. A remoção de um manifesto cascata seus itens; o app já reinicia a cópia ao receber 404/410, conservando base e pendências.

Não há cleaner de produção para `sync_changes`/snapshots. Os testes existentes removem o feed como fixture após expirar o cursor original; não exercitam cursor renovado, expurgo real ou limpeza concorrente com uma cópia. A limpeza operacional de backups/WAL pertence a outro contrato.

Leituras de referência: [Sync.java](../../api/src/main/java/dev/ritmo/sync/Sync.java), [DDL V1](../../api/src/main/resources/db/migration/V1__m1_foundation.sql), [cliente](../../app/src/core/sync/synchronize.ts), [prova anterior](../../docs/analises/2026-09-30-exclusao-e-tombstones.md). Diagnóstico por leitura; não equivale a teste do comportamento proposto.

## Entrega vertical proposta

Uma [tarefa de implementação](issues/01-expurgar-feed-e-snapshots.md) reúne expurgo, ressincronização e rotina diária. Seus critérios precisam passar juntos; não encerrar o recorte com uma limpeza manual isolada.

1. Registrar por conta até qual revisão o prefixo do feed foi removido. Usar migration Flyway nova e atualizar spec/00 no mesmo commit da implementação; este plano não declara uma coluna já existente.
2. Antes de ler o feed, comparar o cursor com esse limite. Abaixo dele, devolver o `409 resync_required` existente, mesmo quando o cursor foi emitido recentemente. Cursor exatamente no limite pode retomar o sufixo retido; não rotacionar a época apenas para executar expurgo normal.
3. Remover somente um prefixo contíguo elegível: envelopes com mais de 90 dias, sem cruzar H do snapshot válido mais antigo. Exatamente 90 dias permanece retido. Atualizar limite e remover registros na mesma transação por conta; uma falha não publica um limite falso.
4. Remover manifestos expirados e seus itens. Coordenar criação, página, recibos e cleaner pela fronteira transacional da conta, revalidando o manifesto após adquirir a trava. Não manter transação aberta entre páginas HTTP.
5. Acrescentar execução automática diária com limites configuráveis de trabalho e duração, sem sobreposição destrutiva. A cadência de Q50 é própria; o horário de backup Q38 não define implicitamente o horário deste job. Documentar configuração, falha, retomada e execução de diagnóstico no runbook.
6. Tratar a enumeração operacional de contas separadamente das consultas de domínio. Não ampliar SELECT sobre dados pessoais, não conceder BYPASSRLS aos logins runtime; todo expurgo ocorre em contexto e filtro explícitos de uma conta. Qualquer função/permissão nova deve constar da migration/modelo e de testes de privilégios.
7. Verificar o fluxo pelo app público, SQLite, HTTP e PostgreSQL reais, incluindo reinício e pendências. Preservar mensagens m1.1; nenhum endpoint administrativo exposto ao cliente é necessário.

Os detalhes de SQL, índices, limites numéricos da execução e agenda serão concretizados como engenharia no contrato/runbook antes do código, respeitando as escolhas acima. Não há decisão de produto adicional pendente para o escopo delimitado.

## Aceite

- Expurgo real remove envelopes antigos e snapshots expirados; conserva a janela de 90 dias e snapshots válidos.
- Cursor renovado que aponta antes do limite recebe resync; cursor no limite e clientes atuais continuam lendo o sufixo completo.
- Snapshot em páginas e recibos em H permanecem coerentes durante limpeza/escritas concorrentes; retomada depois de H não perde alterações.
- App reaberto preserva base/fila/rejeições, reconhece recibos antigos e converge sem duplicar cumprimento/XP nem ressuscitar hábito excluído.
- Replay e chaves de lote antigas continuam idempotentes; IDs excluídos continuam indisponíveis após remover o feed.
- Falha/rollback, execução repetida, limites, reinício/retomada, concorrência de executores e isolamento A/B têm provas.
- A execução diária usa o cleaner real, não uma fixture que simula sua conclusão; observação operacional não imprime tokens, payloads ou dados pessoais.

## Limites

Compactação física de hábitos/fatos/contextos/XP, exclusão da conta, corrupção local, cofre indisponível e resolução de conflitos de identidade são recortes próprios. Hábitos em soft delete continuam necessários ao tombstone do snapshot atual. UI depende do protótipo de Q28; instalação externa, SMTP/deep link reais, distribuição iOS e aceite nos aparelhos permanecem abertos.

Após confirmação do entendimento, implementar a tarefa, executar app typecheck/lint/test e API check com ModularityTests e integração real, validar migration/contratos/links, registrar relatório e commit semântico atômico. Os checks da baseline não constituem prova do cleaner ainda inexistente.

## Verificação do registro documental

Decisões e diagnóstico documentados, sem cleaner ou migration novos. Checks da implementação atual aprovados em 04/10/2026; [relatório e limites](../../docs/analises/2026-10-04-contrato-de-retencao-feed.md). A confirmação do entendimento e os critérios de implementação continuam pendentes.
