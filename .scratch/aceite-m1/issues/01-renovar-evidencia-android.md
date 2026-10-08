# 01 — Renovar evidência técnica Android com as fontes atuais

Status: ready-for-agent
Blocked by: none

Origem: [plano](../spec.md), [tarefa 05](../../primeiro-marco/issues/05-completar-sessao-e-recuperacao.md), M1-02/03/07 e REQ-SYN-005/008. Reexecução da fronteira nativa já autorizada; nenhum comportamento novo.

## Critérios de aceite

- Reconstruir harness HTTP isolado a partir do checkout atual; validar package antes de instalar com `-r`, sem apagar bancos anteriores.
- Exercitar SQLite/SecureStore/fetch/AppState/rede reais: registro offline, force-stop/reabertura, pausa em segundo plano, sync automático, replay, refresh e convergência com cliente auxiliar sem duplicar XP.
- Rodar typecheck/lint/test do app e `api check bootJar` integral com caso nativo habilitado. Registrar hash do APK e contagens reais.
- Restaurar rádios/encaminhamento; encerrar apenas o emulador iniciado para esta prova.
- Identificar limites: segundo cliente desktop, sem iPhone, interface de produto, links HTTPS nativos ou injeção nativa das exceções Q51–Q53.

## Resultado

Concluída: sim — cenário Android existente aprovado com fontes atuais e checks integrais; M1 permanece aberto.

## Comments

08/10/2026 — Evidência anterior de 30/09; APK anterior não incluía incrementos posteriores. Renovação iniciada em Pixel_9/API 35 com `scripts/verify-android-http.ps1 -Serial emulator-5560`, serviços locais descartáveis e pacote `dev.ritmo.httpharness`. [Relatório](../../../docs/analises/2026-10-08-plano-de-aceite-m1.md).

08/10/2026 — Concluído: APK das fontes c5e7b51, hash registrado no relatório, app 121/typecheck/lint aprovados; check integral final reexecutado com 86 Java/zero ignorados e 13 operações aprovados. Android passou nas duas rodadas; primeiro check teve timeout WAL, caso isolado e repetição completa passaram sem mudanças de código/limites. Rádios 1/1 e reverse restaurados; emulador próprio encerrado. [Evidências e limites](../../../docs/analises/2026-10-08-plano-de-aceite-m1.md).
