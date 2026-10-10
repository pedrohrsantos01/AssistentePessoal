# Interface nativa do primeiro marco — plano

Estado em 10/10/2026: referência consolidada em [spec/11](../../specs/11-design-system.md); primeira jornada nativa (recorte 01) implementada e verificada no Android com API real. [Relatório](../../docs/analises/2026-10-09-interface-primeira-jornada.md). Gestão nativa (recorte 02) também concluída localmente: [relatório](../../docs/analises/2026-10-09-interface-gestao-de-habitos.md). [Fidelidade das telas atuais](../../docs/analises/2026-10-10-fidelidade-visual-m1.md) refinada e aprovada em 10/10/2026, com ensaio Android visível. [Sessão/cofre/abertura — recorte 03](../../docs/analises/2026-10-10-interface-sessao-e-recuperacao-local.md) concluído localmente. [Sync/identidade/compatibilidade — recorte 04](../../docs/analises/2026-10-10-interface-resultados-de-sincronizacao.md) concluído localmente. Recortes 05/06 permanecem abertos. Decomposição da [tarefa visual 03](../primeiro-marco/issues/03-integrar-prototipo.md), sem segundo marco ou aceite por revisão de HTML.

## Resultado esperado

Conta, onboarding retomável, hábito binário diário, Briefing/XP e gestão sobre SQLite/sessão/sync reais, com visual entregue e estados Q51–Q53. Android visível durante ensaios e encerrado após; iPhone continua obrigatório, com rota adiada em Q55=B.

Contratos: [PRD](../../PRD.md), [spec/13](../../specs/13-contrato-primeiro-marco.md), [spec/11](../../specs/11-design-system.md), [matriz da interface](../../docs/design/implementacao-interface-m1.md). O JSON extraído não é runtime/regra de negócio.

## Recortes verticais

1. [Conta → onboarding → primeiro hábito/Briefing](issues/01-conta-onboarding-briefing.md), com fontes/tokens/primitives que a jornada utiliza. Concluído localmente: primeiro valor real, marcar/desfazer offline, reabrir e sincronizar no Android.
2. [Gestão e exclusão](issues/02-gestao-de-habitos.md), ligada à mesma home/fila. Concluído localmente: editar/reordenar/excluir offline, reabrir e convergir no Android; início futuro permanece gerenciável sem cumprimento antecipado.
3. [Sessão, cofre e abertura](issues/03-sessao-e-recuperacao-local.md), com isolamento pela navegação. Concluído localmente: falhas de cofre/abertura, logout e reentrada A/B/A pela UI Android, sem perda/duplicação.
4. [Sync, identidade e compatibilidade](issues/04-estados-de-sincronizacao.md), com ações distintas por resultado. Concluído localmente: recusa corrigida/cadeia explícita, Q53 preservado, espera/remoto e cópia inicial/compatibilidade no Android.
5. [Recuperação de senha](issues/05-recuperacao-de-senha.md), próximo recomendado; teste local enquanto domínio/associações reais aguardam execução externa.
6. [Aparência/acessibilidade](issues/06-aparencia-e-acessibilidade.md), especificando a custódia das preferências antes de persistir.

Tokens não são entrega de produto isolada. Cada fatia cria somente primitives necessários e testa comportamento público, evitando biblioteca genérica ou todas as telas da Fase 1 antes do primeiro valor.

## Aceite comum

Preservar núcleo/harnesses, TS strict, i18n e tokens. App typecheck/lint/test e API check passam. Carregando/vazio/erro, controles acessíveis, texto 200%, redução de movimento, offline e proteção de conta nas jornadas. Não simular sucesso que persistência/servidor não confirmaram.

A revisão web é diagnóstico. O [aceite final existente](../aceite-m1/issues/04-aceitar-m1-nos-aparelhos.md) cobre matriz nos aparelhos e depende de integrações externas/iOS; não duplicado neste plano.

## Não escopo

Tarefas, Agenda, voz, notificações, níveis/ofensivas/conquistas e 2A seguem seus incrementos. “DECIDIDO” no handoff não muda domínio. Reparo/reconstrução de banco, descarte de identidade incerta e contratação/publicação externa não fazem parte desta entrega.

## Resultado

Concluída: não. Incorporação documental e recortes 01/02/03/04 concluídos localmente; recuperação de senha e preferências (05/06), além da matriz integral nos aparelhos, permanecem pendentes.
