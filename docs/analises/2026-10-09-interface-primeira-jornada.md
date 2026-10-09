# Primeira jornada nativa do Ritmo

Data: 09/10/2026. Recorte: [interface 01](../../.scratch/interface-m1/issues/01-conta-onboarding-briefing.md), dentro do M1. Referência: [spec/11](../../specs/11-design-system.md) e [matriz](../design/implementacao-interface-m1.md). O M1 completo e a Fase 1 permanecem abertos.

## Entrega

Entrada/cadastro/login → fuso/início do dia → primeiro hábito ou pular → Briefing útil → criar/marcar/desfazer → reabrir offline → sincronizar. São telas nativas sobre Session, SQLite/Drizzle e scheduler existentes. Ajustes mínimos mostram perfil/estado remoto, aviso de privacidade para testes e saída confirmada, inclusive durante onboarding.

Nome/título em NFC, limites por pontos de código Unicode e rejeição de surrogates isolados; senha preservada integralmente, sem trim/normalização/truncamento. O medidor é uma orientação por comprimento, não uma exigência de símbolos. A política pública final continua pendente; o texto de teste não a substitui.

Holograma segue o modo do sistema. Tokens tipados contemplam Holograma/Cockpit/Neo em claro/escuro, com bordas interativas corrigidas. Fontes locais: quatro pesos Chakra Petch, quatro Space Grotesk e três JetBrains Mono. Licenças OFL acompanham a distribuição Android. Ícone/cor usam as chaves existentes e fallback sem reescrever metadados desconhecidos. Não há migração nova, telemetria, áudio ou pedido de permissões futuras.

## Integração e garantias

- AccountStore publica mudanças somente após commit da transação externa. Comandos internos participam da mesma transação: uma segunda transação raiz falhou no Expo SQLite durante o ensaio, foi corrigida e não foi escondida por um estado de sucesso.
- O passo do onboarding usa o controle local existente; confirmar horário e criar/pular são operações duráveis. A cópia do perfil público não reduz uma revisão mais nova já sincronizada.
- Journey usa os serviços públicos; Zustand guarda navegação/rascunho de sugestão, sem copiar domínio. Subscrições e providers respeitam a geração da conta. Logout bloqueia imediatamente o conteúdo anterior.
- Briefing registra providers locais independentes de hábitos e XP, cada um com carregamento/erro contido. Não há HTTP nos componentes.
- Timer agenda a próxima virada IANA e é refeito no foreground. O toque calcula o dia atual e inclui desfazeres conhecidos; não há polling nem temporizador simulando confirmação remota.
- XP é a projeção real; prêmio parcial não é prometido. Falha de gravação conserva formulário/etapa. Serviço indisponível/backoff não é apresentado como sincronizado. Avisos detalhados e recuperação de intenções permanecem no recorte 04.
- Controles usam layout plano e feedback de pressão separado. A inspeção nativa encontrou estilos de callback não aplicados nessa composição, com abas agrupadas; o layout foi corrigido e o driver passou a medir alvos em unidades lógicas do Android.

## Verificação

Jornada Android aprovada em 09/10/2026, 14:24: cadastro, horário, interrupção/retomada, pular, vazio útil, criação com ícone/cor, marcação offline, kill/reopen, undo/remark, convergência independente, modos do sistema, fonte 200% e ação com redução de movimento. O ensaio final levou 204,4 s. O check integral final da API foi aprovado após a integração em 14 min 35 s, sem falhas; a jornada nativa é um opt-in separado e foi executada explicitamente.

| Verificação | Evidência |
|---|---|
| App | typecheck/lint; 138 testes Node/SQLite e 7 de componentes |
| Domínio/jornada | Rollback sem publicação, retomada do passo, A/B/A, pull, toque duplicado, undo/remark, limite sem prêmio, Unicode e virada lógica |
| Datas | Próxima virada em gap/repetição DST e Kathmandu; relógio controlado atravessa 04:00, total 20/XP do novo dia 10 |
| Contraste | Seis conjuntos; texto ≥4,5:1, controles ≥3:1, input/alpha/scanline/toast/cores dos hábitos |
| API | Check integral: 88 métodos JUnit, 85 aprovados/3 opt-in ignorados; 13 testes operacionais Python aprovados |
| Android | JUnit direcionado + driver aprovados; API/Postgres/SMTP descartáveis, cadastro real e convergência independente em 10 XP, sem duplicar prêmio |
| Alvos/layout | [Medidas nativas](../design/evidencias/2026-10-09/jornada-android/native-targets.json); densidade 420 dpi/2,625; mínimo 44, com arredondamento a pixels inteiros; abas legíveis a 100%/200% |
| Bundle | [Auditoria](../design/evidencias/2026-10-09/jornada-android/bundle-audit.json): hashes dos onze pesos conferidos no APK e três OFL presentes; fonte Material Symbols adicional do framework |

Os ensaios nativos usam Pixel_9/API 35 x86_64, ADB por rótulos e pacote isolado `dev.ritmo.journeytest`. Capturas: [pasta de evidências](../design/evidencias/2026-10-09/jornada-android). Capturas de teclado, Holograma claro/escuro e texto 200% foram inspecionadas. Todos os dados são fixtures sintéticas. O cliente independente usa retry transitório limitado com as mesmas operações; um ECONNRESET no ensaio anterior não foi confundido com falha de persistência do produto. O build mostrou avisos das dependências nativas/Gradle/CMake no Windows; typecheck e lint do código do projeto não introduziram warnings. Esses avisos não foram ocultados.

Testes de componentes: Jest Expo/RNTL; Reanimated recebe seu setup de testes e o resolver Worklets disponível na versão instalada. Referências oficiais: [Reanimated](https://docs.swmansion.com/react-native-reanimated/docs/guides/testing/) e [Worklets](https://docs.swmansion.com/react-native-worklets/docs/guides/testing/). O mock de animação no Jest não substitui o ensaio nativo.

## Reproduzir

Na raiz, com Java 21, Android SDK, Docker e o AVD disponível:

```powershell
$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME='H:\Android\Sdk'
.\scripts\verify-android-journey.ps1 -Avd Pixel_9 -Serial emulator-5560
```

O script verifica o app, compila e valida o pacote, abre emulador/painel visíveis e executa somente o método JUnit da jornada. O Gradle prepara o backend e os serviços descartáveis. Rede, fonte, modo e escalas de animação são restaurados; encaminhamento, aplicativo de teste, painel e emulador criados pelo executor são encerrados em `finally`, inclusive em falha. Ele preserva processos anteriores, bancos e pacotes dos harnesses. O opt-in nativo tem entrada própria no Gradle e impede reutilizar um resultado de teste em cache. Se ADB não iniciar, o executor tenta encerrar somente os filhos QEMU do launcher que criou. `-SkipBuild` reutiliza um APK já validado, para diagnóstico; não dispensa checks.

Produto: `dev.ritmo.app`, origem HTTPS por `EXPO_PUBLIC_RITMO_API_ORIGIN`. Harness técnico: `EXPO_PUBLIC_RITMO_TECHNICAL_HARNESS=1` / `dev.ritmo.foundationharness`; HTTP: `EXPO_PUBLIC_RITMO_HTTP_HARNESS=1` / `dev.ritmo.httpharness`. Variante da jornada é exclusiva para fixtures e só libera HTTP para loopback. Entradas/configurações foram conferidas separadamente. O executor HTTP existente agora usa modo de teste para Jest, antes do modo de produção do build.

Não foi iniciado servidor de desenvolvimento persistente; build e testes são processos finitos. O plano de domínio, Resend, links e infraestrutura não foi alterado.

## Limites e próximo recorte

Próximo: [gestão de hábitos — 02](../../.scratch/interface-m1/issues/02-gestao-de-habitos.md), com edição de título/ícone/cor, ordenação e exclusão confirmada sobre a mesma fila. Recortes 03–06 cobrem avisos/recuperação detalhados, links de senha e preferências de aparência/áudio.

iPhone 16e permanece adiado por Q55=B. TalkBack/VoiceOver com navegação de foco completa, seis aparências selecionáveis/persistidas, listas longas/desempenho e matriz integral nos aparelhos ainda precisam de seus aceites. Nesta entrega, Android exercita modos Holograma, escala 200%, teclado, rótulos/alvos e ações com redução de movimento configurada; não se declara uma auditoria completa de leitor de tela.
