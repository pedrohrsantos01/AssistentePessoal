---
status: accepted
date: 2026-10-21
---

# ADR-021 — Fronteira web de origem, credenciais e transação local

Pedro escolheu **A em Q67, Q68 e Q69** na [entrevista PWA](../../.scratch/pwa-m1/entrevista.md), após o [diagnóstico da rodada1](../analises/2026-10-21-contratos-pwa-rodada-1.md). Complementa ADR-020 e preserva o cliente React Native.

- **Q67:** frontend estático e API Java sob a mesma origem pública HTTPS, com encaminhamento dos caminhos pelo proxy. Reduz configuração entre origens; não dispensa CSRF, autorização, TLS ou headers de cache adequados. Nome do domínio e provisionamento permanecem pendentes.
- **Q68:** credenciais web em cookies HttpOnly/Secure, sem access/refresh/revogação legíveis pelo JavaScript. A fronteira web fica no Java existente; não cria runtime servidor de frontend. Não substitui o transporte bearer nativo nem decide ainda entre cookie opaco e cookies do ciclo access/refresh.
- **Q69:** controle e domínio no mesmo banco IndexedDB por instalação web, sempre particionados e filtrados por conta. A preferência visual fica em banco separado, conforme Q58. Permite validar proprietário/conta/geração dentro da mesma transação de intenção+sequência+projeção. Uma falha estrutural dessa base pode bloquear todas as contas locais; falha restrita recuperável de uma conta conserva o bloqueio só do seu escopo, sem reset ou descarte.

## Alternativas e consequências

Não foram escolhidas origens públicas distintas com CORS/credenciais, access bearer exposto à memória JS ou bancos de domínio separados por conta. A separação física por conta, usada no nativo, não oferece uma transação IndexedDB entre databases; conservá-la exigiria outro protocolo de coordenação. A separação lógica aprovada não reduz a obrigação de isolamento/autenticação nem equivale a um cofre contra scripts da mesma origem.

Cookies protegidos exigem CSRF e contratos de sessão/instalação/renovação/revogação/resposta tardia. Cercar a transação local não impede Set-Cookie tardio. A sessão escolhida precisa validar a conta/geração esperada antes de operar domínio; uma referência pública nunca autentica por si.

Esta decisão aprova as fronteiras, não nomes/TTLs/campos/endpoints ou migrations. Esses detalhes e os ramos de instalação, rascunhos e atualização continuam na tarefa02; as decisões novas da rodada2 ainda não foram tomadas. Nenhum runtime foi alterado, não há aceite Safari/M1 nem publicação/compra por este ADR.
