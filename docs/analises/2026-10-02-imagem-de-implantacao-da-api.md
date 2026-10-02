# Imagem local de implantação da API — 02/10/2026

Estado: **imagem e checks completos verificados localmente; etapa 4B e aceite externo ainda abertos**.
Origem: Q47/Q48, [tarefa 04, etapa 4B](../../.scratch/recuperacao-operacional/issues/04-validar-operacao-externa.md) e REQ-NFR-004. Continuação do [preparo de provisionamento](2026-10-02-preparacao-do-provisionamento.md), commit b40c413.

## Resultado

[Dockerfile](../../api/Dockerfile) com build na raiz do repositório, cópias explícitas e [.dockerignore](../../.dockerignore) restrito aos arquivos do build. O wrapper Gradle 8.14.4 verifica o SHA-256 da distribuição; lockfile preservado. Java 21 JDK/JRE Temurin Noble fixados por digests de manifest oficial, consultados em 02/10/2026. O build inclui contrato OpenAPI e migrations V1–V4 no JAR executável. A etapa runtime contém o JRE e o JAR, executado sem privilégios como UID/GID 10001.

A imagem define RITMO_REQUIRE_WAL=true e RITMO_RECOVERY_QUARANTINE=true. O [exemplo de runtime](../../api/deploy/.env.example) tem campos obrigatórios vazios; não inclui credenciais reais nem está pronto para iniciar um ambiente. Porta 8080 interna, sem publicação no host pelo Dockerfile. A instalação real exige isolamento de rede e os gates já aprovados.

O [contrato/comandos](../../api/ops/container-deployment.md) documenta contexto no Coolify, segredos por runtime, roles separados e limites do ensaio. Não houve alteração de domínio, schema, API m1.1 ou lockfile de dependências.

## Evidência

TDD no artefato real: o teste ContainerPackagingTests falhou inicialmente porque api/Dockerfile não existia. Após a implementação, construiu uma imagem Linux e subiu PostgreSQL 18 real descartável, com fsync/full_page_writes/synchronous_commit ativos e grupos/logins de migração/domínio/identidade separados.

Pela API HTTP da imagem:

- Quarentena padrão recusou cadastro com 503 temporarily_unavailable; UID de execução 10001 verificado.
- Ao retirar somente a quarentena, proteção WAL padrão recusou cadastro sem receptor com 503.
- Na exceção explicitamente descartável sem WAL/quarentena, cadastro devolveu access/refresh/revoke e snapshot autenticado, comprovando inicialização, Flyway e disponibilidade do contrato empacotado.

A sonda de prontidão foi ajustada para uma rota de leitura que exige autenticação, evitando depender de GET numa rota somente POST. O teste não consulta tabelas privadas para afirmar comportamento de negócio. Containers/rede/imagem de tag única são encerrados ao final; processo de build tem prazo e limpeza em timeout/interrupção. Logs de fixture em api/build ficam ignorados pelo Git e não contêm segredos reais.

## Checks e limites

App: pnpm --dir app typecheck, lint e test com exit 0, 94/94 testes aprovados, sem ignorados. API: Java 21, gradlew.bat -p api check --no-daemon, exit 0 em 5 min 52 s; 60 testes Java reportados, 59 aprovados e 1 ignorado (teste nativo Android opt-in sem emulador configurado nesta execução), zero falhas/erros. operationsTest executou 8/8. ModularityTests e todos os testes locais de WAL/restauração passaram. ContainerPackagingTests terminou em 43,166 s com camadas de build já em cache.

Digest da imagem Linux/amd64 gerada no ensaio: sha256:133093fd8619a0b0aecca7c0e8f6f6e96c38a8373101873a4a59f19554959a9c. A tag única e a imagem foram removidas no finally da fixture, confirmado no log de cleanup. Digests de build/runtime e checksum do Gradle estão nos arquivos versionados; os resultados XML ficam em api/build/test-results/test. A duração da suíte local não é um RTO externo. Conferidos 18 arquivos UTF-8 do incremento e 142 links locais em 13 Markdown; sem caminhos ausentes. Diff sem erros de whitespace antes do commit.

O teste de imagem é local, em Linux/amd64 no Docker Desktop; arm64 não foi ensaiado. Não mediu latência/recursos de uma VPS real nem validou configuração da versão de Coolify instalada, proxy/TLS/IP externo, agendamento/supervisor, transporte de probes, entrega Resend, custódia Bitwarden, janela externa de 30 dias ou reconstrução em 24h. Não houve compra, instalação remota, upload R2 ou exposição.

## Continuação

A etapa 4B ainda precisa de supervisão comprovada do receiver/parada/restart, agenda Linux, transporte privado autenticado de probes e configuração/testes de proxy. Depois: instalação isolada e aceite externo cronometrado, com orçamento/fornecedores a definir conforme Q47. Tarefa 04 e M1 permanecem abertos; interface aguarda o protótipo Q28.
