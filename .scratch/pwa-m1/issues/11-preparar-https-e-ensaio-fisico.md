# 11 — Preparar HTTPS e ensaio físico (02c, pacote local)

Status: ready-for-agent
Blocked by: none — recortes09/10 concluídos no escopo local; este preparo não depende de contratar/publicar

Origem: spec/14 §5/6, Q62/Q67–Q75 e tarefa02. Uma entrega delimitada: preparar e conferir os artefatos de hospedagem e o roteiro físico. Não entrega a jornada03 nem conclui02c.

## Entrega e aceite

- Fragmentos de servidor estático e borda para uma origem HTTPS, API diretamente atrás do Traefik existente, sem novo salto na confiança de IP da API. Sem fallback HTML em /api, retry automático de POST ou cache de API.
- HTML/SW/manifest revalidados; somente assets de conteúdo identificável pelo hash podem receber immutable. Arquivos ausentes não devolvem HTML nem cache imutável; assets de builds anteriores preservados na publicação futura.
- Ensaio finito com Nginx/Traefik reais e upstream sintético: prioridades, TLS/cadeia/host, headers, erros e Cookie maior que8192bytes atravessando a borda. O upstream sintético não substitui a prova Java/RLS09.
- Ficha de parâmetros públicos e roteiro Safari/Tela de Início no iPhone 16e, com resultados em aberto, limites de evidência e critérios para liberar tarefa03. Reutilizar tarefas humanas de domínio/Resend e operação; não duplicar contratação ou configuração.
- Build técnico atual/bridge não publicado. Ambiente externo e participação no aparelho continuam pendentes, sem aceitar Safari/M1 por inferência dos testes locais.

## Resultado

Concluída: sim — pacote local, roteiro físico e17 verificações de hospedagem aprovados, conforme [relatório](../../../docs/analises/2026-10-23-preparo-https-iphone.md). App: typecheck/lint e264 testes; web: typecheck/lint e20 testes. API check completo aprovado em10m58s:112 casos (102 passaram/10 opt-in ignorados),13 operacionais. Containers/rede do ensaio encerrados; nenhuma publicação/alteração externa ou aceite Safari.

A execução física02c continua na tarefa02, com domínio/ambiente e participação no aparelho pendentes. Próximo preparo local: [controles por toque12](12-preparar-controles-do-ensaio-iphone.md); jornada03 continua bloqueada. Publicação/aceite de produto permanecem nas tarefas06/07.

Conferência final:12 Markdown/131 links locais válidos; diff sem erros de whitespace.
