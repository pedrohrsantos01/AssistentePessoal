# Navegação linear e isolamento dos diálogos — Q60

Status: incremento Android concluído localmente;06/M1 abertos. Escopo delimitado de06/M1; REQ-DS-003 e contrato Q60=A já aprovados.

## Resultado esperado

Com TalkBack real e texto200%, percorrer os diálogos de privacidade (cadastro e configurações), exclusão, saída, sincronização e revisões aninhadas nos dois sentidos. Título, textos informativos e ações pertinentes devem ser alcançáveis. Gestos anteriores/posteriores às bordas não transferem o foco ao fundo nem ativam ações. Fechar/cancelar mantém o retorno protegido já aprovado; conferências de formulário/hábito/XP e cliente independente detectam efeitos indevidos.

## Coleta

`verify-android-accessibility.ps1 -Traversal` implica `-Matrix`, é incompatível com `-Recovery` e usa a mesma fixture real de API/PostgreSQL e o APK atual. Abre emulador/painel visíveis somente durante o ensaio, preserva processos preexistentes e fecha os próprios recursos no finally.

O observador temporário continua com `FLAG_DONT_SUPPRESS_ACCESSIBILITY_SERVICES`. Registra todas as janelas interativas da jornada sintética retornadas pelo Android, com ID/camada/foco de janela e nó. O driver comum continua usando apenas a janela superior. Não coleta conteúdo de outras aplicações ou do teclado; registra somente geometria do IME e o ID da janela com foco. A API Android omite janelas bloqueadas por um modal: a ausência não significa inspeção de janelas ocultas; o gesto e o foco efetivo complementam a evidência.

Após cada gesto físico de um contato, o teste exige janela estável, foco nativo único/visível na janela do diálogo e nenhum nó de fundo selecionado. Registra sequência nos dois sentidos, checkpoints XML/PNG e os probes de borda. Navegação não usa `performAction`; temporizadores apenas permitem assentamento e não são prova de sucesso. Os landmarks são exigidos nos dois percursos.

## Limites

Não aceita edição falada por caractere/cursor, todas as variantes de sincronização/descarte, desempenho, paletas do novo APK ou VoiceOver. Q55=B mantém iOS adiado e06/M1 abertos. A fonte Android é a API pública [UiAutomation.getWindows](https://developer.android.com/reference/android/app/UiAutomation#getWindows()) e [AccessibilityWindowInfo](https://developer.android.com/reference/android/view/accessibility/AccessibilityWindowInfo#isAccessibilityFocused()).

## Diagnósticos do driver

Rodada1 interrompida antes de ativar o leitor: a ampliação inicial tinha substituído a tolerância existente a hierarquia transitória ausente por uma falha imediata. Restaurada a consulta limitada por prazo para localizar alvos; as asserções de travessia continuam estritas.

Rodada2 passou privacidade e interrompeu antes de percorrer exclusão: o título estava visível, com105px de altura, mas a exploração reutilizava o mínimo de115px dos controles na densidade2,625. Textos informativos usam visibilidade; o mínimo44 continua exigido ao explorar/ativar controles. Nenhuma tentativa foi aceita como matriz completa; configurações e recursos foram restaurados em ambas.

## Resultado Android

Rodada3 aprovada:31 fases, sete percursos,145 gestos lineares/297 observações nativas, nove registros de entrada/retorno,75 medições de controles/13 de campos-IME. Mesmo APK7430a6f8, sem alteração do produto. Configurações restauradas e emulador/painel próprios fechados, com conferência posterior. [Relatório e limites](../../docs/analises/2026-10-16-talkback-navegacao-dos-dialogos.md). App:227 testes/tipos/lint aprovados; API check aprovado em10m40s:85 executados/oito nativos opt-in ignorados,zero falhas/erros,13 verificações operacionais e modularidade. Não fechar06/M1.
