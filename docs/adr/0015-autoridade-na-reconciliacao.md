---
status: accepted
date: 2026-09-24
---

# ADR-015 — Resposta local e reconciliação dos fatos pelo servidor

O app mantém a experiência local-first do ADR-002: ações respondem imediatamente a partir do armazenamento local, inclusive offline. Ao sincronizar, o servidor valida e reconcilia os fatos; os aparelhos incorporam o resultado canônico e recalculam suas projeções de progresso a partir dele. Pedro aceitou essa divisão de autoridade na resposta R1-Q3 da entrevista da fundação.

Por exemplo, se dois aparelhos marcarem o mesmo hábito no mesmo dia, a convergência deve produzir um cumprimento e uma concessão de XP, ainda que os identificadores locais tenham sido diferentes. A alternativa de cada aparelho permanecer como autoridade independente não garante esse resultado.

Em R2-Q8, Pedro aceitou distinguir falha transitória, duplicação e rejeição definitiva. Falha de rede mantém a pendência com possibilidade de retry; duplicação reconciliada permanece silenciosa; rejeição definitiva preserva conteúdo recuperável e apresenta aviso discreto com motivo e opção de corrigir ou descartar. Uma alteração recusada não pode aparecer como sincronizada nem ficar em retry automático indefinido.

O [ADR-017](0017-reconciliacao-de-registros-e-correcoes.md), aceito em 25/09/2026, detalha a identidade lógica de cumprimentos, contribuições e concessões, além da semântica de correção. A representação física, o protocolo de confirmação e os critérios de rejeição ainda precisam de especificação. Nenhuma dessas decisões implica aceitar como canônicos totais de XP enviados pelo cliente nem copiar caches derivados entre aparelhos.

Origem: [entrevista da fundação, R1-Q3 e R2-Q8](../../.scratch/fundacao/entrevista.md). Contrato afetado: [sincronização](../../specs/06-sincronizacao.md).
