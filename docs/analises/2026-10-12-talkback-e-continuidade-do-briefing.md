# TalkBack e continuidade do Briefing — 12/10/2026

O Briefing agora mantém o foco acessível no hábito depois do cumprimento confirmado. Antes, o provider local trocava o card por carregamento e desmontava o controle. O roteiro básico com TalkBack real passou no APK corrigido na rodada7 e novamente após cold boot na rodada10. A ponte funciona no Pixel_9 Google Play existente, preservando imagem e dados. Este incremento pertence ao recorte06; não conclui esse recorte nem o M1.

## Correção do produto

A sessão já entrega a projeção local confirmada. Providers locais passam a renderizar esse contexto diretamente, sem `load` assíncrono que substitua os controles a cada atualização. A identidade dos controles permanece. Providers que precisam carregar conservam o loader opcional, o carregamento e o isolamento de falha por card. Não há sucesso anterior à escrita local, nova query na renderização ou alteração de contratos de sincronização.

A regressão de componente verifica que uma nova projeção não desmonta o controle, não mostra carregamento e aplica imediatamente o bloqueio de escrita. Outra prova cobre falhas de renderização local e de carregamento assíncrono, preservando o card independente.

## Ponte e observação nativas

A ponte de teste usa `sendTouch` do proto instalado, carregado por grpc-js 1.14.6/proto-loader 0.8.1, dependências apenas de desenvolvimento. O lançador verifica PID/AVD/serial, política exclusiva e endpoint próprio em loopback. JWT ES256 com validade de 60 segundos, emissor de teste e audience limitada a `sendTouch`; nenhum endpoint desprotegido. Chave privada e tokens ficam em memória; somente o conjunto público JWK temporário é escrito e removido. Não há reenvio automático de gesto após erro de transporte.

O observador Android `testOnly`, de 12,7 KB, não possui activity nem permissão de rede e executa no próprio pacote/processo. `UiAutomation.FLAG_DONT_SUPPRESS_ACCESSIBILITY_SERVICES` consulta rótulo, estado, geometria e foco sem suspender o TalkBack. A janela precisa pertencer à jornada sintética. Esperas limitadas repetem somente consultas de leitura; ativações não são repetidas automaticamente.

O gesto linear parte do centro do controle focado, com deslocamento curto e rápido. Exige foco no radio Neo-tokyo e Cockpit ainda selecionado; qualquer outro destino reprova. O tempo registrado desse gesto inclui transporte do driver e não mede o desempenho do produto.

## Execuções e evidências

Todas as rodadas anteriores foram preservadas, incluindo as reprovadas. O aceite usa o resultado correspondente ao APK realmente instalado.

| Rodada | Resultado e limite |
|---|---|
| [1](../design/evidencias/2026-10-12/leitor-android-sdk/rodada1/reader-status.json) | Preflight passou; consultas que pausavam/reiniciavam o leitor invalidaram a ativação. Sem aceite. Cópias anteriores de capturas preservadas. |
| [2](../design/evidencias/2026-10-12/leitor-android-sdk/rodada2/reader-status.json) | Consulta antes de o hábito estar disponível. Sem aceite. |
| [3](../design/evidencias/2026-10-12/leitor-android-sdk/rodada3/reader-status.json) | Foco/marcar/desfazer com leitor contínuo passaram; seleção não passou na consulta imediata. A captura02 mostrou a perda de foco após marcar, mantendo cumprimento/XP. |
| [4](../design/evidencias/2026-10-12/leitor-android-sdk/rodada4/talkback-summary.json) | Roteiro básico aprovado no APK anterior `3d5e7460…`; não comprovava permanência do foco após atualizar. |
| [5](../design/evidencias/2026-10-12/leitor-android-sdk/rodada5/reader-status.json)/[6](../design/evidencias/2026-10-12/leitor-android-sdk/rodada6/reader-status.json) | Instalação convencional recusada por espaço. Sem gestos/aceite. |
| [7](../design/evidencias/2026-10-12/leitor-android-sdk/rodada7/talkback-summary.json) | APK corrigido aprovado: exploração sem ativação, marcar/desfazer com foco retido, Ajustes, seleção e navegação linear. Também 12 paletas/36 alvos. |
| [8](../design/evidencias/2026-10-12/leitor-android-sdk/rodada8/reader-status.json) | Hash instalado confirmado após cold boot; hábito/foco/desfazer passaram. Swipe foi interpretado como exploração e focou “Nome”. Navegação reprovada. |
| [9](../design/evidencias/2026-10-12/leitor-android-sdk/rodada9/reader-status.json) | Hash confirmado; transporte ADB desapareceu durante preparo, antes de habilitar leitor. Causa não estabelecida. Sem aceite. |
| [10](../design/evidencias/2026-10-12/leitor-android-sdk/rodada10/talkback-summary.json) | Roteiro corrigido aprovado após cold boot: foco retido, desfazer, seleção e foco linear Cockpit→Neo-tokyo. Reutiliza paletas da rodada7 somente após conferir o mesmo hash. |

Rodada10: Pixel_9, Android35 Google APIs Play Store x86_64, SDK emulator 36.3.10, TalkBack 15.0.0.639625893. Emulador/painel visíveis. Explorar não alterou o hábito nem a aparência; duplo toque ativou o nó real; serviço Bound/touch exploration e foco do nó conferidos durante a prova. Autenticação ausente foi recusada com código16; audience/emissor incorretos, código7. Tempo total de 119,5 s pertence ao ensaio, não às metas do app.

Capturas inspecionadas: [hábito marcado com foco](../design/evidencias/2026-10-12/leitor-android-sdk/rodada10/02-talkback-habito-alterado.png) e [foco linear em Neo-tokyo com Cockpit ativo](../design/evidencias/2026-10-12/leitor-android-sdk/rodada10/05-talkback-navegacao-linear.png). A [matriz de paletas](../design/evidencias/2026-10-12/leitor-android-sdk/rodada7/palette-summary.json) contém seis aparências/modos a 100%/200%, 12 capturas e 36 medições de alvos com densidade 2,625. Leitor testado a 100%.

## Checks e artefato

Correção do produto registrada no commit `ff86a08` (REQ-BRF-003). Ponte, roteiro e evidências ficam em commit de teste separado, sem declarar conclusão integral do requisito ou do recorte.

- App: typecheck/lint e 203 testes passaram, sendo 164 de domínio e 39 de componentes. Tipos/lint repetidos após o ajuste final do driver.
- Build: Java21.0.8, Expo57/RN0.86.3, x86_64, concluído em 5m26s. Build original SHA-256 `09dc590064c987ed20af1f9e1f54bef35f370865499796451966ea6752843c20`.
- Artefato final com assinatura de debug v4: SHA-256 `11cee24a408bb8d265c41bf4387a21076cebfb681c6e2b20e8fa544a92d7263f`, 44.649.421 bytes. [Hash instalado após cold boot](../design/evidencias/2026-10-12/leitor-android-sdk/rodada10/installed-apk.json) coincide, sem inferência apenas por versão ou exit code do installer.
- API: `gradlew check` completo aprovado em 12m41s, com Java21. XML de 14 suítes:92 casos,85 executados,7 opt-ins ignorados,0 falhas/erros. Os13 testes Python operacionais também passaram. Execução isolada após fechar o emulador do ensaio.

Um primeiro teste de componente excedeu 5s durante boot do emulador; a execução completa com emulador fechado passou sem alterar timeout. Build com JAVA_HOME25 falhou no CMake/worklets; o build Java21 passou. Avisos existentes de bibliotecas/Kotlin/Gradle, sem warning novo nos fontes alterados.

## Espaço e restauração

Instalação convencional falhou com 381–384 MB livres. `pm trim-caches` preservou bancos e liberou pouco. `InspectOnly` confirmou que foundationharness e httpharness já não estavam instalados. A assinatura v4 com `true`, com a mesma chave convencional de debug, permitiu instalação incremental sem desinstalar a jornada. O apksigner do SDK36 não aceita `only`, citado na documentação atual; essa tentativa não alterou o APK. A assinatura válida alterou o hash, registrado e conferido no aparelho. Nenhuma base ou imagem foi descartada; nenhuma política SELinux foi alterada.

A desconexão da rodada9 impediu confirmar sua restauração. O observador residual foi identificado pelo SHA-256 `b7715fa3aaf8722435ee6a68746233a5983ca664db76a15ad5c6f970b00d6f50` e removido em recuperação visível, preservando a jornada. A inspeção confirmou leitor desabilitado, fonte1 e modo noturno `no`; a origem anterior dos flags de notificação não pôde ser reconstituída e não foi inferida. O snapshot da rodada10 registra os valores encontrados antes de qualquer alteração do novo ensaio.

A rodada10 preservou o [estado inicial](../design/evidencias/2026-10-12/leitor-android-sdk/rodada10/reader-environment.json) e confirmou [restauração sem falhas](../design/evidencias/2026-10-12/leitor-android-sdk/rodada10/reader-cleanup.json). Emulador/painel próprios encerrados; o Pixel_9_Pro preexistente em emulator-5554 foi preservado. O lançador solicita remoção de seu observador temporário; não assume pacotes preexistentes. A revisão automática recusou remover cópias de capturas da rodada1: elas continuam preservadas e separadas do aceite.

## Reprodução e fontes

Comandos/pré-condições no [README do app](../../app/README.md#aparência-e-leitor-de-tela--recorte06). `ReaderOnly` exige 12 arquivos/36 alvos no mesmo APK; o resumo aponta a origem. Não usar `adb input`, foco de janela ou simples registro do serviço como prova de ativação do leitor.

O SDK instalado cria `pid_<PID>.ini`; a ajuda menciona `pid_<PID>_info.ini`. O lançador aceita os dois somente para os próprios PIDs. JWK precisa ser um conjunto `keys`; JWT não inclui `typ` opcional rejeitado pelo validador e precisa de `iss` autorizado na allowlist local. Proto SHA-256: `dcf136e573f846cde7625d0e9ce8b175c7eaaad9355bf6962093cbb23e828357`.

Fontes primárias: [SDK e segurança gRPC](https://android.googlesource.com/platform/external/qemu/+/0ad64c577d2304561b8dab72ab38d535a4c061a9/android/android-grpc/docs/), [UiAutomation](https://developer.android.com/reference/android/app/UiAutomation#FLAG_DONT_SUPPRESS_ACCESSIBILITY_SERVICES), [gRPC Node](https://grpc.io/docs/languages/node/basics/), [apksigner](https://developer.android.com/tools/apksigner). Help/proto/allowlist instalados e provas reais determinam a compatibilidade; documentação de outra versão não substitui a execução.

## Pendências

Specs07 §1/08 §6: cold start≤2s, feedback≤100ms, cards locais≤300ms. Instrumentação real ainda pendente; tempos/esperas do driver não aceitam nem reprovam essas metas. Ampliar leitura para texto200%, formulários/teclado, sheets, validação/erros e estados de sessão/sync. A prova básica não valida toda a leitura falada nem a matriz completa. iPhone/VoiceOver segue adiado por Q55=B; gates externos do M1 continuam abertos.
