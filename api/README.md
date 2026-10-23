# API — primeiro recorte executável

Java 21, Boot 4.1.1 e Modulith 2.1.1. Conta de teste, hábito binário diário, XP e sincronização estão implementados. Este recorte ainda não é a entrega completa do M1.

## Verificar

Instale primeiro as dependências do app, porque o teste de integração usa dois repositórios SQLite reais através de HTTP:

```powershell
pnpm --dir ../app install --frozen-lockfile
.\gradlew.bat check --no-daemon
```

Java 21, Docker e Python 3.11+ com IANA tzdata precisam estar disponíveis. `check` inclui `operationsTest` (stdlib, sem instalar pacotes); `RITMO_PYTHON` pode apontar para o executável Python do ambiente. O teste inicia GreenMail em loopback, sem entrega externa, e um Postgres 18.6 descartável, fixado por digest; aplica Flyway e cria roles de teste sem privilégios administrativos. O Testcontainers encerra os containers ao terminar. WalRecoveryTests usa primário e receptor em filesystems separados, com fsync ativado, e restaura base física/WAL após perdas e promoção; ver [procedimento de WAL](ops/wal-recovery.md). Nenhuma conexão com a VPS é necessária.

`RuntimeTests` verifica HTTP, RLS, transações, recibos e executa os cenários em `app/test/integration/`: sync/sessão, recuperação de senha, scheduler, rejeições, snapshots e compatibilidade. `ModularityTests` verifica fronteiras. Os relatórios ficam em `build/reports/tests/test/index.html`; o resultado dos clientes em `build/mobile-integration.log`, `build/mobile-recovery.log`, `build/mobile-scheduler.log` `build/mobile-rejections.log`, `build/snapshot-integration.log` e `build/compatibility-integration.log`.

## Integração nativa Android (opt-in)

O comando `scripts/verify-android-http.ps1 -Serial <emulator-serial>`, executado na raiz, gera e instala o APK isolado e executa o cenário Android dentro de `RuntimeTests`. Pré-requisitos e efeitos no emulador estão no [README do app](../app/README.md#harness-android-com-http-real). A API do teste escuta somente em `127.0.0.1`; Testcontainers/GreenMail continuam descartáveis.

Sem `RITMO_ANDROID_SERIAL`, o caso nativo é ignorado explicitamente; as demais suítes continuam independentes de Android. Com essa variável, Gradle sempre executa os testes; `RITMO_ANDROID_APK` também registra o APK como entrada. O caminho completo pelo script evita testar acidentalmente um APK antigo. Resultado nativo em `build/android-http-integration.log`; [relatório e limites](../docs/analises/2026-09-30-http-nativo-android.md).

A UI do produto usa opt-in separado: `scripts/verify-android-journey.ps1 -Suite journey` para a jornada/gestão e `-Suite session` para sessão/cofre/abertura. Ambos validam o pacote descartável e usam `RITMO_ANDROID_JOURNEY_SERIAL`; não rodar o cliente contra serviço compartilhado. O método `androidProductSessionRecoveryPreservesAccountIsolation` prepara API/Postgres/SMTP reais e fornece o loopback ao driver. [Relatório](../docs/analises/2026-10-10-interface-sessao-e-recuperacao-local.md).

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

Bucket4j aplica as quotas Q32 por origem confiável, endpoint anônimo e conta do JWT validado, com 429/Retry-After e armazenamento local limitado. O padrão usa o peer TCP; allowlist exata permite XFF sanitizado por um único proxy. [Configuração e alcance](ops/rate-limits.md), [proxy/TLS e ativação](ops/proxy-activation.md) e [prova local](../docs/analises/2026-10-03-proxy-tls-e-origem-confiavel.md). A exposição real via Coolify permanece no aceite externo.


## Backup e restauração

[Guia de operação](ops/backup-restore.md) e [evidência de REQ-NFR-004](../docs/analises/2026-09-30-backup-e-restauracao.md). `RestoreTests` gera dump, encerra a origem, recompõe roles em cluster limpo, restaura com outro dono e sobe a API com logins restritos. Valida conta/sessão, hábitos/XP, snapshots/recibos, tombstones, isolamento e intenções offline no SQLite reaberto. Incluído em `check`; resultado móvel em `build/restore-mobile-integration.log`.

Os scripts exigem cliente PostgreSQL 18, shell POSIX/GNU coreutils e credenciais via ambiente/libpq. Recusam sobrescrita, par corrompido e destino preenchido. O ensaio não configura Coolify/destino externo/retenção nem recupera confirmações posteriores ao ponto do dump. Estratégia pós-corte aprovada em ADR-019/spec/07 §2.2; prova de durabilidade e provisionamento ainda pendentes. Contenção/reativação em [ops/recovery.md](ops/recovery.md).


## Proteção das confirmações externas

O recorte 2 acrescenta barreira de publicação opt-in com `RITMO_REQUIRE_WAL=true`, obrigatória no provisionamento externo. Exige receptor síncrono nomeado, flush remoto antes/depois das rotas e base física/cadeia válidas no destino independente. A barreira verifica o WAL; não substitui a validação da base, o inventário/seleção de alvo nem a quarentena. Desenvolvimento descartável sem receptor usa false. [Configuração, permissões, ferramentas e limites](ops/wal-recovery.md); [contrato](../specs/13-contrato-primeiro-marco.md#20-durabilidade-remota-do-transporte--02102026).

## Ciclo operacional

[operations.py e runbook](ops/operations.md) oferecem jobs finitos de agenda/catálogo/expurgo, congelamento e restauração verificados, probe/monitor e ensaio mensal/por major. O seletor nativo usa somente WAL independente e recusa gaps/corrupção/cauda ausente/história de timeline ausente. Não inicia cron, supervisor ou infraestrutura externa. Instalação Linux e aceites de operação/SMTP/cofre/TLS ficam no recorte 4; M1/UI/aparelhos seguem abertos.


## Imagem de implantação local

[Contrato e comandos](ops/container-deployment.md), [Dockerfile](Dockerfile) e [exemplo de ambiente sem segredos](deploy/.env.example). O contexto de build é a raiz do repositório, com wrapper/lockfile, fontes, migrations e OpenAPI. Java 21 JDK compila; JRE executa como UID/GID 10001. A imagem exige WAL e inicia em quarentena por padrão. ContainerPackagingTests constrói o artefato e o verifica por HTTP com PG18 descartável; incluído em check. Instalação, supervisão/agenda/transporte/proxy e aceite externo seguem na [tarefa 04](../.scratch/recuperacao-operacional/issues/04-validar-operacao-externa.md).


## Telemetria primária — continuação local 4B

[Contrato/runbook e exemplos](ops/primary-telemetry.md): probe privado de PG18/durabilidade/slot/retainedBytes e disco dados/WAL, role mínima/read-only, identidade do cluster e volume; fonte primary no monitor e ciclo mais antigo no watchdog. [Evidência local](../docs/analises/2026-10-03-telemetria-do-primario.md). Artefatos operacionais locais verificados no escopo atual; instalação, capacidade e aceite externo seguem abertos, assim como M1/UI/aparelhos.

## Retenção física do feed

[Runbook e configuração](ops/sync-retention.md), [modelo V5](../specs/00-modelo-de-dados.md#1211-retenção-física-do-feed--04102026) e [prova local](../docs/analises/2026-10-04-retencao-fisica-do-feed.md). Worker diário por conta remove prefixo de envelopes com mais de 90 × 24 horas e snapshots expirados em lotes; progresso e limite são persistidos. Cursor abaixo do limite removido exige ressincronização, mantendo o protocolo m1.1. Quarentena pausa o job. Recibos, hashes, IDs excluídos e dados técnicos de domínio permanecem. Instalação e aceite externo continuam abertos.


## Aparência e leitor de tela — recorte06

Contrato Q56–Q58 em `.scratch/interface-m1/preferencias.md`; resultado/limites em `docs/analises/2026-10-12-interface-aparencia-e-preferencias.md`.

Na raiz do checkout, com ANDROID_HOME configurado:

```powershell
.\scripts\verify-android-journey.ps1 -Suite appearance -Avd Pixel_9 -Serial emulator-5560 -EvidenceDirectory docs/design/evidencias/2026-10-12/aparencia-android/repeticao
.\scripts\verify-android-accessibility.ps1 -Avd 'NOME_DO_AVD_DEPURAVEL' -Serial emulator-5560 -EnableDebugInput -EvidenceDirectory docs/design/evidencias/2026-10-12/aparencia-android/repeticao-talkback
```

A suite appearance prepara API/Postgres e duas contas sintéticas, usa preferências/SQLite reais e testa paletas, persistência, A/B/A, falhas externas de leitura/escrita e reinstalação somente de `dev.ritmo.journeytest`. A suite de leitor usa o APK de jornada previamente compilado e o hábito local preparado pela primeira; não inicia API. Inspeciona6 paletas100%/200% e prepara foco, marcar/desfazer e seleção de aparência com TalkBack real, usando entrada física. A execução no Pixel_9 atual ficou bloqueada; o falso positivo de adb input foi descartado. Escolher/preparar o AVD depurável e suas fixtures antes desse segundo comando; o placeholder não é um AVD existente. UIAutomator só consulta a árvore com o leitor pausado; serviço vinculado é conferido durante os gestos. Serviços/fonte/modo anteriores são restaurados. Não constitui aceite integral de leitura falada ou VoiceOver.

Ambos abrem emulador/painel visíveis e encerram somente os recursos próprios, inclusive em falha. `-InspectOnly` no script de acessibilidade mostra armazenamento/pacotes e encerra o emulador próprio. `-RemoveOldHttpHarness` é opt-in de limpeza: remove exclusivamente `dev.ritmo.httpharness` se estiver instalado; exige autorização específica, concedida por Pedro na Q59 para o ensaio de12/10. Não limpa a jornada atual nem o produto.

`-SkipInstall` no ensaio de leitor reutiliza somente um APK instalado cujo SHA-256 coincide com o build local, verificado no emulador; útil ao repetir mudanças exclusivas do driver. Não dispensa build/checks.

`-ReaderOnly` repete somente gestos do TalkBack quando `palette-summary.json` da pasta de evidências já comprova12 capturas/36 verificações de alvos e o mesmo hash do APK. A execução normal grava esse resumo após concluir as paletas, antes de testar o leitor.

A entrada física exige `-EnableDebugInput`, que só ativa adb root temporariamente em imagem depurável/processo próprio, restaurando com unroot; nenhum setenforce ou mudança de permissão de host. O Pixel_9 Google Play atual é preservado e recusado por esse guard. O teste/ponte de leitor preparado continua sem aceite nativo; ver `.scratch/interface-m1/leitor-e-desempenho.md`.

## Prova de sessão web — recorte09/02b

As17 rotas POST de [PWA M1](../contracts/pwa-m1/README.md) estão implementadas no mesmo Java/PostgreSQL, sem jornada web de produto. V6 mantém instalações/contextos privados a Identity. O domínio só recebe EXECUTE na função `identity_authorize_web_context`: valida e mantém locks de conta/contexto na conexão/transação que efetua o comando m1.1. O dono da migration tem policy própria para que FORCE RLS também funcione sem superusuário; logins runtime continuam separados.

Habilitar a fronteira exige `RITMO_WEB_ORIGIN` (origem HTTPS exata, sem barra final) e `RITMO_WEB_PREPARATION_KEY` (chave independente, pelo menos32bytes em Base64, no cofre). Ausência da origem mantém as rotas web indisponíveis; chave ausente impede nova preparação. Bearer nativo não autentica rotas web. Não colocar chaves no frontend.

Java aceita16KB de headers, com erro web431 para Cookie acima de8192bytes. O ingress real também deve permitir esse limite; o ensaio HTTPS local não valida a configuração futura do Coolify. Limpeza a cada60s processa até500 contextos; não elimina registros mínimos de recuperação. Reservas5/10min, close91dias, auth30dias sem uso/90dias absolutos seguem o contrato, sem rotação/reemissão de segredo.

`WebSessionTests` aplica Flyway com dono sem SUPERUSER/BYPASSRLS e verifica HTTP/SQL reais. A prova de cookies é opt-in **visível**, sem modo headless:

```powershell
$env:RITMO_WEB_BROWSER='1'
.\gradlew.bat test --tests dev.ritmo.WebSessionTests --no-daemon
Remove-Item Env:RITMO_WEB_BROWSER
```

Requer dependências já instaladas em `web/`, Chrome, Node24, Java21 e Docker. O job finito cria API, Postgres, certificado local e proxy HTTPS descartáveis; encerra seus recursos em finally. Não inicia servidor de desenvolvimento persistente. Saída em `output/playwright/web-session/` na raiz (ignorada pelo Git), com screenshots/result.json sem valores de cookies; o perfil é efêmero. Sem o opt-in, o caso de navegador é marcado como ignorado e os testes HTTP/SQL continuam.

[Relatório e limites](../docs/analises/2026-10-22-prova-sessao-web.md). Safari/Tela de Início, IndexedDB de produto e M1 continuam pendentes; a prova sintética01 não foi migrada para produto.


## Isolamento das fixtures no check

A tarefa Gradle `test` usa `forkEvery=1` e `maxParallelForks=1`: uma JVM por classe, sequencialmente. Contextos Spring em cache e recursos estáticos das fixtures ficam limitados à classe/worker, sem aumentar heap ou manter múltiplos workers concorrentes. Isso acrescenta custo de startup e não altera código/limites da API, condições de durabilidade ou asserções dos testes. [Registro da investigação no recorte12](../docs/analises/2026-10-23-controles-do-ensaio-iphone.md). Os opt-ins de Android/navegador continuam explícitos; nenhum caso vira headless por falta de opt-in.
