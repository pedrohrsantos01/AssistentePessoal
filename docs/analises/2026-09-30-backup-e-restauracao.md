# Backup e restauração — 30/09/2026

## Resultado

REQ-NFR-004 foi exercitado com dump custom de PostgreSQL, restauração em outro container limpo e API real contra o banco recuperado. A origem é encerrada antes da API do destino; os testes recompõem grupos e logins separados e restauram com um dono administrativo diferente. Nenhuma VPS ou entrega externa é utilizada.

[Procedimento operacional](../../api/ops/backup-restore.md): `backup.sh` publica dump e checksum completos sem sobrescrever arquivos existentes; `restore.sh` exige integridade e banco vazio, mantém ACLs/RLS e aplica uma transação única. Erro de restore não deixa schema/dados parcialmente recuperados. Migrations, schema, contrato, dependências e comportamento de produção do app/API não mudaram. Os scripts de operação agora são entradas do teste Gradle.

O arquivo do banco não inclui roles globais ou segredos externos. Por isso, o procedimento exige bootstrap dos grupos, logins de domínio/identidade separados e configuração da API antes de abri-la aos clientes. `--no-owner` permite um novo dono das migrations; os grants são preservados. [pg_dump](https://www.postgresql.org/docs/18/app-pgdump.html), [pg_restore](https://www.postgresql.org/docs/18/app-pgrestore.html).

## Evidência verificável

Dois testes de `RestoreTests`, com PostgreSQL 18.6 fixado por digest e instâncias reais da API, observam HTTP e as interfaces públicas de sessão/AccountStore/Sync. Dump/cópia/restauração são fixtures da fronteira externa de armazenamento; a verificação de banco vazio consulta apenas catálogo operacional. Nenhuma asserção de negócio consulta tabelas privadas.

- Cadastro de duas contas, hábito/cumprimento com 10 XP, snapshot e recibos via HTTP na origem.
- Backup completo pelo dono administrativo; tentativa com login restrito de domínio é recusada. Arquivo existente não é sobrescrito.
- Restauração sem grupos globais falha. Provisionar grupos e logins permite restaurar no mesmo banco vazio, comprovando o rollback da tentativa anterior.
- API no destino valida Flyway e lê o snapshot anterior; conteúdo e revisão permanecem iguais após replay do recibo. Conta B recebe 404 ao pedir snapshot de A.
- Refresh original funciona; revoke bloqueia a renovação do sucessor. Chave de assinatura é a mesma e fictícia nos dois processos.
- Banco já preenchido é recusado; arquivo alterado com checksum original é recusado antes de SQL, pelo motivo de integridade.
- Cliente SQLite cria/marca dois hábitos, exclui um e sincroniza antes do dump. Depois mantém criação/marcação offline em fila, reabre o SQLite e retoma contra a API restaurada com os mesmos envelopes.
- Resultado converge com dois hábitos e 20 XP. A exclusão permanece: replay da criação antiga conserva o recibo; nova operação no ID excluído recebe `id_content_conflict`. Um segundo SQLite da mesma conta recebe snapshot sem ressurreição nem XP duplicado; outra conta recebe lista vazia e zero XP. Nova reabertura conserva resultado e fila resolvida.

TDD: o primeiro tracer falhou porque nenhum archive havia sido produzido; passou após os scripts de operação. A ampliação detectou um ID de lote reutilizado pela fixture em dois pushes distintos; o teste passou com IDs de lote distintos, sem alterar a idempotência de produção. Falhas de corrupção e destino ocupado verificam também seu motivo, evitando aceitar uma recusa genérica.

## Validação

- `pnpm --dir app typecheck`: aprovado.
- `pnpm --dir app lint`: aprovado.
- `pnpm --dir app test`: 94 aprovados, nenhuma falha/skip.
- `api/gradlew.bat -p api check --no-daemon`: 50 aprovados, um nativo Android ignorado por ausência de `RITMO_ANDROID_SERIAL`; inclui ModularityTests, RateLimitTests, RestoreTests e RuntimeTests.
- Tracer `api/gradlew.bat -p api test --tests dev.ritmo.RestoreTests --no-daemon`: dois aprovados. O cenário Node/SQLite integrado passou também no check completo.

Revisão documental: seis arquivos Markdown alterados/novos, 64 links locais conferidos, nenhum link/âncora quebrado, bloco de código desequilibrado ou caractere de substituição.

Resultados transitórios: `api/build/test-results/test`, `api/build/reports/tests/test` e `api/build/restore-mobile-integration.log`. Arquivos de dump/checksum e marcadores de coordenação são temporários e removidos ao fim. As credenciais constantes pertencem somente aos serviços descartáveis.

## Limites e próximo recorte

Esta é a evidência automatizada do ensaio de dump/restauração de REQ-NFR-004. Agendamento pelo Coolify, destino fora da VPS, retenção de 30 dias, alertas, provisionamento/TLS/proxy e teste no ambiente real continuam pendentes. Não mede RTO nem comprova disponibilidade/perda zero em produção.

O ensaio recupera o ponto do dump e reconcilia intenções locais que ainda não haviam sido confirmadas pelo servidor. Não cobre confirmações/credenciais/cursors que avançaram depois do dump e seriam perdidos ao restaurar uma cópia antiga. O pull atual não define recuperação de uma revisão do servidor menor que o cursor já entregue; a definição foi registrada como pendente em spec/07 §2.1. Nenhuma política de rewind, novo epoch ou alteração de schema foi inventada neste recorte. Dump periódico não equivale a recuperação contínua. [Backup por dump](https://www.postgresql.org/docs/18/backup-dump.html).

Próximo recorte recomendado: esclarecer recuperação após o corte (RPO/RTO e reconciliação dos clientes) e o provisionamento operacional com grilling, antes da exposição externa. Seguem também expurgo seguro, aceite real de e-mail/aparelhos e integração do protótipo Q28. M1 e tarefa 05 continuam abertos; os testes desktop não substituem iPhone 16e/Android.
