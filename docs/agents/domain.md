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
