# 04 — Provar isolamento A/B/A no Android

Status: ready-for-agent
Blocked by: none

Origem: [plano](../spec.md). Contratos: M1-10, REQ-CTA-004b/004c e REQ-SYN-008. Comportamento já aprovado; amplia evidência nativa.

## Critérios de aceite

Logout offline bloqueia conta/referência e login offline é recusado. B entra online sem dados/pendências de A e sincroniza somente seus dados. A reentra online e recupera envelopes exatos; referência antiga de B bloqueada. Refresh, force-stop e replay preservam 10 XP por conta.

Usar SQLite/SecureStore e API reais, com falhas controladas apenas em fronteiras externas. Checks integrais e relatório com APK/build, fases, resultado e limites; preservar bancos anteriores e restaurar recursos do teste.

## Resultado

Concluída: sim — critérios técnicos deste item aprovados em ensaio direcionado e no check integral, com app typecheck/lint/121 testes, API 87 Java/zero ignorados e 13 operacionais. [Relatório e limites](../../../docs/analises/2026-10-08-excecoes-e-isolamento-android.md).

## Comments

08/10/2026 — Pedro autorizou executar os quatro itens. Falhas controladas e prova nativa delimitadas no plano; UI, iPhone e infraestrutura externa continuam pendentes.


08/10/2026 — APK reconstruído/instalado sem apagar dados anteriores; force-stop e comparação com cliente SQLite/HTTP usados nas fases deste item. Rádios/reverse restaurados; emulador e painel próprios encerrados. UI, iPhone, links reais e operação externa mantêm M1 aberto.
