# 01 — Provar portabilidade e persistência web

Status: ready-for-agent
Blocked by: none

Origem: spec/14 §5 e plano PWA §2–4. Ensaio finito, sem produto publicado ou contas reais.

## Entrega

Prova isolada nas versões fixadas: renderizar componentes/tokens Ritmo-App representativos em Expo Web/RNW e registrar incompatibilidades. Fixtures sintéticas e bootstrap separado dos harnesses nativos; nenhum mock permanente substitui o produto.

Investigar SQLite web com migrations existentes, transação intenção+projeção, reload/fechamento, falha/quota simulada e duas abas. Conferir WASM/worker/headers e trabalho na UI. Não remover PRAGMA/garantia ou usar memória/fallback silencioso para declarar sucesso. Impedimento: documentar reprodução e alternativa; não implementar dois bancos de produto.

## Aceite delimitado

- Reprodução/exportação finitas e relatório com versões, browser, headers, recursos, falhas e dados sintéticos. Serviços persistentes seguem regras do projeto.
- Conferir conteúdo/outbox após reabertura e rollback sem sucesso falso; logs sem credenciais reais.
- Separar desktop de Safari físico. Preparar roteiro iPhone com origem HTTPS e versão iOS; indisponibilidade fica como gate da tarefa02.
- Entrega é relatório local, inclusive para impedimento reproduzível; não aprova motor no iPhone/M1.

## Resultado

Concluída: não — não iniciado.
