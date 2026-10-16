# Navegação linear e isolamento dos diálogos — TalkBack,16/10/2026

Recorte delimitado de06/M1, REQ-DS-003 e Q60=A. Incremento local concluído: matriz nativa, checks do app e check completo da API aprovados. O recorte06/M1 permanece aberto.

## Resultado nativo

Rodada3 aprovada sem modo de observação, no Pixel_9/Android15/API35, GPU host,2GB e texto200% após preparação inicial a100%. Foram31 fases, sete percursos,145 gestos lineares e297 observações de foco nativo. Todas as observações tiveram exatamente um nó visível selecionado, na mesma janela do diálogo, com concordância entre foco de nó e foco de janela. Nenhuma transferência para o fundo foi aceita. Além disso, nove registros conferem entrada/retorno dos diálogos e75 medições de controles/13 de campos-IME mantêm os critérios anteriores.

Mesmo APK7430a6f8db0daf5cfb2e12e4fd1257f7b6557953bdddcf32d4618004fdbaa102 dos incrementos anteriores, sem mudanças no código do produto, assets, contrato HTTP ou schema. O observador temporário e o roteiro de teste foram ampliados. [Índice e validações](../design/evidencias/2026-10-16/leitor-dialogos/increment-summary.json), [resultado da matriz](../design/evidencias/2026-10-16/leitor-dialogos/rodada3/matrix-summary.json).

| Contexto | Transições até a última ação | Transições de volta ao título | Observações de foco |
|---|---:|---:|---:|
| Privacidade no cadastro |2|2|19|
| Exclusão de hábito |4|4|27|
| Privacidade em Ajustes |2|2|19|
| Confirmação de saída |3|3|23|
| Sincronização, visão geral |16|16|75|
| Revisão aninhada de recusa |20|20|91|
| Revisão aninhada de identidade incerta |8|8|43|

Cada percurso inclui cinco gestos de borda: dois anteriores ao título, dois posteriores à última ação e mais um antes do título após voltar. No Android observado, o primeiro gesto na borda pode manter a seleção e o seguinte circular dentro do diálogo. O teste exige confinamento, sem inventar proibição dessa circulação. Textos, campos e ações relevantes aparecem nos dois sentidos; a contagem considera legenda e campo como elementos distintos, sem medir a quantidade de anúncios falados.

Campos do cadastro foram preservados após fechar privacidade. Exclusão/saída canceladas conservaram hábito e sessão. Cliente independente confirmou cumprimento desfeito/XP0. Após a revisão, a correção explicitamente acionada com dependente foi confirmada com10 XP; o acionador removido levou ao título do painel. Na identidade incerta, intenção/diagnóstico sobreviveram ao reinício sem nova identidade ou XP extra; trabalho independente foi confirmado enquanto a cadeia permaneceu bloqueada. Essas conferências complementam a inspeção de foco e detectam ativações indevidas na jornada exercitada.

Fonte, leitor, permissões e rede restaurados; fixture/reverse encerrados. O lançador removeu o observador temporário e fechou emulador/painel próprios. ADB posterior sem dispositivos e ausência de QEMU/painel conferidas, preservando instalação, dados e processos preexistentes.

## Observador e limites da evidência

`ReaderObserver` mantém `FLAG_DONT_SUPPRESS_ACCESSIBILITY_SERVICES` e consulta todas as janelas interativas da jornada sintética retornadas pelo Android, com ID/camada e estados de foco de janela/nó. Não lê conteúdo de outros aplicativos ou teclas/textos do IME. O parser mantém os nós das demais janelas separados do driver comum, que continua selecionando a janela superior. Um teste de regressão conserva evidência de nó focado no fundo, caso apareça, em vez de filtrá-lo silenciosamente.

A documentação de [UiAutomation.getWindows](https://developer.android.com/reference/android/app/UiAutomation#getWindows()) especifica que a consulta retorna janelas interativas e pode omitir o fundo bloqueado por um modal. Nesta rodada, as297 observações retornaram uma janela própria interativa cada. Portanto, não alegamos inspecionar janelas ocultas omitidas: a evidência é a lista interativa inteira retornada, o foco efetivo e os gestos que tentam ultrapassar as bordas. [AccessibilityWindowInfo.isAccessibilityFocused](https://developer.android.com/reference/android/view/accessibility/AccessibilityWindowInfo#isAccessibilityFocused()) distingue foco acessível de foco de entrada.

Não foram usados `performAction`, suspensão do leitor ou temporizadores como prova. As esperas apenas assentam a operação; o resultado depende do nó real, do ID da janela e dos landmarks alcançados. Texto sintético continua entrando por teclas de hardware; isso não aceita edição falada por caractere/cursor/seleção, nem comprova a fala de cada caractere. Não houve medição de desempenho do aplicativo.

## Tentativas não aceitas

- Rodada1: parou na preparação, antes de ativar TalkBack. A ampliação inicial retirava a tolerância já existente à hierarquia momentaneamente ausente. Restaurado o polling limitado por prazo para localizar alvos; travessia continua estrita. Reexecução passou o mesmo ponto.
- Rodada2: privacidade passou; antes de percorrer exclusão, o driver considerou ausente um título visível de105px porque reutilizava o mínimo115px de um controle de44 unidades na densidade2,625. Exploração de título passou a exigir visibilidade; a exigência44 continua nas ações. O XML preserva o falso negativo. Reexecução passou exclusão e a matriz inteira.

Ambas registram `passed=false`, causa e restauração; nenhuma conta como aceite completo. A rodada3 usa o observador compilado inicialmente. A única formatação posterior do Java foi recompilada separadamente e produziu bytecode idêntico.

## Reprodução

Da raiz, com Node24/dependências instaladas, Java21/SDK Android configurados e Docker funcionando:

```powershell
.\scripts\build-reader-observer.ps1
.\scripts\verify-android-accessibility.ps1 -Traversal -SkipInstall -GpuMode host -MemoryMegabytes 2048 -EvidenceDirectory '.scratch/runtime/interface/leitor-dialogos-reexecucao'
```

`-Traversal` implica `-Matrix` e não combina com `-Recovery` ou modo de observação de foco. O lançador prepara API/Postgres antes do emulador visível e só publica discovery autenticado após confirmar propriedade/loopback. `-SkipInstall` exige igualdade de hash com o APK local. As quotas elevadas da fixture isolam o roteiro; não constituem aceite dos limites de produção. [Plano e diagnósticos](../../.scratch/interface-m1/leitor-dialogos.md).

## Verificações e próximo recorte

App: tipos/lint e227 testes aprovados,183 do núcleo/infraestrutura e44 de componentes. O caso novo verifica que o parser preserva todos os nós/janelas para detectar foco no fundo sem contaminar o driver da janela superior. API: check completo aprovado em10m40s:93 casos/85 executados/oito nativos opt-in ignorados,zero falhas/erros,13 verificações operacionais e modularidade aprovadas. A matriz nativa de31 fases passou separadamente; os oito testes ignorados no check não são sua evidência de aceite.

Próximo recorte recomendado: descarte explícito e estados restantes de sincronização com TalkBack, incluindo preservação/retomada. Depois, edição falada e medidas reais de abertura/cards/feedback. Paletas devem corresponder ao APK aceito; VoiceOver/iPhone continua adiado conforme Q55=B. Domínio/Resend/links públicos e gates operacionais existentes continuam nas tarefas próprias. O sucesso destes sete contextos não fecha toda a acessibilidade,06 ou M1.
