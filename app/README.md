# App Ritmo — primeira jornada e núcleo local

Expo 57.0.25, React Native 0.86.3, React 19.2.3, TypeScript 6.0.3, expo-sqlite 57.0.3 e Drizzle 0.45.3.

## Verificar

```powershell
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
```

A suíte usa arquivos SQLite reais através de better-sqlite3/Drizzle. O mesmo `AccountStore` é usado pelo adapter Expo/Drizzle. O teste com dois clientes, HTTP e Postgres é iniciado por `api/gradlew.bat check`; o caminho reproduzível para todos os testes de integração é o Gradle da API. Além de `RITMO_TEST_API`, o cenário de recuperação recebe e-mail e link fictícios emitidos no SMTP local (`RITMO_RESET_EMAIL`/`RITMO_RESET_LINK`); não preencher essas variáveis com dados ou links reais.

`AccountStore.enqueue` grava a intenção imutável, sequência e projeção na mesma transação síncrona. Recebimento de ack atualiza entidades por revisão e não avança o cursor; pull reconhece recibos antes de reaplicar pendências. O snapshot usa staging no mesmo banco. Não há `await` dentro de transações Drizzle, evitando o alistamento de consultas assíncronas externas.

`synchronize` recebe um transporte vinculado à mesma conta, valida respostas geradas do OpenAPI, recupera snapshot quando necessário e troca lotes de até 50 operações. Erros preservam o banco. O uso autenticado passa por `Session.synchronize`, que verifica a geração da sessão e renova acesso quando necessário. O scheduler automático e o backoff estão descritos abaixo; o aceite visual e a execução em iPhone permanecem pendentes. O cenário HTTP nativo Android está descrito abaixo.

## Interface dos recortes 01 a 03

`index.js` inicia Expo Router/`src/app`. `Journey` traduz apenas comandos/estados públicos de Session/AccountStore; componentes não chamam HTTP. O SQLite preserva o passo do onboarding, perfil público, intenções, IDs e projeções. `AccountStore.subscribe` publica após a transação externa confirmar; rollback não publica sucesso. Dados de domínio não são duplicados no Zustand, usado somente para navegação e rascunho de sugestão.

Entrada, cadastro/login, confirmação de fuso/início do dia, primeiro hábito ou pular, Briefing, criação posterior e ajustes mínimos estão nesta jornada. A gestão inclui todos os ativos, inclusive antes do início; o Briefing lista apenas os devidos. A gestão usa lista virtualizada, edição de título/ícone/cor com prévia, ordenação e exclusão confirmada. Sessão, cofre e abertura têm avisos e ações distintos. Resultados detalhados de sync, recuperação por link e preferências persistidas foram implementados nos recortes04–06, com os limites dos relatórios; desempenho e matriz integral ainda pendentes. O aviso de privacidade para testes identifica a política pública ainda pendente; não foi inventado um contrato legal final.

Holograma acompanha o tema do sistema. Os mesmos tokens suportam Cockpit/Neo em claro/escuro; seleção/persistência de aparência fica no recorte 06. Onze pesos locais de Chakra Petch, Space Grotesk e JetBrains Mono entram no bundle; licenças SIL OFL em `assets/licenses/`, incluídas também nos assets do APK pelo plugin de build. Não há download de fontes, telemetria, áudio ou permissões futuras neste recorte.

Na gestão, patches contêm somente campos alterados; metadados desconhecidos são preservados. A ordenação enfileira mudanças de posições na mesma transação local. Exclusão reverte XP sem devolver orçamento e usa os tombstones existentes. Validação de unicidade usa a tabela Unicode full casefold gerada por `scripts/generate-habit-casefold.py`, com fonte versionada e licença Unicode nos assets. Relatório: [gestão nativa](../docs/analises/2026-10-09-interface-gestao-de-habitos.md).

O Briefing registra providers locais independentes de hábitos/XP com fronteira de erro por card. Uma assinatura acompanha commits/pull e a geração da sessão. Um timer calcula a próxima virada lógica IANA, incluindo DST, e é refeito ao retornar ao foreground; não há polling de minuto nem timer que confirme sync. Marca/desfaz usa o dia no momento do toque e todos os desfazeres conhecidos.

`pnpm test` roda a suíte Node/SQLite e os componentes com React Native Testing Library/Jest Expo. A animação de botão usa Reanimated, com duração por token e redução de movimento do sistema. Componentes verificam comportamento/acessibilidade; renderização e I/O nativos são exercitados pelo driver Android abaixo.

## Testar a jornada visivelmente no Android

Na raiz do projeto, com Java 21, Android SDK, Docker e o AVD indicado disponível:

```powershell
$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME='H:\Android\Sdk'
.\scripts\verify-android-journey.ps1 -Avd Pixel_9 -Serial emulator-5560
```

O script verifica app, compila/valida `dev.ritmo.journeytest`, abre emulador/painel visíveis e instala somente essa variante. O método JUnit prepara API/Postgres/SMTP descartáveis em loopback. O driver opera os controles nativos por rótulo, interrompe/retoma onboarding, pula e cria um hábito, desliga conexão, mata/reabre processo, desfaz/remarca, reconecta e confirma 10 XP por um cliente independente. Também verifica modos Holograma claro/escuro, teclado, alvos nativos mínimos de 44, texto 200% e ações com escalas de animação zeradas. Rádios, modo, escalas de fonte/animação são restaurados; somente encaminhamento e processos criados pelo teste são encerrados em `finally`. Não limpa bancos nem desinstala os harnesses anteriores. `-SkipBuild` reutiliza um APK já compilado e verificado pelo pacote, para diagnóstico local; não substitui os checks.

A variante libera HTTP somente para `127.0.0.1` e porta reversa reservada `18766`, sem logs de credenciais. `RITMO_ANDROID_JOURNEY_SERIAL` é separado do opt-in dos harnesses, para não confundir interfaces com testes técnicos. Screenshots contêm somente fixtures sintéticas. API/check normal deixa esse teste opt-in ignorado.

O produto normal é `dev.ritmo.app`, exige `EXPO_PUBLIC_RITMO_API_ORIGIN` com origem HTTPS no build e mantém HTTP bloqueado. As flags `EXPO_PUBLIC_RITMO_HTTP_HARNESS=1` e `EXPO_PUBLIC_RITMO_TECHNICAL_HARNESS=1` conservam os pacotes/entradas técnicos; nunca usar a variante de teste para contas reais. Configuração de domínio/provedor e aceite no iPhone seguem pendentes.

[Resultado, evidências e limites do recorte 01](../docs/analises/2026-10-09-interface-primeira-jornada.md).

## Sessão e recuperação pela interface — recorte 03

`SessionNotice` acompanha o estado público da jornada nas telas locais e permite retomar o cofre ou autenticar a mesma conta online. Leitura/escrita locais continuam durante uma nova tentativa do cofre, quando a sessão e as bases estão saudáveis. `OpeningFailure` distingue conta e instalação; diagnóstico exibe somente escopo, etapa e código reconhecido, sem caminhos, mensagens SQL ou credenciais. Retry conserva o owner/arquivos. Logout incompleto oferece Terminar saída e bloqueia rotas/painéis; navegação vincula chave de geração e estado de abertura. Resultados assíncronos antigos não publicam erros na nova conta.

O ensaio específico usa os controles da aplicação:

```powershell
.\scripts\verify-android-journey.ps1 -Suite session -FreshTestInstall -EvidenceDirectory docs/design/evidencias/2026-10-10/sessao-android
```

`harness/journey-runtime.ts` só é selecionado com `EXPO_PUBLIC_RITMO_JOURNEY_TEST=1`; sua própria fábrica também exige essa flag. Intents de teste injetam falhas de leitura/remoção do cofre e abertura de conta/instalação nas fronteiras externas, mantendo os algoritmos e a UI do produto. Ausência de credencial exercita autenticação necessária; expiração real/refresh recusado são verificados nos componentes com Session real. Nunca usar essa variante para contas reais. `-FreshTestInstall` remove somente a variante descartável validada, antes da jornada; o ensaio verifica persistência e isolamento sem apagar dados entre suas etapas. [Relatório e limites](../docs/analises/2026-10-10-interface-sessao-e-recuperacao-local.md).

## Resultados de sincronização na interface

A pílula e a entrada em Ajustes abrem o painel inferior da referência M1. Contagens e estados por hábito vêm de `AccountStore.operationStates`; o histórico conserva originais, resoluções e substitutas. A revisão usa `recovery`, `correct` e `discard`: somente dependentes selecionadas são corrigidas junto, e descarte exige confirmação por item. Q53 oferece diagnóstico e preserva a cadeia, sem correção/descarte/reenvio automático.

`SyncScheduler` fornece fase, espera mínima e causa transitória; retry manual não encurta `Retry-After`. Compatibilidade mantém formulários em leitura. Cópia inicial de conta já configurada usa snapshot atômico: a tela mostra contagem real da área separada e indicador indeterminado, mantendo o bloqueio até a cópia completa. Interfaces novas não alteram schema ou endpoint.

```powershell
.\scripts\verify-android-journey.ps1 -Suite sync -FreshTestInstall -EvidenceDirectory docs/design/evidencias/2026-10-10/sync-android
```

O roteiro usa controles do produto, SQLite/SecureStore/HTTP reais e uma API descartável. A fábrica da variante de teste injeta respostas 429/503/426, interrupção de página e colisão no limite HTTP; a própria API calcula a prova da colisão. Esses modos não são controles do produto nem devem ser usados com contas reais. O lançador fecha o emulador/painel que abriu, inclusive em falha, e preserva processos preexistentes.

## Sincronização automática

`openExpoRuntime(origin)` compõe identidade HTTP, sessão, SQLite/SecureStore e scheduler. A entrada do produto mantém uma instância por processo, encerrada com o dono da jornada. `runtime.sync.status()` expõe o estado de sync e revogações; `runtime.sync.retry()` retoma falhas transitórias esgotadas preservando os IDs. A variante HTTP do harness usa essa fábrica; o harness básico de armazenamento mantém seu transporte fictício.

O adapter combina AppState com expo-network 57.0.2. Abertura, login, retorno ao primeiro plano, reconexão e o período de cinco minutos acionam a sincronização com rede. Enquanto o app estiver inativo ou sem conectividade, nenhum novo envio automático começa; uma resposta já em trânsito pode ser reconciliada. `close()` remove listeners e timers.

Falhas transitórias esperam 1s, 2s, 4s até cinco minutos; um `Retry-After` válido pode exigir mais tempo. Após dez falhas, o núcleo expõe `failed`. Para push, tentativas, prazo e esgotamento ficam no SQLite e sobrevivem ao reinício. Pull sem push e revogações mantêm contadores de retry somente nesta execução; as intenções e capacidades de revogação continuam duráveis. Reautenticação e atualização de protocolo têm estados próprios, sem retry automático infinito. Avisos mínimos existem no recorte 01; ações detalhadas seguem os recortes 03/04.

[Evidências, reprodução e limites deste incremento](../docs/analises/2026-09-28-sincronizacao-automatica.md).

## Retomada do cofre

Com controle de instalação ativo e banco da conta saudáveis, falha do SecureStore conserva leitura/escrita local e pausa requisições remotas. `runtime.session.vaultRecovery()` expõe `{unavailable,cleanupPending}`, sem referências ou mensagens da plataforma. `runtime.session.retryVault()` tenta reler a credencial atual e limpar as antigas; retorna o estado atualizado e libera o scheduler quando o cofre se recupera, conservando o backoff.

Falha de leitura não apaga referência; ausência/conteúdo inválido exige autenticação. A retomada não promove chaves órfãs nem repete refresh incerto. Logout incompleto conserva a fence e só termina após limpeza; login novo só ativa depois da persistência protegida. [Contrato e evidências](../docs/analises/2026-10-07-retomada-do-cofre.md). A UI de retomada e o aceite físico de falhas de SecureStore permanecem pendentes.

## Recuperação de rejeições

A UI futura acessa a conta pela sessão e usa três operações do repositório:

- `recovery()` devolve conteúdo original, motivo, dependências, origem (`server`/`local`) e resolução. Itens com `resolution === null` continuam abertos; os demais preservam o histórico.
- `correct([{operationId,replacementId,command?,occurredAt?}])` cria as substitutas atomicamente. IDs novos devem ser UUID v7. Sem `command`/`occurredAt`, preserva os valores originais; a correção mantém o tipo de comando. Dependências, desfazeres observados e referências ao hábito substituto são remapeados. O novo envelope contém `supersedesOperationId`.
- `discard([operationId])` resolve apenas os itens selecionados; filhas permanecem recuperáveis. O conteúdo original fica no histórico local e pode ser selecionado explicitamente para recuperação posterior.

Rejeição retira a intenção e suas filhas bloqueadas da projeção aplicada. O envio reavalia a fila entre lotes. Pending, retry esgotado e resultado incerto não são correção: exigem reconciliação/retry com o mesmo ID. Colisões de identidade (operação/sequência) exigem prova antes de correção/descarte; rejeição persistida por ID de hábito reutilizado, com hash correspondente, segue a recuperação explícita. Não confundir uma resposta em conflito com prova de que a intenção original nunca foi aceita.

O limite de 4096 referências bloqueia o envio sem cortar contexto. Corrigir não permite remover referências de desfazer para contornar esse limite; o conteúdo continua recuperável até tratamento técnico explícito ou descarte escolhido. A seleção detalhada de recuperação está no recorte 04 de interface. [Evidências e limites](../docs/analises/2026-09-28-recuperacao-de-rejeicoes.md).

## Recuperação de snapshot

O cliente copia cada página para `snapshot_staging` no banco da conta. A base atual e as intenções locais continuam disponíveis até a troca final. Verifica identidade/corte H, progresso de cursor, quantidade de entidades e recibos exatamente correspondentes aos IDs consultados; aceitação/reconciliação posterior a H não confirma uma intenção nessa base.

Ao receber snapshot inacessível/expirado, inicia uma nova cópia uma vez; uma segunda falha devolve `snapshot_retry_required` ao backoff limitado do scheduler. Interrupção por rede ou reinício conserva a base e a fila; a próxima recuperação solicita outro manifesto e substitui somente o staging antigo. Não há retomada da página exata de uma cópia anterior.

Ações gravadas durante as requisições entram nas consultas de recibos, em lotes de 50. A seleção final e a troca são síncronas: base, reconhecimentos, projeções e cursor confirmam juntos. Rejeições/resoluções locais permanecem. Após a troca, ler o feed depois de H antes de enviar pendências. [Evidências e limites](../docs/analises/2026-09-28-snapshots-e-migrations.md).

## Arquivos gerados e migrations

```powershell
pnpm contracts:generate
pnpm db:bundle
```

O primeiro comando gera validadores de resposta sem compilação dinâmica no aparelho. Eles toleram campos adicionais opcionais e recusam tipos obrigatórios desconhecidos. O segundo reúne as migrations SQL numeradas e o journal Drizzle para o Expo. Os testes de desktop leem esses mesmos SQLs pelo migrator oficial.

A migration inicial corresponde ao DDL aprovado. Para uma evolução, adicionar SQL/journal, atualizar spec/00, gerar o bundle e testar preservação de uma base anterior. Não fazer reset do banco para recuperar migration falha. As migrations são SQL revisado; não existe geração automática de tabelas a partir de um schema TypeScript neste recorte.

A abertura nativa de `installation.db` e de cada `account-<id>.db` verifica o histórico Drizzle antes de aplicar migrations. Histórico desconhecido, mais novo ou divergente gera `LocalRecoveryRequired` com `code=local_schema_not_supported`; uma falha do migrator gera `local_migration_failed`. O erro identifica o banco e a abertura fecha seu handle. A camada de apresentação futura deve traduzir o código, sem exibir SQL/causas internas, e orientar atualização compatível ou nova tentativa após corrigir a falha.

Não há reconstrução ou limpeza automática: arquivos das contas, intenções e referências protegidas ficam preservados. O migrator oficial continua responsável pela transação; os testes injetam uma migration seguinte descartável que altera dados e falha, reabrem a versão anterior e depois aplicam a correção. Esse teste não substitui uma fixture da versão anterior para cada migration futura de produção. [Evidências e limites](../docs/analises/2026-09-28-abertura-segura.md).

## Harness Android

`harness/index.ts` é somente um teste nativo sem interface visual. Usa SQLite e SecureStore reais com um transporte de identidade fictício, troca entre A/B e escreve somente o resultado não sensível em `RITMO_HARNESS`. A segunda execução verifica pendências e sessão protegida após reiniciar o processo. A variante básica usa o pacote `dev.ritmo.foundationharness`. A variante HTTP abaixo usa outro pacote. Nenhuma delas é o Briefing ou define a identidade visual.

```powershell
$env:EXPO_PUBLIC_RITMO_TECHNICAL_HARNESS='1'
pnpm exec expo prebuild --platform android --no-install
# Com JAVA_HOME (Java 21) e ANDROID_HOME configurados:
cd android
.\gradlew.bat :app:assembleRelease -PreactNativeArchitectures=x86_64 --max-workers=2 --no-daemon
```

O template do Expo usa seu próprio Gradle 9.3.1; o wrapper 8.14.4 pertence somente à API. O APK do harness é assinado com a chave de debug do template, para teste local. `android/` é gerado e ignorado.

A configuração `node-linker=hoisted` encurta caminhos para CMake/Ninja no Windows; a instalação isolada anterior excedeu o limite de caminhos nativos. O lockfile conserva as versões.

iPhone: nenhum build instalado ou teste físico realizado; a rota a partir do Windows ainda depende de Apple Developer ativo ou de alternativa com Mac. Protótipo recebido em 09/10/2026; Q55=B mantém a rota iOS adiada.

## Harness Android com HTTP real

Na raiz do repositório, com Java 21, Android SDK, Docker e um emulador **já iniciado com Wi-Fi habilitado**:

```powershell
$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr' # ajustar à instalação
$env:ANDROID_HOME='H:\Android\Sdk' # ajustar à instalação
.\scripts\verify-android-http.ps1 -Serial emulator-5560 # usar o serial de adb devices
```

O script verifica app, gera/valida/instala o APK e executa `check bootJar` da API, incluindo os dois métodos Java nativos opt-in: o cenário original e os cinco casos de exceções/isolamento. Ele não inicia o emulador. O teste é restrito a emuladores: desliga temporariamente Wi-Fi/dados, encerra apenas `dev.ritmo.httpharness` e restaura os rádios em `finally`. Não limpa dados nem desinstala o harness anterior. Requer a porta reversa `tcp:18765` livre; remove somente o encaminhamento que criou.

`EXPO_PUBLIC_RITMO_HTTP_HARNESS=1`, aplicado pelo script no prebuild e no bundle, seleciona `dev.ritmo.httpharness` e as entradas `harness/http.ts` e `harness/exceptions.ts`. O plugin permite HTTP somente para `127.0.0.1` nessa variante. O app alcança a API descartável via `adb reverse`; API e SMTP ficam em loopback no host. Sem a flag, o pacote básico e a política normal de rede continuam selecionados. Diretórios nativos são gerados; mudanças no bundle/configuração exigem reconstruir e reinstalar o APK.

O driver `test/integration/android-http.test.ts` usa sessão/runtime e adapters nativos reais: cadastro/onboarding técnico, criação/marcação offline, force-stop/reabertura, restauração de credenciais e dos envelopes, pausa em segundo plano, sincronização automática ao voltar ao primeiro plano, refresh persistido e leitura independente por outro cliente SQLite/HTTP. Replays e marcação do mesmo dia pelo segundo cliente devem conservar 10 XP. A fixture usa UTC/início do dia 0; não substitui a matriz de fusos/virada lógica.

O log `api/build/android-http-integration.log` registra fases e contagens. O logcat `RITMO_HTTP_HARNESS` contém somente os dados sintéticos do cenário, sem credenciais; não adaptar esse logging para contas reais. Cada execução cria uma conta de teste na API descartável; dados locais de execuções anteriores ficam no pacote isolado. [Evidências e limitações](../docs/analises/2026-09-30-http-nativo-android.md).

## Sessão e isolamento

`openExpoSession(compatibility => new HttpIdentity(origin, compatibility))` abre o controle da instalação, recupera interrupções e devolve a sessão. Uma instância é dona do controle por processo; fechá-la libera os bancos, sem executar logout. A UI futura deve obter seu repositório via `Session.account()`, nunca abrir diretamente o arquivo de outra conta. `register`/`login` fazem autenticação online; `accessToken` concentra renovações simultâneas. O transporte HTTP renova e repete no máximo uma vez após 401.

`logout` grava o fence no SQLite antes de esperar pelo SecureStore e funciona sem rede. Falha na limpeza mantém `logging_out`; `restore` retoma essa limpeza. `flushRevocations` envia capacidades pendentes, preservando a da sessão ativa. O scheduler retoma essa fila ao reconectar, inclusive sem conta ativa, com espera independente da sincronização de domínio. Erros de autenticação não apagam dados e permitem reautenticar a mesma conta sem logout; trocar para outra conta exige logout explícito.

`drizzle-control/` migra `installation.db` separadamente dos bancos por conta. O registro contém somente IDs, estados e referências opacas; credenciais ficam no SecureStore com acesso enquanto o dispositivo está desbloqueado e sem migração para outro aparelho no iOS. Não foi habilitada biometria. A instalação nativa usa Crypto 57.0.3 e SecureStore 57.0.4, conforme o SDK 57. O plugin exclui SecureStore do backup Android; isso não constitui backup das pendências nem criptografia de todo SQLite.

A proteção por geração também é verificada em referências antigas de `AccountStore`, antes de ler ou escrever. Respostas atrasadas não são aplicadas; um envio já aceito pelo servidor será reconciliado depois pelo recibo idempotente.

## Recuperação de senha

`HttpIdentity.requestPasswordReset(email)` aceita o 202 vazio; `confirmPasswordReset(token,newPassword)` aceita o 204 vazio e preserva erros tipados. `resetTokenFromLink(link,expectedOrigin)` só aceita a origem HTTPS configurada, caminho `/password-reset` e token no fragmento. A futura UI deve manter o token apenas em memória durante a confirmação, sem enviá-lo a logs/analytics nem armazená-lo nos bancos.

O teste integrado recebe uma mensagem no SMTP local e prova que um refresh recusado após reset não apaga a pendência: ela sobrevive ao reinício e sincroniza após login com a nova senha. O link não deve causar logout automático, pois pode se referir a outra conta; a API não retorna identidade nem sessão na confirmação.

Associação de domínio, recebimento do link pelo sistema operacional e tela de recuperação permanecem pendentes do host/build e do recorte 05 de interface. Evidências: [incremento de recuperação](../docs/analises/2026-09-27-recuperacao-de-senha.md).


## Atualização obrigatória e leitura local

O uso do app passa por `openExpoRuntime`: sessão, identidade HTTP (inclusive recuperação de senha) e sync compartilham a mesma restrição. `session.access()` expõe `{mode: 'read_only', reason: 'update_required'}` ou `{mode: 'read_write', reason: null}`; `session.subscribe` notifica mudanças. A apresentação futura usa esse estado para o aviso e desabilitação das ações. O aviso visual ainda não está implementado.

HTTP 426 ou resposta essencial incompatível grava o par versão/protocolo em `installation_control.blocked_client`, criado por `drizzle-control/0001_client_compatibility.sql`. O mesmo build não pode enviar novamente, criar/corrigir/descartar intenções nem aplicar alterações remotas. Ler projeções, pendências e histórico e fazer logout local continuam possíveis. O scheduler restaura `update_required` mesmo offline. Manutenção interna de tentativas interrompidas e limpeza de credenciais continuam permitidas; envelopes e sequências não são alterados por esse bloqueio.

Um build diferente mantém leitura local até validar uma resposta de sync, login ou refresh da geração atual. Offline, 401, 503 e erros de transporte não liberam escritas. Resposta atrasada após logout não libera nem impõe a restrição da sessão atual. Ao confirmar compatibilidade, o cliente reconcilia/reenvia as intenções originais. Um refresh incerto ou recusado continua exigindo login, conforme as garantias de sessão.

`src/core/sync/client-version.ts` centraliza os cabeçalhos dos dois transportes. Ao publicar um build, atualizar sua versão junto de `app.json` e `package.json`; não reutilizar o par versão/protocolo de um build rejeitado. Transportes/repositórios usados isoladamente nos testes não compõem essas garantias: a entrada de produção é o runtime por sessão. [Evidências e limitações](../docs/analises/2026-09-29-compatibilidade-e-leitura-local.md).


## Correspondência e identidade dos recibos — 07/10/2026

AccountStore compara operationHash/JCS antes de reconhecer ack/pull/snapshot; ausência de prova ou divergência bloqueiam a intenção e dependentes sem reenviar ou trocar IDs. recovery() expõe error.identity com até um recibo original e um de conflito. receiptOperationIds() inclui impasses e IDs originais necessários à consulta no corte H. A abertura confere histórico sem resolução; prova posterior correspondente libera dependentes mantendo prazo/esgotamento de retry. Implantar API antes do app. [Contrato e evidências](../docs/analises/2026-10-07-correspondencia-de-recibos.md); cofre/abertura e aceite nativo continuam nos recortes/gates existentes.


## Recuperação da abertura local — 08/10/2026

`openExpoRuntime(origin)` e `openExpoSession(identity)` conservam um owner quando a instalação não abre. Consulte `recovery()` antes de obter `session`: o diagnóstico informa base lógica/escopo/etapa/classificação e não inclui causas SQL ou segredos. Com controle bloqueado, `session` lança `installation_locked`; no runtime, identidade/scheduler também aguardam abertura saudável. `retryDatabase()` repete a abertura após corrigir a causa/atualizar; `close()` encerra o owner e invalida tentativas atrasadas.

Com controle saudável e falha na conta, a sessão existe, mas `account()` permanece bloqueado; `session.databaseRecovery()` expõe o problema e `session.retryDatabase()` só tenta a conta selecionada na geração atual. Logout e troca de conta mantêm isolamento. O scheduler de domínio fica `paused` até a abertura bem-sucedida. Arquivos e pendências são preservados; nenhum retry reconstrói/restaura/substitui banco. Reparo continua em recorte próprio. A interface do recorte 03 distingue conta/instalação, exibe diagnóstico limitado e oferece nova tentativa sem substituir arquivos. [Contrato, testes e limites](../docs/analises/2026-10-08-recuperacao-da-abertura-local.md).


## Exceções e isolamento nativos — 08/10/2026

`harness/exceptions.ts` exercita Q51–Q53 e M1-10 no mesmo pacote HTTP isolado. O driver `test/integration/android-exceptions.test.ts` contém cinco casos: leitura do cofre indisponível/retomada, open/PRAGMA/migration/rollback, colisão de operação, colisão de sequência e logout offline → B → reentrada online em A. Cada cenário usa seus próprios arquivos nativos por UUID e preserva dados de execuções anteriores.

Falhas de leitura/open/PRAGMA são controladas na fronteira externa, com SecureStore/SQLite reais nos caminhos saudáveis. A migration exclusiva de ensaio executa uma escrita e SQL inválido pelo migrator Expo/Drizzle real; retry deve recuperar os envelopes anteriores. Não muda o bundle de migrations de produção. Outro cliente SQLite/HTTP observa a API descartável e confere recibos, hash Unicode Hermes/Node, isolamento e ausência de XP duplicado.

Para repetir somente estes casos, depois de reconstruir e instalar o APK HTTP, com o emulador visível e Wi-Fi habilitado, executar na raiz:

```powershell
$env:RITMO_ANDROID_SERIAL='emulator-5560' # ajustar ao emulador iniciado
$env:RITMO_ADB=Join-Path $env:ANDROID_HOME 'platform-tools/adb.exe'
.\api\gradlew.bat -p api test --tests dev.ritmo.RuntimeTests.androidRuntimePreservesExceptionsAndAccountIsolationThroughNativeAdapters --no-daemon
```

Não executar o driver isoladamente contra API compartilhada: o Gradle fornece Spring/PostgreSQL/SMTP descartáveis e a origem em loopback. O caminho completo `scripts/verify-android-http.ps1` reconstrói/instala e roda ambos os métodos nativos no check integral. Logs resumidos ficam em `api/build/android-exceptions-integration.log`; logcat `RITMO_ANDROID_ACCEPTANCE` contém apenas fixtures sintéticas e diagnóstico público, sem credenciais.

`scripts/watch-android-tests.ps1 -GradleLog <log-absoluto-da-execução> -CompletionPath <json-absoluto-de-conclusão>` permite abrir um console visível de acompanhamento. O runner deve redirecionar o Gradle para esse log e escrever `{"exitCode":0}` ou o código de falha no JSON ao terminar, inclusive em erro. O painel só mostra fases observadas em logs atuais e fecha cinco segundos após a conclusão; não é uma UI de produto. Emulador e painel iniciados para o teste devem ser encerrados ao terminar, preservando processos preexistentes.

[Evidências, falha inicial do comparador e limites](../docs/analises/2026-10-08-excecoes-e-isolamento-android.md). Falhas controladas não comprovam defeito físico de keystore/disco. UI, iPhone, links HTTPS reais e aceite operacional externo permanecem nos gates existentes.

Verificação da interface de resultados em 10/10/2026: [relatório, evidências e limites](../docs/analises/2026-10-10-interface-resultados-de-sincronizacao.md). Recuperação por link, aparência persistida e aceite integral M1 continuam pendentes.


## Recuperação de senha — interface 05, 12/10/2026

A tela usa PasswordRecovery/Journey e o transporte público de identidade. O +native-intent valida a origem HTTPS/caminho/fragmento antes da navegação e devolve /; somente a intenção transitória é entregue ao controlador. Token não é persistido ou exibido. Solicitação/confirmação não criam uma sessão; a reentrada preserva o banco e as pendências da conta de origem.

Ensaio local visível:

```powershell
.\scripts\verify-android-journey.ps1 -Suite recovery -FreshTestInstall
```

Executar da raiz, com JAVA_HOME e ANDROID_HOME como nos demais ensaios. O lançador valida pacote descartável/emulador, abre acompanhamento e encerra recursos próprios. O método JUnit prepara API/Postgres/SMTP e mailbox/relógio de ensaio em loopback; o driver não usa Resend. A entrada por intent explícito verifica tratamento no app; associações públicas de domínio e iOS permanecem no aceite externo. [Relatório e estado da validação](../docs/analises/2026-10-12-interface-recuperacao-de-senha.md).


## Aparência e leitor de tela — recorte06

Contrato Q56–Q58 em [.scratch/interface-m1/preferencias.md](../.scratch/interface-m1/preferencias.md). Preferências: [resultado anterior](../docs/analises/2026-10-12-interface-aparencia-e-preferencias.md). Toque/leitor e continuidade do Briefing: [incremento atual](../docs/analises/2026-10-12-talkback-e-continuidade-do-briefing.md).

Da raiz, com Node24, dependências do lockfile, JAVA_HOME apontando para Java21 e ANDROID_HOME configurado:

```powershell
.\scripts\build-reader-observer.ps1
.\scripts\verify-android-accessibility.ps1 -Avd Pixel_9 -Serial emulator-5560 -EvidenceDirectory docs/design/evidencias/2026-10-12/leitor-android-sdk/repeticao
```

O APK de jornada deve ter sido compilado com EXPO_PUBLIC_RITMO_JOURNEY_TEST=1 e o hábito sintético preparado pela suite appearance. O leitor não inicia API nem recria contas. Atualiza somente dev.ritmo.journeytest com install -r, preservando os dados. A compilação do pequeno observador usa SDK build-tools36/plataforma35, sem AndroidX ou Gradle adicional, com assinatura convencional de debug. Ele é testOnly, não tem activity/permissões de rede e por padrão consulta apenas as janelas próprias de dev.ritmo.journeytest. O modo isolado ReadOnly seleciona dev.ritmo.readonlytest por argumento validado; a lista aceita somente esses dois pacotes sintéticos.

O lançador inicia um emulador próprio e visível, verifica serial/AVD/PID e listener em loopback e exige JWT. A política exclusiva em scripts/android-reader-access.json permite apenas sendTouch, protegido pelo audience do token. A ponte carrega o proto do SDK instalado, assina tokens ES256 de60s em memória e registra somente a chave pública temporária. Chamadas sem credencial, com emissor diferente ou audience errado precisam ser recusadas; o mesmo payload autenticado deve funcionar. Nenhum token é colocado em ambiente, linha de comando, log ou evidência.

Preflight físico: marcar/desfazer sem leitor. Com TalkBack ativo continuamente: explorar não pode marcar nem selecionar; ativação altera o estado real; o observador FLAG_DONT_SUPPRESS_ACCESSIBILITY_SERVICES confere o nó exato com foco e estado. Verifica também a aba Ajustes, escolha de aparência inicialmente diferente e mudança de foco com gesto linear. Consultas não usam uiautomator dump nem pausam o leitor. O cumprimento confirmado deve manter o foco no hábito após a atualização do Briefing.

A execução normal refaz6 paletas a100%/200% e mede36 alvos antes do leitor a100%. O limite de44 unidades é convertido com arredondamento nativo conforme a densidade. Isso não aceita toda a leitura falada, teclado/sheets/erros a200% ou VoiceOver.

```powershell
.\scripts\verify-android-accessibility.ps1 -SkipInstall -ReaderOnly -PaletteEvidenceDirectory docs/design/evidencias/2026-10-12/leitor-android-sdk/rodada7 -EvidenceDirectory docs/design/evidencias/2026-10-12/leitor-android-sdk/repeticao-leitor
```

O hash instalado é conferido em toda execução e salvo em installed-apk.json. SkipInstall exige hash do APK instalado igual ao build local. ReaderOnly exige12 capturas/36 alvos no palette-summary.json da pasta indicada, todas presentes e com o mesmo hash; não aceita paletas de APK anterior. O resumo registra a origem dessa prova. A opção não dispensa checks/build.

O emulador Pixel_9 Google Play funciona pela ponte sem root, alteração de SELinux, troca de imagem ou descarte de dados. Processo/endpoint preexistente não é assumido pelo teste. Emulador/painel visíveis, pacote temporário do observador, chave pública e configurações de acessibilidade/fonte/modo/permissão são encerrados/removidos/restaurados somente quando pertencem ao ensaio, inclusive em falha. O driver registra os valores originais em reader-environment.json e o resultado da restauração em reader-cleanup.json; desconexão não equivale a recuperação confirmada. A instalação da jornada é preservada. Não remover pacotes preexistentes do observador.

Se a instalação convencional falhar por espaço, TrimCaches solicita apenas liberação de caches ao Android, preservando bases e pacotes. Neste AVD isso liberou pouco. A instalação incremental com assinatura v4 resolveu a atualização sem desinstalar a jornada; o SDK36 aceita true, mas não o valor only da documentação mais recente. Gere a assinatura de debug antes do ensaio, registre o novo hash e valide-o no dispositivo:

```powershell
& "$env:JAVA_HOME/bin/java.exe" --enable-native-access=ALL-UNNAMED -jar "$env:ANDROID_HOME/build-tools/36.0.0/lib/apksigner.jar" sign --ks app/android/app/debug.keystore --ks-pass pass:android --key-pass pass:android --v4-signing-enabled true app/android/app/build/outputs/apk/release/app-release.apk
```

Esses valores são exclusivos da chave pública de teste padrão Android. A assinatura pode alterar o hash do APK; o driver usa o artefato final, não reutiliza paletas anteriores e confirma todos os bytes instalados. Não adaptar esse comando para assinatura de produção.

InspectOnly mostra armazenamento/pacotes e fecha somente o emulador próprio. RemoveOldHttpHarness permanece opt-in histórico de limpeza exclusivamente de dev.ritmo.httpharness; Q59 autorizou a remoção específica já feita em12/10, não uma limpeza geral.

Briefing local: providers sem loader renderizam a projeção já confirmada da sessão. A atualização não substitui os controles por carregamento, evitando perda do foco. Providers com carregamento assíncrono e falhas continuam isolados por card. Não há marcação antecipada à escrita local nem consulta nova de banco na renderização.

### Matriz do leitor com texto ampliado

O roteiro opt-in `android-reader-matrix.test.ts` exercita cadastro/onboarding reais, teclado com texto200%, hábito longo, diálogos e falhas locais preservadas. Q60=A foi corrigida e validada no Android em15/10:18 fases e cinco diálogos passaram, com título inicial/retorno realmente focados, conforme [relatório](../docs/analises/2026-10-15-talkback-foco-dos-dialogos.md). Preparar o APK journeytest correspondente e executar pela raiz:

```powershell
$env:RITMO_READER_OBSERVE_FOCUS=$null # Q60=A: exigir titulo inicial e retorno
.\scripts\verify-android-accessibility.ps1 -Matrix -GpuMode host -MemoryMegabytes 2048 -EvidenceDirectory docs/design/evidencias/2026-10-15/leitor-matriz/repeticao
```

`Matrix` prepara a API/PostgreSQL descartáveis antes de abrir o emulador. A fixture Java confirma o servidor pronto, o lançador verifica a propriedade do emulador e publica seu discovery em uma pasta temporária exclusiva; só então começa o Node. O cancelamento libera a fixture. O painel mostra as fases concluídas; logs completos ficam em `.scratch/runtime/interface/reader-matrix-gradle.log` e `api/build/android-reader-integration.log`. Não é um servidor de desenvolvimento persistente.

O observador opta por janelas interativas em ordem de camada. Consulta somente a janela de aplicação da jornada, inclusive o diálogo, e apenas a geometria do teclado; campos de senha têm texto suprimido. A inserção sintética por teclas de hardware não aceita edição falada, cursor ou seleção. A rolagem física com TalkBack usa dois contatos simultâneos. O driver verifica foco, campos acima do IME, entrada/retorno dos diálogos, alvos mínimos e restauração; não repete ativações após resultado de transporte desconhecido.

`GpuMode` conserva swiftshader como padrão e permite host para diagnóstico; `MemoryMegabytes` não altera o arquivo do AVD. A instalação do pequeno observador usa `--no-incremental`; a jornada mantém seus dados e o hash obrigatório. `matrix-summary.json` registra o resultado integral, as fases efetivas, alvos e hash. Q60=A confirmou título inicial e retorno protegido em14/10/2026. A repetição deve deixar `RITMO_READER_OBSERVE_FOCUS` ausente e instalar o APK novo; `SkipInstall` só cabe após conferir os bytes instalados. O modo histórico `RITMO_READER_OBSERVE_FOCUS=1` permanece disponível para diagnóstico: sempre mantém `passed=false` e separa `functionalPassed`; não aceita o contrato de foco. Resumo parcial ou configuração do leitor ativa não significa aprovação. Preserve as tentativas reprovadas.

Desempenho instrumentado, recuperação de senha/rejeições/identidade incerta integralmente com leitor, edição falada e iPhone/VoiceOver continuam no recorte06/aceite existente. Veja a [matriz](../.scratch/interface-m1/matriz-leitor.md) para separar roteiro previsto de resultado verificado.


15/10/2026 — extensão das revisões: a matriz estrita passou24 fases/nove registros de foco a200%,75 controles/13 campos-IME, no APK7430a6f8. [Resultado](../docs/analises/2026-10-15-talkback-revisoes-de-sincronizacao.md). Agora inclui recusa real por nome, correção com dependente, retorno ao acionador sem rolagem do driver, foco no título após remoção do acionador, diagnóstico de identidade incerta e persistência/trabalho independente com conferência HTTP. A camada de foco mede/revela o destino no viewport antes de selecioná-lo. O parser do observador aceita ambos os delimitadores de atributos XML. Diagnóstico expandido é capturado e recolhido antes do fechamento; não equivale à travessia falada integral do JSON. Paletas de APK anterior não aceitam esse build; demais estados/recuperação/preempção/desempenho/iOS continuam no plano.


### Recuperação de senha com TalkBack

```powershell
.\scripts\verify-android-accessibility.ps1 -Recovery -SkipInstall -GpuMode host -MemoryMegabytes 2048 -EvidenceDirectory docs/design/evidencias/2026-10-15/leitor-recuperacao/repeticao
```

`Recovery` seleciona a matriz com API/PostgreSQL/SMTP e controle de relógio em loopback, preparado antes do emulador; a variante anterior de recuperação e a matriz geral continuam disponíveis. Mesmo APK/instalação preservados; `SkipInstall` exige hash igual. A fixture não usa Resend e suas quotas elevadas não aceitam rate limiting. A execução de15/10 passou12 fases a200%, com duas interrupções de diálogo,44 medições de controles/14 campos-IME. Inclui pedido/offline, entrada quente/fria, confirmações/links inválidos, preempção, reautenticação/sync e isolamento. [Relatório e limites](../docs/analises/2026-10-15-talkback-recuperacao-de-senha.md).

XML persistido redige valores de senha/tokens da fixture; capturas ocorrem com senha oculta. O roteiro registra a seleção inicial da página, sem criar regra de título para páginas a partir de Q60. Intent explícito não aceita associações públicas de domínio; janela superior/teclado sintético não comprovam navegação completa entre janelas/edição falada. Configurações restauradas e recursos próprios fechados inclusive em falha.

## Travessia linear de diálogos no TalkBack

Roteiro Q60/REQ-DS-003: `.\scripts\verify-android-accessibility.ps1 -Traversal -SkipInstall -GpuMode host -MemoryMegabytes 2048 -EvidenceDirectory '.scratch/runtime/interface/leitor-dialogos-reexecucao'`, a partir da raiz, com Java21/SDK/Docker preparados e observador recompilado por `build-reader-observer.ps1`. `-SkipInstall` exige hash do APK instalado igual ao local. `-Traversal` implica `-Matrix` e não combina com `-Recovery`; não usar modo de observação de foco para aceite.

Além da jornada real da matriz, percorre privacidade, exclusão, saída, painel e revisões aninhadas nos dois sentidos e nas bordas. Cada passo confere janela/nó nativos em todas as janelas interativas próprias retornadas, sem suspender o TalkBack ou coletar conteúdo de outros apps/IME. O driver comum continua consultando somente os nós da janela superior. Títulos informativos não recebem a restrição de tamanho dos controles; ações continuam exigindo44 unidades. [Contrato de teste e limites](../.scratch/interface-m1/leitor-dialogos.md).

Resultado de16/10: [matriz de31 fases e sete percursos aprovada](../docs/analises/2026-10-16-talkback-navegacao-dos-dialogos.md), com restauração/fechamento dos recursos,227 testes/tipos/lint do app e API check completo.06/M1 continuam abertos pelos limites registrados.

## Descarte e esperas remotas com TalkBack

Da raiz: `.\scripts\verify-android-accessibility.ps1 -SyncStates -GpuMode host -MemoryMegabytes 2048 -EvidenceDirectory '.scratch/runtime/interface/leitor-sync-estados-reexecucao'`, com Java21/SDK/Docker preparados. Exige APK journeytest com as fixtures `sync-push-429`/`sync-push-503`; `-SkipInstall` só vale quando o hash instalado é igual ao local. O lançador preserva a instalação ao atualizar e fecha somente recursos próprios.

Roteiro delimitado: cancelar/confirmar descarte por item, originais/dependentes após reinício, histórico, estado canônico independente, espera mínima de push após429/503, interrupção/retomada da cópia inicial e isolamento de contas. Falhas push deixam o pull real passar; contadores de pull sem push são por execução e não demonstram a espera durável da fila. Prazos exibidos têm precisão de segundos; o núcleo tem testes do prazo persistido exato. Texto200%, exploração/ativação físicas e observação nativa sem suspender o leitor.

`-SyncStates` implica `-Matrix` e não combina com Recovery/Traversal/modo de observação. Atualização obrigatória, retry esgotado, cópia com staging não zero interrompida, edição falada por caractere/cursor, desempenho e VoiceOver não recebem aceite novo por esse roteiro. [Plano e estado da verificação](../.scratch/interface-m1/leitor-descarte-e-espera.md).

Resultado nativo de 16/10: [nove fases aprovadas](../docs/analises/2026-10-16-talkback-descarte-e-espera.md), 79 medições de controles/12 campos-IME a 200%, com restauração e fechamento dos recursos. Check completo da API aprovado em 10m43s: 85 executados/oito nativos opt-in ignorados, zero falhas/erros, 13 verificações operacionais e modularidade; 06/M1 permanecem abertos.


## Atualização obrigatória com TalkBack em instalação isolada

Da raiz, com APK/instalação da jornada já preparados, Java21, SDK Android e Docker:

```powershell
.\scripts\build-reader-observer.ps1
.\scripts\build-android-readonly.ps1
.\scripts\verify-android-accessibility.ps1 -ReadOnly -GpuMode host -MemoryMegabytes 4096 -EvidenceDirectory '.scratch/runtime/interface/leitor-readonly-reexecucao'
```

O builder conserva o APK normal, regenera Android para o pacote de ensaio e gera current.apk/updated.apk em .scratch/runtime/interface/readonly-journey, com identidades sintéticas 0.1.0/0.1.1 e protocolo m1.1. Regenera a configuração normal e restaura o APK ao encerrar, inclusive em falha. No passo de bundle, libera o reset de cache que a CLI Expo desativa sob CI; depois extrai e compara os bundles dos dois APKs e exige a identidade0.1.1 apenas no atualizado. Não publica versão nova. O lançador recusa pacote de ensaio preexistente, instala somente dev.ritmo.readonlytest e o remove ao terminar, conferindo o hash de dev.ritmo.journeytest antes/depois. Sem limpeza de bancos/guard durante o exercício ou wipe; a desinstalação final apaga somente os dados descartáveis da fixture, preservando a instalação original.

O AVD precisa de espaço para manter o APK atual durante a instalação substituta. O Pixel_9 original chegou ao fluxo, mas recusou a atualização por espaço. O ensaio foi movido para um AVD separado `Ritmo_ReadOnly`, API35/perfil Pixel_9, com8GiB de dados novos e TalkBack da imagem instalada. O controle journeytest nesse AVD é uma instalação nova do APK preservado; os bancos da instalação anterior não foram copiados. Para usar esse ambiente local já preparado, da raiz:

```powershell
$env:ANDROID_AVD_HOME = Join-Path $PWD '.scratch/runtime/interface/readonly-avds'
.\scripts\verify-android-accessibility.ps1 -ReadOnly -Avd Ritmo_ReadOnly -GpuMode host -MemoryMegabytes 4096 -EvidenceDirectory '.scratch/runtime/interface/leitor-readonly-reexecucao'
```

O diretório do AVD é local/ignorado; em outra máquina, crie um AVD de teste com espaço suficiente e prepare nele o APK normal da jornada antes do lançador. Não use wipe ou remova pacotes preexistentes para satisfazer o roteiro.

`-ReadOnly` implica `-Matrix`, incompatível com Recovery/Traversal/SyncStates/SkipInstall. Testa leitura/pendências/recusa, controles e campos bloqueados, reinício, logout/login, diagnóstico e atualização compatível após conta encerrada. TalkBack a 200% usa toque físico; texto sintético entra por teclas de hardware. Não aceita edição falada por caractere/cursor, atualização offline com conta ativa, desempenho, paletas integrais, iPhone/VoiceOver ou M1 completo. [Plano e estado](../.scratch/interface-m1/leitor-somente-leitura.md), [relatório](../docs/analises/2026-10-17-talkback-somente-leitura.md).


Resultado de 18/10: [rodada 12 aprovada](../docs/analises/2026-10-17-talkback-somente-leitura.md), 11 fases, 76 controles/11 campos-IME, atualizando sem reset e convergindo originais/diagnóstico/10 XP sem duplicação. Restauração/isolamento confirmados e recursos próprios fechados. Tipos/lint e 231 testes do app; API check completo aprovado. Recusa de alvo do observador verificada separadamente; as demais tentativas não recebem aceite integral. 06/M1 permanecem abertos pelos limites acima.

## Retentativas esgotadas com TalkBack

Da raiz, após preparar observador, APK isolado atual e controle journeytest conforme a seção anterior:

```powershell
$env:ANDROID_AVD_HOME = Join-Path $PWD '.scratch/runtime/interface/readonly-avds'
.\scripts\verify-android-accessibility.ps1 -RetryExhausted -Avd Ritmo_ReadOnly -GpuMode host -MemoryMegabytes 4096 -EvidenceDirectory '.scratch/runtime/interface/leitor-retry-reexecucao'
```

`-RetryExhausted` implica `-Matrix`, não combina com Recovery/Traversal/SyncStates/ReadOnly/SkipInstall e reutiliza somente current.apk/dev.ritmo.readonlytest; não instala updated.apk. O lançador exige fixture ausente, preserva o controle journeytest e remove apenas os pacotes temporários que instalou. Java21, SDK e Docker precisam estar preparados. Em outra máquina, preparar um AVD de teste com espaço livre e o APK normal antes do lançador; não apagar dados preexistentes.

O roteiro mantém o relógio/backoff reais e usa a fixture HTTP existente sync-push-503: pull real e push recusado antes de encaminhar, Retry-After60. Nove prazos e a parada na décima falha levam pelo menos808s entre a primeira e a última. O Retry-After60 da décima recusa também permanece após reinício; o botão fica bloqueado até vencer. O vencimento só habilita a ação, sem autoenvio. Conferir intenção/dependente/10 XP provisórios, reinício sem falha, reconexão/foreground sem reenvio, retomada manual física pelo TalkBack e convergência independente sem duplicação. Tela a200%; timeout de desligamento da tela temporário e restaurado. Texto sintético por teclas de hardware não aceita edição falada. [Plano e limites](../.scratch/interface-m1/leitor-retentativas-esgotadas.md).
