# Sessão e recuperação local pela interface — recorte 03

Data: 10/10/2026. Escopo: [interface 03](../../.scratch/interface-m1/issues/03-sessao-e-recuperacao-local.md), REQ-CTA-004/004b/004c, REQ-SYN-008, REQ-DS-004, ADR-016 e spec/13 §22/Q51/Q52. Continuação dos recortes 01/02 sobre o mesmo núcleo local.

## Entrega

O aviso de cofre indisponível distingue sessão ativa com acesso local de entrada sem credenciais disponíveis. Retomar acesso remoto usa retryVault existente. Com bases saudáveis, leitura e novas alterações locais continuam, inclusive durante uma retomada pendente. Referências e intenções originais ficam preservadas; indisponibilidade não é tratada como credencial ausente.

Abertura da conta e abertura da instalação têm títulos/bloqueios próprios. Nova tentativa usa o owner atual, repete a abertura completa e só publica dados após sucesso. Ver diagnóstico apresenta escopo, etapa e código permitido; causa, caminho, SQL e credenciais não entram na UI. Armazenamento inacessível não é chamado de corrupção. Falha repetida mantém bloqueio; não há reset, exportação ou reconstrução neste recorte.

Saída incompleta bloqueia conta, navegação e painéis até terminar a limpeza. Navegação vincula geração e gate da jornada, incluindo transições sem chave de conta. O fundo de um painel aberto é retirado da árvore acessível. Saída preempta uma autenticação pendente. Um contador de ação evita que seu término altere loading/erro da próxima ação; a chave de geração continua impedindo mensagens de outra conta. A não deixa mensagem ou conteúdo em B. Após logout, autenticação online continua obrigatória.

Autenticação remota necessária mantém os dados e acesso local autorizados. A ação abre formulário específico, explica a exigência da mesma conta, conserva campos em falha/offline e volta ao Briefing após sucesso. Outra conta recebe instrução de sair primeiro. A interface usa tokens/primitives atuais; não houve migração, campo de domínio, dependência ou endpoint novo.

## Verificação

App: 146 testes Node/SQLite e 18 componentes aprovados. Os cenários novos verificam escrita durante retry do cofre, resultado atrasado A/B, falhas de abertura/diagnóstico, saída incompleta/rotas/painéis, reentrada A/B/A e expiração com refresh recusado. Os testes de componente controlam o relógio da lista virtualizada sem ocultar warnings. Typecheck/lint passaram sem warnings. API/check integral aprovado: 85 JUnit, quatro opt-in Android ignorados e 13 testes operacionais Python. Android visível aprovado em 431,66 s; JUnit e driver encerraram com sucesso. [Auditoria do APK final](../design/evidencias/2026-10-10/sessao-android/bundle-audit.json) aprovada para fontes/licenças.

No Android, o roteiro cadastrou A, criou/marcou/alterou offline, pausou/retomou o cofre, terminou uma saída incompleta, entrou em B sem dados/envio de A e retornou online em A. Cliente SQLite/HTTP independente confirmou uma única concessão de 10 XP. Falhas repetidas de abertura de conta/instalação mantiveram bloqueio; sucesso recuperou a edição local antes de enviá-la. Credencial ausente manteve consulta local, preservou campos offline, recusou B na reautenticação e aceitou A sem duplicar XP.

Evidências: [cofre](../design/evidencias/2026-10-10/sessao-android/01-cofre-pausado.png), [cofre com texto 200%](../design/evidencias/2026-10-10/sessao-android/02-cofre-200.png), [saída incompleta](../design/evidencias/2026-10-10/sessao-android/03-saida-incompleta.png), [B isolada](../design/evidencias/2026-10-10/sessao-android/04-conta-b-isolada.png), [diagnóstico da conta](../design/evidencias/2026-10-10/sessao-android/06-base-conta-bloqueada.png), [instalação com texto 200%](../design/evidencias/2026-10-10/sessao-android/07-instalacao-200-diagnostico.png) e [reautenticação](../design/evidencias/2026-10-10/sessao-android/09-mesma-conta.png). Sete [medições de alvos](../design/evidencias/2026-10-10/sessao-android/native-targets.json) passaram com mínimo de 44 e arredondamento nativo inferior. [Resumo verificável](../design/evidencias/2026-10-10/sessao-android/verification.json). Capturas conferidas; conteúdo longo é rolável. Texto 200% foi observado no cofre e na abertura da instalação; não se declara a matriz integral de acessibilidade.

O ensaio passou na primeira execução completa. Uma rodada de componente anterior passou com aviso de atualização da FlatList fora de act; o relógio foi controlado e os checks completos repetidos sem ocultar o aviso. Uma verificação adicional pelos métodos da Journey reproduziu saída bloqueada por autenticação pendente; a correção e o teste comprovam preempção da ação antiga, incluindo loading de um novo login. O build mantém os avisos já conhecidos das dependências/Gradle/CMake e do ambiente de cores; nenhum warning novo de TypeScript, lint ou componentes. A auditoria do APK foi repetida após a última alteração da UI, com hash correspondente ao artefato ensaiado.

## Reprodução e limites

Na raiz, configurar Java 21, Android SDK, Docker e AVD Pixel_9:

```powershell
$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME='H:\Android\Sdk'
.\scripts\verify-android-journey.ps1 -Suite session -FreshTestInstall -EvidenceDirectory docs/design/evidencias/2026-10-10/sessao-android
```

O JUnit fornece API/Postgres/SMTP descartáveis e inicia o driver pelos controles nativos, com um cliente SQLite/HTTP independente. A fábrica de teste usa SQLite/SecureStore reais nos caminhos saudáveis; falhas controladas apenas nas fronteiras de leitura/remoção/abertura. Não comprova corrupção física ou defeito real do keystore. Ausência de credencial no Android testa a rota pública de autenticação necessária; expiração/refresh recusado são cobertos pela Session real nos componentes e pela integração HTTP já existente.

Emulador e painel próprios foram encerrados e a lista ADB estava vazia após o ensaio. São visíveis somente durante o ensaio; finally restaura configurações e encerra os processos próprios, inclusive em falha. A opção FreshTestInstall limpa apenas dados sintéticos anteriores à execução na variante validada; nenhuma etapa de recuperação apaga bancos. Não há dev server persistente.

Próximo recomendado: [04 — sync, identidade e compatibilidade](../../.scratch/interface-m1/issues/04-estados-de-sincronizacao.md). Q53/ações de rejeição, snapshot detalhado, recuperação de senha e aparência persistida permanecem nos recortes 04–06. M1/Fase 1, iPhone adiado por Q55=B, TalkBack/VoiceOver integral e gates operacionais externos continuam abertos.
