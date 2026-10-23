# 07 — Preparar publicação e aceite da PWA

Status: needs-info
Blocked by: .scratch/pwa-m1/issues/06-validar-interface-no-iphone.md; .scratch/aceite-m1/issues/02-preparar-dominio-e-resend.md; .scratch/recuperacao-operacional/issues/04-validar-operacao-externa.md

Origem: spec/14 WEB-10; reutilizar gates externos sem duplicar configuração humana.

## Entrega

Bundle/deploy reproduzível, manifest/icons e cache/headers aprovados. Validar HTTPS, sessão/CSRF, recuperação por link de teste autorizado e backend apto a dados reais. Instalações nova e com fila toleram publicação/rollback conforme contrato.

Registrar WEB-01–10/M1-01–20; Pedro confirma Safari e Tela de Início no iPhone. Parâmetros públicos pendentes explícitos; segredos no cofre/ambiente, nunca bundle/relatório.

## Aceite

Publicação futura depende de ambiente/contratos e autorização aplicável; pedido atual é planejamento. Não contratar domínio/VPS/serviço, enviar e-mail real ou publicar por inferência deste arquivo. A prova web alimenta a tarefa04 de aceite-m1, que consolida PWA+iPhone/Android conforme Q65. Build nativo iOS fica posterior; Fase1 completa permanece aberta.

## Resultado

Concluída: não — origem, operação, implementação/provas pendentes.

23/10/2026 — Referências locais de roteamento/cache e roteiro de ensaio02c preparados no [pacote11](../../../web/ops/https-iphone.md). A prova usa shell/API sintéticos e não aceita publicação da jornada, retenção/rollback de releases reais ou operação externa. Não copiar web/dist/bridge técnico para a VPS; ambiente público continua pendente e sujeito a esta tarefa e aos gates existentes.

23/10/2026 — `web/dist-iphone/` é o artefato técnico isolado do [recorte12](12-preparar-controles-do-ensaio-iphone.md), com entrada/manifest/cache em `/ensaio/`. O [guia](../../../web/ops/https-iphone.md) explica montagem no subdiretório e gates; não publicar em origem com dados reais nem promover esse cliente a produto. Nenhum domínio, DNS, Resend ou VPS alterado.
