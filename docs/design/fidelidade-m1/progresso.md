# Ciclo de fidelidade M1

**Referência corrigida em11/10/2026:** este documento é histórico da seleção incorreta de Ritmo-M1. A fonte atual aprovada por Pedro é Ritmo-App; os pareceres visuais anteriores não a aceitam. Ver [correção e evidências](../fidelidade-ritmo-app/progresso.md) e spec/11.

Objetivo aprovado: corrigir todas as telas já implementadas contra `Ritmo-M1.dc.html`, Holograma. Modelos: GPT-6.1 Sol construtor/briefing; GPT-6 Luna sistema; GPT-6 Astra visual. Limite: três rodadas por grupo.

Pré-verificação: original e support.js disponíveis; referência renderizada por interceptação local no Chromium visível, sem servidor persistente; capturas nativas anteriores disponíveis; Android visível será aberto somente no ensaio. Spec/11, fontes locais e catálogo disponíveis. Nenhum crítico depende apenas do código.

| Grupo | Rodadas | Briefing | Sistema | Visual | Estado |
|---|---:|---|---|---|---|
| A — entrada/conta/onboarding | 3 | APROVADO | APROVADO | APROVADO | concluído no escopo atual |
| B — Briefing/vazios/XP | 2 | APROVADO | APROVADO | APROVADO | concluído no escopo atual |
| C — gestão/edição/ajustes/sheets | 2 | APROVADO | APROVADO | APROVADO | concluído no escopo atual |

Lacunas iniciais: marca envolta em card; peso/tamanho excessivo de títulos; ausência de etapa visual; catálogo sem cinco colunas; cores em botões de texto; cards e status espaçados além da referência; gestão com card por hábito; abas sem ícones; sheets substituídas por página inteira. Capturas iniciais em `docs/design/evidencias/2026-10-09/gestao-android/`; referência em `output/playwright/fidelidade/`.

## Rodada 1 — grupo A

Construtor entregou a primeira composição. Briefing e Sistema aprovaram o escopo observado. Visual reprovou A 05: frequência abaixo do nome amplia a prévia e desloca ações; deve ficar na linha horizontal a 100%. A comparação 200% verifica leitura/reflow/alcance: a escala não linear nativa e os rótulos web fixos em px não são uma equivalência geométrica.

App: typecheck/lint e 156 testes passaram. API: check completo passou em 12m58s. APK journeytest gerado. Primeiro ensaio visible parou ao medir um alvo fora do viewport; driver passou a rolar antes da medição e ler coordenadas com sinal. Segundo comprovou alvo200% e avançou ao Briefing, mas o check decorativo prefixado alterou o nome acessível do estado; o nome semântico será preservado antes da repetição. Emulador/painel próprios fecharam nas duas falhas. Isto não é aceite final.

Comparativos A 01–A 07: `../evidencias/2026-10-09/fidelidade-android/rodada-1/comparativos/`. Originais nativos preservados, normalização em 411×847 da área útil (densidade 2,625; corte superior137px/inferior63px). Referência teve somente quadro externo ajustado para 411,43×928,43, retirando47/34 de barras fictícias; transição do quadro desativada para captura. Dados reais de fuso/data/saudação e copy contratual podem variar; controles futuros e placeholders do protótipo não são funcionalidades aprovadas.

## Rodada 2 — grupo A / rodada 1 — grupo B (10/10/2026)

A: prévia horizontal corrigida a 100%, com reflow a 200%. Briefing aprovou. Sistema reprovou contraste das bordas; a medição dos pixels de login confirmou controle transparente em 2,847:1 sobre a base e input em 2,996:1 contra a base externa. As bordas decorativas de cards não são indicadores necessários e não têm essa exigência. Visual reprovou cadastro: ação Criar conta aproximadamente52 unidades abaixo da referência, sobretudo pelo bloco de privacidade separado. Próxima rodada A será a terceira e última autorizada.

B: Briefing e Sistema aprovaram. Visual reprovou a textura: repetição de 4 pixels físicos a densidade 2,625 produz scanlines densas demais, que desaparecem na área útil normalizada. A referência usa período4 unidades lógicas. Correção enviada ao construtor, sem aumentar alpha para compensar.

O ensaio A 2 comprovou onboarding retomável, vazio, criação/cumprimento/desfazer offline, XP persistido e convergência HTTP, temas nativos, texto200%, redução de movimento e edição/ordem persistida. Parou ao procurar Tudo sincronizado na gestão, que não tem a pílula. O driver agora abre Briefing para verificar esse estado e volta à gestão; mantém as asserções do cliente independente. Repetição visível em andamento, sem modificar o APK congelado. Originais e comparativos estão em rodada-2. Ainda não há aceite final nem M1 encerrado.

## Rodada 1 — grupo C / repetição nativa concluída

Briefing reprovou a descoberta de edição: nomes/tiles acionáveis não têm pista visível de abertura. Sistema e Visual aprovaram o grupo no escopo observado. Visual inicialmente apontou corte no Cancelar200%, mas retificou após abrir a original1080×2424: contorno y2197–2360 e barra de gestos abaixo, cerca2393; a leitura reduzida912×2048 não sustentava o corte. Retificação registrada, não contada como nova rodada.

Construtor recebeu: pista discreta de abertura na área acionável de gestão, preservar contexto do editor por trás do painel de exclusão e ocultar somente esse fundo da acessibilidade. A 3/B2/C2 em construção.

Ensaio nativo completo da rodada2: **PASSOU**, Node 508,45s/Gradle 9m17s,20 fases e medidas de alvos. Incluiu exclusão offline, cancelamento sem escrita, reversãoXP e convergência, gestão200%, início futuro gerenciável sem cumprimento antecipado. Emulador e painel próprios encerrados. Evidência: rodada-2/verificacao.json e native-targets.json. Driver corrigido para rotular explicitamente100% após reset da fonte; o arquivo desta execução manteve rótulos200% desatualizados em alguns alvosC100, sem alterar medidas. Próximo ensaio verificará a versão corrigida.

## Construção para A 3/B2/C2

Aplicadas: política inline do cadastro em alvo único44 e texto equivalente ao aviso autorizado; rótulos de Input com entrelinha1,20; força de senha preexistente preservada quando preenchida; boundary composto sobre base clara/elevado escuro; textura normalizada por densidade; chevron discreto na área de edição; editor retido atrás da exclusão e oculto da acessibilidade enquanto o painel abre.

App final: typecheck/lint passaram;144 testes de núcleo/domínio e12 de componente passaram. Teste de contraste ampliado falhou antes nos três modos claros e passou depois;72 pares de borda/fundo adjacente, mínimo 3,102339:1. Cancelamento confirma rascunho não salvo preservado, fundo oculto do leitor e nenhuma operação nova. Driver acrescenta privacidade100/200% no cadastro e corrige metadado da escala. APK final gerado e congelado; conclusão do ensaio e pareceres abaixo. As seções anteriores preservam o histórico, não o estado atual.

## Conclusão — 10/10/2026

A 3, B2 e C2 receberam os três veredictos APROVADO, dentro do limite de três rodadas. Retificações de leitura das mesmas imagens foram preservadas em [avaliações](avaliacoes.md), sem nova implementação/rodada. O crítico C2 de Sistema recebeu as métricas por encaminhamento do coordenador porque seu exec falhou; a inspeção das imagens foi própria. Não ocultar esse limite.

APK final SHA256 `9753ee1c91ace45df65ef31285577d2d176687c16fa265cf110a8111b8f93cd6`, build 5m41s. Jornada Android visível final aprovada:20 fases, Node 537,043s/Gradle 9m29s;28 medições de toque passaram. Emulador/painel próprios encerrados e ausência confirmada após o ensaio. [Verificação final](../evidencias/2026-10-09/fidelidade-android/rodada-3/verificacao.json).

Contraste:72 pares de borda ≥3,102339:1;192 pares textuais permitidos ≥5,252708:1. Pixels de cobertura inteira do login confirmam a borda corrigida; textura do XP mede período médio10,5px a densidade 2,625, equivalente a 4 unidades. Os JSONs distinguem papéis textuais e controles. [Relatório final](../../analises/2026-10-10-fidelidade-visual-m1.md).

Concluído o refinamento das telas implementadas nos recortes 01/02. M1 continua aberto: recortes 03–06, matriz integral de acessibilidade/aparelhos, iPhone adiado e integrações/aceites externos.
