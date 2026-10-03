# Rate limiting do M1

Contrato aprovado: [spec/07 §4.1](../../specs/07-nao-funcionais-e-lgpd.md#41-rate-limiting-do-primeiro-marco--q32-30092026), Q32. A API utiliza Bucket4j local; iniciar somente uma instância neste marco.

## Configuração

Cada prefixo recebe `_CAPACITY` e `_PERIOD_SECONDS`. O período é em segundos; o bucket começa cheio e repõe continuamente a capacidade durante esse período. Alterações de ambiente valem no próximo start.

| Prefixo de ambiente | Capacidade padrão | Período padrão | Escopo |
|---|---:|---:|---|
| `RITMO_RATE_API_IP` | 300 | 60 | Toda a API por peer TCP |
| `RITMO_RATE_ACCOUNT` | 120 | 60 | Conta do JWT validado |
| `RITMO_RATE_LOGIN` | 10 | 60 | Login por IP |
| `RITMO_RATE_REGISTER` | 5 | 60 | Cadastro por IP |
| `RITMO_RATE_RESET_REQUEST` | 3 | 900 | Solicitação de recuperação por IP |
| `RITMO_RATE_RESET_CONFIRM` | 10 | 60 | Confirmação de recuperação por IP |
| `RITMO_RATE_REFRESH` | 60 | 60 | Renovação por IP |
| `RITMO_RATE_REVOKE` | 60 | 60 | Revogação por IP |

Exemplo: `RITMO_RATE_LOGIN_CAPACITY=10`, `RITMO_RATE_LOGIN_PERIOD_SECONDS=60`. Capacidades válidas: 1 a 1.000.000; períodos: 1 a 86.400. Zero não desliga a proteção; configuração inválida impede o start.

`RITMO_RATE_MAX_BUCKETS` limita o armazenamento a 10.000 buckets por padrão; faixa válida: 1 a 100.000. As oito categorias compartilham esse limite. Buckets permanecem apenas em memória e são removidos sob pressão quando ficaram inativos por um período completo de reposição. A API não libera crédito eliminando um bucket com dívida. Se faltarem posições seguras para uma identidade nova, responde 503 com `Retry-After`; identidades existentes conservam seu orçamento.

## Comportamento HTTP e do app

Cada requisição consome um token em cada quota aplicável, inclusive respostas inválidas. Um push de 50 operações custa uma requisição. A origem é o caminho decodificado do servlet; codificar letras do URL não cria outra quota. Todos os aparelhos e rotas da mesma conta compartilham a quota autenticada; e-mail e deviceId do corpo não identificam a conta para esse limite.

429 usa `rate_limited`; 503 por cardinalidade usa `temporarily_unavailable`. Ambos levam `Retry-After` inteiro, arredondado para cima. Não há espera de reposição na thread HTTP. Os filtros recusam antes do controller: não criam conta, não rotacionam/revogam credenciais e não produzem recibos de sync. Tokens das quotas anteriores já consumidos pela requisição não são reembolsados.

O campo opcional `error.retryAfterSeconds` continua compatível com m1.1: inteiro de 1 a 300 ou null. Esperas maiores, possíveis em configurações próprias, são informadas integralmente no cabeçalho; não encurtar a espera para caber nesse campo. O app usa o cabeçalho e o backoff existente, conservando o envelope original no SQLite.

## Proxy e reinício

`server.forward-headers-strategy=none` conserva o peer TCP. Por padrão, cabeçalhos de origem são ignorados. A lista RITMO_TRUSTED_PROXY_PEERS aceita somente IPs literais exatos; apenas desses peers a quota usa um XFF único e válido, normalizado. Ambiguidade ou erro voltam ao orçamento do peer. Não ativar confiança genérica em cabeçalhos.

O [pacote proxy/TLS](proxy-tls.md) e a [ativação no Coolify](proxy-activation.md) concretizam sanitização na borda e allowlist privada. A [prova local](../../docs/analises/2026-10-03-proxy-tls-e-origem-confiavel.md) atravessa TLS/Traefik/API reais; instalação externa, peer observado, firewall e ausência de bypass público continuam gates obrigatórios. Atrás de um proxy sem allowlist, o limite por IP agrega seus clientes.

Reiniciar a API esvazia os buckets e restaura a capacidade inicial. Não há quota persistente ou distribuída; múltiplas réplicas não compartilham orçamento. Não registrar IP, senha, credenciais ou payload de recuperação/sync em logs. Os testes usam identidades fictícias, PostgreSQL/SMTP descartáveis e relógio monotônico externo controlado; a API de produção não expõe uma rota de teste.

Evidências: [relatório de rate limiting](../../docs/analises/2026-09-30-rate-limiting.md).
