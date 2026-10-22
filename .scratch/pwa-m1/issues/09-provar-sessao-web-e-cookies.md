# 09 — Provar sessão web e cookies (02b, primeira parte)

Status: ready-for-agent
Blocked by: none — contrato08/02a concluído

Origem: [contrato02a](../../../contracts/pwa-m1/README.md), spec/00 representação web, spec/14 WEB-05/06/07/10. Próximo recorte recomendado; não exige nova decisão de produto ou escolha de stack.

## Entrega

Implementar ensaio delimitado do protocolo web no Java/PostgreSQL existente, com fixture de conta A/B e navegador HTTPS visível. Incluir preparação/close comprovado antes da senha, segredo auth distinto/Path por contexto, inspeção/claim e autorização transacional de um comando de domínio m1.1. Preservar bearer nativo, quotas compartilhadas, RLS e limites de versão; UI da jornada funcional não integra este recorte.

Schema/grants reais exigem nova Flyway e spec/00 no mesmo commit, com hashes privados a Identity e autorização no mesmo commit/conexão do domínio. Nenhum fake em memória substitui prova dessas garantias. Preparar execução local finita ou Termbaker conforme regras, encerrar recursos próprios ao terminar, preservar processos preexistentes. Não publicar ou usar dados reais.

## Aceite

- Usar os vetores de contratos como referência e testar os adapters independentemente do oráculo Python.
- Browser verifica HttpOnly/Secure/SameSite/Path/Expires, cookies A ausentes nas rotas B, resposta de login tardia/perdida e cookie revogado que reaparece. JS não recebe access/refresh/revogação. Abort sozinho não é prova de rollback.
- Provar CSRF/origem/JSON e ausência de cache; roteamento de quotas/426/429 e431 conservam intenções. Native bearer segue com suas próprias rotas/validades.
- Provar login vs close/reset nas duas ordens, senha antiga após reset, replay sem reemissão, prazos exatos30/90dias e claim antigo que chega depois do novo. Transação não aceita comando com posse/conta divergentes.
- Provar quatro contextos, quinto bloqueado e recovery-close com senha da conta original sem quinta sessão. Cookie de B não fecha A; registro mínimo permite recuperação após expirar/limpar hashes, e404 não libera vaga.
- Provar filtro de usuário/grants/RLS e autorização na mesma transação/conexão do domínio. Filtro HTTP separado não basta. Quarentena precisa abranger contextos web.
- Relatório com versões/limites e evidência visível delimitada. Chrome/WebKit desktop não aceitam Safari físico nem M1. Ajustar contrato diante de impedimento comprovado; perguntar somente se surgir decisão nova de produto.

## Resultado

Concluída: não — especificado para execução; ainda não há endpoints/migration/prova de cookies deste protocolo. Validação de contratos08 não satisfaz estes critérios.
