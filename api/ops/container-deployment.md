# Imagem de implantação da API — contrato local

Origem: [recorte 4B](../../.scratch/recuperacao-operacional/issues/04-validar-operacao-externa.md), REQ-NFR-004 e [caderno externo](external-provisioning.md). Q47 autoriza artefatos locais antes de escolher fornecedores e orçamento.

## Comportamento esperado

O Dockerfile em api/Dockerfile usa a raiz do repositório como contexto. Compila pelo wrapper Gradle e lockfile com Java 21 JDK e inclui contracts/primeiro-marco/openapi.json como recurso do JAR. A execução usa Java 21 JRE e usuário sem privilégios (UID/GID 10001). As imagens base são fixadas por digest; atualização exige novo ensaio.

As cópias do build são explícitas. A lista de arquivos permitidos em .dockerignore exclui segredos, bases, backups, caches e demais arquivos do checkout. Credenciais de PostgreSQL e chave de assinatura entram somente em execução, por injeção privada do operador/Coolify. Não passar segredos por build-arg ou gravar arquivos de ambiente na imagem.

Por padrão a imagem exige WAL síncrono (RITMO_REQUIRE_WAL=true) e inicia em quarentena (RITMO_RECOVERY_QUARANTINE=true). Instalação e recuperação também exigem isolamento de rede real: a flag não fecha portas. A porta interna 8080 não é publicada pelo Dockerfile. Antes de liberar clientes, cumprir todos os gates do caderno externo, manter WAL obrigatório e só então retirar a quarentena.

O arquivo api/deploy/.env.example documenta variáveis sem valores de segredo. Campos obrigatórios vazios precisam ser preenchidos pelo canal privado; o exemplo não inicia um ambiente válido. Manter os logins de migração, domínio e identidade separados. A URL JDBC externa deve limitar conexão/leitura e verificar TLS conforme a rede definida na instalação; não reduzir durabilidade para contornar espera do receptor.

## Verificação local

O teste ContainerPackagingTests constrói a imagem pelo Docker real e sobe PostgreSQL 18 descartável com fsync ativo. Pela API HTTP verifica quarentena padrão, recusa sem receptor ao liberar apenas quarentena e cadastro/snapshot na exceção explicitamente descartável sem WAL. Nenhuma consulta privada é usada para afirmar dados de negócio. Verifica o UID do processo e encerra containers/rede/imagem da fixture ao final.

[Resultado e limites do ensaio](../../docs/analises/2026-10-02-imagem-de-implantacao-da-api.md). O ensaio valida empacotamento e padrões da imagem. Não aceita WAL/backup externos, proxy/TLS, latência, desempenho, entrega de e-mail ou RTO. O bypass de WAL usado somente nessa fixture não faz parte da configuração de operação.

## Construção

Na raiz do checkout:

```sh
docker build --file api/Dockerfile --tag ritmo-api:local .
```

No Coolify selecionar Dockerfile, api/Dockerfile e contexto na raiz. Uma única instância da API, ligada por rede privada ao banco; configurar proxy/TLS e segredos de runtime conforme o caderno. Os checks completos são executados fora do build, antes do aceite da versão. O build não instala scheduler, receptor, detector nem recursos externos.

Referências: [Docker build context](https://docs.docker.com/build/concepts/context/), [Temurin containers](https://adoptium.net/installation/containers/), [Coolify Dockerfile](https://coolify.io/docs/applications/builds/dockerfile).
