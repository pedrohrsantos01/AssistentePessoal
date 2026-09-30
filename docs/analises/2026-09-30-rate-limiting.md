# Rate limiting — 30/09/2026

## Resultado

Implementadas as quotas aprovadas na Q32 e documentadas em spec/07 §4.1: conta 120/min; API por IP 300/min; login 10/min; cadastro 5/min; recuperação 3/15 min; confirmação 10/min; refresh e revoke 60/min cada. Resposta de excesso: 429 `rate_limited`, `Retry-After` arredondado para cima e envelope de erro m1.1. A recusa não executa o controller.

A quota por IP precede consulta de compatibilidade, leitura/descompressão do corpo e autenticação. O limite de conta recebe apenas o subject do JWT validado. Ambos usam o caminho decodificado do servlet: o teste revelou que `%6cogin` alcançava o controller sem a quota específica quando o filtro comparava o URI bruto; a correção também protege prefixos codificados da API.

Bucket4j 8.20.0, artefato Java 17+, foi resolvido e fixado no lockfile. O bucket usa refill greedy, relógio monotônico e consumo imediato; não espera a reposição na thread HTTP. A interface pública do módulo limita-se a verificar IP/rota e conta. A documentação oficial fornece a API de consumo e o artefato utilizado. [Bucket4j](https://github.com/bucket4j/bucket4j), [release 8.20.0](https://github.com/bucket4j/bucket4j/releases/tag/8.20.0).

O filtro de conta fica após BearerTokenAuthenticationFilter na cadeia de segurança e não é registrado novamente como filtro de servlet. Essa ordem permite usar o JWT validado e evita cobranças duplicadas. [Arquitetura de filtros do Spring Security](https://docs.spring.io/spring-security/reference/servlet/architecture.html).

## Evidência verificável

Onze testes de RateLimitTests exercitam HTTP real com PostgreSQL/SMTP descartáveis, defaults aprovados e relógio externo controlado:

- Login: 10 tentativas permitidas, 11ª bloqueada mesmo trocando e-mail, dispositivo e cabeçalhos de IP.
- Conta: 120 requisições compartilhadas entre dois aparelhos/rotas; outra conta conserva sua quota. JWT inválido continua recusado pela autenticação. Reposição de um token após exatamente 0,5 s.
- Todos os endpoints anônimos têm quotas independentes; tentativa inválida também consome crédito.
- URLs codificados conservam limites de endpoint e API; 300 requisições de protocolo inválido esgotam a quota geral.
- Vinte logins simultâneos produzem exatamente 10 respostas de autenticação e 10 de rate limiting; espera é arredondada para cima e só libera após reposição.
- Pressão em armazenamento de oito buckets de fixture recusa identidades novas com 503, preserva dívida existente e libera entrada após reposição segura. Produção usa 10.000.
- Recuperação de senha conserva o mesmo comportamento de quota para e-mail existente/inexistente.
- Refresh/revoke bloqueados não consomem nem revogam a credencial; o mesmo token funciona após reposição e a revogação posterior bloqueia renovação.
- Um push de 50 operações aceita todas e consome um token, conservando a última requisição da quota.
- O cliente Session/AccountStore/SyncScheduler recebe 429 real durante push, preserva dois envelopes e Retry-After no SQLite, reabre a conta e converge com 10 XP. Replay conserva recibos e um segundo armazenamento confirma o resultado sem XP duplicado.

O teste móvel observa chamadas HTTP reais apenas para preencher o orçamento e usa arquivos temporários sem credenciais para coordenar a passagem do relógio externo do servidor. Não simula 429 nem acrescenta endpoint ao runtime. Nenhum teste de quota consulta tabelas privadas ou inspeciona o mapa de buckets. RuntimeTests recebe quotas altas e finitas próprias para regressões de grande volume; RateLimitTests mantém os valores de produção.

TDD: testes novos de login, conta, endpoints anônimos e rota codificada falharam antes da respectiva implementação/correção e passaram depois. As fixtures foram ajustadas para corpos JSON válidos, declaração Java e títulos distintos no lote; o comportamento de domínio permanece vigente.

## Validação

- `pnpm --dir app typecheck`: aprovado.
- `pnpm --dir app lint`: aprovado.
- `pnpm --dir app test`: 94 aprovados.
- `api/gradlew.bat -p api check`: 48 aprovados, 1 nativo Android ignorado por ausência de RITMO_ANDROID_SERIAL; inclui ModularityTests e os onze casos acima.
- `api/gradlew.bat -p api check bootJar --write-locks`: aprovado; JAR executável empacotado com a dependência nova.

Resultados transitórios: api/build/test-results/test, api/build/reports/tests/test e api/build/rate-limit-integration.log. Sem mudança de schema, migration ou contrato gerado. A resposta e os retries existentes do app são suficientes; este recorte adiciona a prova de integração.

## Limites e próxima tarefa

[Guia de operação](../../api/ops/rate-limits.md): variáveis de ambiente, limites de configuração, cardinalidade, reinício e proxy. As quotas são locais e reiniciam com o processo; a execução alvo permanece uma instância. Cabeçalhos de IP não são confiados. Provisionamento do proxy confiável, exposição TLS/Coolify, backup/restauração, retenção/expurgo e aceite real de recuperação/aparelhos continuam pendentes.

M1 e tarefa 05 permanecem abertos. Interface aguarda o protótipo Q28; iPhone 16e/Android não foram aceitos neste incremento. Próximo recorte recomendado: REQ-NFR-004, backup/restauração reproduzível em ambiente limpo, com checklist de provisionamento. Decompor os demais eixos com grilling após tratar as lacunas do M1.
