# API — primeiro recorte executável

Java 21, Boot 4.1.1 e Modulith 2.1.1. Conta de teste, hábito binário diário, XP e sincronização estão implementados. Este recorte ainda não é a entrega completa do M1.

## Verificar

Instale primeiro as dependências do app, porque o teste de integração usa dois repositórios SQLite reais através de HTTP:

```powershell
pnpm --dir ../app install --frozen-lockfile
.\gradlew.bat check --no-daemon
```

Java 21 e Docker precisam estar disponíveis. O teste inicia GreenMail em loopback, sem entrega externa, e um Postgres 18.6 descartável, fixado por digest; aplica Flyway e cria roles de teste sem privilégios administrativos. O Testcontainers encerra seu container ao terminar. Nenhuma conexão com a VPS é necessária.

`RuntimeTests` verifica HTTP, RLS, transações, recibos e executa os cenários em `app/test/integration/`: sync/sessão, recuperação de senha, scheduler, rejeições, snapshots e compatibilidade. `ModularityTests` verifica fronteiras. Os relatórios ficam em `build/reports/tests/test/index.html`; o resultado dos clientes em `build/mobile-integration.log`, `build/mobile-recovery.log`, `build/mobile-scheduler.log` `build/mobile-rejections.log`, `build/snapshot-integration.log` e `build/compatibility-integration.log`.

## Integração nativa Android (opt-in)

O comando `scripts/verify-android-http.ps1 -Serial <emulator-serial>`, executado na raiz, gera e instala o APK isolado e executa o cenário Android dentro de `RuntimeTests`. Pré-requisitos e efeitos no emulador estão no [README do app](../app/README.md#harness-android-com-http-real). A API do teste escuta somente em `127.0.0.1`; Testcontainers/GreenMail continuam descartáveis.

Sem `RITMO_ANDROID_SERIAL`, o caso nativo é ignorado explicitamente; as demais suítes continuam independentes de Android. Com essa variável, Gradle sempre executa os testes; `RITMO_ANDROID_APK` também registra o APK como entrada. O caminho completo pelo script evita testar acidentalmente um APK antigo. Resultado nativo em `build/android-http-integration.log`; [relatório e limites](../docs/analises/2026-09-30-http-nativo-android.md).

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

Os testes usam dados fictícios. Antes do uso diário ainda faltam aceite real da recuperação por e-mail/aparelho, matriz ampliada de snapshot/migrations e recuperação completa, limpeza/retenção operacional, configuração de e-mail, deploy/backup agendado externo e o restante da matriz M1. Essas pendências estão na [tarefa seguinte](../.scratch/primeiro-marco/issues/05-completar-sessao-e-recuperacao.md). Não publicar este scaffold como versão pronta.

Migrations aplicadas não devem ser editadas ao evoluir o schema: criar V4 e seguintes, atualizar spec/00 e testar a migração. V1 concretiza o DDL aprovado; V2 adiciona grants e políticas de perfil; V3 acrescenta a política global de compatibilidade.

Evidências e limites do incremento de sessão: [relatório](../docs/analises/2026-09-26-sessao-e-isolamento.md).

Evidências do incremento de recuperação: [relatório](../docs/analises/2026-09-27-recuperacao-de-senha.md). O SMTP local não comprova entregabilidade nem abertura nativa do link.


O push ordena dependências disponíveis no lote e preserva a ordem das respostas. Ciclos entre operações ainda não processadas recebem `dependency_cycle`; dependência rejeitada recebe `dependency_rejected` com IDs, e referência ausente continua `deferred`. Operações com recibo não redefinem o grafo a partir de um replay alterado. A recuperação no app usa novos IDs/`supersedesOperationId`, preservando envelopes antigos. [Evidências e limites](../docs/analises/2026-09-28-recuperacao-de-rejeicoes.md).


## Versão mínima do app

Antes de autenticar `/api/v1/*`, o filtro exige protocolo `m1.1` e lê a linha `singleton=true` de `app_compatibility`. A migration V3 instala `min_supported_version='0.1.0'`. É configuração operacional global sem dados pessoais; o login de domínio tem apenas SELECT. Alterações exigem a conexão administrativa de migrations/operação, não uma rota do app nem a role de runtime.

A política armazena uma versão estável `major.minor.patch`, cada componente com até seis dígitos, sem zeros à esquerda. O cabeçalho tem até 64 caracteres e aceita pré-release/metadados válidos. A comparação é numérica; pré-release fica abaixo da estável de mesmo núcleo e metadados de build não alteram a ordem ([SemVer 2.0.0](https://semver.org/)). Versão abaixo da mínima, formato inválido ou protocolo desconhecido devolve `426 unsupported_version` antes de processar o corpo. Linha ausente ou falha de leitura devolve `503 temporarily_unavailable`; não se presume uma versão mínima.

A mudança de política vale na próxima requisição, sem reiniciar a API. Um build já bloqueado no app permanece bloqueado mesmo que o operador reduza a mínima: a liberação local exige um build diferente e confirmação online. Por isso, só elevar a mínima quando houver um build compatível distribuível. [Evidências e limites](../docs/analises/2026-09-29-compatibilidade-e-leitura-local.md).


## Limites de requisição

Bucket4j aplica as quotas Q32 por peer TCP, endpoint anônimo e conta do JWT validado, com 429/Retry-After e armazenamento local limitado. [Configuração e alcance](ops/rate-limits.md); [testes e pendências](../docs/analises/2026-09-30-rate-limiting.md). Proxy confiável e validação da exposição via Coolify seguem no recorte operacional.


## Backup e restauração

[Guia de operação](ops/backup-restore.md) e [evidência de REQ-NFR-004](../docs/analises/2026-09-30-backup-e-restauracao.md). `RestoreTests` gera dump, encerra a origem, recompõe roles em cluster limpo, restaura com outro dono e sobe a API com logins restritos. Valida conta/sessão, hábitos/XP, snapshots/recibos, tombstones, isolamento e intenções offline no SQLite reaberto. Incluído em `check`; resultado móvel em `build/restore-mobile-integration.log`.

Os scripts exigem cliente PostgreSQL 18, shell POSIX/GNU coreutils e credenciais via ambiente/libpq. Recusam sobrescrita, par corrompido e destino preenchido. O ensaio não configura Coolify/destino externo/retenção nem recupera confirmações posteriores ao ponto do dump. Estratégia pós-corte aprovada em ADR-019/spec/07 §2.2; prova de durabilidade e provisionamento ainda pendentes. Contenção/reativação em [ops/recovery.md](ops/recovery.md).
