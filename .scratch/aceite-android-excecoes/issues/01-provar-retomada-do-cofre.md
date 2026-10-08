# 01 — Provar retomada do cofre no Android

Status: ready-for-agent
Blocked by: none

Origem: [plano](../spec.md). Contratos: Q52=A, REQ-CTA-004/004c e REQ-SYN-008. Comportamento já aprovado; amplia evidência nativa.

## Critérios de aceite

Falha de leitura no reinício conserva sessão/intenções; novas escritas locais continuam e acesso remoto pausa. Retry ainda falhando preserva referências; retry saudável retoma automaticamente. Outro cliente confirma ausência de envio durante a pausa; replay/refresh/reabertura conservam 20 XP.

Usar SQLite/SecureStore e API reais, com falhas controladas apenas em fronteiras externas. Checks integrais e relatório com APK/build, fases, resultado e limites; preservar bancos anteriores e restaurar recursos do teste.

## Resultado

Concluída: sim — critérios técnicos deste item aprovados em ensaio direcionado e no check integral, com app typecheck/lint/121 testes, API 87 Java/zero ignorados e 13 operacionais. [Relatório e limites](../../../docs/analises/2026-10-08-excecoes-e-isolamento-android.md).

## Comments

08/10/2026 — Pedro autorizou executar os quatro itens. Falhas controladas e prova nativa delimitadas no plano; UI, iPhone e infraestrutura externa continuam pendentes.


08/10/2026 — APK reconstruído/instalado sem apagar dados anteriores; force-stop e comparação com cliente SQLite/HTTP usados nas fases deste item. Rádios/reverse restaurados; emulador e painel próprios encerrados. UI, iPhone, links reais e operação externa mantêm M1 aberto.
