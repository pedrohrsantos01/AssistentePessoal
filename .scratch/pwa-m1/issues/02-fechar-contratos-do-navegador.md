# 02 — Fechar contratos do navegador

Status: needs-info
Blocked by: none — prova01 concluída localmente; definições e evidência física ainda pendentes

Origem: spec/14 §4–5. Q75=A confirmou o entendimento;02a especificado sem schema/rotas aplicados. Provas locais e evidência Safari ainda pendentes.

## Entrega

Com a opção1/ADR-020 aprovadas, conferir Safari/Tela de Início no iPhone e concretizar IndexedDB/Dexie: especificar schema/migrações, repositório assíncrono/atomicidade e impacto Journey/Session; não simular tipos síncronos. Reabrir a escolha somente diante de impedimento comprovado e decisão registrada. Biblioteca local não substitui a sincronização Java do Ritmo.

Fechar sessão/HTTP: cookies HttpOnly/Secure e mesma origem aprovados em Q67/Q68, com fronteira no Java existente; detalhar CSRF, instalação, refresh, perda de resposta, logout offline, revogação e conta A/B. Tratar cookies copiados Safari→Tela de Início sem família/identidade compartilhada acidentalmente. Preservar bearer nativo.

Definir propriedade/fencing entre abas, leitura secundária, migração/atualização com versões simultâneas, HTTPS de teste, suporte de navegador, recuperação por URL e falhas. Consolidar medição/metas web. Consultar Pedro apenas sobre comportamentos não resolvidos pelas Q61–Q65/specs. Dados/transportes novos exigem spec/00, migrations e contratos executáveis antes de implementar.

## Aceite

Resolver spec/14 §5 e mapear M1-01–20/WEB-01–10. Uma biblioteca fora de alpha ou um ensaio desktop não aprovam banco no iPhone. Atualizar dependentes; manter needs-info enquanto faltar definição necessária.

## Resultado

Concluída: não —02a concluído na [tarefa08](08-especificar-contrato-executavel.md), com [contrato executável](../../../contracts/pwa-m1/README.md) e campos/índices no spec/00. Q67–Q75 aprovadas; próximo recorte09 ready-for-agent para sessão/cookies/autorização, seguido de10 para coordenação/commits. Nenhum adapter/schema/endpoint de produto foi aplicado. Safari/Tela de Início e HTTPS continuam gates; tarefa03 não liberada.

21/10/2026 — [Prova01](../../../docs/analises/2026-10-21-prova-tecnica-pwa.md) fornece React/Vite, Dexie transacional, precache e candidato Web Locks+geração no Chrome. Esquema reduzido não é contrato de produto. Próximo recorte recomendado; manter needs-info por sessão/schema/upgrade e Safari/Tela de Início físicos. Roteiro iPhone no relatório; versão iOS ainda não informada.

21/10/2026 — Rodada1 iniciada com grilling. Fatos conferidos: fence local não protege Set-Cookie tardio; IDB não reúne databases separadas na mesma transação; swap assíncrono precisa revalidar o conjunto vigente no corte H. M1-01–20 mapeados a WEB-01–10 na proposta, sem declarar aceite. Q66 informa iOS26.6.2 (declaração do operador; falta ensaio). Origem, credenciais e fronteira física do banco são as três raízes da rodada; detalhes dependentes aguardam respostas.

21/10/2026 — Pedro aprovou A em Q67–Q69. Fronteiras propagadas ao spec/14, spec/00 e ADR-021. Rodada2 pergunta contêiner novo, modelo de sessão web e durabilidade de formulário; detalhes dependentes continuam sem implementação. Leitura secundária pós logout, uso local ativo e preservação de intenções não são reabertos.

21/10/2026 — Pedro respondeu A em Q70–Q72. ADR-022/spec14/instruções atualizados: instalação nova autentica online, Java controla sessão opaca e rascunho fica na aba. A tarefa continua needs-info até consolidar prazo, protocolo e provas; não implementar a hipótese de cookie fixo sem conferir contexto/sessão esperados.

21/10/2026 — Pedro respondeu A em Q73/Q74. Validade30/90dias e quatro contextos propagados. Plano interno:02a contrato executável,02b provas locais,02c HTTPS/Safari físico. Representação/limpeza de cookies, recuperação sem quinta sessão, posse/compatibilidade/transações ainda exigem especificação e ensaio. Desenho proposto substitui a hipótese de steal da prova01; esta continua evidência histórica, não prova do candidato novo. Não houve mudança de runtime neste incremento.

22/10/2026 — Q75=A consolidada e02a especificado:17 rotas propostas,65 schemas de transporte,10 registros locais,50 exemplos/61 cenários do oráculo. Tarefas08/09/10 decompõem execução sem duplicar06/07 ou provisionamento. [Relatório](../../../docs/analises/2026-10-22-contrato-executavel-pwa.md). Task02 segue aberta por provas/gates, sem nova entrevista de decisões já aprovadas.
