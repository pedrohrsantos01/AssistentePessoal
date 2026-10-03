# Proxy/TLS e origem confiável do cliente — 03/10/2026

Incremento local 4B de [REQ-NFR-004](../../specs/07-nao-funcionais-e-lgpd.md) e das quotas Q32, autorizado por Pedro como próximo recorte. [Tarefa 04](../../.scratch/recuperacao-operacional/issues/04-validar-operacao-externa.md), [plano aprovado](../../.scratch/recuperacao-operacional/spec.md), [contrato de engenharia](../../api/ops/proxy-tls.md) e [procedimento de ativação futura](../../api/ops/proxy-activation.md). Tarefa 04/4B/M1 permanecem abertos.

## Resultado

A API conserva o peer TCP e usa um XFF único/literal somente quando esse peer está na lista explícita RITMO_TRUSTED_PROXY_PEERS. O padrão vazio ignora encaminhamento. IPv4/IPv6 equivalentes compartilham orçamento; headers repetidos/encadeados/inválidos voltam ao peer, sem permitir novas chaves arbitrárias. A configuração recusa CIDR/DNS/portas/zonas e encaminhamento genérico no startup.

Os fragmentos Traefik eliminam confiança em headers de clientes externos, separam a rota HTTP de redirecionamento da rota TLS e aplicam HSTS nos erros. API/banco não publicam portas. Esquema/host/URLs da API continuam independentes dos headers; IP só integra a quota RAM limitada existente. Os fragmentos precisam de adaptação aos entrypoints, routers, mounts e ACME reais do Coolify.

## Evidência por interfaces públicas

TDD iniciou com HTTP real e PostgreSQL: o segundo cliente de um proxy recebia 429 porque o orçamento era agregado. Após o ajuste mínimo, conservou seu orçamento. TrustedProxyTests cobre três cenários, incluindo IPv6 expandido/comprimido e IPv4 mapeado, header ausente/repetido/chain/porta/DNS/endereço inválido; RateLimitTests confirma a política padrão sem confiança, quotas existentes e preservação das intenções SQLite.

ProxyTlsTests constrói o JAR pela imagem real, gera certificado descartável com SAN, sobe Traefik/PG18 e clientes Node em redes Docker isoladas. Verifica:

- TLS 1.2 e 1.3 com validação de certificado/hostname; certificado não confiável recusado.
- HTTP do domínio redireciona para HTTPS; host HTTP desconhecido não recebe rota da API.
- Cliente A chega a 429 mesmo alterando XFF/Forwarded/X-Real-IP/proto/host encaminhados; cliente B mantém sua quota. Retry-After e JSON rate_limited preservados.
- Peer privado fora da allowlist não muda sua quota forjando XFF; proto forjado não torna a requisição interna segura.
- Cliente na rede frontal não resolve o backend; API e PG têm bindings de portas vazios.
- HSTS de um ano em 401, 429, erro do gateway por perda do backend e 503 da API em quarentena.
- CIDR, hostname e estratégia genérica impedem o startup, com causa operacional reconhecida antes de remover a fixture. Também recusa remote-ip-header/protocol-header específicos do Tomcat, que instalariam RemoteIpValve mesmo com estratégia none.

Cada container/rede/imagem de teste pertence à fixture; certificado/chave gerados são removidos ao final. Não há rota de teste ou IP persistido na API.

Imagens da prova: PostgreSQL 18 `sha256:5a5a84b19854a9ffaa54082c166ff4ec27473a361e496e5ea167f298f2da9722`; Traefik v3.6.2 `sha256:aaf0f6185419a50c74651448c1a5bf4606bd2d2ddb7b8749eed505d55bf8b8ea`; Node 24.13.0 `sha256:4660b1ca8b28d6d1906fd644abe34b2ed81d15434d26d845ef0aced307cf4b6f`. Bases Temurin 21 já fixadas no Dockerfile. Dados e credenciais dessas suítes são fictícios.

A revisão do artefato Spring Boot 4.1.1 confirmou a condição de instalação em TomcatWebServerFactoryCustomizer.customizeRemoteIpValve: IP/protocol header explícito ou estratégia nativa. Um segundo ciclo red reproduziu o startup indevidamente permitido com o parâmetro de IP; a proteção foi ampliada aos dois parâmetros, com prova real incluída.

## Validação

- App: typecheck, lint e 94/94 testes aprovados.
- Quotas/origem: execução focal com RateLimitTests e TrustedProxyTests, 14/14 aprovados.
- TLS/proxy: execução focal de ProxyTlsTests aprovada, incluindo casos de configuração negativa.
- Check completo da API: aprovado em 14 min 10 s; 69 testes, 68 aprovados, zero falhas/erros e 1 Android opt-in ignorado. ModularityTests, restauração, WAL, supervisão, proxy/TLS e clientes SQLite incluídos. Operações: 10/10; provas nativas adicionais da agenda: 5/5; transporte: 9/9.
- Codificação UTF-8 dos 22 arquivos e 194 links locais: aprovados.

O check completo inicial encontrou erro 500 no ping do engine Docker antes do build de duas fixtures. A disponibilidade voltou sem reiniciar serviços. Na repetição, a fixture de congelamento revelou uma espera global de 20 s incompatível com cópia, verificação e fsync completos. Um atraso controlado de 45 s no pg_verifybackup real reproduziu o mesmo falso timeout. A espera da fixture passou a 120 s, com retomada concorrente novamente recusada após liberar o verificador; ensaio focal aprovado em 2 min 38 s. Os deadlines operacionais e todas as afirmações de segurança foram preservados. O ajuste da fixture está separado no commit f0a25bd.

Comandos: `pnpm --dir app typecheck`, `pnpm --dir app lint`, `pnpm --dir app test`; `gradlew.bat check --no-daemon` com Java 21. Saídas regeneráveis em api/build/reports/tests/test/, api/build/test-results/test/ e logs próprios da fixture em api/build/.

## Limites e próximo incremento

A prova usa proxy Linux descartável e certificados locais. Não comprova instalação na VPS, versão do Traefik no Coolify 4.3.23 informado por Pedro, DNS/ACME/renovação, firewall IPv4/IPv6 externo, peer de produção, latência real/espera WAL sob falha ou capacidade/independência dos provedores. Mínimo TLS 1.2 e deadlines estão configurados; calibração e ensaios externos seguem obrigatórios. Retirar WAL na fixture de proxy é a exceção descartável já aprovada para empacotamento, não configuração de operação; as demais suítes comprovam a barreira WAL.

502/504 e perda da conexão mantêm resultado de escrita incerto: preservar intenção/idempotência no app e confrontar timeout JDBC/proxy com espera WAL. O guia mantém os gates de contenção e não aceita RPO zero/RTO de 24 h reais por esta prova.

Próximo recorte recomendado: telemetria privada de saúde/disco/slot do primário e impacto da retenção WAL, integrando o detector existente antes da instalação isolada. Contratação/orçamento, canal SMTP alternativo independente, entrega real e aceite 4C/4D continuam pendentes. Protótipo/UI, aparelhos e distribuição permanecem no marco M1.

Fontes primárias e sua aplicação estão no [contrato](../../api/ops/proxy-tls.md) e no [guia](../../api/ops/proxy-activation.md); o comportamento local é afirmado pelos ensaios, não pela documentação dos fornecedores.
