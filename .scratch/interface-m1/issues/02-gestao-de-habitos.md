# 02 — Gestão e exclusão ligadas ao Briefing

Status: ready-for-agent
Blocked by: none

## Resultado esperado

Lista/formulário com criação, edição de título/ícone/cor/ordem e exclusão confirmada. Catálogo semântico de spec/11; conferir defaults/chaves atuais antes de migrar. Nova representação exige spec/migration no mesmo incremento.

## Aceite

- Validação canônica, preview real, formulário preservado na falha; patch só dos campos alterados.
- Ícone/colorToken não dependem de índice/hexadecimal; tema não altera escolha sincronizada; renderizar não reescreve metadado desconhecido.
- Editar/reordenar offline persiste e atualiza home; conflitos conservam regra de campos independentes.
- Confirmação informa perda de hábito/histórico, XP revertido e orçamento não devolvido. Cancelar não altera; falha não finge exclusão.
- Exclusão offline/reinício/tombstone não ressuscita hábito/XP; recusa mantém recuperação existente.
- Vazio/somente leitura, controles de ordem acessíveis; arquivar e novos tipos/agendas/metas fora.

## Referências

REQ-HAB-001/003/007; REQ-GAM-002a/003; Q30/Q31; spec/13 §3/M1-13; spec/11.

## Resultado

Concluída: sim, no escopo local deste recorte. Edição/ordem/exclusão ligadas ao Briefing, persistência offline/reinício e convergência HTTP/Android verificadas. [Relatório](../../../docs/analises/2026-10-09-interface-gestao-de-habitos.md). O aceite integral nos aparelhos permanece separado.

## Comments

09/10/2026: criado após incorporar o protótipo; execução/aceite nativo pendentes.

09/10/2026: entregue lista completa de hábitos ativos (inclusive antes do início), patches somente dos campos alterados, validação Unicode canônica, ordenação atômica local e confirmação da exclusão com Q30. App 156 testes, API check e ensaio Android visível aprovados. Próximo recomendado: recorte 03; arquivamento/tipos/agendas não foram antecipados.
