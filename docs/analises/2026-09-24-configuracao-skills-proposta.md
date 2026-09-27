# Configuração proposta das skills de Matt Pocock

Data: 24/09/2026.
Status: aprovado pelo Pedro na conversa e aplicado em 24/09/2026. Os blocos abaixo registram o conteúdo aprovado.

O uso de Markdown local foi recomendado e aceito na conversa. O projeto contém `CLAUDE.md`, PRD, specs e análises; ainda não há configuração dessas skills nem repositório Git. A skill `triage` está instalada, portanto o setup inclui seu vocabulário padrão.

Esta configuração organiza a entrevista e o planejamento. Ela não aprova nenhuma das decisões técnicas propostas pela auditoria.

## 1. Bloco a acrescentar ao CLAUDE.md

Adicionar fora dos marcadores gerenciados pelo Termbaker, preservando as demais seções:

```markdown
## Agent skills

### Issue tracker

Especificações de entrega e tarefas são acompanhadas em Markdown local, sob `.scratch/<feature>/`. Ver `docs/agents/issue-tracker.md`.

### Triage labels

Usamos os cinco rótulos padrão de Matt Pocock. Ver `docs/agents/triage-labels.md`.

### Domain docs

Um glossário de domínio em `CONTEXT.md` e decisões arquiteturais em `docs/adr/`, criados conforme as definições forem resolvidas. As decisões existentes no PRD continuam válidas. Ver `docs/agents/domain.md`.
```

## 2. Conteúdo de docs/agents/issue-tracker.md

```markdown
# Acompanhamento de trabalho: Markdown local

O trabalho é acompanhado em arquivos locais dentro do projeto.

## Convenções

- Uma entrega ou capacidade por diretório: `.scratch/<feature-slug>/`.
- A especificação da entrega fica em `.scratch/<feature-slug>/spec.md`.
- Cada tarefa de implementação fica em `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numerada a partir de `01`.
- Não reunir todas as tarefas em um único arquivo.
- Registrar o estado de triagem em uma linha `Status:` no início da tarefa, usando o vocabulário de `docs/agents/triage-labels.md`.
- Registrar dependências numa linha `Blocked by:` com os caminhos das tarefas bloqueadoras, ou `none`.
- Registrar conclusão e evidências em `## Resultado`, com `Concluída: sim` somente quando os critérios de aceite passarem. O rótulo de triagem não substitui esse registro.
- Acrescentar comentários em `## Comments`, preservando o histórico relevante.

## Relação com a documentação existente

O PRD define produto e escopo. Os arquivos de `specs/` definem os contratos de domínio e dados. A especificação de uma entrega referencia os requisitos e decisões aplicáveis; não cria uma segunda versão divergente deles.

Se uma decisão aceita mudar um contrato, atualizar o spec canônico e referenciar essa alteração na entrega. As análises em `docs/analises/` são diagnósticos e propostas; não são decisões aprovadas por sua simples existência.

## Publicar ou consultar trabalho

Quando uma skill disser para publicar no issue tracker, criar ou atualizar o arquivo local correspondente. Quando disser para consultar uma tarefa, ler seu arquivo e as dependências citadas.

Nenhuma publicação em serviço externo faz parte desta configuração.
```

## 3. Conteúdo de docs/agents/triage-labels.md

```markdown
# Rótulos de triagem

| Papel da skill | Rótulo no projeto | Significado |
|---|---|---|
| needs-triage | needs-triage | Precisa ser avaliado |
| needs-info | needs-info | Faltam informações ou decisões |
| ready-for-agent | ready-for-agent | Especificado e pronto para execução por agente |
| ready-for-human | ready-for-human | Exige execução humana |
| wontfix | wontfix | Não será executado |

No acompanhamento local, esses valores são gravados na linha `Status:` da tarefa. O estado de conclusão é registrado separadamente com a evidência de aceite.

Uma tarefa não fica pronta para execução enquanto uma decisão necessária ao seu comportamento estiver em aberto.
```

## 4. Conteúdo de docs/agents/domain.md

```markdown
# Documentação de domínio

Usamos um contexto documental único para o Ritmo. A divisão prevista entre app, backend e módulos não exige, neste estágio, glossários separados.

## Leitura

Seguir a ordem das instruções do projeto. Consultar também `CONTEXT.md`, quando existir, e os ADRs relevantes em `docs/adr/`.

O PRD já contém glossário e ADR-001 a ADR-014. Consultar essas definições e decisões antes de propor alterações. Ausência de `CONTEXT.md` ou `docs/adr/` não apaga esse histórico nem impede o trabalho.

## Glossário

Criar `CONTEXT.md` quando houver a primeira definição resolvida para registrar. Ele contém apenas termos do domínio e suas definições curtas; contratos de implementação, algoritmos e listas de pendências ficam nos specs e no planejamento.

Reutilizar as definições existentes que continuem válidas. Se uma definição passar do PRD para o glossário, deixar uma referência no PRD e evitar manter duas definições normativas concorrentes.

## Decisões arquiteturais

Criar `docs/adr/` somente quando houver uma decisão que justifique um ADR: custo relevante de reversão, motivação não óbvia e alternativas reais consideradas.

Preservar ADR-001 a ADR-014 no PRD. Numerar novos ADRs considerando também esses registros: começar em `0015-<slug>.md`, salvo se já houver número maior. Revisões devem indicar explicitamente qual decisão substituem.

Não tratar uma recomendação da auditoria como decisão aceita. Registrar a escolha e a razão quando forem acordadas na entrevista.

## Consistência

Usar o vocabulário acordado nas especificações, tarefas e testes. Apontar contradições entre uma nova proposta e decisões existentes. Ao resolver uma contradição, atualizar os documentos afetados e manter a origem da decisão rastreável.
```

## Aprovação e aplicação

Pedro confirmou os cinco rótulos padrão e a aplicação deste conteúdo. A configuração foi aplicada em `CLAUDE.md` e nos três arquivos de `docs/agents/`. As decisões técnicas continuam em aberto para as rodadas de `grill-with-docs`.

Fonte do procedimento: `C:/Users/pedro/.agents/skills/setup-matt-pocock-skills/SKILL.md`, seções 2–4. A skill pede uma revisão do conteúdo antes da escrita dos arquivos de configuração.
