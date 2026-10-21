# Entrega adicional — Ritmo M1 em PWA

Data: 21/10/2026. Estado: prova01 concluída localmente; contratos02 em entrevista (Q67–Q69 aprovadas). Fontes: [spec/14](../../specs/14-pwa-primeiro-marco.md), PRD v3.1 e [plano/alternativas](../../docs/analises/2026-10-21-plano-pwa-m1.md).

## Objetivo e fronteira

M1 no Safari e na Tela de Início do iPhone16e, preservando nativo, conta/API, Ritmo-App e domínio. Q61–Q65 aprovados: M1 funcional, dois acessos, limite de durabilidade explícito, uma aba proprietária por instalação. Planejamento e prova01 local autorizados; sem publicação/contratação ou aceite funcional.

Não duplicar tarefas de domínio, nome/domínio/Resend, aceite nativo ou operação externa. Tarefas/Agenda/voz e gamificação ampliada ficam fora deste marco.

## Sequência

| Tarefa | Resultado | Triagem |
|---|---|---|
| [01 — Portabilidade/persistência](issues/01-provar-portabilidade-e-persistencia.md) | Ensaio React/Vite/Dexie/Workbox no Chrome; Safari continua gate02 | done |
| [02 — Contratos web](issues/02-fechar-contratos-do-navegador.md) | Evidência Safari, ADR/contratos da jornada funcional | needs-info |
| [03 — Jornada vertical](issues/03-entregar-jornada-vertical.md) | Login→hábito offline→reabrir→convergir com API real | needs-info |
| [04 — Completar jornada](issues/04-completar-jornada-e-excecoes.md) | Gestão, preferências, reset e sessão/recuperação | needs-info |
| [05 — Atualização/concorrência](issues/05-provar-atualizacao-e-concorrencia.md) | Abas, crash, upgrade e contêineres distintos | needs-info |
| [06 — Interface no iPhone](issues/06-validar-interface-no-iphone.md) | Ritmo-App, VoiceOver, teclado e desempenho | needs-info |
| [07 — Publicação/aceite](issues/07-preparar-publicacao-e-aceite.md) | WEB-01–10 e ambiente apto para uso real | needs-info |

Expo Web foi descartado e Pedro escolheu a opção1 do [comparativo](../../docs/analises/2026-10-21-alternativas-pwa-sem-expo.md). A [ADR-020](../../docs/adr/0020-pwa-com-frontend-web-proprio.md) libera a definição da prova01 em React DOM/TypeScript/Vite/React Router, IndexedDB/Dexie e Workbox. Os recortes só ficam prontos após suas decisões/dependências; não declarar prontidão com sessão/banco em aberto.

## Resultado

Concluída: não — prova01 local entregue; jornada funcional, contratos e aceite físico pendentes. [Resultado da prova](../../docs/analises/2026-10-21-prova-tecnica-pwa.md). Pesquisa não é prova executada de compatibilidade.

## Aceite conjunto — Q65

A evidência PWA no iPhone e a do app Android poderão encerrar o M1 funcional. A [tarefa existente de aceite M1](../aceite-m1/issues/04-aceitar-m1-nos-aparelhos.md) consolida a decisão; tarefa07 desta trilha prepara a prova web. Instalação/links nativos iOS ficam na entrega posterior05 de aceite-m1. M1 continua aberto até as provas; não iniciar os 30 dias da Fase1 completa automaticamente.

21/10/2026 — Revisão após Q65: Expo Web excluído da PWA; app nativo preservado. Comparação de React DOM/Vite, Next.js e SvelteKit preparada. Q61–Q65 continuam aprovadas; stack e prova01 aguardam escolha.

21/10/2026 — Escolha confirmada por Pedro: opção1. Tarefa01 voltou a ready-for-agent; demais contratos/gates continuam pendentes. Nenhuma implementação ou aceite foi concluído nesta consolidação.

21/10/2026 — Prova01 concluída no escopo local: build, reabertura offline, rollback e transferência entre abas no Chrome visível; migração determinística. Próximo: contratos02. Não promover o ensaio sintético a schema/sessão de produto nem a aceite do iPhone.

21/10/2026 — [Rodada1 de contratos](../../docs/analises/2026-10-21-contratos-pwa-rodada-1.md) preparada após apuração do código e fontes oficiais. [Entrevista](entrevista.md) registra Q66=iOS26.6.2 e perguntas Q67–Q69 pendentes. Task02 continua needs-info; task03 não está liberada.

21/10/2026 — Q67–Q69=A consolidadas no [ADR-021](../../docs/adr/0021-fronteira-de-sessao-e-armazenamento-web.md). [Rodada2](../../docs/analises/2026-10-21-contratos-pwa-rodada-2.md) e Q70–Q72 abertas; task02 continua needs-info, task03 bloqueada.
