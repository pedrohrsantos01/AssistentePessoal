# Preparação do provisionamento externo — 02/10/2026

Estado: **preparo local verificado; recorte 4 em preparação local e não concluído**.
Origem: [tarefa 04](../../.scratch/recuperacao-operacional/issues/04-validar-operacao-externa.md), [REQ-NFR-004](../../specs/07-nao-funcionais-e-lgpd.md) e [ADR-019](../adr/0019-recuperacao-operacional-sem-perda-de-confirmacoes.md).

## Resultado

Pedro autorizou seguir ao próximo recorte recomendado após o ciclo operacional local. Conferimos a memória do marco anterior com plano/specs/código/Git atuais. A base de partida é 23067bf; não havia mudanças locais.

O [caderno de provisionamento/aceite](../../api/ops/external-provisioning.md) organiza quatro etapas: 4A definir ambiente/custos, 4B construir/testar pacote, 4C instalar em rede isolada e 4D aceitar provas externas antes da exposição. Contém inventário sem segredos, topologia/conexões, cálculo de capacidade da cadeia física, parcelas de custos, ordem de ativação, matriz de gates e roteiro/registro do ensaio completo. Nenhum limite de produto foi alterado. A [proposta com custos/custódia](2026-10-02-proposta-de-infraestrutura.md) compara US$21/US$34 mensais antes dos adicionais, recomenda preparar os artefatos localmente antes de contratar e registra Q47/Q48 respondidas: perfil A para artefatos locais, fornecedores/orçamento depois, Bitwarden Free escolhido.

A [pesquisa técnica](2026-10-02-referencias-provisionamento-externo.md), executada conforme a skill research com agente de pesquisa em background, registra fontes primárias Coolify/Docker/Adoptium/Tomcat/Spring/PostgreSQL/systemd. As fontes orientam o pacote, com comparação Hostinger/R2 acrescentada por Q47, sem escolher fornecedor/região/supervisor ou afirmar que uma instalação existe.

## Lacunas confirmadas

- Q44 confirmou VPS Hostinger/Campinas-SP, 2 vCPU/8 GB RAM/100 GB disco, Ubuntu 24.04/Coolify 4.3.23. Capacidade livre/arquitetura/configuração ainda não foram inspecionadas; remoto Git, domínio e acessos operacionais não estão definidos.
- Na base inicial 23067bf, o checkout não tinha Dockerfile/Compose de implantação. O build deve incluir contracts pela raiz do repositório; o contrato do jar usa ../contracts no Gradle.
- A confiança de cabeçalhos do proxy está desligada na configuração atual. A allowlist precisa corresponder à rede real; não ativar encaminhamento irrestrito para resolver IP externo.
- O monitor atual mede espaço do receptor. Disco/slot do primário, saúde do detector/agenda e do canal SMTP exigem integração operacional adicional. O próprio detector não prova que continuará funcionando quando seu host morrer.
- Base física diária, âncora/WAL, staging e cópias congeladas exigem dimensionamento medido. Um disco que comporte só uma base ou um orçamento por usuário não basta.
- DigitalOcean bloqueia SMTP 25/465/587; detector com Resend pode ensaiar 2587/STARTTLS, que o provedor de e-mail documenta, mas acesso permitido/entrega real continuam gate. Não presumir funcionamento pela cotação nem contornar bloqueios por túnel.
- Instalação nova só dispõe do histórico já acumulado. Configurar retenção=30 não comprova uma janela retroativa de 30 dias.

Essas lacunas constam da tarefa/caderno como entregas e gates; não são apresentadas como implementação pronta.

## Definições solicitadas

Q44: confirmar a VPS/Coolify mencionada no PRD, provedor/região, Linux/Coolify, CPU/RAM/disco quando conhecidos. Q45: teto mensal adicional para receptor/detector e restrições de região/provedor. Q46: cofre externo e serviço de e-mail/SMTP já existentes ou necessidade de escolha. Somente nomes/configuração não sensível; nenhum segredo foi solicitado.

Pedro respondeu as três: Q44 confirmou o ambiente acima; Q45 pediu recomendações específicas, sem aprovar teto; Q46 informou Resend existente e solicitou sugestões de cofre. A [proposta](2026-10-02-proposta-de-infraestrutura.md) recomenda perfis com preços oficiais e Bitwarden Free cloud, com Q47/Q48 já respondidas: perfil A/artefatos locais primeiro, fornecedores/orçamento depois, comparação Hostinger/R2 documentada e Bitwarden Free escolhido. Rota privada, capacidade, acesso a gestão/cofre, remoto/domínios e envio real devem ser definidos/verificados antes da instalação. A compra e a exposição externa não são inferidas da autorização de trabalho local, conforme o plano confirmado.

## Verificação local

- App: pnpm --dir app typecheck, lint e test, todos com exit 0; 94/94 testes aprovados, nenhum ignorado.
- API: Java 21, gradlew.bat -p api check --no-daemon, exit 0 em 31 s; operationsTest executou 8/8. Compile/resources/suíte Java ficaram UP-TO-DATE, pois este incremento altera apenas Markdown. Não foi executado novo ensaio de WAL/RTO; o resultado anterior da suíte Java permanece referência do [recorte 3](2026-10-02-ciclo-operacional-de-backups.md).
- 10 Markdown e 104 referências locais a arquivos verificados; diff sem erros de whitespace antes do commit. Nenhuma nova dependência, migration, código de domínio, schema ou contrato m1.1.

As chamadas foram finitas, sem iniciar serviço local persistente. Pesquisa web não é teste de emissão TLS, build de imagem, transporte privado ou operação de fornecedor. Não há e-mail externo recebido, infraestrutura comprada/instalada, perda real de host ou RTO externo medido neste preparo.

## Pendências e continuação

Preparar/testar o pacote local 4B, conforme Q47; comparar Hostinger/R2 e medir capacidade/rede. Fornecedores/orçamento/contratação ficam para depois. Q48 escolheu Bitwarden Free. A tarefa 04 está em preparação local, com instalação/aceite externos pendentes e Concluída: não. M1, Q28/UI, iPhone/Android e distribuição iOS continuam abertos.
