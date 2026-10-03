# Ativação de proxy/TLS no Coolify — procedimento para o ensaio externo

Este procedimento concretiza [proxy-tls.md](proxy-tls.md) e o [caderno de provisionamento](external-provisioning.md). Foi preparado localmente. A VPS/Coolify de Pedro não foi acessada. Os nomes de routers, redes e caminhos dependem da instalação efetiva.

## Preparação isolada

1. Registrar versão efetiva do Coolify/Traefik, domínio escolhido, rede privada API–proxy–PostgreSQL e versão da imagem da API. A fixture usa Traefik v3.6.2 por digest; isso não determina qual versão estará instalada na VPS.
2. Manter a API em quarentena, WAL obrigatório e banco/API sem publicação de portas no host. Conferir tanto firewall quanto os bindings Docker: uma regra UFW isolada não comprova bloqueio de portas publicadas por Docker. Somente a borda atende 80/443. A rede da API deve conter apenas componentes autorizados.
3. No recurso da API, configurar o domínio HTTPS pelo Coolify e conservar o resolver ACME já gerenciado por ele. Verificar cadeia, SAN e renovação; não instalar o certificado descartável da fixture.
4. Conferir os entrypoints da borda: `forwardedHeaders.insecure=false`, sem `trustedIPs` de clientes externos e sem PROXY protocol. Os [exemplos](../deploy/proxy/traefik-static.example.yml) mostram o contrato; mesclar os campos necessários, preservando configuração, rotas e resolvers existentes. Mudanças globais de entrypoint exigem revisar o efeito sobre outros recursos do painel. A fixture chama os entrypoints web/websecure; a documentação atual do Coolify usa http/https: empregar os nomes efetivamente renderizados na instalação.

## Rota e peer confiável

Usar o [fragmento dinâmico](../deploy/proxy/ritmo-dynamic.example.yml) como referência. Trocar host/backend fictícios, remover somente o bloco `tls.certificates` da fixture e conservar o ACME da rota existente. Integrar `ritmo-security`, `ritmo-https`, `ritmo` serversTransport e a opção TLS `ritmo` ao provider file utilizado na instalação. Não substituir o proxy inteiro nem criar routers concorrentes com os gerados pelo Coolify. A documentação atual indica /data/coolify/proxy/dynamic/ no host e /traefik/dynamic/ no proxy; conferir esses mounts no painel antes de preparar o arquivo. Manter o provider directory do Coolify: o filename /etc/traefik/dynamic/ritmo.yml do exemplo é exclusivo da fixture.

Se aplicar por labels ao router já existente, preservar a lista de middlewares existente e acrescentar `ritmo-security@file`; selecionar `ritmo@file` como opção TLS e o serversTransport correspondente no serviço. O nome exato do router/service vem da configuração renderizada no painel. O router HTTP deve redirecionar o domínio conhecido, sem encaminhar POSTs em claro à API. Não ativar retry automático de escritas.

Identificar o IP exato do proxy na mesma rede da API, usando os metadados Docker da instalação. Conferir também o peer de uma conexão real no namespace de rede da API, por `ss`/inspeção administrativa, com uma chamada de ensaio e sem habilitar logs de IP ou conteúdo. Anotar apenas a referência privada ao inventário; não publicar endereços reais neste repositório.

Definir `RITMO_TRUSTED_PROXY_PEERS` somente com esses literais e manter `SERVER_FORWARD_HEADERS_STRATEGY=none`. Remover parâmetros server.tomcat.remoteip.remote-ip-header/protocol-header: eles também instalam encaminhamento genérico e são recusados pelo pacote, mesmo com estratégia none. Não usar toda a faixa RFC1918/Docker nem usar o endereço público resolvido para o domínio como peer do proxy. Se a borda for recriada com outro IP, atualizar a configuração da API e repetir a prova antes de retirar quarentena. IPs reutilizáveis numa rede compartilhada não estabelecem identidade criptográfica: o isolamento e o controle administrativo dessa rede são parte da garantia.

CDN/Cloudflare proxy habilitado, load balancer ou outro salto mudam o peer e a cadeia. O pacote inicial recusa cadeias XFF; não adicionar esses saltos sem um novo contrato de sanitização e provas.

## Aceite antes de liberar

Executar do lado externo, em clientes/origens realmente distintos:

- HTTP do domínio redireciona para HTTPS e host desconhecido não alcança uma rota da API.
- Certificado/cadeia/hostname válidos; TLS 1.2/1.3 e HSTS de um ano, inclusive nas respostas 401/429/503. Não usar `-k` nem desativar verificação.
- API/PG não são alcançáveis diretamente; tentar portas IPv4 e IPv6 a partir de fora. Conferir redes/portas após redeploy e reboot.
- Cliente A esgota sua quota; modificar XFF, Forwarded, X-Real-IP, host/proto encaminhados e envio repetido de headers não devolve tokens. Cliente B conserva sua quota; 429 tem Retry-After e JSON do contrato.
- Quarentena mantém 503; liberar apenas para o ensaio depois de comprovar todos os gates. Por TLS, testar também recusa de confirmações sem receptor e recuperação da conexão, mantendo a mesma intenção no app.
- Medir latência e espera WAL sob falha para confrontar os deadlines de proxy/JDBC. Provar resultado incerto sem descartar/reidentificar intenções no SQLite. O ensaio local não mede esse orçamento no provedor.
- Registrar evidência sanitizada, versão/configuração e referência aos certificados/segredos no cofre. Não copiar chaves, tokens, IPs de clientes nem conteúdo de requisições.

Se falhar sanitização, bypass, peer, TLS ou WAL, manter quarentena/isolar a API e corrigir antes de novo ensaio. Retirar um IP da allowlist faz a API voltar ao orçamento agregado do peer; isso não autoriza desligar quotas ou confiar genericamente em headers.

Contratação, aplicação destas configurações, DNS/ACME e exposição externa continuam na etapa 4C/4D.

Referência primária: [Traefik gerenciado pelo Coolify](https://coolify.io/docs/core/networking/proxy/traefik/overview), consultada em 03/10/2026. A versão instalada 4.3.23 foi informada por Pedro e ainda não foi inspecionada.
