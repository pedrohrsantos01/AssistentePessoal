# 03 — Entregar recuperação de senha pelo link no Android

Status: needs-info
Blocked by: 02-preparar-dominio-e-resend.md; ../../primeiro-marco/issues/03-integrar-prototipo.md

Origem: [spec/01](../../../specs/01-conta-e-onboarding.md), [contrato de e-mail](../../../api/ops/email-recovery.md) e [plano](../spec.md). Rota iOS adiada em Q55=B; seu aceite continua obrigatório para fechar M1.

## Definições antes de implementar

Confirmar origem HTTPS, domínio de envio/remetente, application ID final e identidade de assinatura Android. Documentar entendimento e fronteiras de teste com Pedro. Package do harness e certificado de debug local não são identidades finais do produto.

## Critérios de aceite

- Configurar Android App Links para origem confirmada e comprovar associação do pacote/certificado instalado.
- Receber link com app encerrado e já aberto; respeitar parser de origem/caminho/fragmento existente, sem consumir token ao abrir ou expô-lo em logs.
- Pelo fluxo aprovado no protótipo, confirmar reset por HTTP; tratar link inválido/expirado/usado, indisponibilidade e quotas, sem criar sessão automaticamente.
- Provar revogação remota, nova autenticação e pendências locais preservadas/isoladas conforme contratos atuais.
- SMTP real, recebimento e abertura por mensagem exigem ambiente isolado preparado e autorização explícita para envio externo. Preparação/testes locais podem anteceder essa etapa.
- Checks integrais, evidência do build/aparelho e limites. Não publicar fallback web ou aprovar iPhone por inferência.

## Resultado

Concluída: não — parâmetros públicos e protótipo faltam; contratos HTTP/parser existem, integração OS/associação/fluxo real ainda não.

## Comments

08/10/2026 — Lacuna decomposta em recorte verificável; não autoriza implementar decisões abertas.
