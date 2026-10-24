# Domínio escolhido para a PWA — phsdev.cloud

24/10/2026. Pedro escolheu **phsdev.cloud** para testar e usar a versão PWA do Ritmo. Pedro também confirmou o subdomínio: **https://ritmo.phsdev.cloud**, com a API em /api na mesma origem. A escolha do endereço está fechada. Não houve publicação ou alteração de DNS.

## Estado verificado

O Hostinger Connector retornou domínio Active, vencimento em26/05/2027 e nameservers cosmos.dns-parking.com / nova.dns-parking.com. A consulta pública NS confirmou esses mesmos servidores.

A zona retornada pela Hostinger contém um MX no nome @, prioridade10, destino phsdev.cloud. A consulta pública MX confirmou esse destino; consultas A/AAAA ao domínio raiz não retornaram endereços. Isso descreve o DNS observado, sem certificar o funcionamento das caixas de e-mail ou afirmar que o domínio esteja livre de dependências.

Fontes de leitura: domains_portfolio_get e dns_records_list para phsdev.cloud; Resolve-DnsName com NS/A/AAAA/MX. Nenhum IP, credencial, contato WHOIS ou identificador privado foi copiado para este relatório.

## Endereço confirmado

Pedro respondeu **ritmo.phsdev.cloud — subdomínio para PWA e API**, conforme Q67. O subdomínio permite apontar a aplicação sem mudar a resolução do destino do MX atual. A alternativa do domínio raiz não foi escolhida.

O cliente técnico usará https://ritmo.phsdev.cloud/ensaio/ e a API https://ritmo.phsdev.cloud/api/, na mesma origem. O manifest técnico não vira manifest do produto. Recuperação por /password-reset e parâmetros RITMO_WEB_ORIGIN/RITMO_PUBLIC_ORIGIN devem usar a origem exata confirmada, preservando os contratos existentes. Nenhum valor de runtime foi gravado nesta etapa.

## Próximas dependências

Pedro esclareceu que fará manualmente a configuração. A consulta do agente serve para identificar o inventário e ajudar a preparar o roteiro; não inclui executar DNS, provisionamento ou deploy. A existência do Coolify foi confirmada pela tela de login no endereço informado. Seus projetos e recursos internos ainda não foram visualizados.

- Reutilizar o domínio registrado e o subdomínio confirmado, sem nova compra.
- Coolify informado por Pedro: https://coolify.continuumcare.app.br. O painel abriu na tela de login; faltam sessão autenticada, inspeção dos projetos, servidor/destino e capacidade efetiva.
- Preparar DNS/roteamento/TLS somente com o destino e os recursos concretos conferidos, preservando os registros existentes. Não trocar nameservers ou usar reset da zona.
- Escolher/verificar domínio de envio e remetente no Resend; a escolha da PWA não define esses parâmetros.
- Pedro publicará manualmente o ambiente sintético e executará02c no Safari/Tela de Início, com acompanhamento das provas. Jornada03, uso diário e M1 permanecem com seus gates.

Referências: [tarefa humana de domínio](../../.scratch/aceite-m1/issues/02-preparar-dominio-e-resend.md), [roteiro HTTPS/iPhone](../../web/ops/https-iphone.md), [guia de domínio/Resend](../../api/ops/domain-and-email-setup.md) e [spec/14](../../specs/14-pwa-primeiro-marco.md).
