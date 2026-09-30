# HTTP nativo Android — 30/09/2026

Status: incremento técnico concluído e verificado; M1 continua aberto. Incremento da [tarefa 05](../../.scratch/primeiro-marco/issues/05-completar-sessao-e-recuperacao.md), iniciado em 29/09. Fronteiras já autorizadas: Session/AccountStore/HTTP, agora com adapters Expo reais. O recorte não acrescenta UI, requisito de produto, schema ou dependência.

## Caminho executado

`dev.ritmo.httpharness` usa `openExpoRuntime` com SQLite/Drizzle, SecureStore, fetch, AppState e expo-network reais. O driver usa ADB para operar somente esse pacote num emulador explicitamente selecionado. O Gradle da API controla um teste finito com Spring Boot, PostgreSQL e SMTP local descartáveis; nenhum serviço da VPS é utilizado.

1. Cadastro HTTP de uma conta sintética, abertura autenticada do banco e onboarding técnico em UTC/início do dia 0.
2. Wi-Fi/dados desligados e `adb reverse` removido. O app confirma a ausência de conectividade, restaura o acesso protegido e grava criação/marcação. Resultado esperado: um hábito feito, duas pendências e 10 XP provisórios.
3. `am force-stop` com runtime/SQLite ainda abertos; nova execução ainda offline. Comparação exata dos envelopes, incluindo IDs, sequência, dependências e conteúdo, mais a projeção local.
4. App em segundo plano; restabelecimento de rede e encaminhamento. O harness observa os eventos nativos; outro cliente lê a API e verifica que o hábito ainda não chegou ao servidor.
5. Retorno ao primeiro plano, sem chamada explícita de sync para esvaziar a fila. O scheduler deve convergir; depois o teste força refresh, repete sync e compara a projeção com outro cliente SQLite/HTTP.
6. Reenvio dos envelopes originais recebe recibos com `replayed=true`; uma marcação independente do mesmo hábito/dia continua em 10 XP. Nova execução Android restaura o refresh rotacionado, renova novamente e converge com fila vazia.

O dia da fixture é escolhido uma vez em UTC pelo driver, coerente com seu contexto de início 0. O cenário não simula virada de dia, mudança de fuso ou relógio incorreto. O segundo cliente é SQLite de desktop; não é outro aparelho nem substitui o iPhone.

## Reprodução

Pré-requisitos: dependências do app instaladas pelo lockfile, Node 24, pnpm, Java 21, Android SDK/ADB, Docker e emulador x86_64 já iniciado com Wi-Fi habilitado. Na raiz:

```powershell
$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr' # adaptar
$env:ANDROID_HOME='H:\Android\Sdk' # adaptar
.\scripts\verify-android-http.ps1 -Serial emulator-5560 # serial explícito de adb devices
```

O script executa typecheck/lint/test, prebuild, `assembleRelease`, valida o package com `aapt2`, instala com `adb install -r` e executa `api/gradlew.bat -p api check bootJar --no-daemon`. O APK usa a chave de debug do template para teste local. Não há Metro/dev server em execução contínua.

`EXPO_PUBLIC_RITMO_HTTP_HARNESS=1` precisa valer no prebuild e no bundle. Seleciona um pacote separado e um Network Security Config que permite cleartext somente em `127.0.0.1`, com subdomínios desabilitados; o restante continua proibido. A API de testes escuta em loopback; `adb reverse tcp:18765 tcp:<porta-aleatória>` liga os dois lados. O driver recusa encaminhamento preexistente nessa porta, remove apenas o seu e restaura Wi-Fi/dados em `finally`. Desligar os rádios sozinho não corta um encaminhamento ADB, por isso ambos são removidos na fase offline.

Sem a flag, a configuração Expo seleciona `dev.ritmo.foundationharness` e desabilita o plugin HTTP. O plugin também remove sua referência ao Network Security Config ao retornar à variante básica. Nenhum pacote é desinstalado, nenhum banco é apagado e os dados das execuções anteriores permanecem no pacote isolado. O script restaura suas variáveis de processo. O emulador pode ser encerrado depois da execução; o script não inicia nem encerra emuladores alheios.

Sem `RITMO_ANDROID_SERIAL`, o caso nativo é explicitamente ignorado no Gradle e no runner TypeScript; o restante da suíte continua utilizável sem SDK/emulador. Com serial, o Gradle não reutiliza um resultado antigo como UP-TO-DATE. `RITMO_ANDROID_APK` registra o arquivo instalado como entrada adicional; reconstruir pelo script evita divergência entre fonte e APK.

## Evidências

Ambiente: Pixel_9, Android 15/API 35, x86_64, SDK em `H:/Android/Sdk`; compilação com API 36, Expo 57.0.25/React Native 0.86.3 e Java 21. Nenhuma versão de dependência mudou.

| Verificação | Resultado |
|---|---|
| App typecheck/lint | Aprovados |
| App SQLite/domínio/sessão | 69 testes aprovados |
| Android assembleRelease + instalação | Aprovados; 759 módulos no bundle |
| API check/bootJar com emulador selecionado | 34 testes aprovados, zero ignorados (33 RuntimeTests + ModularityTests) |
| Clientes TypeScript integrados pelo Gradle | 8 cenários aprovados, incluindo o Android nativo |
| Configuração padrão Expo (introspect) | Pacote foundationharness, sem networkSecurityConfig do teste |
| Runner nativo sem serial | Um caso explicitamente ignorado; nenhum ADB/API acionado |
| Encerramento | Wi-Fi/dados restaurados a 1/1, nenhum reverse restante; emulador criado nesta sessão encerrado |

A execução nativa final durou aproximadamente 25 segundos. Fases confirmadas: `prepared` (0 pendências/0 XP), `offline`, `restored`, `background` e `background_online` (2/10), `converged` e `verified` (0/10). API e bancos temporários encerraram ao final do Gradle. O hash SHA-256 do APK exercitado foi `36f53dc73d82ac8a658dd49b73005ff163cefb77d7e933c539ffc9e0fe956fda`.

O build ainda emite avisos de depreciação de dependências Expo/template Gradle e de conflito NO_COLOR/FORCE_COLOR do ambiente, já observados no toolchain; typecheck e ESLint não emitiram advertências. A configuração XML passou pelo lint nativo, incluindo `includeSubdomains="false"`.

Fontes locais: [harness](../../app/harness/http.ts), [driver](../../app/test/integration/android-http.test.ts), [script](../../scripts/verify-android-http.ps1), [teste proprietário da API](../../api/src/test/java/dev/ritmo/RuntimeTests.java). Logs ignorados: `.scratch/runtime/android-http-verification.log` (build/execução inicial), `.scratch/runtime/android-http-final-check.log` (API final), `.scratch/runtime/android-http-app-checks.log`, `api/build/android-http-integration.log` e relatório JUnit em `api/build/reports/tests/test/index.html`. Os logs nativos contêm somente fixtures sintéticas, sem access/refresh/revoke tokens; não reutilizar esse logging em contas reais.

O primeiro teste comprovou cadastro HTTP nativo. A ampliação falhou inicialmente por falta das fases no APK. Na primeira execução completa, a restauração offline passou, mas a espera de segundo plano expirou: timers JS foram suspensos pelo Android. O harness passou a observar AppState/rede por subscriptions nativas; o runtime de produção já usava esses listeners e não precisou ser alterado. Depois, o replay expôs uma chave HTTP fixa no cliente auxiliar: a API corretamente recusou usá-la para outro lote. O driver passou a gerar uma chave por requisição. Essa última correção atingiu somente o teste desktop; o APK gerado/instalado foi preservado e a suíte de app/API foi reexecutada.

## Limites e continuidade

Este incremento amplia a evidência Android de M1-02/03/07 e REQ-SYN-005/008. Não prova perda real de resposta HTTP no Android: exercita replay explícito; perda de ack continua coberta pela suíte integrada de desktop. Não exercita suspensão prolongada/Doze, disco cheio, reinstalação, reboot do sistema, dispositivo físico ou interrupção no meio de uma transação nativa.

M1 e tarefa 05 continuam abertos. Próximo recorte recomendado: completar a matriz de concorrência (M1-04/06) e datas/relógios/fusos (M1-12) por interfaces públicas e bancos reais. Permanecem exclusão/tombstones, demais lacunas da matriz, UI vinculada ao protótipo de Pedro, configuração operacional/SMTP/deploy/backup/rate limiting e aceite no iPhone 16e. Pedro segue sem Apple Developer ativo e sem alternativa com Mac confirmada.

## Referências primárias consultadas

- [Expo config plugins](https://github.com/expo/expo/blob/main/docs/pages/config-plugins/plugins.mdx) e [mods de arquivos](https://github.com/expo/expo/blob/main/docs/pages/config-plugins/dangerous-mods.mdx): integração do manifest/XML na geração nativa.
- [Android Network Security Configuration](https://developer.android.com/privacy-and-security/security-config): exceção de cleartext delimitada por domínio.
- [ADB](https://developer.android.com/tools/adb) e [acesso a servidor local](https://developer.android.com/develop/ui/views/layout/webapps/access-local-server): encaminhamento reverso e ciclo do aplicativo.
