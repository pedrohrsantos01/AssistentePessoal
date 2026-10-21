# Entrega adicional — Ritmo M1 em PWA

Data: 21/10/2026. Estado: planejamento; implementação não iniciada. Fontes: [spec/14](../../specs/14-pwa-primeiro-marco.md), PRD v3.1 e [plano/alternativas](../../docs/analises/2026-10-21-plano-pwa-m1.md).

## Objetivo e fronteira

M1 no Safari e na Tela de Início do iPhone16e, preservando nativo, conta/API, Ritmo-App e domínio. Q61–Q65 aprovados: M1 funcional, dois acessos, limite de durabilidade explícito, uma aba proprietária por instalação. Pedido desta sessão: planejamento; sem publicação/contratação ou execução dos recortes.

Não duplicar tarefas de domínio, nome/domínio/Resend, aceite nativo ou operação externa. Tarefas/Agenda/voz e gamificação ampliada ficam fora deste marco.

## Sequência

| Tarefa | Resultado | Triagem |
|---|---|---|
| [01 — Portabilidade/persistência](issues/01-provar-portabilidade-e-persistencia.md) | Ensaio local sintético, relatório e gate Safari físico identificado | ready-for-agent |
| [02 — Contratos web](issues/02-fechar-contratos-do-navegador.md) | Evidência Safari, ADR/contratos da jornada funcional | needs-info |
| [03 — Jornada vertical](issues/03-entregar-jornada-vertical.md) | Login→hábito offline→reabrir→convergir com API real | needs-info |
| [04 — Completar jornada](issues/04-completar-jornada-e-excecoes.md) | Gestão, preferências, reset e sessão/recuperação | needs-info |
| [05 — Atualização/concorrência](issues/05-provar-atualizacao-e-concorrencia.md) | Abas, crash, upgrade e contêineres distintos | needs-info |
| [06 — Interface no iPhone](issues/06-validar-interface-no-iphone.md) | Ritmo-App, VoiceOver, teclado e desempenho | needs-info |
| [07 — Publicação/aceite](issues/07-preparar-publicacao-e-aceite.md) | WEB-01–10 e ambiente apto para uso real | needs-info |

Ready-for-agent indica especificação do ensaio, não execução por este pedido de planejamento. Demais recortes só ficam prontos após decisões/dependências; não declarar prontidão com sessão/banco em aberto.

## Resultado

Concluída: não — plano preparado; implementação e aceite pendentes. Pesquisa não é prova executada de compatibilidade.

## Aceite conjunto — Q65

A evidência PWA no iPhone e a do app Android poderão encerrar o M1 funcional. A [tarefa existente de aceite M1](../aceite-m1/issues/04-aceitar-m1-nos-aparelhos.md) consolida a decisão; tarefa07 desta trilha prepara a prova web. Instalação/links nativos iOS ficam na entrega posterior05 de aceite-m1. M1 continua aberto até as provas; não iniciar os 30 dias da Fase1 completa automaticamente.
