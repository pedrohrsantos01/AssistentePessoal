# API — primeiro recorte executável

Java 21, Boot 4.1.1 e Modulith 2.1.1. Conta de teste, hábito binário diário, XP e sincronização estão implementados. Este recorte ainda não é a entrega completa do M1.

## Verificar

Instale primeiro as dependências do app, porque o teste de integração usa dois repositórios SQLite reais através de HTTP:

```powershell
pnpm --dir ../app install --frozen-lockfile
.\gradlew.bat check --no-daemon
```

Java 21 e Docker precisam estar disponíveis. O teste inicia GreenMail em loopback, sem entrega externa, e um Postgres 18.6 descartável, fixado por digest; aplica Flyway e cria roles de teste sem privilégios administrativos. O Testcontainers encerra seu container ao terminar. Nenhuma conexão com a VPS é necessária.

`RuntimeTests` verifica HTTP, RLS, transações, recibos e executa os cenários em `app/test/integration/`: sync/sessão, recuperação de senha, scheduler e rejeições. `ModularityTests` verifica fronteiras. Os relatórios ficam em `build/reports/tests/test/index.html`; o resultado dos clientes em `build/mobile-integration.log`, `build/mobile-recovery.log`, `build/mobile-scheduler.log` e `build/mobile-rejections.log`.

## Conexões e permissões

Antes de aplicar Flyway num banco novo, um administrador executa [bootstrap-roles.sql](ops/bootstrap-roles.sql). Provisiona separadamente um login membro de `ritmo_domain`, outro de `ritmo_identity` e o dono das migrations. Nenhum login de aplicação recebe `SUPERUSER`, `BYPASSRLS`, propriedade de tabelas ou as duas memberships.

O datasource padrão usa o login de domínio. `TenantTransactions` define o usuário com `set_config(..., true)` dentro da transação. Identity usa outra conexão e outra transação; apenas ela acessa hashes e sessões. As grants de coluna impedem domínio de ler senha/e-mail. Aceitação de hábito, listener síncrono de XP, recibo e feed usam a mesma transação; falhas de negócio usam savepoint antes de persistir a rejeição.

Configuração por variáveis de ambiente, sem arquivo de credenciais no repositório:

- `RITMO_DB_URL`, `RITMO_DB_USER`, `RITMO_DB_PASSWORD`
- `RITMO_MIGRATION_USER`, `RITMO_MIGRATION_PASSWORD`
- `RITMO_IDENTITY_USER`, `RITMO_IDENTITY_PASSWORD`
- `RITMO_SIGNING_KEY`: chave aleatória de pelo menos 32 bytes em Base64, persistida entre reinícios.

Os valores constantes nos testes pertencem exclusivamente ao container descartável.

## Superfície implementada e limites

Implementados: cadastro, login, refresh rotativo, revoke, solicitação/confirmação de recuperação de senha e cinco rotas de Sync (push, pull, criar snapshot, página de snapshot e consulta de recibos), sob `/api/v1`. Recuperação usa token de uma hora, invalida links anteriores após uma confirmação e revoga as sessões da conta na mesma transação. Configuração e limitações estão no [guia de e-mail](ops/email-recovery.md). Refresh e revoke usam transação e lock da família; duas renovações concorrentes do mesmo token produzem um sucesso e um 401. Cada refresh novo vale 30 dias e estende a família; a capacidade de revogação original não muda. Reutilizar um refresh consumido é recusado, sem invalidar o sucessor legítimo. Revogação bloqueia renovação imediatamente; access emitido continua limitado aos 15 minutos originais.

Os testes usam dados fictícios. Antes do uso diário ainda faltam aceite real da recuperação por e-mail/aparelho, rate limiting, matriz ampliada de snapshot/migrations e recuperação completa, limpeza/retenção operacional, configuração de e-mail, deploy/backup e o restante da matriz M1. Essas pendências estão na [tarefa seguinte](../.scratch/primeiro-marco/issues/05-completar-sessao-e-recuperacao.md). Não publicar este scaffold como versão pronta.

Migrations aplicadas não devem ser editadas ao evoluir o schema: criar V3 e seguintes, atualizar spec/00 e testar a migração. V1 concretiza o DDL aprovado; V2 adiciona grants e políticas de perfil.

Evidências e limites do incremento de sessão: [relatório](../docs/analises/2026-09-26-sessao-e-isolamento.md).

Evidências do incremento de recuperação: [relatório](../docs/analises/2026-09-27-recuperacao-de-senha.md). O SMTP local não comprova entregabilidade nem abertura nativa do link.


O push ordena dependências disponíveis no lote e preserva a ordem das respostas. Ciclos entre operações ainda não processadas recebem `dependency_cycle`; dependência rejeitada recebe `dependency_rejected` com IDs, e referência ausente continua `deferred`. Operações com recibo não redefinem o grafo a partir de um replay alterado. A recuperação no app usa novos IDs/`supersedesOperationId`, preservando envelopes antigos. [Evidências e limites](../docs/analises/2026-09-28-recuperacao-de-rejeicoes.md).
