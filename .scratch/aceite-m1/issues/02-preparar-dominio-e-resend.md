# 02 — Preparar manualmente domínio, DNS e Resend

Status: ready-for-human
Blocked by: none

Origem: Q54 e [guia solicitado por Pedro](../../../api/ops/domain-and-email-setup.md). Escolha do nome e configuração da conta são do operador; não há contratação automática.

## Critérios de aceite

- Reutilizar phsdev.cloud, escolhido por Pedro em24/10/2026 e com registro ativo confirmado; não comprar outro nome para cumprir este item. Usar a origem confirmada https://ritmo.phsdev.cloud.
- Confirmar registro ativo, provedor de DNS autoritativo e continuidade do e-mail existente.
- Conferir no Resend os registros exatos do domínio/subdomínio de envio escolhido e obter verificação de envio.
- Retornar parâmetros públicos: domínio, gestor DNS, domínio de envio/status e remetente de serviço proposto. Segredos permanecem no canal privado/cofre.
- Deixar apontamento da API, instalação, envio externo e associação do app sujeitos aos gates próprios; domínio verificado não equivale a recuperação ponta a ponta.

## Resultado

Concluída: não — domínio phsdev.cloud escolhido e registro ativo confirmado; origem https://ritmo.phsdev.cloud confirmada; apontamento, continuidade do e-mail e Resend ainda pendentes. Nenhuma conta/DNS alterado pelo agente.

## Comments

08/10/2026 — Q54: não há domínio disponível; solicitado documento para configuração. Gratuidade da conta não comprovada. [Plano](../spec.md).

23/10/2026 — Pedro confirmou que ainda não escolheu o domínio; ficha pública permanece em aberto. Pacote/cliente técnico PWA são preparados localmente, sem registro, DNS ou envio externo.

23/10/2026 — Consulta autenticada ao Hostinger Connector identificou phsdev.cloud e phsdev.com ativos, conforme o [inventário verificado](../../../docs/analises/2026-10-23-inventario-hostinger.md). São candidatos existentes na conta; Pedro ainda precisa escolher o nome/subdomínio para o Ritmo. Nameservers foram lidos, sem mudança de DNS ou consulta ao Resend. Esta tarefa permanece aberta.

24/10/2026 — Pedro escolheu phsdev.cloud para teste e uso da PWA. [Registro e conferência DNS](../../../docs/analises/2026-10-24-dominio-pwa-phsdev-cloud.md): MX aponta para a raiz e não há resposta A/AAAA nela. Pedro confirmou https://ritmo.phsdev.cloud para PWA/API e informou https://coolify.continuumcare.app.br como painel. Login no painel e destino ainda pendentes de conferência; domínio de envio/remetente não definidos por inferência.

24/10/2026 — Responsabilidades esclarecidas: Pedro executará manualmente as configurações externas. O agente consulta o inventário em leitura e ajuda com o roteiro, conforme a seção Infra de CLAUDE.md. A existência do painel Coolify foi confirmada; sua estrutura interna continua não inspecionada.
