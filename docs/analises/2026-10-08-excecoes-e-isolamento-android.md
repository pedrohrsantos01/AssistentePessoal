# Android — exceções e isolamento de contas

Data: 08/10/2026. Origem: autorização de Pedro para testar os quatro itens independentes do domínio, [plano deste recorte](../../.scratch/aceite-android-excecoes/spec.md), [tarefa 05 do M1](../../.scratch/primeiro-marco/issues/05-completar-sessao-e-recuperacao.md) e [spec/13 §22](../../specs/13-contrato-primeiro-marco.md#22-recuperação-de-exceções--q51q52q53-07102026).

## Resultado e alcance

Os cinco casos nativos passaram na repetição direcionada e no check integral: cofre, abertura local, colisão de operação, colisão de sequência e isolamento A/B/A. App typecheck/lint/121 testes, API check/bootJar com 87 testes Java e 13 verificações operacionais aprovados, sem falhas ou testes ignorados. Emulador e painel encerrados.

A mudança amplia a prova técnica dos comportamentos aprovados em Q51–Q53 e M1-10. Não altera módulos de produção, schema, dependências, protocolo ou interface. M1 continua aberto para interface/Q28, links reais, aparelhos e aceite operacional externo.

## Fronteiras exercitadas

O APK usa Hermes/React Native, Expo SQLite/Drizzle, SecureStore, fetch e adapters reais de AppState/rede. O Gradle inicia Spring Boot em porta aleatória, PostgreSQL e SMTP descartáveis. Um segundo cliente SQLite/HTTP de desktop consulta o servidor e compara projeções, envelopes e recibos; não representa o iPhone.

Cada cenário cria bancos nativos próprios com UUID da execução e contas fictícias em `example.test`. A instalação usa `install -r` no pacote isolado `dev.ritmo.httpharness`, validado com aapt2. Não há limpeza de dados, reinstalação destrutiva, recuperação de banco a partir de arquivos soltos ou uso de contas reais.

Falhas de leitura do cofre e open/PRAGMA são injetadas na fronteira externa do harness. Leituras saudáveis, gravações e remoções usam SecureStore real; conexões saudáveis usam SQLite real. Isso não prova indisponibilidade física do keystore ou corrupção arbitrária do disco.

A migration adicional pertence somente ao ensaio: pelo migrator Expo/Drizzle real, altera um envelope e consulta uma tabela inexistente antes do commit. A tentativa seguinte usa o bundle normal; compara os envelopes integralmente com os anteriores. Não é uma migration de produção nem modifica seus arquivos.

## Casos e observações

| Caso | Prova observada | Resultado da repetição direcionada |
|---|---|---|
| Cofre/Q52 | Duas intenções sobrevivem ao force-stop; leitura falha e retry ainda falha; scheduler pausa; duas novas intenções locais continuam. Outro cliente confirma ausência de envio. Retry saudável retoma automaticamente, refresh e nova reabertura funcionam | 4 pendências/20 XP durante a pausa; 0/20 após convergência e replay |
| Abertura/Q51 | Falhas de open, PRAGMA e migration da conta bloqueiam seu acesso, fecham o handle adquirido e pausam o scheduler. Falha de open da instalação não abre conta nem lê o cofre. Retry público conserva todos os envelopes após rollback | 2 pendências/10 XP preservados em cada retry; 0/10 após sincronização e replay |
| Colisão de operação/Q53 | Servidor recebe conteúdo diferente para o mesmo operationId. Intenção divergente e filha permanecem bloqueadas; correção/descarte recusados. Trabalho independente sincroniza; consulta no corte H conserva recibo original e confirma filha não processada | 2 impasses persistidos após novo processo; 10 XP, sem envio da filha |
| Colisão de sequência/Q53 | Mesmo deviceId/clientSequence com outro operationId e conteúdo. Mesmas garantias de preservação, diagnóstico, dependência, consulta e continuidade independente | 2 impasses persistidos após novo processo; 10 XP |
| Contas/M1-10 | Logout com rádios/reverse desligados encerra acesso e referência antiga; login offline recusado. B entra online sem dados de A. Reentrada online em A recupera seus envelopes exatos; referência antiga de B bloqueada. Projeções remotas conferidas separadamente | A e B conservam 10 XP cada; nenhuma intenção de A enviada pela sessão B |

Os impasses de identidade saem da fila enviável, mas permanecem em `recovery()`: zero pendências não significa descarte. O recibo da filha continua `notProcessedAtH`, sem confundir ausência no corte com rejeição. O hash integral de envelope Unicode (`Café 😀`) calculado em Hermes coincide com Node.

Replays são explícitos e precisam devolver recibos anteriores; em seguida a projeção é consultada novamente para verificar XP. Force-stop é usado entre fases com conexões abertas, sem fechamento gracioso do banco pelo harness.

## Falha inicial e correção do ensaio

A primeira rodada direcionada aprovou 3/5 casos; ambas as colisões falharam em `original_receipt_changed`. O comparador do harness serializava os objetos sem ordenar suas propriedades. A resposta inicial e o replay de JSONB continham todos os mesmos campos/valores, mas em outra ordem.

O comparador agora ordena recursivamente as chaves dos objetos, mantendo ordem de arrays e conferindo todos os campos e valores. As duas repetições emitiram `receiptOrderChanged: true` e passaram a comparação integral. Não houve alteração na API ou relaxamento de asserts do conteúdo. Também foi acrescentada a observação explícita de scheduler pausado durante o bloqueio da conta. Limites de tempo e testes permaneceram habilitados.

## Ambiente, build e checks

Fontes: base `e1c17c6` mais os arquivos de harness/driver/painel deste recorte. Pixel_9, Android 15/API 35/x86_64, serial `emulator-5560`; Java 21 e SDK `H:/Android/Sdk`. APK release do harness com assinatura de debug de ensaio, sem identidade final de distribuição.

APK exercitado: 28.877.952 bytes; SHA-256 `2ee884dfbebbba51caf0d0e7f9c113cdb4a938778d651224ed13f41c947e9a5d`. Prebuild/build inicial e reconstrução após ajuste do comparador aprovados; reconstrução final em 52s.

| Verificação | Resultado |
|---|---|
| App typecheck/lint | Aprovados após o ajuste final do harness |
| App test | 121 aprovados, zero falhas/ignorados |
| Gradle direcionado | Aprovado em 1m11s; 1 método Java e 5 casos Node nativos, zero ignorados; execução Node em 35,7s |
| API check/bootJar integral, sem filtro | Aprovado em 16m23s; 87 testes Java em 14 classes, zero falhas/erros/ignorados; testes reexecutados, JAR UP-TO-DATE |
| OperationsTest | 13 aprovados na rodada integral |
| Cenário Android original | 1 caso Node aprovado, zero ignorados; 10.5s |
| Nova bateria Android no check integral | 5 casos Node aprovados, zero ignorados; 31.8s |
| Limpeza de recursos | Rádios 1/1 restaurados, nenhum reverse restante, emulador próprio fechado assim que os testes nativos terminaram; painel fechado após conclusão |

Os avisos anteriores de Expo/template/Gradle e NO_COLOR/FORCE_COLOR não constituem alteração de dependências deste recorte. TypeScript e lint passaram sem avisos.

## Reprodução e acompanhamento

O caminho completo versionado continua `scripts/verify-android-http.ps1 -Serial emulator-5560`, com Java 21/SDK/Docker e emulador visível já iniciado. O check integral inclui o caso Android original e os cinco novos casos quando `RITMO_ANDROID_SERIAL` está configurado. Requer Wi-Fi ligado e `tcp:18765` livre.

Para repetir apenas o novo caso, usar o APK reconstruído/instalado e as variáveis descritas no [README do app](../../app/README.md#exceções-e-isolamento-nativos--08102026), depois executar `api/gradlew.bat -p api test --tests dev.ritmo.RuntimeTests.androidRuntimePreservesExceptionsAndAccountIsolationThroughNativeAdapters --no-daemon`. O Gradle gerencia os serviços descartáveis; não executar o driver Node contra uma API compartilhada.

O painel `scripts/watch-android-tests.ps1` acompanha logs atuais, exibe fases/contagens observadas e fecha cinco segundos após o marcador de conclusão. Não apresenta passos fictícios nem credenciais. O harness retorna `null`: não há tela de produto para inspecionar nesta etapa. O emulador e o console foram abertos visivelmente para Pedro; o emulador foi encerrado após os dois métodos nativos passarem, e o painel após o check integral. ADB confirmou ausência de dispositivo; os PIDs dos processos iniciados deixaram de existir. Processos preexistentes foram preservados.

Logs locais ignorados: `.scratch/runtime/android-exceptions-20261008-154955-targeted.log` (falha inicial), `android-exceptions-20261008-160118-targeted.log` (repetição aprovada) e `android-exceptions-20261008-160245-full.log` (check integral). Fases nativas em `api/build/android-exceptions-integration.log` e `android-http-integration.log`; resultados Java em `api/build/test-results/test/`. Builds, dados e logs não são versionados.

## Pendências mantidas

Não há prova física de keystore indisponível, disco cheio, corrupção arbitrária, reparo/exportação/reconstrução assistida, Doze ou perda real de resposta na rede Android. Estes limites não invalidam os contratos locais; exigem cenários próprios quando aplicáveis.

Interface/estados/acessibilidade aguardam Q28. Domínio/remetente e links recebidos pelo SO aguardam Q54 e identidade final do app. iPhone 16e continua gate de M1, com rota adiada por Q55=B. Instalação e aceite operacional externo seguem as tarefas 4A/4C/4D. Nenhum serviço externo foi configurado ou contratado neste ensaio.
