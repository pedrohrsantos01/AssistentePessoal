---
status: accepted
date: 2026-09-24
---

# ADR-016 — Logout preserva pendências isoladas por conta

O usuário pode sair da conta mesmo offline. Alterações ainda não sincronizadas permanecem no aparelho, isoladas e vinculadas à conta que as criou, para recuperação ao entrar novamente nessa mesma conta. Pedro escolheu essa alternativa em R1-Q4, em vez de exigir sincronização antes de sair ou descartar as alterações na saída.

Esta decisão substitui a limpeza integral do SQLite antes prescrita em REQ-CTA-004. Os dados preservados não podem ficar disponíveis na sessão de outra conta. O custo aceito é representar o estado local de uma conta sem sessão ativa e sua recuperação posterior.

Em R2-Q5 a R2-Q7, Pedro definiu os limites dessa preservação:

- Após logout deliberado, a reentrada exige autenticação online. Uma sessão local que não foi encerrada continua permitindo uso offline conforme o spec de Conta.
- As pendências não expiram automaticamente. Permanecem até confirmação de sincronização, descarte explicitamente escolhido ou exclusão confirmada da conta. A expiração do refresh token e a retenção de tombstones não autorizam descartá-las.
- É permitido entrar e usar a conta B enquanto existem pendências de A. B não pode consultar, exportar ou enviar os dados de A; recuperar e enviar as pendências de A exige autenticação como A.

O detalhamento posterior em spec/13 §2 preserva também o cache sincronizado no banco isolado e mantém uma capacidade protegida que só revoga a família de refresh, enviada quando houver rede. Em 26/09/2026, Pedro aprovou que a resposta de refresh não devolve essa capacidade: o cliente conserva a original do login. Não foi aprovada reentrada offline, biometria nem uma tecnologia de isolamento ou criptografia específica.

Logout e exclusão de conta são fluxos distintos. A decisão não altera REQ-CTA-011 nem transforma a fila local em backup contra desinstalação ou perda do aparelho.

Origem: [entrevista da fundação, R1-Q4 e R2-Q5 a R2-Q7](../../.scratch/fundacao/entrevista.md). Contratos afetados: [conta](../../specs/01-conta-e-onboarding.md) e [sincronização](../../specs/06-sincronizacao.md).
