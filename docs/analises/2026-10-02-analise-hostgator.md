# HostGator como alternativa de infraestrutura — 02/10/2026

A HostGator tem um VPS NVMe vigente em Oracle Cloud no Brasil, com acesso root e opção de sistema operacional limpo. É candidato para investigar um receptor independente; a oferta não comprova separação física do primário, latência de confirmação, durabilidade do filesystem ou janela recuperável. [Produto atual](https://www.hostgator.com.br/servidor-vps), [conceito e infraestrutura da VPS](https://suporte.hostgator.com.br/hc/pt-br/articles/30819638157459-O-que-%C3%A9-um-Servidor-VPS-e-para-o-que-serve).

Pesquisa pela skill research, com fontes primárias consultadas nesta data e observações da página renderizada feitas pelo agente principal. Sem login, checkout autenticado, contato comercial, contratação, instalação ou dados de clientes. Contratos consultados na ordem canônica: [CLAUDE.md](../../CLAUDE.md), [PRD.md](../../PRD.md), [spec/07 §2.2](../../specs/07-nao-funcionais-e-lgpd.md), [ADR-019](../adr/0019-recuperacao-operacional-sem-perda-de-confirmacoes.md), [WAL](../../api/ops/wal-recovery.md) e [operações](../../api/ops/operations.md).

Q44 informou o primário Hostinger/Campinas com 2 vCPU, 8 GB RAM, 100 GB e Ubuntu 24.04/Coolify 4.3.23. Q47 aprovou perfil A enxuto como referência para artefatos locais, mantendo orçamento/fornecedores/contratação para depois. Q48 escolheu Bitwarden Free hospedado pelo fornecedor. Esta pesquisa amplia a comparação e não altera essas decisões. [Preparo local e decisões](2026-10-02-preparacao-do-provisionamento.md).

## Produto atual, recursos e preço observado

O suporte distingue os VPS atuais NVMe 2/4/8/12/16/32 dos antigos Standard/Optimized/Platinum/Premium, descontinuados para contratação. Portanto, não aplicar automaticamente informações de planos antigos ou do catálogo americano `hostgator.com` à oferta brasileira atual. [Características oficiais](https://suporte.hostgator.com.br/hc/pt-br/articles/30814898002707-Quais-s%C3%A3o-as-caracter%C3%ADsticas-dos-servidores-VPS).

Dois planos interessam ao recorte enxuto:

| Plano candidato | vCPU / RAM anunciada ao vivo | Disco incluído | Primeiro período observado | Total antecipado observado | Mensal equivalente anunciado |
| --- | --- | --- | --- | --- | --- |
| NVMe 2 | 1 / 2 GB DDR5 | 50 GB NVMe | 3 anos | R$755,64 | R$20,99 |
| NVMe 4 | 2 / 4 GB DDR5 | 100 GB NVMe | 3 anos | R$1.094,11 | R$30,39 |

Tabela observada pelo agente principal no navegador IAB, após abrir os planos do [catálogo público atual](https://www.hostgator.com.br/servidor-vps). A oferta apresenta um IP dedicado e transferência ilimitada; não anuncia aqui uma franquia por GB nem preço de excesso. Para pagamento, conferir o total mostrado, pois o equivalente mensal é arredondado. Nada foi reservado numa conta.

A [tabela pública de preços](https://www.hostgator.com.br/precos-hostgator), menu “Servidor VPS NVMe”, foi conferida pelo agente principal no navegador IAB. Estes são valores regulares publicados por ciclo, para comparação de renovação; não são confirmação de fatura futura:

| Plano | Mensal: total / equivalente mensal | Anual: total / equivalente mensal | Bienal: total / equivalente mensal | Trienal: total / equivalente mensal |
| --- | --- | --- | --- | --- |
| NVMe 2 | R$54,98 / R$54,98 | R$539,80 / R$44,99 | R$959,60 / R$39,99 | R$1.259,40 / R$34,99 |
| NVMe 4 | R$96,65 / R$96,65 | R$939,80 / R$78,39 | R$1.679,60 / R$69,99 | R$2.279,40 / R$63,39 |

Tabela reproduzida literalmente da [fonte oficial renderizada](https://www.hostgator.com.br/precos-hostgator). Há diferenças entre total e equivalente mensal multiplicado pelo número de meses; por exemplo, NVMe 4 trienal não fecha essa multiplicação. Para orçamento futuro, usar o total publicado e confirmar a divergência antes da contratação. O ciclo mensal regular permite comparar um ensaio curto sem supor o desconto trienal.

As referências riscadas da oferta, R$1.979,28/R$3.479,40, coincidem com 36 vezes o regular mensal NVMe 2/4, respectivamente; **não são os totais de renovação trienal** acima. Banner ao vivo: 73%/R$20,99; índice: 68%/R$21,69. Confirmar campanha atual, sem usar snippet como cotação. [Oferta](https://www.hostgator.com.br/servidor-vps), [regular por ciclo](https://www.hostgator.com.br/precos-hostgator).

O guia de contratação publica ciclos mensal, anual, bienal e trienal; licença cPanel é cobrada adicionalmente quando escolhida. Os termos exigem pagamento antecipado por toda a vigência e renovação automática por período igual ao último contratado. Logo, R$20,99/R$30,39 nesta oferta são equivalentes de um compromisso de três anos, não uma cobrança mensal sem compromisso. [Ciclos e extras](https://suporte.hostgator.com.br/hc/pt-br/articles/45892434068243-Como-contratar-uma-VPS-na-HostGator), [termos §6](https://www.hostgator.com.br/termos-de-servico).

A comparação futura deve confirmar renovação/total, validade da promoção, impostos e extras da conta. Não foi convertido BRL para USD nem comparado custo final com os US$21 do perfil A: promoção plurianual e catálogo mensal regular têm compromissos diferentes. Para o receptor/detector, cPanel, email hospedado, domínio e aplicações adicionais não foram definidos como necessários pelo contrato do Ritmo.

## Localização, independência e latência

A localização Brasil é declarada explicitamente pelo produto e suporte Oracle Cloud; não foi inferida da marca brasileira. A nota renderizada cita teste interno OCI em São Paulo de 8 ms, variável por usuário/operadora/tráfego. Isso não comprova a localização da conta, a rota Campinas–HostGator ou a latência de flush. [Catálogo e nota de desempenho](https://www.hostgator.com.br/servidor-vps), [infraestrutura VPS Oracle](https://suporte.hostgator.com.br/hc/pt-br/articles/30819638157459-O-que-%C3%A9-um-Servidor-VPS-e-para-o-que-serve).

O guia manda selecionar localização na contratação, mas não fixa uma cidade/zona brasileira em seu texto. Não presumir `sa-saopaulo-1`, Vinhedo, zona OCI ou anti-afinidade sem a configuração efetivamente oferecida. [Guia oficial](https://suporte.hostgator.com.br/hc/pt-br/articles/45892434068243-Como-contratar-uma-VPS-na-HostGator).

Inferência operacional: HostGator/Oracle e Hostinger são fornecedores declarados diferentes, mas a identidade comercial sozinha não comprova que o receptor está fora do host/disco físico perdido. A própria explicação VPS distingue isolamento virtual de físico. Independência do alvo continua gate de aceite, com registro de localização/infraestrutura e evidência de sobrevivência à perda do primário. Não há reserva ou implantação efetuada nesta pesquisa. [Virtualização HostGator](https://suporte.hostgator.com.br/hc/pt-br/articles/30819638157459-O-que-%C3%A9-um-Servidor-VPS-e-para-o-que-serve), [contrato local](../../api/ops/wal-recovery.md).

Medir depois rota privada real, TLS `verify-full`, ida e volta, flush no disco e latência HTTP com a barreira ativa. O receptor síncrono participa da confirmação; testes de ping/marketing não cobrem falha, congestão, timeout ou indisponibilidade. A medição não autoriza fallback assíncrono. [PG18: pg_receivewal](https://www.postgresql.org/docs/18/app-pgreceivewal.html), [barreira do Ritmo](../../api/ops/wal-recovery.md).

## Linux, PostgreSQL 18, Docker e operação

A VPS SO Simples vem sem painel/aplicação, com root por SSH e opção AlmaLinux 9, Rocky Linux 9 ou Ubuntu 22.04 LTS. É a modalidade candidata para os processos operacionais; instalar um painel apenas para executá-los acrescentaria componentes sem necessidade definida. [VPS simples](https://suporte.hostgator.com.br/hc/pt-br/articles/45911662214419-Como-funciona-a-VPS-simples).

O fornecedor publica Docker como aplicação e tem guia de execução em containers. Sua disponibilidade comercial não prova versão, configuração ou execução do pacote Ritmo. Não instalar OpenClaw nem seguir seus comandos para esta pesquisa. [Aplicações VPS](https://suporte.hostgator.com.br/hc/pt-br/articles/46321129208211-Quais-s%C3%A3o-as-aplica%C3%A7%C3%B5es-para-adicionar-na-VPS-HostGator), [guia Docker/OpenClaw](https://suporte.hostgator.com.br/hc/pt-br/articles/50279666686739-Como-instalar-e-configurar-manualmente-o-OpenClaw-na-VPS).

O repositório oficial PostgreSQL suporta Ubuntu 22.04/24.04 e publica `postgresql-client-18`, distinto do pacote servidor. Docker Engine também lista ambas as versões Ubuntu 64 bits como suportadas. Inferência: existem caminhos documentados para os clientes PG18 e Docker; não foi comprovado download/instalação na imagem HostGator. O receptor não precisa de um segundo banco completo. [PostgreSQL no Ubuntu](https://www.postgresql.org/download/linux/ubuntu/), [Docker no Ubuntu](https://docs.docker.com/engine/install/ubuntu/).

Python 3.11+, IANA tzdata, clientes PG18 e filesystem Linux com `fsync` de arquivos/diretórios são exigências do [runbook](../../api/ops/operations.md). A imagem entregue, versão Python e compatibilidade do supervisor ainda precisam de ensaio. Essa avaliação não troca Java 21/PostgreSQL 18 nem decide outra distribuição para o primário.

## Armazenamento, tráfego e retenção

Os 50/100 GB anunciados incluem o disco da VPS, não um volume exclusivo já separado para backups. Inferência de dimensionamento: descontar OS/logs e calcular bases/dumps diários, WAL contínuo, âncora anterior à janela de 30 dias, cauda, históricos, pacotes congelados e áreas incompletas/orphans. Não inferir adequação pela RAM nem pelos 100 GB totais do primário. O NVMe 4 tem 100 GB totais; não equivale aos 40 GB raiz + 100 GB adicionais do perfil A original. [Disco dos planos](https://suporte.hostgator.com.br/hc/pt-br/articles/30814898002707-Quais-s%C3%A3o-as-caracter%C3%ADsticas-dos-servidores-VPS), [retenção por dependência](../../api/ops/operations.md).

NVMe descreve tecnologia/capacidade publicada, não comprova a persistência depois de `fsync`, o tipo de volume OCI, o domínio de falha ou a sobrevivência a exclusão/rebuild. Rebuild HostGator apaga todos os dados. O contrato exige comprovar filesystem POSIX durável e recuperação integral em ambiente externo; não substituir por disco efêmero ou montagem S3 presumida. [Rebuild oficial](https://suporte.hostgator.com.br/hc/pt-br/articles/38550817860499-Como-reinstalar-o-sistema-operacional-na-VPS-e-Dedicado), [WAL durável do Ritmo](../../api/ops/wal-recovery.md).

O suporte explica transferência ilimitada como sem quantidade definida, ainda sujeita à capacidade física; limita CPU acima de duas vezes os núcleos por mais de 15 minutos e define um milhão de inodes nos NVMe atuais, até dois milhões sob justificativa. Os termos vedam I/O intenso que prejudique o servidor. Não há nessas fontes uma garantia mensurável de throughput ou latência mínima para WAL/backups. [Limitações oficiais](https://suporte.hostgator.com.br/hc/pt-br/articles/30816318898963-Quais-s%C3%A3o-as-limita%C3%A7%C3%B5es-dos-servidores-da-HostGator), [termos §15](https://www.hostgator.com.br/termos-de-servico).

Backups VPS são responsabilidade do cliente, conforme suporte e termos; restauração realizada pelo fornecedor pode ter taxa e não é garantia de recuperação. Não atribuir ao VPS o backup diário/semanal descrito em artigos de hospedagem compartilhada. A cadeia independente do Ritmo e seus ensaios continuam obrigatórios. [Backup VPS](https://suporte.hostgator.com.br/hc/pt-br/articles/30807807620883-Como-restaurar-um-backup-completo-na-HostGator), [termos §7.2/15.6](https://www.hostgator.com.br/termos-de-servico).

R2 permanece candidato a cópias auxiliares de bases/dumps completos e WAL fechado. A API de objetos não substitui automaticamente o append/rename/`fsync` do receptor nem conserva, por upload de segmentos fechados, toda a cauda ainda aberta. Não reduzir a retenção independente para fazer o plano menor caber. [Pesquisa R2](2026-10-02-referencias-provisionamento-externo.md), [API R2](https://developers.cloudflare.com/r2/api/s3/api/), [pg_receivewal](https://www.postgresql.org/docs/18/app-pgreceivewal.html).

Os termos também descrevem troca de instância em upgrades entre categorias e possível intervenção na senha root. Confirmar aplicação ao NVMe SO Simples e procedimento de expansão/custódia antes de contratar; não presumir upgrade preservando o disco. [Termos §15.5/15.7](https://www.hostgator.com.br/termos-de-servico).

## Detector e SMTP

NVMe 2 pode ser candidato para um detector Python enxuto, separado do primário e do receptor, mas 2 GB/50 GB são capacidade de catálogo, sem ensaio da carga. Se HostGator for o receptor, o detector não deve rodar na mesma VPS; verificar também dependências compartilhadas de região/provedor para a observação externa. Não instalar PostgreSQL completo, API ou painel por aproveitar recursos. [Recursos](https://suporte.hostgator.com.br/hc/pt-br/articles/30814898002707-Quais-s%C3%A3o-as-caracter%C3%ADsticas-dos-servidores-VPS), [posição do monitor no runbook](../../api/ops/operations.md).

A lista genérica de portas HostGator inclui SMTP 26/465/587 e referências cPanel/Virtuozzo; não distingue explicitamente saída SMTP de uma VPS OCI nova para um relay externo. Portanto, não comprova alcance a Resend pela porta 587/2587 nem permite aplicar à HostGator o bloqueio específico de Droplets DO. [Portas oficiais](https://suporte.hostgator.com.br/hc/pt-br/articles/30812710494739-Quais-portas-s%C3%A3o-liberadas-por-padr%C3%A3o-nos-servidores-na-HostGator-Brasil).

A política VPS limita envio a 500 destinatários únicos/hora/domínio. Isso não define a quota da conta Resend nem substitui o teste de relay, DNS, TLS e entrega. Resend documenta `smtp.resend.com` com STARTTLS em 587 e 2587. Confirmar regras aplicáveis ao produto e testar entrega de abertura/agravamento/resolução antes do aceite; não contornar bloqueios por túnel. [Política VPS](https://www.hostgator.com.br/termos-de-servico), [SMTP Resend](https://resend.com/docs/send-with-smtp).

## Divergências a resolver antes do orçamento externo

| Ponto | Evidência oficial divergente | Tratamento nesta pesquisa |
| --- | --- | --- |
| Oferta promocional | Banner renderizado 73% / R$20,99; índice 68% / R$21,69 | Oferta de hoje; regular por ciclo em tabela própria; confirmar cotação futura |
| Memória | Cartões ao vivo DDR5; características do suporte DDR4 | Não prometer geração física; confirmar configuração ofertada |
| IPs | Características gerais: 1; tabela de SO: 2 | Não orçar IP adicional nem presumir dois incluídos |
| Ubuntu | Lista SO: 22.04 LTS; guia OpenClaw: 24.04 LTS | Confirmar opção disponível; não mudar a stack por inferência |
| Planos | NVMe vigentes convivem com instruções para VPS descontinuadas | Conferir linha/modalidade antes de aplicar uma instrução |

Fontes da comparação: [produto atual](https://www.hostgator.com.br/servidor-vps), [características](https://suporte.hostgator.com.br/hc/pt-br/articles/30814898002707-Quais-s%C3%A3o-as-caracter%C3%ADsticas-dos-servidores-VPS), [SO/IPs](https://suporte.hostgator.com.br/hc/pt-br/articles/46442132112531-Quais-s%C3%A3o-os-sistemas-operacionais-dispon%C3%ADveis-nas-VPS-na-HostGator), [guia com Ubuntu 24.04](https://suporte.hostgator.com.br/hc/pt-br/articles/50279666686739-Como-instalar-e-configurar-manualmente-o-OpenClaw-na-VPS).

## Recomendação para o perfil A local

Manter o trabalho local autorizado e deixar HostGator NVMe 2/4 na comparação futura. Para receptor, priorizar a capacidade da janela PITR e os ensaios de flush/independência; 100 GB do NVMe 4 oferece mais espaço que o NVMe 2, mas ainda não demonstra a janela. Para detector isolado, NVMe 2 é um candidato; não há dado suficiente para preferi-lo ao DO enxuto em custo final, compromisso de renovação ou SMTP.

Antes de decidir externamente, fechar cotação promocional/regular por ciclo, localização/zona e separação do primário, imagem Linux/Python/PG18, volume e capacidade de retenção, rota privada/TLS sem PostgreSQL público, supervisão/parada/reboot, saída SMTP e entrega, e restauração/API/RTO completos. São gates do [recorte 4](../../.scratch/recuperacao-operacional/issues/04-validar-operacao-externa.md), não novas funcionalidades ou garantias provadas pela pesquisa. Q47/Q48 permanecem vigentes; nenhum fornecedor foi contratado.


## Verificação do incremento documental

App: typecheck/lint/test com exit 0, 94/94 aprovados, sem ignorados. API: Java 21, gradlew.bat -p api check --no-daemon, exit 0 em 29 s; operationsTest executou 8/8 e suíte Java ficou UP-TO-DATE, pois só Markdown foi alterado. A prova anterior de imagem/WAL/restauração permanece na [evidência local da API](2026-10-02-imagem-de-implantacao-da-api.md); nenhum novo ensaio de fornecedor, SMTP, desempenho ou RTO foi executado. Não houve teste adicional criado para esta atualização documental.

Conferidos 3 Markdown UTF-8 e 35 referências locais a arquivos existentes; diff sem erros de whitespace antes do commit.
