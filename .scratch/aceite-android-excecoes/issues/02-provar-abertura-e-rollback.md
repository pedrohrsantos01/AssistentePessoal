# 02 — Provar abertura e rollback no Android

Status: ready-for-agent
Blocked by: none

Origem: [plano](../spec.md). Contratos: Q51=A, REQ-SYN-008/013. Comportamento já aprovado; amplia evidência nativa.

## Critérios de aceite

Falhas open/PRAGMA da conta e open da instalação bloqueiam o acesso correto e fecham handles. Instalação bloqueada não abre conta nem lê o cofre. Migration de ensaio roda no migrator Expo/Drizzle real e falha após escrita; rollback/retry preservam os envelopes. Convergência/replay conservam 10 XP.

Usar SQLite/SecureStore e API reais, com falhas controladas apenas em fronteiras externas. Checks integrais e relatório com APK/build, fases, resultado e limites; preservar bancos anteriores e restaurar recursos do teste.

## Resultado

Concluída: sim — critérios técnicos deste item aprovados em ensaio direcionado e no check integral, com app typecheck/lint/121 testes, API 87 Java/zero ignorados e 13 operacionais. [Relatório e limites](../../../docs/analises/2026-10-08-excecoes-e-isolamento-android.md).

## Comments

08/10/2026 — Pedro autorizou executar os quatro itens. Falhas controladas e prova nativa delimitadas no plano; UI, iPhone e infraestrutura externa continuam pendentes.


08/10/2026 — APK reconstruído/instalado sem apagar dados anteriores; force-stop e comparação com cliente SQLite/HTTP usados nas fases deste item. Rádios/reverse restaurados; emulador e painel próprios encerrados. UI, iPhone, links reais e operação externa mantêm M1 aberto.
