# 02 — Fechar contratos do navegador

Status: needs-info
Blocked by: .scratch/pwa-m1/issues/01-provar-portabilidade-e-persistencia.md

Origem: spec/14 §4–5. Falta evidência Safari e decisões técnicas; nenhuma tabela/rota/cookie nova definida.

## Entrega

Com a opção1/ADR-020 aprovadas, conferir Safari/Tela de Início no iPhone e concretizar IndexedDB/Dexie: especificar schema/migrações, repositório assíncrono/atomicidade e impacto Journey/Session; não simular tipos síncronos. Reabrir a escolha somente diante de impedimento comprovado e decisão registrada. Biblioteca local não substitui a sincronização Java do Ritmo.

Fechar sessão/HTTP: proposta cookie HttpOnly/Secure e mesma origem no Java existente, CSRF, instalação, refresh, perda de resposta, logout offline, revogação e conta A/B. Tratar cookies copiados Safari→Tela de Início sem família/identidade compartilhada acidentalmente. Preservar bearer nativo.

Definir propriedade/fencing entre abas, leitura secundária, migração/atualização com versões simultâneas, HTTPS de teste, suporte de navegador, recuperação por URL e falhas. Consolidar medição/metas web. Consultar Pedro apenas sobre comportamentos não resolvidos pelas Q61–Q65/specs. Dados/transportes novos exigem spec/00, migrations e contratos executáveis antes de implementar.

## Aceite

Resolver spec/14 §5 e mapear M1-01–20/WEB-01–10. Uma biblioteca fora de alpha ou um ensaio desktop não aprovam banco no iPhone. Atualizar dependentes; manter needs-info enquanto faltar definição necessária.

## Resultado

Concluída: não — provas/consolidação pendentes.
