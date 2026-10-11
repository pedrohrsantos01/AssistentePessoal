# Correção visual para o Ritmo-App — 11/10/2026

**Estado: correção das telas existentes aprovada no ciclo visual.** Os três grupos receberam aprovação de Briefing, Sistema e Visual: A3, B2 e C4, nove rodadas no total. A quarta rodada de C foi autorizada por Pedro e resolveu a legibilidade em somente leitura. App/API e ensaio Android passaram; o M1 integral permanece aberto.

Pedro identificou a seleção incorreta de Ritmo-M1. A referência visual correta é **Ritmo-App.dc.html**, incluindo seu estado `fase=m1` para as capacidades atuais. O spec/11, o plano e a matriz da interface foram corrigidos; a mesma fonte orientará os incrementos posteriores. Pareceres visuais de Ritmo-M1 ficam como histórico e não aprovam esta direção.

## O que mudou

- Entrada, conta e onboarding seguem marca 68, título 40, ações inferiores, formulários com gutter 24/gap 16, indicador sobre duas barras e grade de quatro colunas. Primeiro hábito usa cinco sugestões e nome, com catálogo reservado à criação/edição posterior.
- Briefing usa XP em pílula no cabeçalho, card único, emoji simples e check 28 com alvo 44. Removidos card separado de saldo, mensagem allDone e rodapé extra de gestão. Estado real de sincronização continua visível e acionável.
- Gestão usa linhas 64, emoji 20, caption do protótipo e superfície sem scanline/colchetes. ACK normal não repete status em cada linha; pendências, recusa e identidade incerta continuam explícitas. Ordenação e exclusão continuam funcionais.
- Criação/edição usa os dez ícones e cinco cores do Ritmo-App. Metadados legados continuam renderizáveis/editáveis; editar apenas o título não os substitui. Nova escolha noPhone/magenta e legado walking/green foram verificados sobre SQLite.
- Em somente leitura, nomes, descrições, emojis e estados dos hábitos mantêm o contraste normal; apenas check, chevron e ações indisponíveis ficam esmaecidos. A linha continua desabilitada e as tentativas de marcar, criar, editar ou ordenar preservam fila, XP e metadados.
- Barra inferior usa os caracteres ☀/◎/⚙, tamanho 18, rótulos 11/gap 2. Sheets seguem máximo 88%, borda superior 1/raio 22, padding 10/20/40, gap 14 e handle 40× 5/raio 3. Ajustes e painéis de sessão/sync usam os mesmos componentes.

Nome/privacidade, senha 8–128, fuso IANA, horas 0–23, título 120, isolamento de contas e regras de XP/sync permanecem contratos reais. Nenhuma migration, dependência ou integração externa foi adicionada. As telas continuam usando Journey/SQLite; não foram portadas contas, relógios, localStorage ou HTTP simulado do protótipo.

## Correção de teclado descoberta no ensaio

O primeiro ajuste de offset passou no componente, mas reprovou no Android edge-to-edge com texto 200%: viewport terminava em 2361px enquanto o teclado começava em 1116px. A3 limita a área útil pela altura real do IME e safe areas, acompanha mudanças de altura/dimensões e restaura o layout ao fechar. Page e Sheet compartilham o mecanismo.

A automação passou a exigir o controle inteiro acima do limite físico do teclado, com duas leituras estáveis. Encontrar bounds no XML atrás do IME ou uma faixa transitória de navegação não vale como prova. A jornada Android passou com teclado 100%/200%, preservação dos campos e reabertura. Quatro casos de componente cobrem Page/Sheet× 100%/200%, mudanças de altura, dimensões e fechamento.

## Método e evidências

[Ciclo e progresso](../design/fidelidade-ritmo-app/progresso.md): A entrada/conta/onboarding, B Briefing/vazio/hábitos, C gestão/criação/ajustes/painéis. Construtor/Briefing GPT-6.1 Sol, Sistema GPT-6 Luna, Visual GPT-6 Astra; contextos independentes e sem leitura de implementação pelos críticos. Limite inicial de três rodadas por grupo, com quarta rodada de C autorizada por Pedro, sem aprovação por maioria. [A3](../design/fidelidade-ritmo-app/avaliacao-a-rodada-3.md) e [B2](../design/fidelidade-ritmo-app/avaliacao-b-rodada-2.md) receberam três aprovações; C2 foi reprovado pelo Sistema por sobreposição da borda da pílula longa de cofre 200%; [pareceres C2](../design/fidelidade-ritmo-app/avaliacao-c-rodada-2.md). C3 corrigiu a pílula longa, mas o Visual encontrou uma lacuna no contraste do conteúdo de consulta em somente leitura; [pareceres C3](../design/fidelidade-ritmo-app/avaliacao-c-rodada-3.md). [C4](../design/fidelidade-ritmo-app/avaliacao-c-rodada-4.md) corrigiu o conteúdo esmaecido e recebeu as três aprovações em novos contextos, com novas capturas100/200. Nenhuma aprovação por maioria foi aplicada.

[Tokens extraídos](../design/tokens-prototipo-app.json) registram SHA256 `a37d1a92cac66cc302cdb0603f5636e079b66369d9feacf13f264964ba0c0557`. As seis paletas foram conferidas com o AST da fonte. Chromium visível capturou o HTML original e estados equivalentes, incluindo Leitura offline concluída/10 XP e gestão com os mesmos dois hábitos.

- [Referência original](../design/evidencias/2026-10-11/ritmo-app-referencia/).
- [Jornada Android aprovada — APK 3](../design/evidencias/2026-10-11/ritmo-app-android/rodada-3/).
- [15 quadros de comparação](../design/evidencias/2026-10-11/ritmo-app-comparacoes/rodada-3/).
- [Sessão C3 — APK5](../design/evidencias/2026-10-11/ritmo-app-android/sessao-rodada-3/).
- [Sync C4 — APK6](../design/evidencias/2026-10-11/ritmo-app-android/sync-rodada-4/), incluindo somente leitura100/200.
- [Sessão histórica — APK4](../design/evidencias/2026-10-11/ritmo-app-android/sessao-final/), funcionalmente aprovada, com defeito visual C2 preservado.

Os quadros normalizam apenas a área útil: Android 1080× 2424/densidade 2,625, recorte[0,137,1080,2361] reduzido para 411× 847; HTML 413× 929, recorte[1,47,412,894]. Não há retoque de conteúdo. C04 pareava temas diferentes e foi excluído; C05 usa fonte escura 200%. Rodada 3 no nome do diretório é a passagem de captura, não o número de iterações de todos os grupos.

O Sistema A3 inicialmente atribuiu a imagem esquerda de A01 ao produto. A identificação foi corrigida e o crítico aprovou as mesmas imagens originais, sem nova mudança ou quarta rodada. A crítica Visual sempre recebeu os pares sem identificação.

## Validação verificada

| Verificação | Resultado |
|---|---|
| App typecheck / lint | passaram |
| App testes | 180: 150 de domínio + 30 de componentes; nenhum snapshot |
| API check C4 | passou; 85 testes Java executados/aprovados, 5 casos Android separados não habilitados nesse check e 13 testes operacionais; sem mudança de API |
| Bundle APK 6 | 11 pesos de fontes esperados, licenças OFL e Unicode presentes |
| Android jornada APK 3 | passou;20 fases funcionais e 30 medições de alvos, incluindo teclado 100%/200% |
| Android sessão APK5 | passou: oito fases e nove medições de alvos |
| Android sync APK6 | passou: cinco fases, nove medições, quinze capturas; inclui consulta100/200 após reabertura |

APK 5 contém a geometria final de Sheet e resumos para cinco status descritivos, conservando explicações completas/rótulos acessíveis. As telas normais e o mecanismo de teclado exercitados na jornada APK 3 são os mesmos; sessão/sync foram repetidos no APK 5. A jornada inteira não foi executada no APK 5 nem no APK 6. APK 6 acrescenta somente a legibilidade das linhas em consulta; o novo ensaio de sync C4 passou. Fontes e licenças foram reauditas no APK 6. [Sessão C3](../design/evidencias/2026-10-11/ritmo-app-android/sessao-rodada-3/) e [sync C3](../design/evidencias/2026-10-11/ritmo-app-android/sync-rodada-3/) registram os ensaios; [bundle final](../design/evidencias/2026-10-11/ritmo-app-android/final/bundle-audit.json) confirma fontes e licenças. Emulador e acompanhamento encerrados ao terminar os ensaios. Os [checks](../design/evidencias/2026-10-11/ritmo-app-android/final/checks.json) registram os resultados do app/API; metadados distinguem os APKs.

A primeira tentativa da sessão APK 4 falhou no leitor XML do teste: a tela vazia correta foi capturada, mas o emoji do rótulo estava codificado numericamente. Decodificação alinhada ao driver já validado da jornada; captura da falha preservada e repetição aprovada sem mudar o APK. As provas antigas/condicionais de teclado e o ensaio A2 reprovado permanecem histórico, sem serem contabilizados como aceite.

Erro interno de codificação durante a edição C4 truncou temporariamente o teste de jornada; o source map do Jest preservou a versão íntegra C3. Conteúdo recuperado, alteração C4 reaplicada em UTF-8, diff conferido e suíte final de 180 testes aprovada. Não foi usado HEAD para descartar os incrementos anteriores.

## Diferenças e pendências

Contornos funcionais mais fortes preservam contraste e alvos 44. Glyphs/emojis e rasterização de fontes variam entre Android e Chromium; o Visual B2 apontou o sol colorido como diferença residual. Conteúdo real, safe areas e escala Android não linear também diferem dos fixtures. Aprovação dos mecanismos não afirma igualdade de todos os pixels entre renderizadores.

Recortes 05 recuperação por link e 06 preferências/aparência, matriz integral de leitores de tela/aparelhos, integrações externas e iPhone 16e continuam abertos. Q55=B mantém iOS adiado. Correção das telas existentes não encerra o M1 nem adiciona módulos futuros. Contraste dos controles realmente inativos segue a exceção dos critérios [WCAG 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) e [1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html), sem dispensar semântica de desabilitado.
