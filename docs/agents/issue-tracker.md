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
