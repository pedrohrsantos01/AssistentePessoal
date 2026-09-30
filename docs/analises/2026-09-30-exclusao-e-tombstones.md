# Exclusão, tombstones e recuperação de clientes antigos — 30/09/2026

Incremento técnico de REQ-HAB-007, REQ-SYN-009/010, REQ-GAM-001/002/003 e M1-13. A tarefa 05 e o M1 inteiro continuam abertos; confirmação visual segue o protótipo de Pedro.

## Definições aprovadas

Q30: excluir reverte as concessões ativas de XP do hábito, sem devolver consumo do teto. Substitui a regra antiga de spec/04 §7, que preservava esse XP. O histórico do hábito deixa de estar disponível como produto; fatos/contextos, decisões, transições e recibos técnicos permanecem para reconciliação conforme spec/00 §12.

Q31: confirmar o cumprimento e conceder os 10 XP somente se o prêmio couber inteiro no saldo. Caso contrário, gravar `limit_reached`, sem XP parcial. A primeira decisão continua valendo no desfazer/refazer, mesmo após aumentar o teto.

## Comportamento implementado

- `habit.delete` no contrato do M1 e na fila SQLite. Projeção oculta hábito e XP imediatamente; intenção e dependências sobrevivem a reinício. Rejeição definitiva recuperável restaura a base canônica quando não há tombstone aceito.
- API marca soft delete, registra `sync_deleted_ids`, invalida estados diários e reverte apenas concessões ativas com transição por concessão/operação. Atualiza N dos orçamentos abrangidos pelo início do hábito, preservando consumo. Tudo participa da transação de sync e da mesma revisão/recibo.
- Edição/marcação/desfazer de ID excluído recebe `resource_inaccessible`; tentativa de recriar o ID recebe `id_content_conflict`. Replay conserva resultado/revisão originais. ID novo pode reutilizar o título, sem recuperar XP do hábito excluído.
- Tombstone terminal vence a criação/edição/marcação pendente, ack atrasado e reaplicação de entidades antigas. Não apaga conteúdo recuperável nem tenta inferir rejeição antes do recibo servidor.
- Histórico extenso usa a recuperação existente: ack/replay devolvem o tombstone; envelope completo fica interno; pull retorna `resync_required` ao cruzar mais de 32 entidades. Snapshot estável/paginado e recibos em H preservam a transação inteira e intenções independentes. Recuperação vale no pull inicial e após push.
- Clock de sync passa a ser injetável, assim como o de hábitos. Cursor vence após 90 dias e snapshot após 15 minutos; tempo é fronteira externa controlada nos testes.

Nenhum campo/tabela/dependência nova. A tabela de IDs excluídos e os campos de soft delete já estavam no DDL/Flyway. O comentário do DDL de contrato foi atualizado; migrations aplicadas não foram reescritas. Comando adicional usa os tipos/limites/rotas existentes de `m1.1`; não houve aumento silencioso de tamanho nem mudança de schema de resposta.

## Evidência por fronteiras públicas

Testes usam AccountStore/HttpSync/HTTP com SQLite e PostgreSQL reais. Transporte, relógio e falha de escrita são fronteiras externas; não há mocks de módulos internos nem assertions por consulta a tabelas privadas.

1. Tracer local reproduziu hábito reaparecendo após tombstone; outro reproduziu XP indevido. Correções foram verificadas antes de ampliar o fluxo. Intenção antiga e projeção permanecem corretas após reabertura/ack atrasado.
2. Exclusão offline com reabertura e ack perdido converge em dois SQLite; XP 10 → 0, consumo 10, uma reversão e rejeição recuperável da edição antiga. Replays não avançam feed nem repetem a reversão.
3. Vinte dias com XP produzem exclusão extensa. O transporte permanece dentro de 32 entidades e os dois clientes recuperam por snapshot. Intenção independente é aceita; tentativa de criar o ID excluído é recusada; 20 reversões e consumo total 200 permanecem.
4. Exclusão contra edição/marcação nas duas ordens e com envios simultâneos: seis cenários convergem sem hábito/XP ativo. Replay não avança revisão.
5. Outra conta não exclui o hábito da vítima nem lê seu XP/tombstone. Estado da vítima permanece até a própria exclusão autorizada.
6. Exemplo aprovado de saldo parcial: 23 hábitos, 22 cumprimentos, consumo 220; excluir oito deixa N=15, limite 225 e XP válido 140. O último cumprimento é confirmado sem conceder 5 nem 10 XP. Com N=16/limite 240 depois, desfazer/refazer continua sem prêmio e mantém consumo 220.
7. Limite temporal: cursor é aceito exatamente em 90 dias e recusado um segundo depois. Fixture remove o feed daquela conta; snapshot mantém tombstone, recibo original e bloqueio de recriação. As datas de dezembro são avanço de relógio da fixture, não datas da execução.
8. Falha PostgreSQL real na transição de XP retorna 503 e reverte hábito/XP/tombstone/recibo/revisão juntos. Consulta pública de recibos em H retorna `notProcessedAtH`; remover a falha permite retry da mesma intenção.

## Verificação

- App: typecheck/lint aprovados sem warnings; 94 testes locais aprovados, incluindo três novos de tombstones.
- Arquivo HTTP `test/integration/deletion.test.ts`: dez cenários aprovados no servidor descartável controlado pelo Gradle.
- Contratos: OpenAPI 3.1.1, 52 schemas/11 endpoints, 49 fixtures (39 positivas/10 negativas); DDL parseado e constraints SQLite verificadas.
- API `check`: 38 casos JUnit, 37 aprovados e um nativo ignorado por ausência de serial; inclui ModularityTests. A suíte executa os dez cenários HTTP de exclusão e os cenários HTTP anteriores.

Comandos:

```powershell
pnpm.cmd --dir app typecheck
pnpm.cmd --dir app lint
pnpm.cmd --dir app test
python contracts/primeiro-marco/build_contract.py
python contracts/primeiro-marco/validate.py
api\gradlew.bat -p api check --no-daemon
```

Evidência gerada/ignorada: `api/build/deletion-integration.log`, `api/build/test-results/test/TEST-dev.ritmo.RuntimeTests.xml` e relatório Gradle. O owner de teste controla API/Postgres; não permanece um servidor de desenvolvimento aberto.

## Limites e próximo recorte

Não houve novo aceite no Android/iPhone nem confirmação visual de exclusão. Builds nativos anteriores não incluem o incremento até serem reconstruídos; a UI segue Q28. A retenção mínima mantém soft delete, IDs, fatos/contextos e recibos; o teste de expiração remove somente o feed como fixture. Não foi implementado um job de expurgo/compactação de produção, nem exclusão de conta, nem arquivamento.

Recomendação: preparar o próximo recorte de operação — rate limiting, retenção/expurgo seguro, provisionamento reproduzível e backup/restore — com testes locais antes de exposição externa. Host, SMTP externo, deploy e aceite dos aparelhos continuam dependências reais. Depois de completar as lacunas do M1 que não dependem do protótipo, usar `grilling` para esclarecer e decompor os demais eixos da Fase 1.
