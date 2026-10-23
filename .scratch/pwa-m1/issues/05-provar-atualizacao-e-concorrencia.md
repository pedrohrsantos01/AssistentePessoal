# 05 — Provar atualização e concorrência web

Status: needs-info
Blocked by: .scratch/pwa-m1/issues/04-completar-jornada-e-excecoes.md

Origem: spec/14 §3–6; robustez dos mecanismos básicos já necessários na tarefa03.

## Entrega e aceite

WEB-06–08: duas abas, takeover, suspensão/retorno, crash, respostas tardias e troca de conta. Sem segundo escritor/refresh enquanto o anterior autorizado. Safari/Tela de Início distintos, incluindo cópia de cookies do Safari autenticado.

Upgrade com fila, protocolo incompatível e migração interrompida. Preservar base/IDs/recibos/cursor/leitura. SW cacheia assets públicos aprovados, sem respostas autenticadas/reset/sync. Não usar reload forçado, limpeza ou nova identidade para ocultar recuperação.

Relatório com código/schema/protocolo e resultado por instalação/aba, inclusive falhas. Testes de segurança e isolamento acompanham adaptações.

## Resultado

Concluída: não — mecanismos básicos têm implementação e prova local nos recortes09/10. Resta validar a jornada de produto e os contêineres físicos Safari/Tela de Início, conforme tarefa02/02c.

23/10/2026 — [Relatório10](../../../docs/analises/2026-10-23-prova-coordenacao-web.md) separa ensaio técnico Chrome de aceite WEB-06–08. Não repetir a implementação de CAS/commits ou tratar o protótipo01 com steal como mecanismo atual.
