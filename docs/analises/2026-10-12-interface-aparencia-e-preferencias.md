# Aparência e preferências do M1 — 12/10/2026

Entrega funcional do recorte 06, com contrato Q56–Q58 confirmado por Pedro. O recorte permanece em andamento para medidas instrumentadas de desempenho e matriz integral de acessibilidade; o M1 não está aceito integralmente. O iPhone 16e/VoiceOver segue adiado pela Q55=B.

## Comportamento entregue

Ajustes permite Holograma, Cockpit e Neo-tokyo nos mesmos componentes, com modos claro/escuro e Seguir sistema. A escolha é da instalação: sobrevive ao reinício, logout e troca de conta. Modo escuro estabelece escolha manual; desligar Seguir sistema fixa o modo efetivo e religar acompanha mudanças reais do aparelho. Status bar acompanha o modo efetivo. A primeira apresentação da jornada aguarda a leitura da preferência.

Configuração visual em `ritmo-preferences.db`, chave `appearance`, JSON `version=1/skin/mode`, conforme [contrato](../../.scratch/interface-m1/preferencias.md) e [modelo](../../specs/00-modelo-de-dados.md). Usa o SQLiteStorage já instalado, em exceção delimitada ao Drizzle aprovada na Q58. Nenhum novo campo de conta, migração de domínio, segredo ou alteração do protocolo/API.

Valor inválido/futuro ou leitura indisponível preserva o armazenamento, usa Holograma/seguir sistema e oferece aviso acessível com tentativa explícita. Só as escolhas visuais ficam pausadas; sessão, hábitos e pendências continuam sujeitos aos seus próprios estados. Falha de gravação mantém a última escolha salva e permite tentar novamente. Não há confirmação visual antes da gravação. Áudio fica em recorte próprio, conforme Q57.

Cockpit recebe duas marcas de canto e Neo o brilho discreto de cards decorados; Holograma conserva suas marcas/scanline. Ajustes usa card sem decoração como o Ritmo-App. Rótulos e medidas estão nos tokens/i18n. Não foram adicionadas árvores de telas distintas por aparência.

## Referência e contraste

Fonte correta: `Ritmo-App.dc.html`, modo M1, SHA-256 `a37d1a92cac66cc302cdb0603f5636e079b66369d9feacf13f264964ba0c0557`. [Seis capturas da fonte](../design/evidencias/2026-10-12/aparencia-referencia/) em viewport 411,4286×928,4286. As 11 faces locais daquelas famílias/pesos foram carregadas e verificadas com FontFace.status/document.fonts.check em cada captura; document.fonts.ready sozinho não foi usado como prova. Seletores mantêm a ordem, card/linhas e indicador secundário13 da referência. A linha Seguir sistema atende ao contrato aprovado; o perfil real/sync ocupa as linhas próprias do produto.

Interruptor48×28, knob22. A borda específica usa alpha0,52 para contrastar com track e superfície; o knob desligado conserva branco nos modos escuros e usa texto secundário nos claros, onde o branco original não atinge3:1. [Matriz dos30 pares novos](../design/evidencias/2026-10-12/aparencia-android/switch-contrast.json):24 indicadores ≥ 3:1 e6 textos ≥ 4,5:1; mínimo geral3,337107:1. Não equivale à inspeção de toda combinação possível de estados.

## Verificação

`pnpm typecheck`, `pnpm lint` e `pnpm test`: passaram;164 testes de domínio e38 de componente,202 no total. Os novos casos verificam SQLite real, abertura/persistência, dados inválidos preservados, falhas de leitura/escrita, confirmação só após durabilidade, encerramento/subscrições, modo automático/manual, controles acessíveis e continuidade dos hábitos durante falhas visuais.

API: `gradlew check --no-daemon --max-workers=2` isolado passou em 21m38s; 92 casos JUnit, 85 executados e 7 opt-ins ignorados, sem falhas/erros, além dos 13 testes Python operacionais. [Resumo final](../design/evidencias/2026-10-12/aparencia-android/checks-final.json). O teste operacional independente revelou igualdade inválida de retenção WAL, reproduzida e corrigida com evidência em [relatório próprio](2026-10-12-estabilidade-do-teste-de-retencao-wal.md). A classe específica passou com seis testes Linux reais; produção permanece inalterada.

Android visível, rodada funcional3: passou com API/Postgres/SQLite reais,6 fases,36 capturas e32 alvos. Cobriu6 paletas100%/200%, modo do sistema/manual, persistência no reinício e A/B/A, falhas de preferência com escrita local continuando, escalas de animação zeradas e reinstalação exclusivamente da variante descartável. APK `713bfddc03875ad424592fa2d06b7eecd6bb947777a3c4fbbe575ed2e9afc3ed`; antes da correção isolada de contraste. Reinstalação usou esse mesmo APK preservado. [Resumo](../design/evidencias/2026-10-12/aparencia-android/rodada-3/verification-summary.json). Altura mínima observada115px/densidade2,625 =43,81 unidades lógicas, arredondamento nativo do piso44. Nenhuma tolerância foi aplicada à largura.

A primeira tentativa parou no preparo do cumprimento antes de observar a escrita local; a segunda encontrou ECONNRESET no cliente HTTP independente. O fixture passou a esperar checkbox/+10XP e repetir somente falha remota explicitamente classificada como retry. A rodada3 passou sem simular confirmação remota. O timeout do teste integrado de componente passou de5s para15s após passar isoladamente e expirar sob carga; suas asserções foram preservadas.

APK final `3d5e7460d0b6ce89715962e365682017db7376c9a2d6b7a6467493c47cdfc414`: build release x86_64 passou. [Auditoria](../design/evidencias/2026-10-12/aparencia-android/bundle-audit.json) comprova11 pesos selecionados,12 TTF incluindo Material Symbols,3 licenças OFL. Fontes podem ser usadas offline. [Manifesto/regras de backup do APK](../design/evidencias/2026-10-12/aparencia-android/backup-audit.json) incluem somente sharedpref e excluem SecureStore, deixando os bancos SQLite fora do backup/transferência. Avisos de plugins Gradle/CMake de caminhos gerados no Windows constam do build, sem novo aviso de código no lint/tipos.

Conferência final do mesmo APK:12 capturas (6 paletas × texto 100%/200%) e36 verificações de alvos passaram. [Resumo da matriz](../design/evidencias/2026-10-12/aparencia-android/final-talkback/palette-summary.json). As capturas a200% mostram o início da página e os destinos inferiores foram verificados por rolagem; não afirmar que todos estão simultaneamente na tela. A sessão remota dos fixtures expirou; o aviso real aparece e o acesso local permanece permitido.

**TalkBack não aceito.** A execução com `adb input` chegou a reportar aprovação, mas a inspeção das capturas mostrou o checkbox alterado antes da ativação enquanto o foco permanecia no aviso. Esse falso positivo foi rejeitado e suas capturas/resumo movidos para `reader-attempts`. O driver passou a exigir que o foco não altere o hábito e que a ponte física primeiro marque/desfaça sem leitor. Eventos do console não passaram nesse preflight; `sendevent` no dispositivo anunciado foi negado. O guard do lançador recusou a escalada para essa imagem. A configuração confirmada é Android 35/Google APIs Play Store x86_64, PlayStore.enabled=true,4 núcleos / 2048 MB; tentativas finais usaram4096 MB temporários e foram encerradas. Nenhuma política SELinux, imagem ou configuração persistente do AVD foi alterada; as fixtures do app mudaram durante os ensaios.

UiAutomation suspende serviços de acessibilidade por padrão, segundo [Android Developers](https://developer.android.com/reference/android/app/UiAutomation#FLAG_DONT_SUPPRESS_ACCESSIBILITY_SERVICES); por isso o roteiro separa consultas de árvore dos gestos e verifica serviço vinculado/exploração por toque. O diálogo de notificações do próprio leitor também interceptou uma tentativa; flags temporárias mantiveram a permissão negada e foram restauradas. [Comandos de simulação de permissões](https://developer.android.com/develop/ui/compose/notifications/notification-permission). O driver de entrada física está preparado, com tipos/lint válidos, mas **não verificado em imagem depurável**. [Estado rejeitado/bloqueio](../design/evidencias/2026-10-12/aparencia-android/final-talkback/reader-status.json).

Q59 executada: só `dev.ritmo.httpharness` foi removido, com Success; jornada/dados atuais permaneceram. Espaço livre passou de349 MB para402 MB na inspeção após a remoção, e a instalação final passou. [Registro](../../.scratch/interface-m1/espaco-emulador.md). Emuladores/painéis/navegadores próprios foram encerrados inclusive em falha.


## Limites e próximo recorte

Observações externas do driver: abertura até hábito observado4623,9665ms; toque até checkbox observado5110,5134ms. Incluem ADB/UIAutomator e esperas de assentamento, portanto não aceitam nem reprovam as metas de abertura 2 s/cards 300 ms/feedback 100 ms. Próximo recomendado: [validar a ponte física ou executar aceite manual assistido do leitor e medir a interface](../../.scratch/interface-m1/leitor-e-desempenho.md), dentro do recorte 06; depois ampliar formulários, sheets, erros e texto 200%.

A inspeção de Ajustes/Briefing nos seis conjuntos não renova a aprovação dos três críticos para todas as telas/estados. Matriz integral, foco/contraste contextual em todos os estados e iPhone/VoiceOver continuam pendentes nos recortes/aceite existentes. Domínio público, associações de links e operação externa mantêm seus gates próprios.
