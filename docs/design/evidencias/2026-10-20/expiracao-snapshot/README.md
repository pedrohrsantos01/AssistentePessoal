# Expiração de snapshot: relógio da fixture

Resultado final: regressão corrigida em `expiry-regression-green.txt`/`targeted-green.json`; check completo aprovado em `api-check-passed.txt`, com totais/hashes em `api-check-passed.json`.

`api-check.txt`, `api-run.json` e `junit-summary.json`: check original, 93 casos/uma falha/oito ignorados. `expiry-repro-1.txt`: mesmo erro 410 esperado/200 recebido no cenário isolado. `expiry-probe.txt` e `clock-probe.json`: sondagem estreita sem identidade/credenciais, uma linha atingida e relógios correntes alinhados. `expiry-regression-red.txt`: diferença deliberada de uma hora entre API e banco, reproduzindo o mesmo erro no SQL antigo.

O teste real usa API HTTP/PostgreSQL e prova tanto página quanto classificação de recibos; o Clock da API é congelado no início do teste. A correção vincula a expiração a esse Clock. Não altera SQL de produção, regra de 900 segundos, limiar HTTP, espera ou escopo de usuário. Sondagens temporárias removidas. As execuções anteriores permanecem separadas; nenhum dado da coleta Android foi descartado para obter aprovação.

Repetir: Java21 configurado, `./api/gradlew.bat -p api test --tests dev.ritmo.RuntimeTests.expiredSnapshotsRefuseBothPagesAndReceiptClassification --no-daemon --max-workers=2 --console=plain`. Check completo: mesmo wrapper com `check`, sem filtro. Não há emulador nesta prova.
