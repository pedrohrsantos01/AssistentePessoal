# Backup e restauração do PostgreSQL

Procedimento local de REQ-NFR-004, verificado em 30/09/2026. Não provisiona a VPS nem o agendamento/destino externo de produção. [Evidência e limites](../../docs/analises/2026-09-30-backup-e-restauracao.md).

## Pré-requisitos

- Cliente PostgreSQL 18 (`pg_dump`, `pg_restore`, `psql`), shell POSIX e GNU coreutils (`mktemp`, `sha256sum`, `ln -T`). Executar os scripts com `sh`; não são scripts PowerShell. O teste usa a imagem PostgreSQL 18.6 fixada no build.
- Diretório privado já criado, em filesystem que suporte hard links, com espaço para o arquivo. Escolher um nome novo por execução. Nunca gravar dumps no Git; `.dump` e `.dump.sha256` estão ignorados.
- Conexão por libpq: `PGHOST`, `PGDATABASE`, `PGUSER` obrigatórios; `PGPORT`/TLS conforme ambiente. Autenticação via `PGPASSFILE` protegido ou segredo injetado no ambiente. Não colocar senha na linha de comando, no histórico, no repositório ou neste guia. Os scripts não solicitam senha interativamente.
- Na origem, usar o dono administrativo das migrations, com leitura completa de todas as contas. A propriedade de tabelas sozinha não supera FORCE RLS: a conexão operacional precisa de privilégio administrativo para ler todas as contas. O login de domínio tem RLS e não pode gerar o backup completo. Não conceder privilégios de backup ao login da API.
- No destino, usar uma conexão administrativa/dona das migrations em cluster isolado com **banco vazio**. Manter a API e outros escritores desligados até o fim da restauração e da verificação. O script verifica o catálogo, mas não coordena concorrência com outros processos.

## Gerar e transportar

Com a conexão da origem carregada pelo ambiente, a partir de `api/`:

```sh
sh ops/backup.sh /private/backups/ritmo-20260930-001.dump
```

`pg_dump --format=custom` captura schema, dados, ACLs, políticas, histórico Flyway, contas/sessões, recibos, snapshots, revisões, tombstones e orçamento/XP no ponto do dump. É um backup de um banco; roles globais e configuração externa não fazem parte dele. [pg_dump](https://www.postgresql.org/docs/18/app-pgdump.html).

O script usa `umask 077`, grava temporários no mesmo diretório, verifica a leitura do índice do archive e publica arquivos completos por hard link sem sobrescrever nomes existentes. Publica primeiro o dump e depois o sidecar `.sha256`, que contém somente o hash hexadecimal. Só considerar a execução concluída quando ambos existirem e o comando terminar com `backup_completed`/exit 0. Uma falha entre publicações pode deixar apenas o dump; o restore exige o par. A leitura do índice não substitui uma restauração completa.

Transportar os dois arquivos como bytes opacos, preservando seu acesso privado. O hash detecta corrupção, não autentica a origem: restaurar apenas arquivos produzidos e mantidos pelo operador responsável. O dump contém dados pessoais e hashes de credenciais; não anexá-lo a relatório, memória, issue ou chat. O teste cria somente dados fictícios e remove seus arquivos temporários.

## Preparar o destino

`pg_dump` não recria grupos, memberships e senhas de logins do cluster. No cluster novo, o administrador executa, a partir de `api/`, com a conexão do destino:

```sh
psql --no-password --no-psqlrc -v ON_ERROR_STOP=1 -f ops/bootstrap-roles.sql
```

Provisionar depois os logins conforme [conexões e permissões](../README.md#conexões-e-permissões): um membro somente de `ritmo_domain`, outro somente de `ritmo_identity` e o dono das migrations separado. Os logins da aplicação devem ser `NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE`, sem propriedade de tabelas. Definir senhas pelo canal de segredos do ambiente. O bootstrap destina-se a cluster novo; não é uma rotina de reset de roles existentes.

Recompor também os segredos/configurações da API fora do dump: banco, SMTP/link de recuperação e `RITMO_SIGNING_KEY`. Na publicação de uma recuperação integral, manter quarentena e invalidar credenciais/chave anteriores conforme o [procedimento de retomada](recovery.md). Os testes originais reutilizam uma chave fictícia apenas no ambiente isolado para verificar o conteúdo do dump; isso não é a política de publicação Q37. Os hashes/famílias de refresh e revoke no banco são recuperados no ponto do dump; mudanças posteriores a esse ponto não estão cobertas pelo ensaio. Nunca extrair esses segredos para a documentação.

## Restaurar e verificar

Com a conexão administrativa do destino carregada, a partir de `api/`:

```sh
sh ops/restore.sh /private/backups/ritmo-20260930-001.dump
```

Antes de escrever, o script confere o par, o hash, o índice e a ausência de objetos de aplicação no banco. Não usa `--clean` nem apaga objetos do destino. `pg_restore --no-owner --exit-on-error --single-transaction` aplica a restauração inteira ou a desfaz em caso de erro; o novo dono das migrations passa a possuir os objetos. Preserva grants/RLS: **não usar `--no-acl`**. Não é necessário recriar o dono antigo. [pg_restore](https://www.postgresql.org/docs/18/app-pgrestore.html).

Após `restore_completed`/exit 0, iniciar a mesma versão da API e migrations do backup com os dois logins restritos. Flyway valida o histórico restaurado. Verificar pela API: autenticação/refresh/revoke, snapshot, recibos/replay, hábitos/XP e isolamento entre contas; pelo app, reabertura do SQLite e envio de intenções offline. Não chamar sucesso somente porque `pg_restore` saiu com zero.

O ensaio automatizado executa essa sequência de ponta a ponta, incluindo falhas de roles ausentes, corrupção e destino ocupado:

```powershell
# Da raiz, com Java 21, Docker, Node e dependências do app disponíveis:
api/gradlew.bat -p api test --tests dev.ritmo.RestoreTests --no-daemon
```

Para regressão completa, seguir os checks de CLAUDE.md. O ensaio usa Postgres novo, encerra a origem antes de iniciar a API restaurada e descarta os containers ao terminar. Resultado em `api/build/reports/tests/test/index.html`; cliente SQLite em `api/build/restore-mobile-integration.log`. Repetir a cada release maior conforme spec/07.

## Falhas e encaminhamento

| Resultado | Ação do operador |
|---|---|
| `backup_destination_exists` | Usar nome novo; não sobrescrever um backup existente |
| `backup_pair_missing`, `backup_checksum_invalid` ou `backup_checksum_mismatch` | Não restaurar; recuperar o par original completo e verificar sua integridade |
| `restore_requires_empty_database` | Usar outro banco isolado e vazio; não limpar automaticamente o destino recusado |
| Erro de permissão/role ausente durante restore | A transação é revertida; completar o provisionamento e repetir no destino ainda vazio |
| API/Flyway falha após restore | Manter destino isolado e investigar build, configuração e histórico; não liberar clientes |

## Pendências antes da operação externa

O requisito mantém backup **agendado pelo Coolify, retenção de 30 dias e destino fora da VPS**. Este recorte não configura agenda, upload, expurgo, alertas, fornecedor ou restauração em produção. É necessário validar o provisionamento real, a guarda dos segredos, o acesso ao destino e uma execução agendada/restaurada no ambiente escolhido.

O dump cobre o ponto capturado; não recupera automaticamente escritas confirmadas depois dele. O cenário SQLite valida intenções ainda não enviadas ao corte, não uma volta do servidor para trás com clientes que já receberam confirmações/cursors posteriores. Q33–Q43 foram fechadas no ADR-019/spec/07 §2.2: RPO zero na perda da VPS primária, RTO alvo de 24 h, receptor contínuo de WAL e base física. A [prova local de base física/WAL](../../docs/analises/2026-10-02-wal-e-recuperacao-fisica.md) foi concluída no recorte 2; [WAL/limites](wal-recovery.md) e [contenção/retomada](recovery.md) têm procedimentos próprios. Inventário/seleção de alvo fora do primário, ciclo operacional e aceite externo continuam pendentes. Não liberar operação externa com essa lacuna nem declarar perda zero/failover transparente com base neste ensaio. [Backup por dump](https://www.postgresql.org/docs/18/backup-dump.html).
