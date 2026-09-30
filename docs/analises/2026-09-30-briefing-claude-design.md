# Briefing funcional e prompt do Claude Design — 30/09/2026

## Resultado

Entregues, por solicitação de Pedro, um [briefing autossuficiente](../design/briefing-claude-design.md) e um [prompt pronto para copiar](../design/prompt-claude-design.md). Anexar o primeiro ao Claude Design e colar o segundo; a ferramenta externa não precisa acessar o repositório.

O briefing organiza conta, onboarding, Briefing, hábitos, tarefas, Agenda, gamificação, assistente, notificações, privacidade e sincronização. Inclui erros locais/remotos, uso offline, recuperação de rejeições, leitura por incompatibilidade e acessibilidade, além de 29 jornadas para revisar o protótipo.

M1, Fase 1, expansão 2A e hipóteses 2B/3 ficam identificados. Propostas visuais e textos sugeridos não substituem decisões de produto. O material não implementa interfaces ou integrações, nem comprova desempenho/permissões/sync do protótipo.

## Fontes e revisão

Confrontado com PRD, CONTEXT, specs 01–13/98, entrevista e ADRs 015–018. Formatos/limites do M1 conferidos nos contratos executáveis. Índice de fontes dentro do briefing.

Pendências explicitadas: Q28, nome, STT, ação rápida no iOS, seleção padrão de calendários, orçamento de notificações, estabilidade de notícias, conflitos de temas prioritários, catálogo do assistente, política de XP parcial, contratos temporais/operacionais e módulos futuros. Nenhuma foi fechada por esta entrega.

A [tarefa 03](../../.scratch/primeiro-marco/issues/03-integrar-prototipo.md) recebeu links para os artefatos e continua `ready-for-human`, não concluída. O spec visual permanece ABERTO; é necessário revisar o protótipo de Pedro e incorporar suas escolhas antes de implementar a apresentação do Briefing.

## Verificação

- Links locais e estrutura Markdown conferidos; 22 seções no briefing, jornadas D01–D29 presentes uma vez e em ordem, texto UTF-8 sem caracteres de substituição.
- App: `pnpm typecheck`, `pnpm lint` e `pnpm test` passaram; 69 testes, zero falhas.
- API: `gradlew check --no-daemon`, Java 21, passou. Relatórios XML: 34 testes, 0 falhas, 0 erros, 1 ignorado. Harness nativo Android opt-in não repetido nesta entrega de documentação; evidência anterior em [HTTP nativo](2026-09-30-http-nativo-android.md).
- Revisão de fidelidade funcional e distinção entre requisito/proposta; sem mudança em código, schemas, contratos ou dependências.

## Próximo resultado esperado

Pedro leva os dois arquivos ao Claude Design. O protótipo resultante deve trazer navegação, estados críticos, componentes/tokens propostos e cobertura das 29 jornadas. Depois da revisão visual, incorporar decisões em spec/11 e prosseguir com o recorte de UI aprovado.
