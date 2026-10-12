# 05 — Recuperação de senha na interface nativa

Status: done
Blocked by: none

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

Concluída localmente: sim. Associações públicas/domínio e iOS continuam no aceite externo existente.

## Comments

09/10/2026: criado após incorporar o protótipo; execução/aceite nativo pendentes.

10/10/2026: sessão (03) e resultados de sync (04) concluídos localmente. Dependência removida; próximo recorte recomendado. O ensaio SMTP/API/Android local pode avançar enquanto domínio e associações públicas permanecem no aceite externo.

12/10/2026: implementação concluída e verificada no [relatório](../../../docs/analises/2026-10-12-interface-recuperacao-de-senha.md): 192 testes app,85 Java/13 operacionais,SMTP/API e Android visível com entrada quente/fria, teclado200%,reentrada/sync e links inválido/usado/expirado. Sem aceite de domínio/iOS ou M1 integral.
