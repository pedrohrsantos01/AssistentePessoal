# App — núcleo local e harness técnico

Expo 57.0.25, React Native 0.86.3, React 19.2.3, TypeScript 6.0.3, expo-sqlite 57.0.3 e Drizzle 0.45.3.

## Verificar

```powershell
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
```

A suíte usa arquivos SQLite reais através de better-sqlite3/Drizzle. O mesmo `AccountStore` é usado pelo adapter Expo/Drizzle. O teste com dois clientes, HTTP e Postgres é iniciado por `api/gradlew.bat check`; o caminho reproduzível para todos os testes de integração é o Gradle da API.

`AccountStore.enqueue` grava a intenção imutável, sequência e projeção na mesma transação síncrona. Recebimento de ack atualiza entidades por revisão e não avança o cursor; pull reconhece recibos antes de reaplicar pendências. O snapshot usa staging no mesmo banco. Não há `await` dentro de transações Drizzle, evitando o alistamento de consultas assíncronas externas.

`synchronize` recebe um transporte vinculado à mesma conta, valida respostas geradas do OpenAPI, recupera snapshot quando necessário e troca lotes de até 50 operações. Erros preservam o banco. O uso autenticado passa por `Session.synchronize`, que verifica a geração da sessão e renova acesso quando necessário. Scheduler/backoff continuam pendentes.

## Arquivos gerados e migrations

```powershell
pnpm contracts:generate
pnpm db:bundle
```

O primeiro comando gera validadores de resposta sem compilação dinâmica no aparelho. Eles toleram campos adicionais opcionais e recusam tipos obrigatórios desconhecidos. O segundo reúne as migrations SQL numeradas e o journal Drizzle para o Expo. Os testes de desktop leem esses mesmos SQLs pelo migrator oficial.

A migration inicial corresponde ao DDL aprovado. Para uma evolução, adicionar SQL/journal, atualizar spec/00, gerar o bundle e testar preservação de uma base anterior. Não fazer reset do banco para recuperar migration falha. As migrations são SQL revisado; não existe geração automática de tabelas a partir de um schema TypeScript neste recorte.

## Harness Android

`harness/index.ts` é somente um teste nativo sem interface visual. Usa SQLite e SecureStore reais com um transporte de identidade fictício, troca entre A/B e escreve somente o resultado não sensível em `RITMO_HARNESS`. A segunda execução verifica pendências e sessão protegida após reiniciar o processo. O teste HTTP real usa a suíte integrada de desktop; não equivale à rede nativa Android. Não é o Briefing nem define a identidade visual.

```powershell
pnpm exec expo prebuild --platform android --no-install
# Com JAVA_HOME (Java 21) e ANDROID_HOME configurados:
cd android
.\gradlew.bat :app:assembleRelease -PreactNativeArchitectures=x86_64 --max-workers=2 --no-daemon
```

O template do Expo usa seu próprio Gradle 9.3.1; o wrapper 8.14.4 pertence somente à API. O APK do harness é assinado com a chave de debug do template, para teste local. `android/` é gerado e ignorado.

A configuração `node-linker=hoisted` encurta caminhos para CMake/Ninja no Windows; a instalação isolada anterior excedeu o limite de caminhos nativos. O lockfile conserva as versões.

iPhone: nenhum build instalado ou teste físico realizado; a rota a partir do Windows ainda depende de Apple Developer ativo ou de alternativa com Mac. Protótipo visual permanece aberto.

## Sessão e isolamento

`openExpoSession(new HttpIdentity(origin))` abre o controle da instalação, recupera interrupções e devolve a sessão. Uma instância é dona do controle por processo; fechá-la libera os bancos, sem executar logout. A UI futura deve obter seu repositório via `Session.account()`, nunca abrir diretamente o arquivo de outra conta. `register`/`login` fazem autenticação online; `accessToken` concentra renovações simultâneas. O transporte HTTP renova e repete no máximo uma vez após 401.

`logout` grava o fence no SQLite antes de esperar pelo SecureStore e funciona sem rede. Falha na limpeza mantém `logging_out`; `restore` retoma essa limpeza. `flushRevocations` envia capacidades pendentes, preservando a da sessão ativa, e deve ser chamado pela futura rotina de conectividade. O scheduler dessa rotina ainda não existe. Erros de autenticação não apagam dados e permitem reautenticar a mesma conta sem logout; trocar para outra conta exige logout explícito.

`drizzle-control/` migra `installation.db` separadamente dos bancos por conta. O registro contém somente IDs, estados e referências opacas; credenciais ficam no SecureStore com acesso enquanto o dispositivo está desbloqueado e sem migração para outro aparelho no iOS. Não foi habilitada biometria. A instalação nativa usa Crypto 57.0.3 e SecureStore 57.0.4, conforme o SDK 57. O plugin exclui SecureStore do backup Android; isso não constitui backup das pendências nem criptografia de todo SQLite.

A proteção por geração também é verificada em referências antigas de `AccountStore`, antes de ler ou escrever. Respostas atrasadas não são aplicadas; um envio já aceito pelo servidor será reconciliado depois pelo recibo idempotente.
