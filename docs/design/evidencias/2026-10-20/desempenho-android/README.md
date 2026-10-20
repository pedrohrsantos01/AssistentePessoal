# Evidências — desempenho nativo do M1

20/10/2026. Rodada8/schema2: coleta válida de10 aberturas frias e20 alterações offline. Abertura dentro de2s em10/10; cards acima de300ms em10/10; feedback acima de100ms em20/20. Issue06/M1 continuam abertos. [Relatório](../../../../analises/2026-10-20-desempenho-instrumentado-m1.md), [plano](../../../../../.scratch/interface-m1/desempenho-instrumentado.md).

- rodada8/performance-summary.json: distribuição e frações das metas, separadas da validade da coleta.
- rodada8/native-events-*.json: eventos brutos do probe; native-frames.json acrescenta coldProof validado por launcher/driver. cold-launches.json e device-launch-*.txt preservam origem/PIDs.
- rodada8/javascript-milestones.json e auxiliary-intervals.json: diagnósticos, sem substituir os endpoints nativos nem alinhar relógios por suposição.
- rodada8/remote-result.json: reinício e convergência independente; matrix-summary.json/native-check.json: resultado funcional/opt-in. reader-cleanup.json/installation-isolation.json: restauração e custódia.
- rodada1–7: tentativas rejeitadas, com motivos e nenhum dado incluído nas estatísticas finais. protocolo v1 rejeitado separado de protocol.json/v2.
- app-checks.json/app-checks.txt/typecheck.txt/lint.txt/analyzer-red.txt; api-check.json/api-check.txt: checks locais, snapshot da API anterior ao opt-in.
- fixture-build*.json/launcher-build.json: identidade dos builds; host-before.json/host-after.json e registros de memória por tentativa: preservação/limites do host. build-diagnosis.json: falha inicial sem causa estabelecida.

Todos os dados da aplicação são sintéticos. Sem APK, banco, segredo, logcat geral ou conteúdo real do usuário. Textos normalizados em UTF-8 LF, apenas espaços finais removidos dos logs. manifest.sha256 cobre os bytes finais desta pasta; source-checksums.json cobre as fontes do recorte. Não inferir aceite de dispositivo físico ou M1 a partir da validade do ensaio.
