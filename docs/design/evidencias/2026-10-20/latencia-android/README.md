# Evidências — latência do cumprimento

20/10/2026. Probe nativo v4/marcos JS v2. [Relatório](../../../../analises/2026-10-20-latencia-do-cumprimento-m1.md), [recorte](../../../../../.scratch/interface-m1/latencia-do-cumprimento.md) e [próximo](../../../../../.scratch/interface-m1/cauda-do-cumprimento.md).

Comparação aceita: baseline2 e optimized4, cada uma com 10 partidas/20 alterações offline, timestamps do PressEvent/UP correspondentes, reinício e convergência independente. Mediana 130,74→97,31 ms; p95 175,56→160,58 ms; máximo 189,90→234,66 ms; dentro de 100 ms: 1/20→12/20. Refreshes 2→1 em todos os casos. A meta de 100 ms permanece aberta, assim como cards/aceite físico/M1.

- protocol.json, comparison.json e selection-*.json: método, distribuições completas/etapas e seleção dos APKs; comparison-sources.json/comparison-bundles.json/fixture-build.json: build comparável e restauração da fonte/APK normal.
- baseline2 e optimized4: native-events/native-frames, coldProof/launcher, marcos JS e atribuição, guard físico de gesto, hierarquias/screenshots, reinício/resultado remoto, logs de driver/lançador, limpeza e isolamento. Somente essas coortes completas integram a comparação.
- diagnostico1: probe v3 rejeitado por associar UP antigo ao PressEvent posterior; motivo em rejected.json. Todos os dados foram preservados, sem aceitação do intervalo alto como latência de um mesmo toque.
- optimized3: mesmo APK de optimized4, mas a coleta perdeu uma entrega de FrameMetrics na quarta partida. Registros parciais e falha preservados; não integra a comparação.
- app-checks.json/app-*.txt, analyzer-tests.txt e duplicate-refresh-red/green.txt: regressão e checks do app. api-check-first.*: primeira execução completa com uma falha no ensaio WAL; api-check.json/api-check.txt: repetição isolada aprovada em 12 min 17 s, 85 executados/oito opt-in ignorados, zero falhas/erros e modularidade.

Dados sintéticos. Sem APK, banco, segredo ou logcat geral. O endpoint é renderização/emissão ao subsistema de display, não fótons. Textos finais normalizados em UTF-8 LF; manifest.sha256 cobre os bytes finais da pasta; source-checksums.json cobre as fontes do recorte. host-before/after.json e preservation.json registram a custódia e o encerramento dos recursos próprios. Não substituir a meta por uma média, nem tratar validade da medição como aceite de desempenho.
