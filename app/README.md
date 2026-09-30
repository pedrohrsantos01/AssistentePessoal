# App — núcleo local e harness técnico

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

## Sincronização automática

`openExpoRuntime(origin)` compõe identidade HTTP, sessão, SQLite/SecureStore e scheduler. A futura entrada do app deve manter uma instância e chamar `close()` no encerramento. `runtime.sync.status()` expõe o estado de sync e revogações; `runtime.sync.retry()` retoma falhas transitórias esgotadas preservando os IDs. A variante HTTP do harness usa essa fábrica; o harness básico de armazenamento mantém seu transporte fictício.

O adapter combina AppState com expo-network 57.0.2. Abertura, login, retorno ao primeiro plano, reconexão e o período de cinco minutos acionam a sincronização com rede. Enquanto o app estiver inativo ou sem conectividade, nenhum novo envio automático começa; uma resposta já em trânsito pode ser reconciliada. `close()` remove listeners e timers.

Falhas transitórias esperam 1s, 2s, 4s até cinco minutos; um `Retry-After` válido pode exigir mais tempo. Após dez falhas, o núcleo expõe `failed`. Para push, tentativas, prazo e esgotamento ficam no SQLite e sobrevivem ao reinício. Pull sem push e revogações mantêm contadores de retry somente nesta execução; as intenções e capacidades de revogação continuam duráveis. Reautenticação e atualização de protocolo têm estados próprios, sem retry automático infinito. A UI de aviso/ação ainda depende do protótipo.

[Evidências, reprodução e limites deste incremento](../docs/analises/2026-09-28-sincronizacao-automatica.md).

## Recuperação de rejeições

A UI futura acessa a conta pela sessão e usa três operações do repositório:

- `recovery()` devolve conteúdo original, motivo, dependências, origem (`server`/`local`) e resolução. Itens com `resolution === null` continuam abertos; os demais preservam o histórico.
- `correct([{operationId,replacementId,command?,occurredAt?}])` cria as substitutas atomicamente. IDs novos devem ser UUID v7. Sem `command`/`occurredAt`, preserva os valores originais; a correção mantém o tipo de comando. Dependências, desfazeres observados e referências ao hábito substituto são remapeados. O novo envelope contém `supersedesOperationId`.
- `discard([operationId])` resolve apenas os itens selecionados; filhas permanecem recuperáveis. O conteúdo original fica no histórico local e pode ser selecionado explicitamente para recuperação posterior.

Rejeição retira a intenção e suas filhas bloqueadas da projeção aplicada. O envio reavalia a fila entre lotes. Pending, retry esgotado e resultado incerto não são correção: exigem reconciliação/retry com o mesmo ID. `id_content_conflict` também exige esclarecer o resultado original antes de correção/descarte por esta interface. Não confundir uma resposta em conflito com prova de que a intenção original nunca foi aceita.

O limite de 4096 referências bloqueia o envio sem cortar contexto. Corrigir não permite remover referências de desfazer para contornar esse limite; o conteúdo continua recuperável até tratamento técnico explícito ou descarte escolhido. A UI de aviso/seleção ainda depende do protótipo. [Evidências e limites](../docs/analises/2026-09-28-recuperacao-de-rejeicoes.md).

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
pnpm exec expo prebuild --platform android --no-install
# Com JAVA_HOME (Java 21) e ANDROID_HOME configurados:
cd android
.\gradlew.bat :app:assembleRelease -PreactNativeArchitectures=x86_64 --max-workers=2 --no-daemon
```

O template do Expo usa seu próprio Gradle 9.3.1; o wrapper 8.14.4 pertence somente à API. O APK do harness é assinado com a chave de debug do template, para teste local. `android/` é gerado e ignorado.

A configuração `node-linker=hoisted` encurta caminhos para CMake/Ninja no Windows; a instalação isolada anterior excedeu o limite de caminhos nativos. O lockfile conserva as versões.

iPhone: nenhum build instalado ou teste físico realizado; a rota a partir do Windows ainda depende de Apple Developer ativo ou de alternativa com Mac. Protótipo visual permanece aberto.

## Harness Android com HTTP real

Na raiz do repositório, com Java 21, Android SDK, Docker e um emulador **já iniciado com Wi-Fi habilitado**:

```powershell
$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr' # ajustar à instalação
$env:ANDROID_HOME='H:\Android\Sdk' # ajustar à instalação
.\scripts\verify-android-http.ps1 -Serial emulator-5560 # usar o serial de adb devices
```

O script verifica app, gera/valida/instala o APK e executa `check bootJar` da API, incluindo o teste nativo opt-in. Ele não inicia o emulador. O teste é restrito a emuladores: desliga temporariamente Wi-Fi/dados, encerra apenas `dev.ritmo.httpharness` e restaura os rádios em `finally`. Não limpa dados nem desinstala o harness anterior. Requer a porta reversa `tcp:18765` livre; remove somente o encaminhamento que criou.

`EXPO_PUBLIC_RITMO_HTTP_HARNESS=1`, aplicado pelo script no prebuild e no bundle, seleciona `dev.ritmo.httpharness` e a entrada `harness/http.ts`. O plugin permite HTTP somente para `127.0.0.1` nessa variante. O app alcança a API descartável via `adb reverse`; API e SMTP ficam em loopback no host. Sem a flag, o pacote básico e a política normal de rede continuam selecionados. Diretórios nativos são gerados; mudanças no bundle/configuração exigem reconstruir e reinstalar o APK.

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

Associação de domínio, recebimento do link pelo sistema operacional e tela de recuperação permanecem pendentes do host/build e do protótipo. Evidências: [incremento de recuperação](../docs/analises/2026-09-27-recuperacao-de-senha.md).


## Atualização obrigatória e leitura local

O uso do app passa por `openExpoRuntime`: sessão, identidade HTTP (inclusive recuperação de senha) e sync compartilham a mesma restrição. `session.access()` expõe `{mode: 'read_only', reason: 'update_required'}` ou `{mode: 'read_write', reason: null}`; `session.subscribe` notifica mudanças. A apresentação futura usa esse estado para o aviso e desabilitação das ações. O aviso visual ainda não está implementado.

HTTP 426 ou resposta essencial incompatível grava o par versão/protocolo em `installation_control.blocked_client`, criado por `drizzle-control/0001_client_compatibility.sql`. O mesmo build não pode enviar novamente, criar/corrigir/descartar intenções nem aplicar alterações remotas. Ler projeções, pendências e histórico e fazer logout local continuam possíveis. O scheduler restaura `update_required` mesmo offline. Manutenção interna de tentativas interrompidas e limpeza de credenciais continuam permitidas; envelopes e sequências não são alterados por esse bloqueio.

Um build diferente mantém leitura local até validar uma resposta de sync, login ou refresh da geração atual. Offline, 401, 503 e erros de transporte não liberam escritas. Resposta atrasada após logout não libera nem impõe a restrição da sessão atual. Ao confirmar compatibilidade, o cliente reconcilia/reenvia as intenções originais. Um refresh incerto ou recusado continua exigindo login, conforme as garantias de sessão.

`src/core/sync/client-version.ts` centraliza os cabeçalhos dos dois transportes. Ao publicar um build, atualizar sua versão junto de `app.json` e `package.json`; não reutilizar o par versão/protocolo de um build rejeitado. Transportes/repositórios usados isoladamente nos testes não compõem essas garantias: a entrada de produção é o runtime por sessão. [Evidências e limitações](../docs/analises/2026-09-29-compatibilidade-e-leitura-local.md).
