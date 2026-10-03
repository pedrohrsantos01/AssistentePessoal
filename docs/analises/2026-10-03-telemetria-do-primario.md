# Telemetria privada do primário — 03/10/2026

Incremento local de REQ-NFR-004/Q42, no pacote 4B da [tarefa operacional](../../.scratch/recuperacao-operacional/issues/04-validar-operacao-externa.md). Pedro autorizou continuar as pendências do primeiro marco. [Contrato e instalação futura](../../api/ops/primary-telemetry.md) registrados antes da implementação; fronteiras de teste seguem o plano já aprovado.

## Resultado

O detector C consulta também o primário A por SSH restrito e chave/pin próprios, independentemente do receptor B. Publica somente saúde PG18, configuração de durabilidade, slot físico e percentuais dos filesystems de dados/WAL. A identidade local de pg_controldata precisa concordar com o SQL; caminhos ausentes, symlinks não resolvidos, permissões abertas e cluster divergente são recusados.

O login ritmo_primary_probe tem apenas CONNECT/EXECUTE em pg_control_system; não recebe privilégio de domínio, administração ou replicação. SQL/TLS/processos são limitados e somente de leitura. retainedBytes mede distância do WAL escrito ao restart_lsn, sem avançar/remover slot nem criar limite novo de lag. Falha SQL publica database=false com durable/slot desconhecidos; o monitor preserva os alertas dependentes dessas informações.

O monitor aplica Q42: duas coletas para indisponibilidade, aviso em 80%, crítico em 90%, abertura/agravamento/resolução e dedupe persistidos. Serviço nativo reúne as duas coletas com estados separados. O watchdog em B considera o ciclo mais antigo; estado primário ausente/atrasado não vira um detector saudável.

Nenhum endpoint, schema de domínio ou contrato m1.1 mudou. Não houve contratação, acesso à VPS, envio externo, configuração de SMTP real ou deployment.

## Evidências

Fronteiras públicas SSH/sudo/CLI, PostgreSQL 18 com TLS, filesystem e SMTP local STARTTLS/autenticado numa fixture Linux descartável:

- Coleta saudável com slot ativo e retenção; a role operacional não lê a tabela privada fictícia.
- Alteração real do sincronismo aparece como durable=false e a coleta não repara a configuração.
- Filesystem controlado cheio a 85%/95% gera aviso/agravamento para dados e WAL, sem repetição após novo processo; retirada da pressão resolve as duas condições. Seis mensagens locais com IDs distintos, sem caminhos/segredos.
- Parada do consumidor e geração de 8 MiB de WAL com flush explícito aumentam retenção; coletar novamente não avança o slot. Slot realmente perdido/inválido e depois ausente nunca aparece saudável. Ajustes destrutivos pertencem exclusivamente à fixture isolada, restaurada ao fim.
- Outro cluster, destino WAL inexistente, alias symlink e permissões abertas são recusados. SQL inalcançável conserva disco e publica os estados dependentes como desconhecidos.
- Watchdog considera o menor checked dos dois estados e ausência de primary-state.json como ciclo ausente.
- Unidade monitor de produção, sem override de ExecStart, executa ambas as coletas: falha de identidade no transporte receptor não impede obter o primário pelo seu caminho próprio. Ambos os estados são separados/0600 e o hook nativo registra o término.

A prova usa PGDATA/pg_wal reais num tmpfs limitado para pressão de filesystem; não atesta persistência após perda de energia. A durabilidade/restauração já tem ensaios específicos com [WAL/base/API](2026-10-02-wal-e-recuperacao-fisica.md) e [congelamento/supervisão](2026-10-03-supervisao-do-receptor-wal.md).

## Validação

- App: typecheck, lint e 94/94 testes aprovados.
- Execução focal: PrimaryTelemetryTests e ProbeTransportTests aprovados; cinco cenários nativos do primário na execução inicial, dez de transporte/watchdog e operationsTest 13/13.
- Check completo da API: aprovado em 14 min 20 s. 70 testes: 69 aprovados, zero falhas/erros e 1 Android opt-in ignorado. Inclui ModularityTests, empacotamento, agenda, transporte, proxy/TLS, restauração/WAL e clientes SQLite; operações 13/13. Após a revisão, o check focal adicional da unidade nativa também foi aprovado, com seis cenários primários.
- Codificação UTF-8 dos 30 arquivos, 277 links locais e blocos Markdown: aprovados. Revisão do diff e git diff --cached --check aprovados.

Comandos: pnpm --dir app typecheck, pnpm --dir app lint, pnpm --dir app test; gradlew.bat test --tests dev.ritmo.PrimaryTelemetryTests --tests dev.ritmo.ProbeTransportTests operationsTest --no-daemon; gradlew.bat check --no-daemon com Java 21. Prova adicional depois da revisão: gradlew.bat test --tests dev.ritmo.PrimaryTelemetryTests check --no-daemon. Saídas regeneráveis em api/build/primary-result.log, api/build/transport-result.log e api/build/test-results/test/.

Os ciclos TDD iniciais recusavam a nova fonte/CLI/metadados antes da implementação. O teste de caminho real também revelou a necessidade de aceitar ancestrais protegidos de propriedade PostgreSQL, comuns em volumes Docker, preservando recusa de escrita pública/symlinks.

Dois problemas das fixtures foram esclarecidos antes do check: a geração de WAL sem flush explícito não garantia 8 MiB já escritos no momento da leitura; e o relógio capturado antes da coleta podia exceder a tolerância acelerada de 1 s do teste SMTP. Um atraso controlado de 2 s reproduziu o segundo problema: agenda válida e smtp=false, mas detector-host em lugar de smtp-channel. A fixture agora amostra o relógio após o transporte real; os intervalos/tolerâncias de produção permanecem os de Q42. Instrumentação temporária removida.

## Pendências e limites

O system identifier rejeita outro cluster; uma cópia histórica do mesmo cluster mantém esse identificador. A instalação exige conferir o volume do cluster ativo e o destino privado/TLS corretos, além de mounts/UID/arquitetura. O pacote não prova esses fatos remotos.

Os componentes locais previstos no escopo atual de 4B possuem artefatos e provas: imagem da API, supervisão, agenda, transporte/watchdog, proxy/TLS e agora telemetria primária. Dimensionamento, contratação/orçamento, rede/hosts/custódia, canal SMTP alternativo independente, instalação isolada e aceite 4C/4D continuam abertos. Só o ensaio real aceita recebimento de alertas, janela PITR, RPO/RTO e capacidade/latência/I/O.

M1 e tarefa 05 permanecem abertos: protótipo/UI, rota iOS/aceite iPhone 16e e Android, e-mail/deep link real e restante da matriz. Retenção/compactação física do feed/tombstones e fluxos de recuperação de exceções precisam ser fechados nos contratos antes dos próximos incrementos. A retenção de backups já implementada é uma obrigação diferente da retenção do feed.

Fontes primárias da consulta/slot/permissões estão no [contrato](../../api/ops/primary-telemetry.md). A fixture força flush somente para produzir a carga verificável, conforme [pg_logical_emit_message PG18](https://www.postgresql.org/docs/18/functions-admin.html); o coletor não emite WAL.
