# 05 — Recuperação de senha na interface nativa

Status: ready-for-agent
Blocked by: 01-conta-onboarding-briefing.md; 03-sessao-e-recuperacao-local.md

## Resultado esperado

Pedido, resposta uniforme, nova senha, link inválido/expirado/usado e retorno ao login pelos serviços reais. Teste local com SMTP de ensaio/parâmetros fictícios pode avançar; domínio/associações públicas seguem tarefas existentes.

## Aceite

- Pedido não revela conta; campos/offline/429/falhas recuperáveis.
- Abrir link não consome segredo nem o registra; salvar online consome/revoga sessões conforme contrato.
- Inválido/usado/expirado permite pedir outro; confirmação não autentica nem apaga pendências.
- Foco/teclado/mostrar senha/texto 200%, rótulos e alvo mínimo validados.
- SMTP/API locais e entrada Android verificados. Universal/App Links reais condicionados a Q54/domínio e Q55=B/iOS; clique simulado não é prova.

## Referências

REQ-CTA-003/spec/01; tarefas 02/03 de .scratch/aceite-m1. Não duplicar a configuração externa.

## Resultado

Concluída: não.

## Comments

09/10/2026: criado após incorporar o protótipo; execução/aceite nativo pendentes.
