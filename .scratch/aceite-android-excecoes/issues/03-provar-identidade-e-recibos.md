# 03 — Provar identidade e recibos no Android

Status: ready-for-agent
Blocked by: none

Origem: [plano](../spec.md). Contratos: Q53=A, REQ-SYN-008/011/017. Comportamento já aprovado; amplia evidência nativa.

## Critérios de aceite

Colisões de operação e sequência preservam a intenção divergente, dependente e recibo original; impedem correção/descarte automático e permitem trabalho independente. Diagnóstico persiste após force-stop. Recibo da filha continua não processado; hash Unicode calculado em Hermes corresponde ao Node; XP continua 10.

Usar SQLite/SecureStore e API reais, com falhas controladas apenas em fronteiras externas. Checks integrais e relatório com APK/build, fases, resultado e limites; preservar bancos anteriores e restaurar recursos do teste.

## Resultado

Concluída: sim — critérios técnicos deste item aprovados em ensaio direcionado e no check integral, com app typecheck/lint/121 testes, API 87 Java/zero ignorados e 13 operacionais. [Relatório e limites](../../../docs/analises/2026-10-08-excecoes-e-isolamento-android.md).

## Comments

08/10/2026 — Pedro autorizou executar os quatro itens. Falhas controladas e prova nativa delimitadas no plano; UI, iPhone e infraestrutura externa continuam pendentes.


08/10/2026 — APK reconstruído/instalado sem apagar dados anteriores; force-stop e comparação com cliente SQLite/HTTP usados nas fases deste item. Rádios/reverse restaurados; emulador e painel próprios encerrados. UI, iPhone, links reais e operação externa mantêm M1 aberto.
