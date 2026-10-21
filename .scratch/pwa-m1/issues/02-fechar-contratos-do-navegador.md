# 02 — Fechar contratos do navegador

Status: needs-info
Blocked by: none — prova01 concluída localmente; definições e evidência física ainda pendentes

Origem: spec/14 §4–5. Falta evidência Safari e decisões técnicas; nenhuma tabela/rota/cookie nova definida.

## Entrega

Com a opção1/ADR-020 aprovadas, conferir Safari/Tela de Início no iPhone e concretizar IndexedDB/Dexie: especificar schema/migrações, repositório assíncrono/atomicidade e impacto Journey/Session; não simular tipos síncronos. Reabrir a escolha somente diante de impedimento comprovado e decisão registrada. Biblioteca local não substitui a sincronização Java do Ritmo.

Fechar sessão/HTTP: proposta cookie HttpOnly/Secure e mesma origem no Java existente, CSRF, instalação, refresh, perda de resposta, logout offline, revogação e conta A/B. Tratar cookies copiados Safari→Tela de Início sem família/identidade compartilhada acidentalmente. Preservar bearer nativo.

Definir propriedade/fencing entre abas, leitura secundária, migração/atualização com versões simultâneas, HTTPS de teste, suporte de navegador, recuperação por URL e falhas. Consolidar medição/metas web. Consultar Pedro apenas sobre comportamentos não resolvidos pelas Q61–Q65/specs. Dados/transportes novos exigem spec/00, migrations e contratos executáveis antes de implementar.

## Aceite

Resolver spec/14 §5 e mapear M1-01–20/WEB-01–10. Uma biblioteca fora de alpha ou um ensaio desktop não aprovam banco no iPhone. Atualizar dependentes; manter needs-info enquanto faltar definição necessária.

## Resultado

Concluída: não — provas/consolidação pendentes.

21/10/2026 — [Prova01](../../../docs/analises/2026-10-21-prova-tecnica-pwa.md) fornece React/Vite, Dexie transacional, precache e candidato Web Locks+geração no Chrome. Esquema reduzido não é contrato de produto. Próximo recorte recomendado; manter needs-info por sessão/schema/upgrade e Safari/Tela de Início físicos. Roteiro iPhone no relatório; versão iOS ainda não informada.
