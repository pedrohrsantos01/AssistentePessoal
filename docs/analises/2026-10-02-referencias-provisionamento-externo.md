# Referências para provisionamento externo — 02/10/2026

Pesquisa do recorte 4 de REQ-NFR-004, sem implantação ou contratação externa. Fontes primárias consultadas nesta data; documentos web de Coolify, Docker e systemd podem acompanhar versões diferentes das instaladas. A versão efetiva de cada host deve ser registrada antes de aplicar configuração.

Contrato do projeto: [spec/07 §2.2/4](../../specs/07-nao-funcionais-e-lgpd.md), [ADR-019](../adr/0019-recuperacao-operacional-sem-perda-de-confirmacoes.md), [WAL](../../api/ops/wal-recovery.md) e [ciclo operacional](../../api/ops/operations.md). Q33–Q43 estão aprovadas. Em Q44, Pedro informou o primário existente: Hostinger em Campinas/SP, 2 vCPU, 8 GB RAM, 100 GB de disco, Ubuntu 24.04 e Coolify 4.3.23. São informações do usuário; esta pesquisa não inspecionou o host. A release [Coolify v4.3.23](https://github.com/coollabsio/coolify/releases/tag/v4.3.23) existe no repositório oficial, mas sua existência não valida a configuração instalada. Em Q45, Pedro informou não ter teto e pediu comparação de abordagens e custos. Em Q47, Pedro aprovou o perfil A enxuto como referência, com prioridade para artefatos locais e contratação/orçamento final adiados; pediu também comparar uma segunda VPS Hostinger e Cloudflare R2. O storage existente informado não foi inspecionado e sua capacidade/configuração não foi confirmada. Em Q48, escolheu Bitwarden Free hospedado pelo fornecedor. A infraestrutura do receptor/detector e a configuração efetiva de SMTP/cofre continuam sem provisionamento. Esta pesquisa não modifica os contratos nem autoriza contratação.

## Build Java e contexto do repositório

Coolify oferece build por Dockerfile de repositório Git. Base Directory determina o contexto; Dockerfile Location é relativo a ele. Para o Ritmo, o contexto precisa conter `api/` e `contracts/`, pois `api/build.gradle` inclui `../contracts/primeiro-marco/openapi.json` em `processResources`. A combinação a ensaiar é contexto na raiz do repositório e Dockerfile em `api/Dockerfile`, equivalente ao build local `docker build -f api/Dockerfile .`. Um Dockerfile avulso na UI, sem Git, não recebe esses arquivos. O processo deve ouvir em `0.0.0.0` na porta interna declarada. [Coolify: Dockerfile](https://coolify.io/docs/applications/builds/dockerfile).

`COPY` acessa arquivos dentro do contexto Docker; posicionar o Dockerfile em `api/` não muda essa fronteira. Portanto, `COPY ../contracts` com contexto limitado a `api/` não resolve o monorepo. `.dockerignore` deve excluir segredos e artefatos locais sem excluir o contrato necessário ao jar. [Docker: contexto de build](https://docs.docker.com/build/concepts/context/).

Adoptium publica Eclipse Temurin como imagem oficial, com variantes JDK e JRE por versão Java e sistema base. O manifesto oficial consultado lista `eclipse-temurin:21-jdk-noble` e `eclipse-temurin:21-jre-noble`, inclusive amd64 e arm64. São candidatos compatíveis com a separação entre compilação Java 21 e execução do jar; não implicam escolher a distribuição Linux do host. Não usar o alias `latest` para selecionar Java. [Adoptium: containers](https://adoptium.net/installation/containers/), [manifesto oficial de tags](https://raw.githubusercontent.com/docker-library/official-images/master/library/eclipse-temurin).

Tags são mutáveis; um digest identifica a imagem para repetição posterior. Registrar digest e arquitetura do build efetivamente ensaiado e atualizar deliberadamente após novos checks. A pesquisa confirma a existência das tags, mas não prova pull, build ou execução delas. [Docker: versões de imagens](https://docs.docker.com/build/building/best-practices/).

## Coolify, API e PostgreSQL

Em Docker Compose normal, Coolify cria rede por recurso; serviços comunicam por nome e porta interna. Comunicação com outro recurso no destino pode exigir Connect To Predefined Network e conferir o nome gerado. Raw Compose atribui ao operador os labels de proxy e a rede que o fluxo normal geraria. A API pode usar o proxy sem publicar sua porta no host; `ports:` permite acesso que contorna esse proxy. [Coolify: Compose e networking](https://coolify.io/docs/applications/builds/docker-compose).

Coolify também permite PostgreSQL como recurso separado no destino Docker. Conferir imagem PG18, rede interna, logins distintos e montagem real antes de iniciar. A opção Make it publicly available gera acesso TCP pelo endereço do servidor; ela não atende ao requisito do Ritmo de manter PostgreSQL fora da internet. O dump nativo usa `--no-acl --no-owner`, portanto não substitui automaticamente o ensaio de ACL/RLS e o ciclo próprio já implementado. [Coolify: PostgreSQL](https://coolify.io/docs/databases/postgresql).

A imagem oficial PG18 usa `PGDATA=/var/lib/postgresql/18/docker` e volume em `/var/lib/postgresql`. A montagem usual de PG17 em `/var/lib/postgresql/data` não deve ser copiada sem conferir a configuração. Scripts de init executam apenas em diretório de dados vazio; reiniciar após falha parcial não garante retomada dos scripts. [Imagem oficial PostgreSQL](https://hub.docker.com/_/postgres).

## TLS HTTP, HSTS e identidade do cliente

Domínio `https://` configurado no Coolify permite ao proxy integrado solicitar/renovar certificado. DNS e alcance das portas do proxy precisam corresponder ao recurso. Isso documenta a capacidade do produto, não comprova emissão, renovação ou TLS do PostgreSQL desta instalação. [Coolify: domínios](https://coolify.io/docs/core/networking/domains).

Se o proxy escolhido for Traefik, o middleware Headers oferece `stsSeconds` para HSTS e opções separadas de `includeSubDomains` e preload. O spec exige HSTS, mas não define a duração nem aprova preload ou efeitos em outros subdomínios. Definir a política do domínio e verificar o header HTTPS real antes da liberação; não inferir HSTS somente da existência de certificado. [Traefik: Headers](https://doc.traefik.io/traefik/reference/routing-configuration/http/middlewares/headers/).

Spring Boot 4.1.1 permite `server.forward-headers-strategy=NATIVE`, usando o servidor embarcado, ou `FRAMEWORK`, usando filtro do framework. A configuração atual do Ritmo é `none`; a identificação por IP não deve mudar até haver fronteira confiável. A propriedade `server.tomcat.remoteip.internal-proxies` configura essa confiança em modo nativo. Lista vazia pode confiar em todos e não é configuração de produção. [Spring Boot: proxy](https://docs.spring.io/spring-boot/4.1/how-to/webserver.html).

O lockfile local resolve Tomcat 11.0.24. Seu `RemoteIpValve` aceita CIDRs ou expressão regular e altera endereço/scheme com headers recebidos. O primeiro proxy confiável deve remover headers de origem não confiável utilizados pela valve; confiar genericamente em toda rede privada não é equivalente a confiar somente no proxy real. Registrar peers e cadeia efetivamente observados; vedar acesso direto ao listener da API por origens de clientes. [Fonte Tomcat 11.0.24](https://raw.githubusercontent.com/apache/tomcat/11.0.24/java/org/apache/catalina/valves/RemoteIpValve.java), [referência da valve](https://tomcat.apache.org/tomcat-11.0-doc/config/valve.html).

No Traefik, `forwardedHeaders.trustedIPs` controla a confiança nos encaminhamentos de um proxy anterior; `insecure=true` confia indiscriminadamente e é indicado apenas para testes. Essa configuração é distinta da confiança do Tomcat no peer Traefik. Sem CDN/load balancer aprovado, não acrescentar uma cadeia fictícia. Ensaiar pedidos com headers falsificados e dois IPs de origem antes de aceitar a quota por IP através do proxy, sem mudar Q32. [Traefik: EntryPoints](https://doc.traefik.io/traefik/reference/install-configuration/entrypoints/).

## Receptor em outro host sem publicar PostgreSQL

A rede Docker do primário, sozinha, não resolve conexão entre hosts. Inferência operacional: precisa existir rota privada autorizada do receptor ao primário, por rede privada do provedor ou túnel/VPN a decidir. WireGuard é um candidato documentado para interface e peers privados; sua presença não comprova isolamento, durabilidade nem substitui TLS/HBA do banco. Não foram escolhidos implementação, IPs ou portas do túnel. [WireGuard: Quick Start](https://www.wireguard.com/quickstart/).

Se houver publicação Docker para uma interface privada, indicar explicitamente o IP e restringir encaminhamento/firewall; publicar sem IP vincula a porta amplamente. Docker documenta que acesso roteado pode atravessar outra interface conforme o forwarding. UFW isoladamente não comprova a restrição, pois tráfego publicado por Docker pode passar antes de suas regras. Aceite: conexão do receptor pela rota privada funciona, enquanto sondagem pelas interfaces públicas IPv4/IPv6 falha. [Docker: publicação de portas](https://docs.docker.com/engine/network/port-publishing/), [Docker: firewalls](https://docs.docker.com/engine/network/packet-filtering-firewalls/).

PostgreSQL exige SSL habilitado com certificado/chave próprios. `hostssl` limita uma regra HBA a conexão TLS; a origem e o login devem ser restritos. O pseudo-banco `replication` corresponde a replicação física. Regras são avaliadas em ordem: uma regra ampla anterior pode tornar a restrição posterior inócua. Planejar regras também para base/dump/health conforme as conexões reais; não copiar uma regra única indiscriminada. [PG18: SSL no servidor](https://www.postgresql.org/docs/18/ssl-tcp.html), [PG18: HBA](https://www.postgresql.org/docs/18/auth-pg-hba-conf.html).

No receptor, usar `PGSSLMODE=verify-full` e CA confiável: valida cadeia e nome/IP do certificado. Certificado de nome diferente do host privado deve provocar falha, não troca por `prefer`/`require`. Coolify oferece configuração de SSL de banco e CA própria; conferir se seus certificados incluem o nome privado selecionado antes de adotá-los. [PG18: libpq SSL](https://www.postgresql.org/docs/18/libpq-ssl.html), [Coolify: Database SSL](https://coolify.io/docs/databases/ssl).

`pg_receivewal --synchronous` faz flush e envia feedback imediatamente; sem isso, a gravação pode aguardar fechamento do segmento. Com sincronismo, a rota e o disco independentes participam da latência de confirmação. A base usa conexão de replicação e `--wal-method=stream` exige conexão adicional. Conferir slots/senders e separar identidade `ritmo_base` de `ritmo_wal`, conforme o runbook existente. [PG18: pg_receivewal](https://www.postgresql.org/docs/18/app-pgreceivewal.html), [PG18: pg_basebackup](https://www.postgresql.org/docs/18/app-pgbasebackup.html).

## Candidatos de supervisão e agenda Linux

systemd é candidato a supervisor do receptor e a serviços finitos de tick/monitor, sem escolha de distribuição/versão. O manual oferece serviço em foreground sem PID file e restart por falha. Usar identidade do processo/unidade/cgroup verificada no adaptador de `receiver-state`; um PID isolado não atende ao runbook. [systemd: serviço](https://raw.githubusercontent.com/systemd/systemd/main/man/systemd.service.xml).

`KillMode=control-group` encerra processos remanescentes da unidade. A parada planejada e a inibição de novos starts/restarts devem ser ensaiadas antes do freeze; configuração de restart, sozinha, não comprova ausência do receptor durante a cópia. [systemd: encerramento](https://raw.githubusercontent.com/systemd/systemd/main/man/systemd.kill.xml).

Timers não iniciam outra instância de uma unidade já ativa. `Persistent=true` recupera acionamento perdido somente em timer OnCalendar; `AccuracySec` tem tolerância padrão de um minuto. Calibrar agenda/probe para Q38/Q42 e medir atrasos reais. O estado durável do `tick` continua sendo a autoridade sobre ciclo diário e execução incerta; timer não substitui essa lógica. [systemd: timers](https://raw.githubusercontent.com/systemd/systemd/main/man/systemd.timer.xml).

Coolify Scheduled Tasks é outro candidato para jobs dentro de containers: usa cron de cinco campos, timezone do servidor e timeout; perde execução quando recurso/host não está funcional. Não usar a agenda do primário como única prova externa de backups/alertas. Monitor deve continuar fora dos hosts do primário e receptor conforme o ciclo aprovado. [Coolify: Scheduled Tasks](https://coolify.io/docs/core/automation/scheduled-tasks/overview).

## Custos e candidatos regionais — 02/10/2026

Os valores das comparações Lightsail, Akamai, Vultr e DigitalOcean são recorrência mensal de catálogo em USD, sem créditos, cupons ou promoções de entrada. A comparação Hostinger adicional registra separadamente promoção e renovação em BRL. Não são uma cotação contratada. Disponibilidade publicada de região/plano não reserva capacidade na conta nem comprova a latência entre provedores. O primário Hostinger já informado não entra nos totais incrementais; seu custo, período contratado e renovação não foram consultados.

### Receptor de WAL e backups em São Paulo

O receptor precisa de clientes PostgreSQL 18, Python e disco para os artefatos; não exige outra instância completa de PostgreSQL. Estas são opções de catálogo para investigar, sem promessa de adequação ao volume real:

| Candidato regional | RAM / vCPU | Disco incluído | Transferência mensal em SP | USD/mês | Fonte oficial |
| --- | --- | --- | --- | --- | --- |
| Lightsail Linux com IPv4, `sa-east-1` | 1 GB / 2 | 40 GB SSD | 1 TB | 7,00 | [Preço](https://aws.amazon.com/lightsail/pricing/), [região](https://docs.aws.amazon.com/lightsail/latest/userguide/understanding-regions-and-availability-zones-in-amazon-lightsail.html), [franquia regional](https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-faq-data-transfer-allowance.html) |
| Lightsail Linux com IPv4, `sa-east-1` | 2 GB / 2 | 60 GB SSD | 1,5 TB | 12,00 | [Preço](https://aws.amazon.com/lightsail/pricing/), [franquia regional](https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-faq-data-transfer-allowance.html) |
| Akamai/Linode Nanode, São Paulo | 1 GB / 1 | 25 GB | 1 TB | 7,00 | [Tabela específica de São Paulo](https://www.akamai.com/cloud/pricing/sao-paulo) |
| Akamai/Linode, São Paulo | 2 GB / 1 | 50 GB | 2 TB | 16,80 | [Tabela específica de São Paulo](https://www.akamai.com/cloud/pricing/sao-paulo) |
| Vultr `vc2-1c-1gb`, `sao` | 1 GB / 1 | 25 GB | 1.024 GB | 5,00 | [Catálogo público de planos](https://api.vultr.com/v2/plans?type=vc2), [regiões](https://api.vultr.com/v2/regions) |
| Vultr `vc2-1c-2gb`, `sao` | 2 GB / 1 | 55 GB | 2.048 GB | 10,00 | [Catálogo público de planos](https://api.vultr.com/v2/plans?type=vc2) |
| Vultr `vhp-1c-1gb-amd` ou `-intel`, `sao` | 1 GB / 1 | 25 GB | 2.048 GB | 6,00 | [Catálogo público de planos](https://api.vultr.com/v2/plans?type=vhp) |
| Vultr `vhp-1c-2gb-amd` ou `-intel`, `sao` | 2 GB / 1 | 50 GB | 3.072 GB | 12,00 | [Catálogo público de planos](https://api.vultr.com/v2/plans?type=vhp) |

No Vultr, o site de preços não pôde ser lido, mas os endpoints públicos oficiais retornaram estes planos e `sao` em suas localizações nesta consulta, sem autenticação. A região retornou `block_storage_storage_opt`, sem `block_storage_high_perf`. Não tratar isso como disponibilidade de volume NVMe em São Paulo; confirmar configuração, preço final e capacidade no console antes de contratar. [Regiões Vultr](https://api.vultr.com/v2/regions).

### Armazenamento durável e orçamento

Lightsail anuncia volume SSD adicional por US$0,10/GB/mês: 100 GB = US$10 e 160 GB = US$16. O volume pode sobreviver à exclusão da instância, ao contrário do disco raiz, e tem replicação dentro da zona de disponibilidade. Isso não o torna uma cópia em outro provedor/zona. [Preço de volumes](https://aws.amazon.com/lightsail/pricing/), [comportamento de discos](https://aws.amazon.com/lightsail/faq/).

Akamai publica US$0,14/GB/mês em São Paulo; por exemplo, 80 GB adicionais custam US$11,20 e 160 GB custam US$22,40. Não aplicar os US$5 do Nanode global nem tarifas globais de armazenamento à região SP. [Preço regional](https://www.akamai.com/cloud/pricing/sao-paulo).

Vultr anuncia Block Storage HDD por US$25/TB/mês e NVMe por US$100/TB/mês. Essa página não confirma oferta regional NVMe em SP. O preço menor do HDD não comprova capacidade de `fsync` adequada ao caminho síncrono; não foi incluído nos perfis recomendados abaixo. [Datasheet oficial](https://discover.vultr.com/block-storage-datasheet).

Inferência para o runbook: usar disco de bloco montado em filesystem Linux POSIX com `fsync` e comportamento de falha ensaiados. O receptor deve dar flush durável antes de confirmar; bucket S3 ou montagem de object storage não substitui essa condição apenas por existir. [PG18: `pg_receivewal --synchronous`](https://www.postgresql.org/docs/18/app-pgreceivewal.html). Dimensionar a janela de 30 dias com tamanho das bases/dumps, taxa real de WAL, âncora necessária, cópias congeladas/orphans e margem do filesystem. Os 100 GB informados do primário não representam automaticamente 100 GB de banco nem definem a capacidade necessária do receptor.

### Detector em um terceiro host/provedor

Para um detector enxuto separado de Hostinger e AWS, a DigitalOcean lista os seguintes **Basic Regular Bundled Plans**, com IPv4 incluído sem cobrança adicional. Não aplicar esses totais à família v5, que tem outra estrutura de preço. [Preços de Droplets](https://www.digitalocean.com/pricing/droplets).

| Detector candidato | RAM / vCPU | Disco / transferência | USD/mês |
| --- | --- | --- | --- |
| Basic Regular Bundled | 512 MiB / 1 | 10 GiB SSD / 500 GiB | 4,00 |
| Basic Regular Bundled | 1 GiB / 1 | 25 GiB SSD / 1.000 GiB | 6,00 |

A lista oficial consultada não inclui região brasileira; NYC3 é um candidato publicado, sujeito à disponibilidade na conta. O detector fica fora do caminho síncrono da confirmação de dados; sua região pode ser diferente da do receptor. [Disponibilidade regional DigitalOcean](https://docs.digitalocean.com/platform/regional-availability/). A opção de 512 MiB requer ensaio de memória/disco do sistema, Python, transporte privado e monitor. Não instalar API, PostgreSQL completo ou Coolify nesse candidato apenas por aproveitar o host.

**Compatibilidade de email ainda precisa de ensaio.** DigitalOcean bloqueia SMTP 25, 465 e 587 nos Droplets, inclusive por Reserved IP; portanto não propor detector DO com saída pela porta 587. [Restrição oficial](https://docs.digitalocean.com/support/why-is-smtp-blocked/). Resend documenta `smtp.resend.com` e STARTTLS nas portas 587 e 2587; a 2587 é candidata para este detector, mas a documentação não prova que a conexão será permitida na conta nem que haverá entrega. [SMTP Resend](https://resend.com/docs/send-with-smtp). Verificar termos aplicáveis, conexão TLS e entrega real antes de instalar; se não viável, selecionar outro host/transporte autorizado. Não usar túnel para contornar a restrição SMTP do provedor.

### Dois perfis para decisão

| Perfil proposto, sem contratação | Receptor Lightsail SP com IPv4 | Volume adicional | Detector DO Basic Bundled | Incremento mensal |
| --- | --- | --- | --- | --- |
| A — referência local aprovada em Q47, sujeita à medição | 1 GB RAM / 40 GB SSD: US$7 | 100 GB: US$10 | 512 MiB / 10 GiB: US$4 | **US$21** |
| Mais capacidade, sujeita à medição | 2 GB RAM / 60 GB SSD: US$12 | 160 GB: US$16 | 1 GiB / 25 GiB: US$6 | **US$34** |

São somas dos preços regulares de [Lightsail/volumes](https://aws.amazon.com/lightsail/pricing/) e [DO Bundled](https://www.digitalocean.com/pricing/droplets), sem promoção e sem acrescentar IPv4 separado. Em Lightsail, IP estático associado não tem custo adicional; deixá-lo desassociado por mais de uma hora tem cobrança. Instâncias paradas continuam sendo cobradas. [FAQ de cobrança Lightsail](https://aws.amazon.com/lightsail/faq/). Q47 aprovou o perfil A como referência para preparar os artefatos locais; contratação e orçamento final ficaram para depois. Nenhum perfil foi provisionado ou testado externamente: RAM, capacidade dos backups, latência da barreira e SMTP são condições de aceite, não consequências do preço.

Os totais não incluem Hostinger, SMTP/cofre eventualmente pagos, impostos, câmbio/spread/taxas de pagamento, tráfego excedente, snapshots opcionais ou máquina temporária de ensaio/restore. Preços de serviço não determinam a tributação da conta; a Akamai explicita valores sem impostos e a DigitalOcean documenta cobrança conforme localização. [Tributos Akamai](https://techdocs.akamai.com/cloud-computing/docs/tax-information), [tributos DO](https://docs.digitalocean.com/platform/billing/taxes/).

Em São Paulo, Lightsail concede **metade** da franquia global: 1 TB no perfil US$7 e 1,5 TB no US$12. Entrada e saída consomem a franquia; somente saída excedente é cobrada, por **US$0,15/GB** em SP. Assim, 100 GB de saída além da franquia acrescentariam US$15. [Transferência Lightsail por região](https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-faq-data-transfer-allowance.html). Excesso de saída: DO US$0,01/GiB; Akamai SP US$0,007/GB; Vultr US$0,01/GB. As unidades e franquias não devem ser igualadas sem conferir a fatura. [DO](https://docs.digitalocean.com/platform/billing/bandwidth/), [Akamai SP](https://www.akamai.com/cloud/pricing/sao-paulo), [Vultr](https://docs.vultr.com/support/platform/billing/what-is-the-bandwidth-overage-rate).

Pendências externas, adiadas por Q47: orçamento final e seleção/contratação do receptor/detector; acesso ao ambiente existente; rota privada/TLS; capacidade calculada e medida; permissão de saída SMTP e entrega real; configuração do cofre Bitwarden Free já escolhido em Q48; faturamento e disponibilidade na conta. Não houve contratação, configuração ou publicação.

## Comparação adicional pedida em Q47: Hostinger e Cloudflare R2

Esta comparação informa a decisão futura. O trabalho autorizado primeiro é preparar artefatos locais; não instalar uma segunda VPS, criar bucket, enviar backups ou configurar o cofre a partir destas referências.

### Segunda VPS Hostinger no Brasil

O catálogo brasileiro atual anuncia os preços abaixo. O valor por mês é equivalente do período contratado; a página informa pagamento integral, com possibilidade de parcelamento em até 12 vezes. A renovação publicada é a cada dois anos. [VPS Hostinger Brasil](https://www.hostinger.com/br/servidor-vps).

| Plano adicional candidato | vCPU / RAM | Disco NVMe / transferência | Promoção, BRL/mês equivalente | Renovação, BRL/mês equivalente |
| --- | --- | --- | --- | --- |
| KVM 1 | 1 / 4 GB | 50 GB / 4 TB | R$29,99 | R$59,99 |
| KVM 2 | 2 / 8 GB | 100 GB / 8 TB | R$43,99 | R$77,99 |

A indexação da página oficial [Opengist/VPS](https://www.hostinger.com/br/vps/docker/opengist) explicita campanha de **24 meses**: R$719,76 no KVM 1 e R$1.055,76 no KVM 2. Esse texto indexado é mais antigo que a página geral consultada hoje; confirmar o prazo promocional e o total no checkout na etapa futura de orçamento. Se mantidos 24 meses na renovação publicada, o cálculo é R$1.439,76 e R$1.871,76, respectivamente. Não tratar os valores de promoção como recorrência permanente nem o preço riscado como a renovação. [Preços atuais e renovação](https://www.hostinger.com/br/servidor-vps).

O catálogo não representa a fatura da conta: confirmar impostos, eventuais extras, validade da promoção e condição de renovação antes da contratação futura. Os valores em BRL não foram convertidos para USD nem somados ao perfil A, cujo provedor do receptor continua uma proposta. [Catálogo brasileiro](https://www.hostinger.com/br/servidor-vps).

Hostinger publica VPS no Brasil, França, Alemanha, Lituânia, Reino Unido, Índia, Indonésia, Malásia e EUA (Phoenix/Boston). A lista final depende da capacidade exibida no painel; a localização da VPS fica fixada após o setup, com mudança por backup/reinstalação. A fonte não especifica uma segunda zona brasileira nem confirma Campinas para uma futura VPS; Campinas/SP permanece o local do primário informado por Pedro. [Regiões oficiais](https://www.hostinger.com/support/1583267-where-are-hostinger-servers-located/).

**Duas VPS não comprovam dois hosts físicos.** A documentação KVM admite recursos separados mesmo quando as VPS compartilham o host. Inferência para o Ritmo: duas ordens, dois IPs ou duas instalações Linux no mesmo datacenter não bastam para demonstrar sobrevivência à perda do host físico primário. Exigir evidência de separação/posicionamento antes de aceitar uma segunda VPS Hostinger como receptor; esta pesquisa não encontrou garantia pública de anti-afinidade física no produto. [Virtualização KVM Hostinger](https://www.hostinger.com/support/6988144-what-is-kvm-virtualization-at-hostinger/). Outro país pode separar o local físico, mas latência do caminho síncrono e dependência do mesmo fornecedor precisam ser avaliadas; nenhuma região foi escolhida.

Os limites são por plano, incluindo um IPv4/IPv6; recursos individuais não podem ser ampliados separadamente, segundo a documentação. Assim, não presumir volume extra barato para transformar os 50 GB do KVM 1 em uma janela de backups de 30 dias; calcular o armazenamento real antes de escolher o plano. [Parâmetros oficiais Hostinger](https://www.hostinger.com/support/6976044-parameters-and-limits-of-hosting-plans-in-hostinger/).

### R2: custos de cópias auxiliares

| Cobrança em USD | Standard | Infrequent Access |
| --- | --- | --- |
| Armazenamento por GB-mês | 0,015 | 0,01 |
| Operações A por milhão | 4,50 | 9,00 |
| Operações B por milhão | 0,36 | 0,90 |
| Recuperação por GB | sem tarifa | 0,01 |
| Egress direto do R2 | gratuito | gratuito |

Standard inclui por mês 10 GB-mês, 1 milhão de operações A e 10 milhões B; a franquia não vale para Infrequent Access. Esta exige armazenamento mínimo de 30 dias. Upload/listagem e partes de multipart contam como A; leitura/consulta de objeto contam como B. [Tabela oficial R2](https://developers.cloudflare.com/r2/pricing/).

Exemplo calculado: 100 GB-mês Standard custariam US$1,35 de armazenamento se os 10 GB-mês gratuitos ainda estiverem disponíveis na conta; caso já consumidos, US$1,50. Somar operações excedentes, impostos e outros serviços utilizados. Egress gratuito do R2 não elimina cobrança de saída da VPS que envia cópias nem custos de serviços medidos conectados ao bucket. A capacidade e o uso do storage existente não foram verificados. [Preço e franquias R2](https://developers.cloudflare.com/r2/pricing/).

R2 implementa API compatível com S3, incluindo upload, download, listagem e multipart, com diferenças explicitadas por operação. Não presumir suporte integral a todos os recursos S3 ou copiar políticas AWS sem validar a tabela. [Compatibilidade S3 oficial](https://developers.cloudflare.com/r2/api/s3/api/).

As operações de objetos têm consistência forte global; multipart só fica legível como objeto completo depois da conclusão. Permissões IAM têm propagação eventual e acesso por domínio com cache pode servir conteúdo anterior; testes de restauração devem usar a API direta. [Consistência R2](https://developers.cloudflare.com/r2/reference/consistency/).

Cloudflare declara durabilidade anual projetada de 99,999999999%, redundância física e resposta de sucesso somente após persistência em disco. Isso descreve uma propriedade do serviço, não um ensaio desta conta nem proteção contra exclusão acidental; durabilidade difere de disponibilidade. [Durabilidade R2](https://developers.cloudflare.com/r2/reference/durability/).

### Por que R2 não substitui o receptor síncrono atual

Inferência técnica a partir das interfaces documentadas: uma API de objetos com persistência no sucesso não fornece automaticamente as operações de arquivo POSIX, append/rename e `fsync` usadas pelo receptor. `pg_receivewal --synchronous` recebe continuamente WAL, grava no diretório local e confirma flush; pode confirmar dados antes de fechar o segmento. Fazer upload posterior de segmentos fechados deixa um intervalo de WAL ainda não copiado. Uma montagem S3/R2 não comprova a semântica exigida e não foi ensaiada. [PG18: `pg_receivewal`](https://www.postgresql.org/docs/18/app-pgreceivewal.html), [API R2](https://developers.cloudflare.com/r2/api/s3/api/).

Recomendação para planejamento posterior: R2 pode guardar **cópias auxiliares** de bases/dumps concluídos e segmentos WAL fechados, com verificação de integridade e teste de download/restore antes de considerá-los utilizáveis. Preservar o receptor independente em disco POSIX e seu flush síncrono no caminho de confirmação aprovado. Não reduzir sua retenção/cadeia necessária nem permitir fallback assíncrono para caber numa VPS menor. A cópia R2 é complementar; substituir esse caminho exigiria novo desenho, definição no contrato e prova correspondente de RPO zero. O upload auxiliar não foi implementado nem está incluído no aceite local atual.

Orçamento final permanece adiado. Na retomada externa, confirmar tipo/capacidade/classe/custo do storage existente, região/independência do receptor, disco e retenção medidos, saída SMTP do detector e cotação de promoção/renovação. Bitwarden Free hospedado pelo fornecedor foi escolhido em Q48; não é mais uma escolha de produto pendente, mas sua configuração e recuperação efetiva ainda precisam ser executadas na etapa autorizada.

## Evidências ainda necessárias

Nenhuma configuração pesquisada foi instalada ou ensaiada no ambiente externo nesta pesquisa. Antes de expor a API, registrar: versões/digests; builds/jar com contrato; rede privada e recusa pública; certificado e renovação; IP real e resistência a spoofing; roles/ACL/RLS; receptor e flush síncrono; base/cadeia recuperável; agenda após reboot e falha; SMTP/abertura/agravamento/resolução; observação do próprio detector; armazenamento e janela real; perda integral/reconstrução/credenciais/API/reabertura em até 24h. Medir também latência da barreira e calibrar timeouts JDBC/proxy sem fallback assíncrono. Isso é o aceite do [recorte 4](../../.scratch/recuperacao-operacional/issues/04-validar-operacao-externa.md), não conclusão derivada dos manuais.
