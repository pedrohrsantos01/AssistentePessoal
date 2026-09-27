# Referências de engenharia — Karpathy e Matt Pocock

Data de consulta: **23/09/2026**. Escopo local desta nota: `README.md`, `CLAUDE.md` e `PLANO-DE-EXECUCAO.md`. Esta pesquisa fundamenta a auditoria; não substitui a leitura de todos os requisitos nem comprova o funcionamento de uma implementação.

## Conclusão

O Ritmo já adota práticas compatíveis com as referências: escopo por fase, requisitos identificados, decisões registradas, testes próximos da implementação e intenção de entregar fatias verticais. A principal oportunidade é transformar essas intenções em contratos coerentes e verificáveis. Quantidade de documentação e escolha de um framework modular, isoladamente, não comprovam prontidão para implementação.

Não há, nos três documentos examinados, uma referência bibliográfica ou versão das guidelines adotadas. Convém registrar quais fontes orientam cada regra e distinguir **afirmação do autor**, **adaptação da comunidade** e **decisão própria do projeto**.

## Proveniência e limites de atribuição

### Andrej Karpathy

O conhecido repositório `forrestchang/andrej-karpathy-skills` redireciona atualmente para `multica-ai/andrej-karpathy-skills`. Seu próprio README se apresenta como guidelines **inspiradas** nas observações de Karpathy. Ele organiza quatro princípios: explicitar hipóteses, preferir simplicidade, restringir alterações ao escopo e verificar objetivos. É fonte primária da **adaptação**, não evidência de que Karpathy escreveu ou endossou esse conjunto de regras. [README da adaptação](https://github.com/multica-ai/andrej-karpathy-skills).

A adaptação aponta para um [post de Karpathy no X](https://x.com/karpathy/status/2015883857489522876). A consulta direta a esse post e à URL equivalente em `twitter.com` falhou nesta pesquisa. Portanto, esta nota não trata as citações reproduzidas por terceiros como texto original verificado, nem atribui a ele a autoria de um `CLAUDE.md` universal.

Uma fonte direta acessível é o [`program.md` de karpathy/autoresearch](https://github.com/karpathy/autoresearch/blob/master/program.md): o experimento delimita o arquivo editável, mantém o avaliador fora do escopo, exige uma medição inicial e compara mudanças por uma métrica definida, considerando também o custo da complexidade. A preferência por soluções simples aparece explicitamente. Trata-se de um experimento de pesquisa de modelos, não de um processo prescrito para aplicativos comerciais.

Também há uma preferência explícita por minimalismo, legibilidade e adaptação a necessidades concretas no [`README` de karpathy/llama2.c](https://github.com/karpathy/llama2.c), em oposição a transformar aquele projeto em um framework muito configurável. Isso sustenta a orientação de simplicidade naquele contexto; não determina a stack do Ritmo.

**Aplicação proposta ao Ritmo — interpretação desta auditoria:** definir a condição de sucesso de cada entrega antes de implementá-la, preservar um oráculo de teste independente do código e exigir justificativa para complexidade adicional. Não se deve transportar o loop autônomo de pesquisa, seu orçamento ou seus comandos literalmente para o desenvolvimento do aplicativo.

### Matt Pocock

O repositório [`mattpocock/skills`](https://github.com/mattpocock/skills) é a referência primária operacional utilizada aqui. O README defende skills pequenas, adaptáveis e combináveis, linguagem compartilhada e ciclos de feedback. Ele atribui a formulação clássica de módulos profundos a **John Ousterhout**; logo, o conceito não deve ser apresentado como invenção de Matt.

O artigo autoral [AI Skills for Real Engineers](https://www.aihero.dev/skills-post), atualizado em 27/04/2026, explica o encadeamento entre esclarecimento do domínio, requisitos, fatias verticais e TDD. Contudo, nomes de skills e detalhes do fluxo já diferem do repositório consultado em setembro. A fonte operacional deve ser versionada quando o projeto formalizar sua política; links para `main` são móveis.

As fontes a seguir foram **lidas como referências**, sem instalar ferramentas, publicar tickets nem executar seus workflows completos.

## Recomendações sustentadas pelas fontes

| Tema | O que a fonte sustenta | Aplicação proposta ao Ritmo |
|---|---|---|
| Vocabulário e decisões | Termos devem ser desambiguados com cenários concretos; glossário guarda conceitos, e ADRs são reservados a escolhas com custo de reversão, alternativas reais e motivação relevante. [domain-modeling](https://github.com/mattpocock/skills/blob/main/skills/engineering/domain-modeling/SKILL.md) | Definir, por exemplo, dia lógico, ocorrência, conclusão, desfazer e exclusão de modo consistente entre módulos; evitar duplicar definições divergentes. Não é obrigatório reorganizar arquivos só para copiar a árvore da skill. |
| Especificação | O documento cobre problema, solução, histórias, decisões de implementação, decisões de teste e não-escopo. Deve identificar interfaces e pontos públicos de verificação. [to-spec](https://github.com/mattpocock/skills/blob/main/skills/engineering/to-spec/SKILL.md) | Cada requisito crítico precisa de entradas, resultado observável e estados de falha; uma descrição de intenção ou nome de classe não resolve o contrato. |
| Planejamento | Cada ticket atravessa as camadas necessárias, produz um comportamento verificável e declara o que o bloqueia. O tamanho deve caber em um contexto de trabalho. [to-tickets](https://github.com/mattpocock/skills/blob/main/skills/engineering/to-tickets/SKILL.md) | Trocar dependências implícitas da lista por relações explícitas; separar preparativos técnicos de incrementos de produto e definir saídas verificáveis para ambos. |
| Módulos profundos | Profundidade depende da capacidade exposta por uma interface pequena. A interface inclui invariantes, ordem de operações, erros, configuração e desempenho; não apenas assinaturas. [codebase-design](https://github.com/mattpocock/skills/blob/main/skills/engineering/codebase-design/SKILL.md) | Para sync, agenda, gamificação e assistente, declarar o que o chamador precisa saber e o que o módulo resolve internamente. Pacotes Modulith são uma estrutura possível, mas não demonstram profundidade por si. |
| Testes comportamentais | Exercitar interfaces públicas; usar valores esperados obtidos de uma fonte independente; evitar testes que apenas reproduzem o cálculo da implementação. Implementar um teste e uma solução mínima por ciclo. [tdd](https://github.com/mattpocock/skills/blob/main/skills/engineering/tdd/SKILL.md) | Usar cenários exemplificados de negócio e falha como oráculo. Cobertura percentual pode ajudar a localizar código não exercitado, mas não substitui esses cenários. |
| Simplicidade e verificação | O experimento define escopo, baseline, avaliação fixa e custo aceitável de complexidade. [autoresearch/program.md](https://github.com/karpathy/autoresearch/blob/master/program.md) | Cada spike deve registrar hipótese, evidência, limite e decisão. A solução mais sofisticada deve demonstrar benefício para a fase atual. Esta transposição é interpretação da auditoria. |

Observação de versão: a skill `tdd` consultada coloca a refatoração na etapa de revisão, fora do ciclo red–green; o artigo de abril descreve o fluxo mais geral red–green–refactor. Os pontos estáveis são feedback frequente, testes comportamentais e incrementos pequenos. O Ritmo deve escrever a política escolhida de forma explícita, sem combinar versões e atribuí-las ao autor como uma regra única. [tdd atual](https://github.com/mattpocock/skills/blob/main/skills/engineering/tdd/SKILL.md), [artigo de abril](https://www.aihero.dev/skills-post).

## Tensões verificadas nos documentos locais

As observações abaixo são desta auditoria, não afirmações dos autores sobre o Ritmo. Os números de linha referem-se aos arquivos lidos nesta data.

1. **Unidade de trabalho contraditória.** `CLAUDE.md:20` manda construir fatias verticais; `CLAUDE.md:22` proíbe trabalhar app e backend na mesma sessão; `README.md:16` associa uma fatia a uma sessão. Não há como cumprir as três regras para uma fatia que atravessa app e backend. Proposta: manter a fatia como unidade de valor e explicitar sessões subordinadas com contrato e teste de integração comuns, ou permitir uma fatia pequena atravessar a stack numa sessão.

2. **Integração tardia ainda precisa de justificativa.** `PLANO-DE-EXECUCAO.md:39` entrega hábitos sem sincronização, enquanto a sincronização aparece na Fatia 5 (`:66`) e o próprio plano alerta contra seu retrofit (`:118`). Isso não prova que o design esteja errado: contratos locais podem antecipar a integração. Porém, o plano precisa mostrar qual experimento anterior valida esses contratos e qual o primeiro caminho real app → API → banco → outro cliente. A alternativa recomendada é incluir uma sincronização mínima no primeiro fluxo de hábitos e ampliar conflitos e recuperação posteriormente.

3. **Bloqueador visual começa antes do indicado.** `README.md:37` e `:46` dizem que Q5 bloqueia a Fatia 3; `PLANO-DE-EXECUCAO.md:20` exige tokens fechados na Fatia 0B antes de qualquer tela. O planejamento deve marcar a primeira entrega efetivamente bloqueada e separar decisões visuais mínimas das que podem amadurecer depois.

4. **Resíduo de arquitetura no plano.** O README anuncia a substituição do Supabase por Spring, mas `PLANO-DE-EXECUCAO.md:92` e `:152` ainda especificam edge functions para assistente e push. Antes de gerar tickets, é preciso esclarecer se isso é terminologia obsoleta ou uma dependência real fora da arquitetura descrita.

5. **Teste no mesmo commit não equivale a feedback test-first.** `CLAUDE.md:21` assegura proximidade entre regra e teste, mas não registra o ciclo de implementação. `PLANO-DE-EXECUCAO.md:60` exige 100% de cobertura para gamificação sem, nessa passagem, definir se a métrica é de linhas, branches ou outro tipo. A fundação deve definir as interfaces testadas, exemplos de referência e evidências de falha/sucesso. Nenhuma dessas fontes impõe 100% universal.

6. **Índice e plano já divergiram.** `README.md:24` promete 11 fatias, mas o plano inclui subdivisões como 0A/0B, 2.5, 10.5 e 10.9. O problema não é a numeração fracionária em si; é o índice deixar de representar a sequência real, especialmente para um agente que recebe apenas parte do contexto.

## Critérios práticos para a auditoria e o planejamento

Esta lista é uma síntese própria, derivada das referências acima, para avaliar prontidão sem transformar documentação em um fim em si mesma.

- **Decisão explícita:** cada ambiguidade que muda dados, experiência ou custo tem responsável, opções e entrega bloqueada. Decisões reversíveis de implementação não precisam virar uma longa entrevista.
- **Fonte de verdade:** termos, campos e comportamentos repetidos apontam para uma definição canônica; uma alteração de decisão identifica os documentos que precisam mudar.
- **Contrato completo:** uma operação informa precondições, autorização, resultado, erros, repetição, concorrência e responsabilidade pelo efeito. Aplicar somente os itens relevantes à operação.
- **Exemplo verificável:** cada risco de negócio tem pelo menos um cenário com entradas e resultado esperado independente, inclusive tempo/fuso, offline, duplicação, retomada e exclusão quando pertinentes.
- **Módulo justificável:** a interface reduz o que os chamadores precisam conhecer. Um módulo que só repassa chamadas merece revisão; uma abstração para um futuro incerto exige justificativa.
- **Fatia executável:** objetivo demonstrável, requisitos associados, dependências reais, comandos de validação e evidência de conclusão. Se depende de decisão humana, isso aparece antes da implementação.
- **Feedback precoce:** testar cedo os riscos que podem invalidar a arquitetura; não esperar acabamento para descobrir que sync, OAuth ou uma ação de notificação não funciona no ambiente real.
- **Mudança proporcional:** implementar a menor solução que satisfaz o contrato da fase; registrar o motivo de uma escolha complexa sem expandir automaticamente o escopo.

Próximo passo sugerido: usar esses critérios para fechar os contratos de maior risco e revisar a ordem das primeiras entregas. Depois, transformar apenas a primeira fatia desbloqueada em trabalho implementável. A adoção de nomes de skills, estrutura específica de pastas ou metas arbitrárias de cobertura não deve ser confundida com aderência aos princípios.
