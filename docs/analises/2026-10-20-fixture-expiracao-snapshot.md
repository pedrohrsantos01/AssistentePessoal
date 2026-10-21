# Fixture de expiração do snapshot — 20/10/2026

O primeiro check completo do recorte de medição leve falhou em `RuntimeTests.expiredSnapshotsRefuseBothPagesAndReceiptClassification`: esperava 410 e recebeu 200. Foram 93 casos, uma falha/oito opt-in ignorados. A causa ficou na preparação do teste, sem alteração da API de produção. [Evidências preservadas](../design/evidencias/2026-10-20/expiracao-snapshot/README.md).

## Diagnóstico e regressão

A API calcula a validade pelo Clock injetado; esta suíte usa MutableClock congelado no BeforeEach. A fixture atualizava `expires_at` para `now() - 1 second` do PostgreSQL. Quando a preparação do teste demora, esse instante pode continuar no futuro em relação ao relógio congelado. O endpoint então retorna 200 corretamente para o instante que recebeu.

O teste isolado repetiu a falha em 38 s. A sondagem restrita confirmou uma linha atualizada, expiração 1004 ms antes do relógio corrente Java e relógio do banco apenas 1 ms atrás dele. Isso descartou ausência da linha e não sustentou deriva entre os relógios correntes. Uma regressão colocou deliberadamente a API uma hora atrás do banco: o SQL antigo voltou a produzir 200 no lugar de 410, sem depender da duração da preparação.

A fixture agora grava `RESET_CLOCK.instant().minusSeconds(1)` por parâmetro e exige exatamente uma linha atualizada. A diferença deliberada dos relógios permanece no teste. Ele continua exigindo 410/snapshot_expired tanto para página quanto recibos e um novo ID ao reiniciar o snapshot. Sem espera, tolerância nova, aumento de margem temporal ou mudança de contrato, transação, filtros por usuário ou código de produção. Sondagens temporárias removidas.

## Validação

A regressão com relógios separados passou por HTTP/PostgreSQL, exigindo 410 nas duas rotas e novo manifesto. Check completo da API aprovado em 15 min 54 s: 14 suítes, 93 casos/85 executados/oito opt-in ignorados, zero falhas/erros e modularidade aprovada. [Resumo e hashes](../design/evidencias/2026-10-20/expiracao-snapshot/api-check-passed.json). O check anterior e os cenários vermelhos permanecem nas evidências. A correção não exige recompilar o APK: nenhum arquivo de produto mudou.

A origem é spec/13 §7: snapshot expirado reinicia a cópia, preservando pendências; o contrato de expiração não foi alterado. A separação explícita dos relógios impede que esta fixture volte a depender do tempo de preparação ou da velocidade da máquina.
