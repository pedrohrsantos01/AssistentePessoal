# Proxy, TLS e origem confiável do cliente

Contrato de engenharia do recorte local 4B de REQ-NFR-004 e do rate limiting (Q32), definido antes da implementação. A referência de requisitos é [spec/07](../../specs/07-nao-funcionais-e-lgpd.md), com execução no [plano aprovado](../../.scratch/recuperacao-operacional/spec.md).

## Fronteira de confiança

A topologia inicial tem uma única borda Traefik/Coolify e uma única API. O cliente termina TLS na borda; API e PostgreSQL permanecem sem portas publicadas no host. A API conserva o peer TCP: `server.forward-headers-strategy=none`. Cabeçalhos nunca alteram esquema, host ou geração de URLs; recuperação usa `RITMO_PUBLIC_ORIGIN` explícito.

`RITMO_TRUSTED_PROXY_PEERS` é uma lista separada por vírgulas de IPs literais exatos do proxy na rede privada da API. O padrão vazio confia em ninguém. Não aceita CIDR, DNS, portas nem zonas IPv6. Entrada inválida ou estratégia de encaminhamento genérica diferente de `none` impede o startup. Também são proibidos server.tomcat.remoteip.remote-ip-header e server.tomcat.remoteip.protocol-header não vazios: no Boot 4.1.1, esses parâmetros podem instalar RemoteIpValve mesmo com estratégia none. A lista não equivale a permitir acesso de toda uma rede Docker.

Somente quando o peer TCP pertence à lista a API usa um único `X-Forwarded-For` com um único IP literal. IPv4 e IPv6 são normalizados, inclusive IPv4 mapeado em IPv6. Cabeçalho ausente, repetido, encadeado ou inválido usa o peer TCP e seu orçamento agregado; nunca gera um identificador arbitrário. `Forwarded`, `X-Real-IP`, corpo, e cabeçalhos de esquema/host não influenciam a quota. O IP vive somente no mapa RAM já limitado de Bucket4j; não se adicionam logs ou persistência.

Na borda pública, `forwardedHeaders.insecure=false`, sem `trustedIPs` externos e sem PROXY protocol. Traefik elimina os valores de encaminhamento fornecidos pelo cliente e envia a origem observada. A confiança da API no peer do proxy só é segura com essa sanitização e com a ausência de bypass público. CDN, balanceador adicional ou outro proxy exigem nova avaliação antes de ativação.

## TLS e disponibilidade

HTTPS aceita TLS 1.2 ou superior, certificado válido para o domínio e cadeia confiável. HTTP do domínio conhecido redireciona para HTTPS; host desconhecido não recebe rota de API. HSTS na borda: `max-age=31536000`, sem `includeSubDomains` ou preload até validar os demais subdomínios. O proxy aplica HSTS também às respostas de erro, rate limiting e quarentena. Certificados/ACME de produção continuam gerenciados pelo Coolify.

O pacote de referência usa deadlines finitos: leitura de requisição 30 s, resposta 35 s, conexão com backend 5 s e espera dos headers do backend 25 s. O JDBC usa conexão 5 s/socket 10 s. Antes de produção, estes valores exigem confronto com latência medida e espera por confirmação WAL; nunca se desliga a garantia WAL para satisfazer o proxy. Não ativar retry automático de POST no proxy.

502/504 ou conexão interrompida não provam rejeição da escrita. O app mantém a intenção e a mesma identidade idempotente para sincronização posterior. Quarentena continua retornando 503 antes dos filtros de domínio. A confiança no proxy não remove autenticação, quota por conta, regras de compatibilidade ou proteção WAL.

## Evidência local e ativação externa

A prova deve atravessar TLS real, proxy real e JAR empacotado, com PostgreSQL real: clientes distintos conservam quotas independentes; forjar headers não muda a quota; 429 preserva Retry-After; quarentena preserva 503; certificado não confiável é recusado. Provas HTTP adicionais cobrem formas IPv6 equivalentes, cabeçalhos ambíguos e configuração inválida.

Artefatos locais não autorizam alterações nas VPS. A ativação externa requer medir o peer de fato observado, registrar a rede e verificar firewall/portas Docker, aplicar os trechos no proxy já gerenciado pelo Coolify, validar DNS/ACME/HSTS e executar os mesmos ataques via Internet. Atualização/recriação do proxy exige rever a lista antes de liberar tráfego.

Referências primárias consultadas em 03/10/2026: [forwarded headers/entrypoints](https://doc.traefik.io/traefik/reference/install-configuration/entrypoints/), [implementação da sanitização v3.6.2](https://github.com/traefik/traefik/blob/v3.6.2/pkg/middlewares/forwardedheaders/forwarded_header.go), [headers/HSTS](https://doc.traefik.io/traefik/reference/routing-configuration/http/middlewares/headers/), [proxy do Coolify](https://coolify.io/docs/core/networking/proxy/traefik/overview).

Procedimento concreto para a instalação futura: [ativação no Coolify e provas externas](proxy-activation.md). Os [fragmentos estático](../deploy/proxy/traefik-static.example.yml) e [dinâmico](../deploy/proxy/ritmo-dynamic.example.yml) são usados pela fixture; o segundo contém somente certificado descartável de teste, substituído pelo ACME já gerenciado na instalação real.
