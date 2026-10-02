# Proposta de infraestrutura e custódia — Ritmo

Data dos preços consultados: **02/10/2026**. Estado: **perfil enxuto e Bitwarden Free escolhidos; fornecedores/orçamento/contratação adiados**.
Origem: [Q44–Q46](../../.scratch/fundacao/entrevista.md), [tarefa 04](../../.scratch/recuperacao-operacional/issues/04-validar-operacao-externa.md) e [caderno de execução/aceite](../../api/ops/external-provisioning.md).

## Recomendação

Q47 determinou **artefatos locais primeiro**, com perfil A como referência enxuta; fornecedores e orçamento final ficam para depois. Q48 escolheu Bitwarden Free cloud. Manter a VPS Hostinger de Campinas como primário, depois de medir a capacidade livre. A composição cotada do **perfil A** serve à comparação, ainda sem fornecedores definitivos: receptor em São Paulo em outro provedor, disco dedicado aos backups e detector pequeno em terceiro provedor. Planejar **US$25/mês de verba base**, sendo **US$21/mês de recursos cotados + US$4 de margem**. Tributos, câmbio, tráfego excedente e ensaios são parcelas adicionais explicitadas abaixo; US$25 não é teto de fatura garantido.

O receptor participa da confirmação síncrona; estar na mesma região metropolitana é uma hipótese para reduzir RTT, a medir. O detector só consulta metadados e pode ficar em região econômica fora do Brasil. São três hosts com papéis diferentes; não há segundo PostgreSQL completo continuamente aplicando WAL. O cofre escolhido é Bitwarden Free cloud; Resend permanece o serviço existente. Hostinger para outra VPS e Cloudflare R2 entram na comparação pedida por Pedro. Nenhum recurso adicional foi contratado.

## Ambiente existente, declarado por Pedro

Hostinger/Campinas-SP: **2 vCPU, 8 GB RAM e 100 GB disco, Ubuntu 24.04, Coolify 4.3.23**. Nenhum host foi acessado nesta avaliação. Ainda precisam ser conferidos: arquitetura, RAM/CPU/disco livres, workloads atuais, configuração/versão efetiva, DNS e acesso de gestão. A release Coolify v4.3.23 existe oficialmente; isso não atesta a instalação do servidor. [Release oficial](https://github.com/coollabsio/coolify/releases/tag/v4.3.23).

## Dois perfis comparáveis

Valores em **USD por mês completo**, sem créditos temporários/promos, impostos ou conversão para reais. Primário Hostinger já contratado não está somado.

| Componente | A — enxuto, recomendado para medir | B — mais folga |
|---|---|---|
| Receptor AWS Lightsail, São Paulo | Linux com IPv4, 2 vCPU/1 GB RAM/40 GB sistema: **US$7** | Linux com IPv4, 2 vCPU/2 GB RAM/60 GB sistema: **US$12** |
| Volume de backups no receptor | 100 GB a US$0,10/GB: **US$10** | 160 GB a US$0,10/GB: **US$16** |
| Detector DigitalOcean Basic Bundled, outro host/provedor | 1 vCPU/512 MiB RAM/10 GiB: **US$4** | 1 vCPU/1 GiB RAM/25 GiB: **US$6** |
| Recursos cotados | **US$21/mês** | **US$34/mês** |
| Verba base sugerida antes dos adicionais | **US$25/mês** | **US$40/mês** |

Fontes dos planos/volumes: [Lightsail](https://aws.amazon.com/lightsail/pricing/) e [DigitalOcean Droplets](https://www.digitalocean.com/pricing/droplets). Selecionar DO **Basic Bundled**: a cotação inclui IPv4; outros tipos/configurações podem cobrá-lo separadamente. São Paulo é região Lightsail disponível. [Regiões oficiais](https://docs.aws.amazon.com/lightsail/latest/userguide/understanding-regions-and-availability-zones-in-amazon-lightsail.html). Disponibilidade do tamanho/imagem/volume no console deve ser conferida antes da contratação.

Aumentar RAM/disco se medições de jobs, memória, I/O ou crescimento não comportarem A; B também não é capacidade comprovada. Os 100/160 GB são hipóteses iniciais de dimensionamento, não promessa de janela de 30 dias. Não somar o disco de sistema como capacidade disponível da cadeia: usar volume privado dedicado, com fsync durável, catálogo e espaço medidos.

Os microhosts executam receiver/Python/PG clients ou detector. O ensaio integral, o build Java/Docker e a API/PG de restauração exigem **ambiente temporário separado**, dimensionado para esse trabalho; não presumir que a suíte Gradle/Testcontainers caiba no receptor de 1 GB ou detector de 512 MiB.

## Custos que precisam de controle

No Lightsail/São Paulo, a franquia é metade da global: perfil A 1 TB/mês, B 1,5 TB/mês. Entrada e saída consomem a franquia; apenas saída excedente é cobrada, a **US$0,15/GB** nessa região. Base/WAL entrando no receptor contam; uma restauração saindo dele pode gerar excedente. Não chamar transferência de entrada de irrelevante para a franquia. [Regra regional de transferência](https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-faq-data-transfer-allowance.html).

Separar do total fixo: tributos/IOF/câmbio da cobrança, domínio eventual, consumo além da franquia, cópias auxiliares/snapshots e host/disco temporários para ensaios mensais/major ou incidente. Não contar promoção/free trial para sustentar a operação. Conferir política de faturamento: desligar processo/VM não equivale necessariamente a destruir recurso cobrado; preservar cadeia e evidências antes de qualquer retirada.

O orçamento do ensaio depende de tamanho transferido, capacidade e horas de uso. Quantificar após o primeiro ensaio isolado; antes de criá-lo, revisar a estimativa/teto pontual com Pedro. O cronômetro de RTO inclui provisionar e transferir, além de replay/verificações.

Alternativa com receptor Akamai/São Paulo: Nanode 1 GB/1 vCPU/25 GB custa US$7, e armazenamento regional custa US$0,14/GB/mês; tende a ficar mais caro com a mesma capacidade de volume. Pode valer se Pedro preferir esse fornecedor ou o enlace medido for melhor. [Tabela regional oficial](https://www.akamai.com/cloud/pricing/sao-paulo). Pesquisa detalhada e limites de preços indisponíveis: [referências](2026-10-02-referencias-provisionamento-externo.md).

## Comparação solicitada em Q47: Hostinger e R2

Hostinger pode fornecer outra VPS; o orçamento e a compra ficam para depois dos artefatos locais. A página brasileira consultada apresenta KVM 1 (1 vCPU/4 GB/50 GB NVMe) por R$29,99/mês equivalente na promoção e R$59,99 na renovação, e KVM 2 (2 vCPU/8 GB/100 GB NVMe) por R$43,99 e R$77,99. A cobrança é integral pelo período contratado; não equivale a cancelamento mensal. Confirmar prazo, total antecipado, impostos e renovação no checkout futuro. [Oferta oficial](https://www.hostinger.com/br/servidor-vps).

Uma segunda VPS em Campinas não comprova separação do host físico: KVM admite hóspedes no mesmo host. Antes de aceitar esse receptor, obter evidência de independência compatível com a perda definida no ADR-019 e medir latência/banda. Não reduzir a cadeia/retencão para caber nos 50/100 GB, nem presumir expansão de disco avulso. [Virtualização Hostinger](https://www.hostinger.com/support/6988144-what-is-kvm-virtualization-at-hostinger/), [limites por plano](https://www.hostinger.com/support/6976044-parameters-and-limits-of-hosting-plans-in-hostinger/).

Cloudflare R2 Standard é candidato a cópias auxiliares futuras: US$0,015/GB-mês, 10 GB-mês gratuitos quando ainda disponíveis, operações excedentes cobradas e egress direto sem tarifa. Exemplo: 100 GB-mês custariam US$1,35 de armazenamento com a franquia disponível, ou US$1,50 se consumida; somar operações, impostos e eventual saída da VPS. O storage já existente ainda não teve tipo/capacidade/quota conferidos. [Preços oficiais R2](https://developers.cloudflare.com/r2/pricing/).

R2 fornece interface de objetos, enquanto o caminho atual confirma flush contínuo em disco POSIX por pg_receivewal --synchronous, inclusive antes de fechar um segmento. Upload posterior de segmentos fechados não cobre sozinho esse intervalo. R2 pode complementar bases/dumps/WAL fechado verificados; não substitui o receptor síncrono nem sua cadeia recuperável neste contrato. Nenhum upload foi implementado. [Interface R2](https://developers.cloudflare.com/r2/api/s3/api/), [pg_receivewal PG18](https://www.postgresql.org/docs/18/app-pgreceivewal.html). Detalhes e limites comerciais na [pesquisa](2026-10-02-referencias-provisionamento-externo.md).

## Cofre escolhido e alternativas pesquisadas

| Opção | Custo consultado | Uso neste projeto |
|---|---|---|
| **Bitwarden Free cloud — recomendado** | **US$0** | Logins/notas e acesso entre dispositivos; suficiente para custódia manual inicial, sem hospedar o cofre na própria VPS |
| Bitwarden Premium | **US$19,80/ano**, equivalente a US$1,65/mês | Opcional para anexos, acesso de emergência e extras; cobrança anual |
| 1Password Individual | Preço regular **US$3,99/mês**, cobrança anual; promoção US$2,99/mês no primeiro ano para elegíveis | Alternativa paga se Pedro preferir essa experiência; comparar pelo preço regular |

Fontes: [Bitwarden preços](https://bitwarden.com/pricing/), [funcionalidades por plano](https://bitwarden.com/help/password-manager-plans/) e [1Password Personal](https://1password.com/pricing/personal). Bitwarden Free foi escolhido em Q48; nenhuma conta foi criada; não é necessário contratar um plano empresarial de secrets neste marco.

Para o Bitwarden escolhido, preparar acesso no iPhone/Windows, 2FA e código de recuperação guardado também fora do cofre/servidores. Manter exportação JSON cifrada protegida por senha independente, e conferir restauração: export account-restricted depende da conta original, enquanto password-protected pode ser importado em outra conta. Senha mestra/export e código nunca vão para chat/Git/memória. [Código de recuperação](https://bitwarden.com/help/two-step-recovery-code/), [exportação](https://bitwarden.com/help/export-your-data/). Esses passos cumprem a custódia/recuperação Q43; não são realizados por este documento.

## Resend e observação do detector

Pedro já usa Resend. Proposta: reaproveitar **smtp.resend.com**, usuário **resend**, STARTTLS obrigatório/validação do certificado. Porta 587 é candidata para a API no primário; para o detector DigitalOcean, a candidata é **2587**, também documentada pelo Resend; segredo é uma API key armazenada/injetada pelo canal privado. API e detector têm configurações/credenciais operacionais separadas. Exige domínio verificado, remetente permitido e acesso configurado. [SMTP oficial](https://resend.com/docs/send-with-smtp).

A DigitalOcean bloqueia SMTP em 25/465/587 por padrão; portanto DO+587 não é uma configuração pronta. A porta alternativa 2587 e a política vigente devem ser verificadas por conexão TLS autenticada/entrega real no ensaio. O SmtpEmail existente aceita porta configurável. Se o caminho permitido não funcionar, selecionar outro host/transporte antes de instalar; não usar um túnel para esconder tráfego restringido. [Restrição oficial](https://docs.digitalocean.com/support/why-is-smtp-blocked/). Essa dependência não foi resolvida por pesquisa e continua gate de aceite.

Se a conta estiver no Free e tiver quota disponível, a tabela pública permite 3.000 e-mails/mês e 100/dia, sem mensalidade; Pro começa em US$20/mês. Não presumir o plano/quota de Pedro nem que só o Ritmo os consome. Alertas e recuperação usam a mesma quota contratada; recebimento/deliverability e retry precisam de aceite real. [Preços oficiais](https://resend.com/pricing/).

Para observar a agenda/host do detector, candidato **Healthchecks.io Hobbyist**: US$0, até 20 jobs; alerta quando heartbeat deixa de chegar. Usar o serviço hospedado, fora dos três hosts, com mensagem operacional sem PII/payload; URL/UUID do ping são segredos no cofre. [Preço](https://healthchecks.io/pricing/), [mecanismo e custódia](https://healthchecks.io/docs/). Ele não substitui probes Q42, integridade WAL/base, verificação da API ou comprovação de entrega SMTP. A integração e o canal independente ainda precisam ser aprovados/ensaiados; não atribuir saúde ao simples envio de heartbeat.

## Decisão que permite avançar

Q47 escolheu perfil A enxuto e artefatos locais antes de contratar; Q48 escolheu Bitwarden Free cloud. Comparar uma segunda VPS Hostinger e R2 conforme pedido, depois levantar capacidade/rota privada/domínios/acessos, medir cadeia, ensaiar e revisar orçamento/contratação concretos. A seleção de um perfil não fixa AWS/DO como fornecedores nem aprova uma fatura. Não foi reduzido RPO zero nem substituído WAL síncrono por object storage/dump assíncrono para baratear a proposta.

O próximo incremento pode preparar e testar os artefatos localmente sem contratar recursos agora. Instalação e exposição externa continuam sujeitas ao plano e aos gates; esta proposta não é autorização de pagamento ou publicação.
