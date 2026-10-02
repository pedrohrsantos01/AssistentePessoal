# WAL e recuperação física pós-base — 02/10/2026

Recorte 2 de [recuperação operacional](../../.scratch/recuperacao-operacional/spec.md), autorizado por Pedro, REQ-NFR-004 e [ADR-019](../adr/0019-recuperacao-operacional-sem-perda-de-confirmacoes.md). Implementação e validação local concluídas. M1/tarefa 05 continuam abertos.

## Implementação

Barreira de publicação de `/api/v1/` com `RITMO_REQUIRE_WAL=true`, obrigatória antes da operação externa. O receptor nomeado precisa usar o slot físico ritmo_wal e ter flush remoto até um marcador operacional vazio/não transacional, emitido com flush local antes da rota e depois da produção da resposta. Corpo permanece em memória até a segunda prova. Ausência/configuração incompatível, falha/timeout ou interrupção produzem indisponibilidade; não confirmar somente por haver commit ou recibo local. A quarentena continua anterior à barreira.

Flyway V4 acrescenta apenas `ritmo_wal_status(pg_lsn)`, SECURITY DEFINER/search_path fixo/EXECUTE restrito, sem tabela de produto nem mudança de m1.1. O dono pode operar sem SUPERUSER/BYPASSRLS/REPLICATION, recebendo pg_read_all_stats; logins de aplicação não recebem esse acesso. O marcador cobre inserções anteriores e evita esperar indefinidamente por WAL de abort ainda sem flush. Confirmado o caso em que cancelar SyncRep deixa um commit local, e o caso de timeout de leitura JDBC. Falhas de início/commit de transação recebem 503 temporário, inclusive em Identity, sem publicar credenciais.

Ferramentas em [ops/wal-recovery.md](../../api/ops/wal-recovery.md): receptor contínuo síncrono, base completa em staging/manifest SHA256/verificação/publicação sincronizada e preparação de restauração isolada com alvo explícito e pausa. `pg_basebackup` usa nome diferente do receptor contínuo; sua conexão temporária não serve como prova do slot designado. Recusa destinos ocupados, paths inadequados e tablespaces adicionais. Base/cadeia/segredos continuam sob custódia operacional; nenhum arquivo de backup ou segredo foi versionado.

## Evidências

`WalRecoveryTests` usa PostgreSQL 18.6 fixado por digest, fsync explicitamente ligado no primário, filesystem separado para pg_receivewal e API HTTP real. Interfaces públicas afirmam fatos de domínio; SQL de teste é restrito a provisionamento, metadados operacionais e injeção de bloqueio/falha, sem consultar tabelas privadas para afirmar resultados de produto.

- API protegida sem receptor recusa cadastro com 503.
- Dono operacional sem visibilidade das estatísticas falha fechado; após pg_read_all_stats consegue provar flush sem conceder estatísticas/replicação ao runtime.
- Interrupção depois da entrada da rota: cancelamento de SyncRep e timeout de transporte JDBC não publicam recibo. Push/replay/recibos/snapshot/páginas/pull ficam indisponíveis; reconexão devolve replay aceito e conserva a revisão.
- Timeout de commit de login não publica credenciais, devolve 503 e permite login novo depois da retomada.
- Receptor em tmpfs de 8 MiB recebe erro real de falta de espaço; API não autoriza confirmação.
- Base física anterior às contas/operações; confirmações posteriores incluem onboarding, hábitos/cumprimentos, 20 XP de consumo, exclusão/reversão e senha alterada por SMTP/link de fixture. Primário é morto abruptamente, sem checkpoint final ou cópia do disco de origem. Somente base/WAL do receptor vão para o destino novo.
- Último alvo está em `.partial`. Recuperação real pausa no alvo comprovado antes da perda. Preparação de credenciais/chave nova e API protegida verificam senha vigente, duas contas isoladas, tombstone, 10 XP ativos, consumo preservado e replay sem outra revisão.
- Base corrompida é recusada antes da cópia. Cauda ausente ou com header corrompido impede atingir o alvo: PostgreSQL encerra recuperação sem promover. A cópia íntegra segue.
- Após promoção, WAL/histórico de timeline 2 e nova confirmação são armazenados. Segunda perda e restauração pela **mesma base da timeline 1** atravessam o histórico/fork; senha vigente, replay e revisão 7 são verificados pela API.

`RestoreTests` mantém a prova HTTP/SQLite de quarentena e retomada do incremento 1; os cenários app existentes cobrem persistência dos mesmos envelopes diante de indisponibilidade. Não houve mudança no cliente, em dependências nem em schema de domínio.

## Verificação final

- App: `pnpm --dir app typecheck`, `lint` e `test` aprovados; **94 testes**, sem falhas/ignorados.
- API: `api/gradlew.bat -p api check --no-daemon` aprovado em 4m25s, Java 21/Docker; **59 casos, 58 aprovados e 1 Android nativo ignorado**, sem falhas/erros. Modularity 1, RateLimit 11, Restore 5, Runtime 37 (um ignorado), WAL 5.
- 13 Markdown/114 links locais sem destinos ausentes; diff sem erros de whitespace. Relatório de teste: api/build/reports/tests/test/index.html. Arquivos temporários de transporte são removidos ao final e containers/processos encerrados.

Reprodução Windows: `JAVA_HOME=C:/Program Files/Android/Android Studio/jbr` e DOCKER_CONFIG apontando para api/build/test-docker-config, configuração descartável vazia, sem credencial de registry. Gradle 8.14.4 e imagem PostgreSQL 18.6 já disponíveis; nenhuma instalação/atualização de dependência.

## Limites e próximo recorte

Prova local da recuperação das confirmações sob perda do primário, com filesystem independente **dentro do mesmo Docker/host de teste**; não reproduz perda do host físico, rede/armazenamento do fornecedor ou crash simultâneo do receptor. Não é aceite externo de RPO/RTO, janela PITR de 30 dias ou desempenho p95. Requer no ambiente real filesystem durável, TLS/pg_hba restritos, supervisão e cofre Q43.

A barreira comprova feedback de WAL; não verifica por si a base, retenção ou completude do inventário. O alvo do ensaio foi registrado e protegido antes da perda. Seleção/custódia do alvo conservador **fora do primário** e inventário imutável ainda pertencem ao recorte 3: agenda Q38, cadeia/expurgo Q39 e detector externo Q40/Q42. Não liberar um alvo antigo arbitrário nem substituir alvo não alcançado por outro menor. Relatório/flags/fim de ferramenta não são prova automática de completude.

Dois marcadores/round trips adicionais por requisição protegida podem afetar latência; medir no provisionamento, mantendo a garantia. `statement_timeout` não fornece prazo confiável de COMMIT: usar limites finitos de conexão/leitura JDBC e proxy, sem concluir rollback pelo timeout. [Código PostgreSQL 18](https://github.com/postgres/postgres/blob/REL_18_STABLE/src/backend/tcop/postgres.c#L2645), [pgJDBC](https://jdbc.postgresql.org/documentation/use/) e demais fontes em ops/wal-recovery.md. Não houve conexão/publicação na VPS, compra ou entrega externa de e-mail. UI/protótipo e aceite dos aparelhos continuam pendentes.
