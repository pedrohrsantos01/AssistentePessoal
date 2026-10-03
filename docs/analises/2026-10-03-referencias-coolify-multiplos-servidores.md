# Coolify com uma segunda VPS — referências e limites

Data da consulta: 03/10/2026. Pesquisa em documentação e código oficiais; nenhum acesso à instalação, contratação, cadastro de servidor, implantação ou ensaio externo foi realizado.

Autoridade local: [CLAUDE.md](../../CLAUDE.md) → [PRD.md](../../PRD.md) → [spec/07](../../specs/07-nao-funcionais-e-lgpd.md) → [ADR-019](../adr/0019-recuperacao-operacional-sem-perda-de-confirmacoes.md). Q47 mantém perfil A, artefatos locais primeiro e orçamento/contratação adiados; Q48 escolheu Bitwarden Free hospedado pelo fornecedor. Esta pesquisa não aprova fornecedor nem muda a arquitetura.

## Conclusão aplicável ao Ritmo

Uma instância Coolify pode administrar uma VPS de outro fornecedor por SSH. A segunda máquina executa Docker e os recursos; não precisa hospedar outra instalação do painel. O Coolify não exige agente permanente de implantação no destino; Sentinel é monitoramento opcional. [Como o Coolify funciona](https://coolify.io/docs/core/how-coolify-works).

O cadastro é compatível com manter o receptor WAL em outra máquina, mas não comprova independência física, rede privada, durabilidade ou RPO/RTO. O receptor do projeto continua sendo `pg_receivewal` contínuo, sem segundo PostgreSQL completo; supervisor, agenda e inibição de reinício de 4B permanecem pendentes. O detector precisa de um terceiro host independente do primário e do receptor. [ADR-019](../adr/0019-recuperacao-operacional-sem-perda-de-confirmacoes.md), [contrato operacional](../../api/ops/operations.md).

**Inferência para o próximo recorte:** cadastrar a VPS para recursos gerais é possível sem delegar ao Coolify o ciclo crítico do receptor. Receptor/agenda nativos e receptor em Compose são alternativas a especificar e ensaiar; nenhuma foi aceita externamente nesta pesquisa. O desenho precisa funcionar e permitir recuperação quando o controller na Hostinger for perdido.

## Versão e alcance da evidência

A release oficial [`v4.3.23`](https://github.com/coollabsio/coolify/releases/tag/v4.3.23) existe. A versão informada por Pedro não foi conferida no painel ou na imagem instalada. As páginas atuais são documentação viva, não um manual congelado por release; por isso, os comportamentos críticos abaixo também foram conferidos no código dessa tag. Não atualizar a instalação como parte deste roteiro.

Na tag, a validação verifica SSH, sistema operacional, pré-requisitos, Docker Engine, Compose e versão do Engine; pode instalar componentes e disparar a inicialização do proxy. Os pré-requisitos explícitos incluem `git`, `curl` e `jq`; o mínimo configurado do Engine é `24.0`. Esses valores são requisitos dessa tag, não uma recomendação para instalar Docker antigo. [ValidateAndInstall](https://github.com/coollabsio/coolify/blob/v4.3.23/app/Livewire/Server/ValidateAndInstall.php), [ValidatePrerequisites](https://github.com/coollabsio/coolify/blob/v4.3.23/app/Actions/Server/ValidatePrerequisites.php), [constants.php](https://github.com/coollabsio/coolify/blob/v4.3.23/config/constants.php).

## Antes de contratar: informação que precisa ficar registrada

- Plano Linux com acesso administrativo por SSH/console, IP ou hostname alcançável pelo controller, armazenamento persistente e suporte a Docker. O cadastro Manual recebe uma máquina já existente; não depende de integração comercial com o fornecedor. [Adicionar servidor](https://coolify.io/docs/core/infrastructure/servers/add-server).
- Localização efetiva, disco útil, tráfego, política de snapshots/reinstalação e independência em relação à Hostinger Campinas: obter evidência do produto contratado. O cadastro no Coolify não confirma esses atributos. HostGator permanece candidato conforme a [análise anterior](2026-10-02-analise-hostgator.md); a marca ou a infraestrutura Oracle, isoladamente, não provam separação física.
- Dimensionar retenção de bases, dumps e WAL pelo inventário e pelas dependências de 30 dias, com margem e espaço operacional; RAM/preço de entrada não são aceite de capacidade. Latência e throughput do caminho síncrono precisam de medição. [ADR-019](../adr/0019-recuperacao-operacional-sem-perda-de-confirmacoes.md), [provisionamento](../../api/ops/external-provisioning.md).

## Cadastro futuro no painel existente

Sequência documental, a executar somente quando houver máquina e janela de mudança autorizadas:

1. Garantir acesso administrativo independente pela console do fornecedor e um meio de SSH de recuperação.
2. Em **Keys & Tokens → Private Keys**, gerar/importar chave dedicada; o guia usa ED25519 sem passphrase para operação automática. Autorizar a chave pública no `authorized_keys` do usuário remoto, preservando o acesso existente.
3. Em **Servers → Add → Manual**, informar nome, IP/hostname, porta SSH, usuário e chave; deixar a opção de build server desligada para um destino que executará recursos.
4. Validar e conferir identidade da máquina, alcance SSH e versões detectadas. A validação pode instalar Docker e reiniciar seu serviço; tratar como mudança, especialmente em host com containers existentes.

Passos e efeitos: [Adicionar servidor](https://coolify.io/docs/core/infrastructure/servers/add-server). Após trocar IP, usuário, porta ou rota, conferir alcance novamente antes de salvar uma conexão que possa interromper o controle. [Gerenciar servidor](https://coolify.io/docs/core/infrastructure/servers/manage-server).

O guia padrão usa `root`. A alternativa non-root é experimental e exige `sudo` sem senha para qualquer comando; portanto, continua com poder de root. Não tratá-la como isolamento de privilégio. Usar conta/chave dedicadas e verificar suporte na máquina concreta. As instruções para Oracle free ARM não se aplicam automaticamente à oferta HostGator baseada em OCI. [Usuário non-root](https://coolify.io/docs/core/infrastructure/servers/non-root-user).

## Rede, destino e portas

| Caminho | Necessidade e limite |
|---|---|
| Controller → VPS remota | SSH na porta escolhida, normalmente TCP 22; restringir origem quando possível e conservar acesso de recuperação. |
| Painel Coolify | 8000/6001/6002 são portas da instalação do controller para acesso direto; cadastrar uma VPS remota não exige instalar/abrir um painel nela. |
| HTTP na VPS remota | 80/443 somente quando ela receber tráfego web público; o receptor WAL não é um serviço HTTP. |
| Receptor → PostgreSQL primário | Conexão de replicação pelo transporte privado a especificar; não publicar PostgreSQL na internet. Cadastro SSH não cria essa rota. |

Portas/escopo: [Firewall do Coolify](https://coolify.io/docs/core/infrastructure/servers/firewall); último caminho é requisito do [spec/07](../../specs/07-nao-funcionais-e-lgpd.md) e do [runbook WAL](../../api/ops/wal-recovery.md). Docker pode publicar portas que ultrapassam regras comuns de UFW; conferir a barreira do fornecedor e a exposição efetiva, conforme o mesmo guia.

Um **Destination** é uma rede Docker de um servidor; a rede `coolify` de um host não se estende ao outro. Compose usa rede própria por recurso, e a opção de conexão à rede predefinida é local ao host. Não confundir gerenciamento de vários Servers com VPN, rede privada entre fornecedores ou migração de dados. [Destinos e rede](https://coolify.io/docs/core/networking-in-coolify), [rede de Services](https://coolify.io/docs/services/how-services-work).

O fluxo padrão de validação pode iniciar Traefik. Para uma VPS dedicada apenas ao receptor, **Custom (None)** é a opção documentada sem proxy gerenciado. A tag reconhece `NONE` e impede sua inicialização automática. Confirmar também a parada/ausência do proxy já iniciado: mudar o tipo não é evidência de que um container anterior desapareceu. Não abrir 80/443 para contornar esse detalhe. [Modelos de proxy](https://coolify.io/docs/core/networking-in-coolify), [CheckProxy na tag](https://github.com/coollabsio/coolify/blob/v4.3.23/app/Actions/Proxy/CheckProxy.php), [changeProxy/proxySet](https://github.com/coollabsio/coolify/blob/v4.3.23/app/Models/Server.php).

## Persistência no destino remoto

Volumes e bind mounts pertencem ao servidor que executa o recurso. Não são copiados para outros Servers nem incluídos no backup da instância Coolify. Para Compose, o arquivo Compose define os mounts; a interface mostra os mounts interpretados, mas não substitui a declaração original. Persistência sobrevive à substituição do container, não à perda do disco/host. [Storage mounts](https://coolify.io/docs/core/persistent-storage/storage-mounts/overview).

Um bind mount usa o caminho no host do daemon remoto, não um caminho da VPS controller. Definir caminhos absolutos do destino, proprietário/permissões e mounts de dados graváveis; configuração/credenciais podem usar mounts somente leitura quando apropriado. Acesso de escrita permite ao container alterar os arquivos daquele mount. A estrutura precisa existir e ser validada na máquina concreta antes do primeiro uso. [Bind mounts do Docker](https://docs.docker.com/engine/storage/bind-mounts/).

**Inferência operacional:** manter WAL, bases, dumps, catálogo e estado da agenda em diretórios persistentes identificáveis, fora de diretórios descartáveis de build/configuração do recurso, facilita recuperação sem painel. A propriedade deve coincidir com o processo executor; bind mount não constitui prova de `fsync` durável do fornecedor. O `pg_receivewal --synchronous` grava/flush imediatamente e informa o flush ao primário; não aplica WAL, e não deve ser usado como destino `remote_apply`. [PostgreSQL 18](https://www.postgresql.org/docs/18/app-pgreceivewal.html), [contratos locais](../../api/ops/operations.md).

## Queda do controller, reinício e congelamento

| Evento | O que a documentação permite concluir |
|---|---|
| Coolify principal indisponível | Containers existentes e dados persistentes continuam se host remoto, Docker e rede estiverem saudáveis. Novos deploys, ações do painel, agendas, webhooks, checks e notificações coordenados pelo controller dependem dele. |
| SSH inacessível | Coolify perde capacidade de operar o destino; o erro SSH, por si só, não para os containers existentes. |
| Reboot do host/daemon remoto | Requer daemon iniciado e política de reinício apropriada; não é garantia derivada do cadastro no painel. |

Primeiras duas linhas: [Modelo de execução do Coolify](https://coolify.io/docs/core/how-coolify-works). Terceira: [Políticas Docker](https://docs.docker.com/engine/containers/start-containers-automatically/). `always` pode retomar após reinício do daemon; `unless-stopped` conserva uma parada manual. Docker recomenda não combinar sua política automática com outro supervisor externo que também inicie o mesmo container.

Na tag 4.3.23, iniciar um Service redefine contadores de reinício dos componentes e executa Compose com `--force-recreate`. Um novo Deploy pode iniciar um container novamente apesar da parada anterior; o contador/política Docker não é bloqueio contra esse comando explícito. [StartService](https://github.com/coollabsio/coolify/blob/v4.3.23/app/Actions/Service/StartService.php).

**Inferência/gate 4B:** a captura da cauda exige parada comprovada e impedir novos writers até finalizar a cópia. Se o receptor for gerenciado por Compose, avaliar Deploy/Restart, ações por componente, APIs/webhooks, jobs em fila, reboot e intervenções SSH. Nenhuma documentação consultada demonstra um gate Coolify que cumpra esse contrato do Ritmo. Desativar só uma agenda ou clicar Stop não constitui essa prova. O detector e a agenda de recuperação não podem depender apenas das automações do controller perdido. [Operação de Services](https://coolify.io/docs/services/how-services-work), [contrato de congelamento](../../api/ops/operations.md).

## Cleanup e exclusão são operações distintas

| Ação | Efeito relevante |
|---|---|
| Docker Cleanup | Pode remover imagens/build cache; habilitar **Delete Unused Volumes** permite apagar todos os volumes sem container anexado. A opção é desabilitada por padrão. Isso não implementa retenção de WAL por dependências. |
| Delete Server sem recursos gerenciados e sem exclusão do fornecedor | Remove o registro do Coolify; não desinstala Docker nem limpa os arquivos da máquina. |
| Delete all resources | Dispara exclusão dos recursos, podendo remover dados/configurações/backups; não usar como forma de desconectar a VPS durante recuperação. |
| Exclusão no fornecedor | Quando há integração/vínculo suportado, pode apagar a própria VM; sem essa ação, a contratação continua existindo e pode continuar sendo cobrada. |

Fontes: [Cleanup](https://coolify.io/docs/core/infrastructure/servers/automated-docker-cleanup), [Remover servidor](https://coolify.io/docs/core/infrastructure/servers/remove-server). A tag confirma `docker volume prune -af` quando solicitado. [CleanupDocker](https://github.com/coollabsio/coolify/blob/v4.3.23/app/Actions/Server/CleanupDocker.php). Não atribuir a bind mounts proteção contra exclusão de VM, comandos administrativos ou cleanup de diretórios.

A UI da tag bloqueia remoção de Server com recursos definidos, salvo **Delete all resources**, e oferece exclusão de máquina para vínculos Hetzner/Vultr/DigitalOcean. Não há nesses controles integração HostGator comprovada. [Delete Server](https://github.com/coollabsio/coolify/blob/v4.3.23/app/Livewire/Server/Delete.php).

O job de exclusão tem volumes/configurações habilitados por padrão e percorre backups agendados; falha na limpeza remota pode ser registrada e seguida de exclusão local. Logo, sumir do painel não prova que o processo parou ou que os dados remotos foram apagados. [DeleteResourceJob](https://github.com/coollabsio/coolify/blob/v4.3.23/app/Jobs/DeleteResourceJob.php), [DeleteService](https://github.com/coollabsio/coolify/blob/v4.3.23/app/Actions/Service/DeleteService.php). Recadastrar a máquina cria novo registro e não readota automaticamente recursos anteriores. [Remover servidor](https://coolify.io/docs/core/infrastructure/servers/remove-server).

## Recuperar o Coolify é separado de recuperar o Ritmo

O backup da instância salva o banco de configuração Coolify; não inclui dados dos recursos. O `.dmp` não contém `/data/coolify/source/.env`. Guardar separadamente a `APP_KEY` usada para cifrar credenciais/chaves; sem ela, o banco restaurado não permite lê-las. Manter cópia fora da máquina, sem gravar valores em Git, relatório ou memória. [Backup da instância](https://coolify.io/docs/core/backup-and-recovery/instance-backup).

Na substituição de máquina, a documentação também exige recuperar `/data/coolify/ssh/keys/` e o `authorized_keys` pertinente. Material de SSH é sensível mesmo com valores cifrados no banco; o Coolify escreve chaves em arquivos com permissões restritas para usar o cliente SSH. Um acesso administrativo independente evita depender exclusivamente do controller perdido para entrar no receptor. [Restore](https://coolify.io/docs/core/backup-and-recovery/instance-restore), [Custódia de chaves SSH](https://coolify.io/docs/core/security/credentials/ssh-keys).

Restauração substitui o banco da instância e exige a chave correspondente ao backup. Registrar a versão capturada; seguir a mesma versão no destino antes de qualquer atualização. Em máquina nova, conservar os demais valores do novo `.env`, como senha do banco Coolify, em vez de copiar indiscriminadamente o arquivo antigo. O procedimento oficial separa parada do control plane dos recursos já implantados, que continuam executando. [Restore da instância](https://coolify.io/docs/core/backup-and-recovery/instance-restore).

**Aplicação local:** Q48 define o cofre, mas custódia efetiva, exportação protegida de arquivos, restauração do painel, acesso sem o primário e cópias externas ainda precisam ser executados e ensaiados. O backup Coolify não substitui a cadeia física/base/WAL do Ritmo. [Spec/07](../../specs/07-nao-funcionais-e-lgpd.md), [provisionamento externo](../../api/ops/external-provisioning.md).

## Gates antes de aceitar operação externa

1. Confirmar produto, OS/arquitetura, versão real Coolify/Docker/Compose, localização e independência das máquinas.
2. Ensaiar SSH do controller e acesso administrativo de recuperação, incluindo perda total do controller.
3. Demonstrar transporte privado do PostgreSQL, ausência de exposição pública e mounts persistentes no host correto.
4. Implementar/ensaiar supervisor e agenda locais; provar freeze contra restart/redeploy/reboot e ausência de dois receptores concorrentes.
5. Medir durabilidade, espaço/retenção e impacto do percurso síncrono; observar a cadeia sob falha, não apenas status verde no painel.
6. Restaurar Coolify com banco/chave/arquivos consistentes e restaurar Ritmo separadamente, com completude, quarentena e RPO/RTO externo.
7. Provar detector/e-mail no terceiro host quando controller e receptor estiverem indisponíveis.

Estes gates consolidam pendências existentes do [ADR-019](../adr/0019-recuperacao-operacional-sem-perda-de-confirmacoes.md) e do [recorte 4](../../api/ops/external-provisioning.md); leitura de documentação e de código upstream não equivale a implantação ou aceite.

## Guia e verificação local

O [guia de configuração](../../api/ops/coolify-remote-server.md) aplica estas referências ao cenário do Ritmo, com cadastro/portas/recursos/persistência e pendências de supervisão. Checks e limites documentados no guia: app 94/94 e API check aprovado com operationsTest 8/8 executado e suíte Java UP-TO-DATE. Nenhum ensaio novo de Coolify ou VPS remota.
