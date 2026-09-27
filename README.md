# Ritmo — fundação do projeto

Assistente pessoal modular: app React Native + backend Java/Spring Modulith na VPS com Coolify. Briefing diário, agenda, hábitos, tarefas, notícias e esportes, com assistente de voz e gamificação.

**Versão 3.0, com revisão da fundação em 24–25/09/2026** — backend próprio em Spring Modulith (ADR-004), Agenda na Fase 1 (ADR-013), Notion cortado (ADR-012) e autenticação por e-mail e senha (ADR-011). O ADR-014 agora exige revisão após quatro semanas desde o início registrado da implementação, sem migração automática para BaaS.

**Etapa atual:** decisões de comportamento na [entrevista](.scratch/fundacao/entrevista.md), [contratos executáveis m1.1](contracts/primeiro-marco/README.md) e [stack/build verificados documentalmente](docs/analises/2026-09-25-stack-e-build-primeiro-marco.md). A [entrega](.scratch/primeiro-marco/spec.md) cobre conta, onboarding, hábito binário diário, Briefing com XP básico e sync iPhone 16e/Android. O [primeiro recorte executável](docs/analises/2026-09-26-primeiro-recorte-executavel.md) já tem repositório SQLite, API, migrations, testes de integração reais e build Android técnico. O [incremento de sessão](docs/analises/2026-09-26-sessao-e-isolamento.md) acrescenta refresh, revogação, SecureStore e isolamento no logout/troca de conta. O [incremento de recuperação](docs/analises/2026-09-27-recuperacao-de-senha.md) acrescenta reset por e-mail testado em SMTP local, uso único e preservação das pendências após nova autenticação. O M1 completo ainda não está pronto. Pedro está concluindo o protótipo e informou não ter Apple Developer ativo; visual e rota do build iOS permanecem pendências específicas.

## Como usar com um agente de código

0. Estrutura: `/app` (React Native) e `/api` (Spring) no mesmo repositório; `specs/` na raiz.
1. Coloque `CLAUDE.md` na **raiz do repositório** — é o arquivo que o Claude Code lê automaticamente.
2. Coloque `PRD.md`, `PLANO-DE-EXECUCAO.md` e a pasta `specs/` também na raiz.
3. Depois de fechar os contratos da fundação, abra uma sessão por tarefa da entrega aprovada. Prompt inicial sugerido:

   > Leia `CLAUDE.md`, `PRD.md`, a especificação da entrega e os specs citados na tarefa. Antes de escrever código, apresente o plano e as ambiguidades remanescentes. Use o primeiro marco aprovado do `PLANO-DE-EXECUCAO.md`; a numeração histórica das fatias não é uma sequência de execução.

4. Uma fatia por sessão. Contexto longo degrada precisão — não peça duas fatias de uma vez.

## Arquivos

| Arquivo | O que é |
|---|---|
| `PRD.md` | Visão, problema, escopo, não-escopo, métricas, fases, riscos, ADRs, glossário |
| `CLAUDE.md` | Stack, convenções, estrutura de pastas, comandos, Definition of Done |
| `PLANO-DE-EXECUCAO.md` | Primeiro marco aprovado e inventário de entregas cuja decomposição está em revisão |
| `specs/00-modelo-de-dados.md` | Invariantes e modelo em revisão; §12 mapeia o primeiro marco entre servidor e aparelho |
| `specs/01-conta-e-onboarding.md` | Auth, onboarding, exportação, exclusão |
| `specs/02-habitos.md` | Módulo Hábitos |
| `specs/03-tarefas.md` | Módulo Tarefas |
| `specs/04-gamificacao.md` | XP, nível, ofensiva, conquistas, guardrails |
| `specs/05-assistente-ia.md` | Contrato de tools, voz, custo, segurança |
| `specs/06-sincronizacao.md` | Offline-first, fila, conflito |
| `specs/07-nao-funcionais-e-lgpd.md` | Performance, segurança, LGPD, acessibilidade |
| `specs/08-briefing.md` | Tela inicial — arquitetura de cards pluggáveis |
| `specs/09-noticias.md` | Módulo Notícias (Fase 2A) |
| `specs/10-esportes.md` | Módulo Esportes (Fase 2A) |
| `specs/12-agenda.md` | Módulo Agenda — Google Calendar (Fase 1) |
| `specs/11-design-system.md` | Tokens e componentes base — **ABERTO**, aguarda o protótipo do Pedro e mantém o gate visual do Briefing |
| `specs/13-contrato-primeiro-marco.md` | Proposta de interfaces, sessão, reconciliação, XP, push/pull, recuperação e cenários verificáveis |
| `contracts/primeiro-marco/` | OpenAPI, schemas, exemplos, fixtures, DDL de referência e verificação reproduzível |
| `specs/98-fase-3-notas.md` | Módulos adiados — **não implementar** |

## Convenção de IDs

`REQ-<MÓDULO>-<NNN>`: `CTA` conta, `HAB` hábitos, `TAR` tarefas, `GAM` gamificação, `IA` assistente, `SYN` sync, `NFR` não funcional, `BRF` briefing, `NOT` notícias, `ESP` esportes, `DS` design system, `AGD` agenda. Cite os IDs reais envolvidos em cada mudança de produto. Para documentação ou infraestrutura sem requisito de produto, cite a tarefa/documento de origem com `Refs:` no corpo. [Convenções de Git e commits](docs/agents/git.md).

## Pendências que travam decisões

Q1 nome, Q2 provedor de STT, Q4 sobreposição hábito/tarefa, **Q5 direção visual**, Q6 spike da ação rápida de notificação, Q7 times acompanhados e Q8 calendários selecionados estão no `PRD.md` §10. A Q3 do PRD (proteção de ofensivas) foi aprovada em R5-Q22, com contrato em REQ-GAM-011. A Q9 acompanha a data de início da implementação e a revisão de quatro semanas; sua política já foi aprovada. Essa numeração histórica é distinta das rodadas da entrevista da fundação.

## Executar a fundação

Consulte [app/README](app/README.md), [api/README](api/README.md) e o [relatório de evidências](docs/analises/2026-09-26-primeiro-recorte-executavel.md). No Windows com Java 21, Node 24 e Docker: `scripts/verify-foundation.ps1`. A revisão de quatro semanas está registrada para 23/10/2026.

## Memória entre sessões

O projeto está vinculado ao ai-memory em `default / ProjetoAssistentePessoal`. Consulta e gravação foram verificadas; o aceite do disparo automático dos hooks do Codex depende do carregamento/revisão do cliente. [Configuração, evidências e uso](docs/agents/ai-memory.md).
