# Stack e caminhos de build do primeiro marco

Consulta: 25/09/2026. Pesquisa em documentação oficial, código dos fornecedores, metadados públicos npm e inspeção local. **Nenhum build mobile/backend foi executado**. Este documento fixa a baseline a verificar no scaffold; versões publicadas/compatíveis documentalmente não equivalem a integração testada.

## Baseline selecionada

| Componente | Versão para o primeiro scaffold | Evidência |
|---|---|---|
| Node / pnpm | 24.13.0 / 10.32.1 | Instalados e consultados localmente; Node supera o mínimo 22.13.x do SDK 57 |
| Expo | 57.0.25 | Publicado no npm; SDK 57 estável, SDK 58 ainda beta |
| React Native / React | 0.86.3 / 19.2.3 | Par usado pelo pacote/template do SDK 57; não seguir `react-native@latest` (0.87.1) isoladamente |
| TypeScript | 6.0.3 | Versão do template SDK 57; não atualizar isoladamente para o `latest` 7.0.2 |
| Expo Router | 57.0.23 | Pacote e faixa do SDK 57 |
| expo-sqlite / expo-secure-store | 57.0.3 / 57.0.4 | Pacotes publicados e listados no SDK 57 |
| Drizzle ORM / Kit | 0.45.3 / 0.31.11 | Metadados publicados; adapter Expo SQLite oficial; validar transações e migrations no scaffold |
| Reanimated / Worklets / Gesture Handler | 4.5.1 / 0.10.1 / 2.32.0 | Conjunto do SDK 57; substitui a indicação antiga de Reanimated 3 |
| NativeWind | 4.2.7 | Publicado, mantendo a linha v4 escolhida; `react-native-css-interop` 0.2.7 declara Reanimated >=3.6.2. Integração visual ainda requer build/teste |
| Java | 21 | Decisão original preservada; JBR 21.0.8 local disponível. Patch/distribuição da imagem de produção será fixado antes do deploy |
| Spring Boot / Modulith | 4.1.1 / 2.1.1 | O POM da versão Modulith 2.1.1 usa Boot 4.1.1 |
| Gradle Wrapper do backend | 8.14.4 | Release existente, dentro da faixa documentada do Boot 4.1; executar com Java 21 |
| PostgreSQL | Linha 18 | DDL usa capacidades documentadas dessa linha; patch/digest de container fica no primeiro ambiente reproduzível |

Fontes da matriz mobile: [referência SDK 57](https://docs.expo.dev/versions/v57.0.0/), [pacote Expo](https://raw.githubusercontent.com/expo/expo/sdk-57/packages/expo/package.json), [template](https://raw.githubusercontent.com/expo/expo/sdk-57/templates/expo-template-default/package.json), [módulos nativos](https://raw.githubusercontent.com/expo/expo/sdk-57/packages/expo/bundledNativeModules.json) e [anúncio da beta 58](https://expo.dev/changelog/sdk-58-beta). As branches são móveis: os números acima registram a consulta; o scaffold deve confirmar e gerar lockfile.

Publicação e peers de Drizzle/NativeWind foram conferidos diretamente: [drizzle-orm 0.45.3](https://registry.npmjs.org/drizzle-orm/0.45.3), [drizzle-kit 0.31.11](https://registry.npmjs.org/drizzle-kit/0.31.11), [NativeWind 4.2.7](https://registry.npmjs.org/nativewind/4.2.7), [css-interop 0.2.7](https://registry.npmjs.org/react-native-css-interop/0.2.7). O [adapter oficial Drizzle/Expo SQLite](https://orm.drizzle.team/docs/sqlite/connect-expo-sqlite) confirma o caminho de integração; peers permissivos não provam ausência de regressões.

A revisão de Boot 3 é necessária porque 3.5.16 foi a última versão com suporte aberto da linha 3.5. Há suporte comercial, mas ele não foi contratado para este projeto. Adotar Boot 4.1.1 conserva Java/Spring e evita começar com essa pendência de manutenção; não há código anterior a migrar. Fontes: [encerramento OSS da 3.5](https://spring.io/blog/2026/06/25/spring-boot-3-5-16-available-now/), [requisitos Boot 4.1](https://docs.spring.io/spring-boot/system-requirements.html), [POM Modulith 2.1.1](https://raw.githubusercontent.com/spring-projects/spring-modulith/2.1.1/pom.xml) e [Gradle 8.14.4](https://docs.gradle.org/8.14.4/release-notes.html). O apêndice geral do Modulith exibia uma tabela antiga; o POM da versão foi usado para verificar o par atual.

Spring AI, áudio, notificações e provedores externos entram quando suas capacidades forem implementadas. A antiga indicação `expo-av` não deve ser instalada por inércia no M1; o SDK atual lista `expo-audio`/`expo-video`. A compatibilidade de Spring AI com a baseline será verificada no incremento de IA, sem introduzir uma dependência sem uso agora.

## Ambiente local encontrado

| Item | Observado | Consequência |
|---|---|---|
| Sistema | Windows / PowerShell | Build iOS local precisa de outro host macOS; Android pode ser preparado aqui |
| Java do PATH | Oracle 25.0.2 | Não usar implicitamente como toolchain do projeto |
| Java do Android Studio | `C:/Program Files/Android/Android Studio/jbr`, 21.0.8 | Pode ser selecionado no processo de build; não foi alterado PATH global |
| Android SDK | `H:/Android/Sdk`; plataforma android-36 presente | Pré-requisito compatível com SDK 57 |
| Emuladores configurados | `Pixel_9.avd` e `Pixel_9_Pro.avd` | Diretórios encontrados; boot/aceleração e execução do app ainda não testados |
| Gradle global | Não encontrado | Usar Wrapper no backend e o Wrapper gerado pelo Android; instalação global desnecessária |
| Docker | CLI encontrada; acesso ao daemon recusado nesta sessão | Não foi possível testar PostgreSQL/Testcontainers; isso não prova que Docker esteja ausente |
| Projeto | Sem `/app`, `/api`, manifests ou lockfiles | Nenhum comando de build da aplicação pode ser declarado aprovado |

A tentativa de listar AVDs via CLI não concluiu no período observado; foi encerrada. A lista acima veio da inspeção dos diretórios, não de um emulador iniciado.

## Transações SQLite e credenciais

O adapter do primeiro marco deve serializar escritores e usar a conexão/objeto da transação correta. `withExclusiveTransactionAsync` restringe o escopo transacional; consultas assíncronas fora do callback de `withTransactionAsync` podem participar indevidamente. Avaliar rollback de intenção/projeção e aplicação de página/cursor com o SQLite real do SDK. Não supor que um wrapper Drizzle diferente preserve essas garantias. [SQLite SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/).

SecureStore e SQLite não compartilham commit. O [contrato de recuperação](../../contracts/primeiro-marco/README.md#sessão-e-recuperação-entre-armazenamentos) usa barreira durável de logout e geração de credenciais; os testes no aparelho precisam provar retomada após interrupção. Nenhum token deve entrar em `.env` público ou no transporte de sync.

## Android no Windows

Após criar o app com as versões fixadas: gerar e instalar um development build, por exemplo `pnpm exec expo run:android --device`, e iniciar Metro com `pnpm exec expo start --dev-client`. Esses são comandos documentados a executar no projeto futuro, não comandos já aprovados por teste. `expo run:android` gera/compila o projeto nativo; não executar antes de revisar a configuração do app. [Development builds](https://docs.expo.dev/develop/development-builds/introduction/).

O emulador padrão acessa o loopback do host por `10.0.2.2`; `localhost` dentro dele aponta ao próprio Android. Para teste local controlado, configurar o endpoint de desenvolvimento e a política de cleartext somente no build de desenvolvimento, ou usar HTTPS de teste. A URL fica na configuração pública do app, nunca contém credencial. [Rede do Android Emulator](https://developer.android.com/studio/run/emulator-networking).

Escolher um AVD existente com Android suportado, confirmar boot e testar a mesma conta com o iPhone quando a rota iOS estiver disponível. Não criar dois bancos remotos independentes e chamar isso de teste de sincronização.

## iPhone 16e a partir do Windows

**Resposta do Pedro nesta etapa:** não possui assinatura ativa do Apple Developer Program.

A rota documentada para development build físico via EAS exige assinatura Apple Developer e registro do aparelho. Com ela disponível, a preparação usa `eas build:configure`, `eas device:create` e `eas build --platform ios --profile development`; assinatura/conta e identificador final do app devem ser configurados pelo titular. Nenhuma assinatura foi comprada e nenhum build remoto foi disparado. [Ambiente iOS físico](https://docs.expo.dev/get-started/set-up-your-environment/?device=physical&mode=development-build&platform=ios).

Alternativa sem assinatura paga: build local num Mac com Xcode e Apple Account pessoal, sujeito às condições desse provisionamento. Isso exige acesso a um Mac, ainda não confirmado; não é build local no Windows. [Development builds](https://docs.expo.dev/develop/development-builds/introduction/) e [conta Apple/Xcode](https://developer.apple.com/help/account/basics/about-your-developer-account).

Expo Go pode servir a exploração preliminar das APIs nativas incluídas e do fluxo de dados, enquanto compatível com o SDK instalado no iPhone. Não substitui o aceite do development build próprio: identidade do app, configuração nativa, deep links, armazenamento e retomada devem ser exercitados no binário final de desenvolvimento. A compatibilidade do Expo Go da App Store muda por SDK. [Limites do Expo Go e development builds](https://docs.expo.dev/develop/development-builds/introduction/).

## Saída desta preparação e próximos testes

A investigação e a baseline documental estão concluídas. Permanecem para a entrega de código: resolução real de dependências/lockfile, `expo install --check`, typecheck/lint, build Android, testes de transação no SDK, `gradlew check`, RLS/roles em Postgres e instalação iOS pela rota escolhida. A ausência de assinatura bloqueia o caminho EAS físico no iPhone, não a elaboração dos contratos nem o trabalho Android/backend.
