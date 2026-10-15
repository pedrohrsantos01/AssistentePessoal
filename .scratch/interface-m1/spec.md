# Interface nativa do primeiro marco — plano

**Correção de 11/10/2026:** Pedro escolheu `Ritmo-App.dc.html` como padrão visual. As implementações/ensaios anteriores usaram Ritmo-M1; aprovação visual anterior não vale para a fonte correta. Ver [spec/11](../../specs/11-design-system.md) e critérios/progresso em `docs/design/fidelidade-ritmo-app/`. Requisitos funcionais e recortes 05/06 permanecem como registrados. A correção das telas existentes foi verificada e aprovada no [ciclo Ritmo-App de 11/10](../../docs/analises/2026-10-11-correcao-visual-ritmo-app.md), sem concluir o M1 integral.

Estado em 10/10/2026: referência consolidada em [spec/11](../../specs/11-design-system.md); primeira jornada nativa (recorte 01) implementada e verificada no Android com API real. [Relatório](../../docs/analises/2026-10-09-interface-primeira-jornada.md). Gestão nativa (recorte 02) também concluída localmente: [relatório](../../docs/analises/2026-10-09-interface-gestao-de-habitos.md). [Fidelidade das telas atuais](../../docs/analises/2026-10-10-fidelidade-visual-m1.md) refinada e aprovada em 10/10/2026, com ensaio Android visível. [Sessão/cofre/abertura — recorte 03](../../docs/analises/2026-10-10-interface-sessao-e-recuperacao-local.md) concluído localmente. [Sync/identidade/compatibilidade — recorte 04](../../docs/analises/2026-10-10-interface-resultados-de-sincronizacao.md) concluído localmente. Recorte 05 concluído localmente em 12/10/2026; recorte 06 e aceite externo permanecem abertos. Decomposição da [tarefa visual 03](../primeiro-marco/issues/03-integrar-prototipo.md), sem segundo marco ou aceite por revisão de HTML.

## Resultado esperado

Conta, onboarding retomável, hábito binário diário, Briefing/XP e gestão sobre SQLite/sessão/sync reais, com visual entregue e estados Q51–Q53. Android visível durante ensaios e encerrado após; iPhone continua obrigatório, com rota adiada em Q55=B.

Contratos: [PRD](../../PRD.md), [spec/13](../../specs/13-contrato-primeiro-marco.md), [spec/11](../../specs/11-design-system.md), [matriz da interface](../../docs/design/implementacao-interface-m1.md). O JSON extraído não é runtime/regra de negócio.

## Recortes verticais

1. [Conta → onboarding → primeiro hábito/Briefing](issues/01-conta-onboarding-briefing.md), com fontes/tokens/primitives que a jornada utiliza. Concluído localmente: primeiro valor real, marcar/desfazer offline, reabrir e sincronizar no Android.
2. [Gestão e exclusão](issues/02-gestao-de-habitos.md), ligada à mesma home/fila. Concluído localmente: editar/reordenar/excluir offline, reabrir e convergir no Android; início futuro permanece gerenciável sem cumprimento antecipado.
3. [Sessão, cofre e abertura](issues/03-sessao-e-recuperacao-local.md), com isolamento pela navegação. Concluído localmente: falhas de cofre/abertura, logout e reentrada A/B/A pela UI Android, sem perda/duplicação.
4. [Sync, identidade e compatibilidade](issues/04-estados-de-sincronizacao.md), com ações distintas por resultado. Concluído localmente: recusa corrigida/cadeia explícita, Q53 preservado, espera/remoto e cópia inicial/compatibilidade no Android.
5. [Recuperação de senha](issues/05-recuperacao-de-senha.md), concluído localmente: solicitação/SMTP, entrada nativa e nova senha preservando pendências; domínio/associações reais aguardam aceite externo.
6. [Aparência/acessibilidade](issues/06-aparencia-e-acessibilidade.md), com contrato Q56–Q58 confirmado e preferências implementadas; desempenho e matriz integral em andamento.

Tokens não são entrega de produto isolada. Cada fatia cria somente primitives necessários e testa comportamento público, evitando biblioteca genérica ou todas as telas da Fase 1 antes do primeiro valor.

## Aceite comum

Preservar núcleo/harnesses, TS strict, i18n e tokens. App typecheck/lint/test e API check passam. Carregando/vazio/erro, controles acessíveis, texto 200%, redução de movimento, offline e proteção de conta nas jornadas. Não simular sucesso que persistência/servidor não confirmaram.

A revisão web é diagnóstico. O [aceite final existente](../aceite-m1/issues/04-aceitar-m1-nos-aparelhos.md) cobre matriz nos aparelhos e depende de integrações externas/iOS; não duplicado neste plano.

## Não escopo

Tarefas, Agenda, voz, notificações, níveis/ofensivas/conquistas e 2A seguem seus incrementos. “DECIDIDO” no handoff não muda domínio. Reparo/reconstrução de banco, descarte de identidade incerta e contratação/publicação externa não fazem parte desta entrega.

## Resultado

Concluída: não. Incorporação documental e recortes 01/02/03/04/05 concluídos localmente; seleção/persistência de preferências (06) implementada e testada, com acabamento/medidas e matriz integral nos aparelhos ainda pendentes.

Entrega local 05: [recuperação de senha,12/10](../../docs/analises/2026-10-12-interface-recuperacao-de-senha.md). Entrega funcional06: [aparência e preferências](../../docs/analises/2026-10-12-interface-aparencia-e-preferencias.md). [Roteiro básico TalkBack e continuidade do foco](../../docs/analises/2026-10-12-talkback-e-continuidade-do-briefing.md) verificados no APK corrigido, incluindo repetição após cold boot. A coleta ampliada de13/10 passou18 fases funcionais, mantendo aprovação integral falsa no modo de observação. Q60=A foi confirmada e implementada em14/10, com218 testes locais e API check aprovados; [relatório](../../docs/analises/2026-10-14-foco-protegido-dos-dialogos.md). A [validação nativa de15/10](../../docs/analises/2026-10-15-talkback-foco-dos-dialogos.md) corrigiu o evento Android e aprovou18 fases/cinco diálogos no APK final. Restam cobertura integral do leitor, demais estados/retornos e medidas de abertura/cards/feedback com instrumentação do produto.

13/10/2026: [matriz ampliada TalkBack](../../docs/analises/2026-10-13-talkback-formularios-dialogos-e-erros.md) completou18 fases funcionais a200%, com35 medições de controles/9 de campo-IME e conferência independente na API; modo de observação mantém aprovação integral falsa. Q60 aguarda definição do destino de foco dos diálogos; não aceitar a proposta por silêncio. Desempenho, cobertura integral de estados/leitura e iPhone continuam abertos.


15/10/2026, revisões de sincronização: [matriz ampliada](../../docs/analises/2026-10-15-talkback-revisoes-de-sincronizacao.md) aprovada a200% no APK7430a6f8:24 fases/nove registros de foco,75 controles/13 campos-IME. Corrigida a revelação do acionador fora do viewport; cancelamento aninhado, correção com dependente, fallback no título, diagnóstico incerto e persistência após reinício verificados. Cliente independente confirma10 XP e trabalho independente; configurações restauradas e recursos próprios fechados. App:225 testes/tipos/lint; API check:85 executados/oito nativos opt-in ignorados,13 verificações operacionais e modularidade aprovados. Recuperação de senha/preempção, demais estados, travessia entre janelas, edição falada, desempenho, novas paletas e iPhone mantêm06/M1 abertos.


15/10/2026, leitor na recuperação: [roteiro aprovado](../../docs/analises/2026-10-15-talkback-recuperacao-de-senha.md) no mesmo APK7430a6f8, sem alteração do produto ou de app/harness:12 fases a200%, duas interrupções de diálogo,44 medições de controle/14 campos-IME. SMTP/API locais, entrada quente/fria, senha inválida/offline, usado/expirado/origem inválida, resposta uniforme, reautenticação e preservação de hábito/10 XP com isolamento entre contas verificados. Configurações restauradas e recursos próprios fechados. App:226 testes/tipos/lint aprovados; API check aprovado:85 executados/oito nativos opt-in ignorados,13 verificações operacionais e modularidade, sem falhas. Q60 não impõe título inicial a páginas. Travessia entre janelas/edição falada, demais estados, desempenho, paletas e iPhone mantêm06/M1 abertos.
