# 03 — Incorporar o protótipo ao contrato visual

Status: ready-for-agent
Blocked by: none

## Dependência externa

Dependência atendida em 09/10/2026: Pedro entregou o pacote Claude Design para orientar a implementação. Spec/11 consolida a direção. Esta tarefa acompanha também a integração/validação visual; não fica concluída só pela revisão do artefato.

## Resultado esperado

Quando o protótipo estiver disponível, incorporá-lo a [spec/11](../../../specs/11-design-system.md), identificando tokens, componentes, temas e estados necessários ao onboarding e Briefing mínimo. O agente pode fazer a documentação e implementação decorrentes após a definição visual, sem inventar decisões ausentes.

## Aceite

- Referência do protótipo e direção visual registradas; valores provisórios claramente substituídos ou ratificados.
- Cobertura dos estados sem hábito, offline, pendência/rejeição, carregamento, erro e texto ampliado.
- Critérios de acessibilidade verificáveis nos dois clientes; nenhum gate visual fechado só porque o domínio passou nos testes.

## Resultado

Concluída: não.

## Comments

25/09/2026: depende de artefato externo do Pedro, não de uma tarefa técnica anterior. Não bloqueia as tarefas 01 e 02.

30/09/2026: preparados o [briefing funcional para o Claude Design](../../../docs/design/briefing-claude-design.md) e o [prompt de uso](../../../docs/design/prompt-claude-design.md), por solicitação de Pedro. Cobrem M1, Fase 1, expansão 2A, erros/offline e 29 jornadas de revisão. O material orienta a criação do protótipo; não fecha Q28 nem conclui esta tarefa.

09/10/2026: [revisão](../../../docs/analises/2026-10-09-revisao-do-prototipo.md), tokens/catálogos, matriz e [seis recortes](../../interface-m1/spec.md) registrados. Spec/11 fechado para direção, PRD Q5 atualizado. Primeira jornada pronta para execução; custódia de preferência/áudio pendente no recorte 06. Concluída: não — integração visual e acessibilidade nos clientes reais ainda necessárias.

09/10/2026: primeiro incremento visual implementado: conta → onboarding → primeiro hábito/Briefing, com dados reais, offline, reinício e sincronização. [Verificação](../../../docs/analises/2026-10-09-interface-primeira-jornada.md) inclui jornada Android visível, fontes/licenças, texto 200% e alvos nativos. Tarefa permanece aberta: recortes 02–06, matriz integral de acessibilidade e iPhone ainda necessários.

09/10/2026: gestão de hábitos (recorte 02) implementada e verificada offline, com reinícios e API real no Android visível. [Relatório](../../../docs/analises/2026-10-09-interface-gestao-de-habitos.md), confirmações de exclusão/Q30 e alvos de toque a 100%/200%. Permanecem recortes 03–06, acessibilidade integral e iPhone; esta tarefa continua aberta.

10/10/2026: [fidelidade visual das telas existentes](../../../docs/analises/2026-10-10-fidelidade-visual-m1.md) refinada e aprovada por três críticos em cada grupo; Android visível final,156 testes, contraste e alvos verificados. Concluídos recortes01/02 no escopo local. Tarefa permanece aberta para03–06, matriz integral, iPhone e aceites externos; não houve aceite automático do marco pelo protótipo.
