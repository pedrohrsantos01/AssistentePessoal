# Hostinger Connector — conexão e inventário verificados

23/10/2026. Consulta autenticada pelo MCP, após registro dos módulos do Hostinger Connector e retomada da sessão. Resultado: conexão confirmada por respostas reais de hospedagens, VPS, domínios e assinaturas. Nenhum recurso da conta foi alterado.

## Recursos observados

| Área | Resultado da API |
|---|---|
| VPS | Uma KVM 2 em execução: 2 vCPU, 8 GB de RAM e 100 GB de disco; template Ubuntu 24.04 LTS |
| Hospedagem | Um plano Business Web Hosting ativo; a API identifica o plano como hostinger_business_v4 |
| Sites | Cinco entradas habilitadas em subdomínios hostingersite.com: quatro classificadas como other e uma como horizons. Habilitado não comprova prontidão ou resposta HTTP |
| Domínios | Dois nomes distintos ativos: phsdev.cloud e phsdev.com. O portfólio também contém entradas free_domain para esses mesmos nomes; não são quatro domínios diferentes |
| Assinaturas | KVM 2, Business Web Hosting, .CLOUD Domain e .COM Domain ativos; Reach 100 e Starter Business Email retornaram in_trial |

Os detalhes de ambos os domínios informam vencimento em 26/05/2027. Nameservers registrados: cosmos.dns-parking.com / nova.dns-parking.com para phsdev.cloud; horizon.dns-parking.com / orbit.dns-parking.com para phsdev.com. Não foi consultada a zona efetiva nem alterado qualquer registro.

## Consultas e limites

Operações de leitura bem-sucedidas: hosting_websites_list, hosting_orders_list, vps_virtual-machines_list, domains_portfolio_list, domains_portfolio_get para os dois nomes e billing_subscriptions_list. A paginação de hospedagens encerrou na primeira página: cinco sites e um plano.

A operação vps_docker_list retornou HTTP 400: `[VPS:2044] Currently installed operating system does not support Docker Manager.` A limitação é do Docker Manager da Hostinger. Ela não demonstra ausência de Docker, Coolify ou aplicações na VPS. A estrutura de projetos do Coolify, sua versão, ocupação atual da máquina, região efetiva, portas, backups e capacidade livre não foram verificados.

Cloudflare e R2 não foram consultados. O conector Hostinger não comprova acesso à conta Cloudflare; os nameservers acima são apenas os informados pelo registrador para estes dois domínios. Nenhum contato WHOIS, credencial, IP, identificador de conta ou configuração privada foi copiado para este relatório.

## Implicação para o Ritmo

Há recursos existentes candidatos à hospedagem, mas nenhum foi reservado para o Ritmo. A escolha do domínio/subdomínio do ensaio permanece com Pedro; domínio disponível na conta não significa autorização para apontá-lo ou alterar serviços existentes. A [tarefa humana de domínio e Resend](../../.scratch/aceite-m1/issues/02-preparar-dominio-e-resend.md) continua aberta; o status de verificação no Resend não foi consultado.

O próximo levantamento deve conferir o Coolify e a capacidade efetiva antes de propor a configuração concreta. O [roteiro HTTPS/iPhone](../../web/ops/https-iphone.md) continua válido: origem única, ambiente sintético isolado e TLS público aprovado antes do ensaio físico02c. Não houve deploy, contratação, envio de e-mail, aceite do iPhone ou liberação da jornada03.
