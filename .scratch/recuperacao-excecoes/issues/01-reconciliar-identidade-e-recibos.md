# 01 — Reconciliar identidade sem confirmar conteúdo divergente

Status: needs-info
Blocked by: none

## Resultado esperado

Entregar o [recorte 1 do plano](../spec.md): reconhecer somente a intenção comprovadamente correspondente, preservando envelope divergente, recibo original e dependentes. REQ-SYN-017; M1-16/18. Q53=A aprovada.

## Pré-requisito

Confirmar entendimento consolidado e fronteiras de teste. Concretizar prova de correspondência, formatos, limites e evolução compatível do protocolo antes do código. Não presumir campo/endpoint já aprovado no contrato executável.

## Escopo e critérios de aceite

- Comprovar correspondência do conteúdo em ack, pull e swap de snapshot, inclusive antes de primeiro push e depois do conflito/reinício.
- Preservar recibo original e conteúdo divergente; jamais marcá-lo como salvo por ID coincidente.
- Distinguir colisões de operação/sequência de criação definitivamente rejeitada por ID de entidade existente/excluído. A rejeição comprovada permite correção/descarte já aprovados, sem ressurreição.
- Se a origem permanecer incerta, preservar/bloquear operação e dependentes com diagnóstico; permitir independentes. Não trocar IDs, descartar ou reenviar automaticamente para esconder o impasse.
- Respeitar H do snapshot: ausência em H não prova rejeição nem autoriza recriar intenção; confirmação posterior deve manter a correspondência.
- Provar pelos módulos públicos e HTTP/SQLite/PostgreSQL reais: conteúdo divergente pelo pull/snapshot, conflito seguido do recibo original, colisão de sequência, rejeição de entidade, conflito de lote, reinício/rollback, A/B, XP e tombstones.
- Atualizar contratos/modelo e nova migration se necessária; preservar compatibilidade e V1–V5.
- Checks obrigatórios de app/API e relatório com limites aprovados.

## Resultado

Concluída: não.

## Comments

07/10/2026 — Q53=A aprovada. [Diagnóstico](../../../docs/analises/2026-10-07-recuperacao-de-excecoes.md) demonstrou a lacuna por inspeção; sem reprodução dinâmica/implementação nesta preparação. `needs-info` aguarda entendimento consolidado e fronteiras de teste.
