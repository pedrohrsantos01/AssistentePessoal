# spec/01 — Conta e onboarding

**Prioridade:** P0. Estava totalmente ausente do PRD v1.

---

## 1. Autenticação

**REQ-CTA-001 — Fase 1: e-mail e senha apenas** (ADR-011). Sem Apple, sem Google. A exigência da App Store de oferecer login Apple só vale se existir outro login social — sem nenhum, não se aplica. Login social entra quando o app for para a loja.

> Atenção: a conexão com o Google Calendar (spec/12) é OAuth de **autorização**, não de autenticação. São coisas diferentes e não se misturam: conectar o calendário não cria nem vincula conta.

**REQ-CTA-002** — Senha mínima de 8 caracteres, com medidor de força. Nada de exigência de símbolo obrigatório (piora a segurança real e a conversão).

**REQ-CTA-003** — Recuperação de senha por e-mail com link de uso único e validade de 1 hora. Confirmação válida invalida também os demais links anteriores e revoga as sessões da conta; nova solicitação não invalida links anteriores. Endpoints, SMTP local e preservação de pendências foram exercitados no [incremento de recuperação](../docs/analises/2026-09-27-recuperacao-de-senha.md). Domínio/provedor, associação de links e tela/aparelhos continuam pendentes para aceite real.

**REQ-CTA-004 — Sessão.** Access token JWT de vida curta (15 min) e refresh token de vida longa (30 dias), rotacionado a cada uso e revogável. Ambos em `expo-secure-store`, nunca em AsyncStorage. O usuário não reautentica em uso normal. Logout encerra o acesso local à conta e permite a saída mesmo offline. Pendências de sincronização são preservadas no aparelho, isoladas e vinculadas à conta de origem, para recuperação ao entrar novamente na mesma conta; outra conta não pode acessá-las. A regra anterior de apagar todo o SQLite no logout foi substituída pelo [ADR-016](../docs/adr/0016-preservar-pendencias-no-logout.md).

**REQ-CTA-004b — Reentrada e troca de conta.** Após logout deliberado, entrar novamente exige autenticação online, mesmo havendo dados preservados. O uso offline continua disponível enquanto a sessão local não tiver sido encerrada; expiração de token não equivale a logout nem autoriza descarte. É permitido usar a conta B com pendências preservadas de A. Nenhuma leitura, exportação ou sincronização de B pode acessar dados de A; recuperá-los e enviá-los exige autenticação como A.

**REQ-CTA-004c — Retenção das pendências.** Não há expiração automática. As alterações e os dados necessários à sua recuperação permanecem vinculados à conta de origem até confirmação de sincronização, descarte explicitamente escolhido ou exclusão confirmada da conta. Os prazos do refresh token e dos tombstones não são prazos de descarte local. Preservação no aparelho não é backup contra desinstalação ou perda do dispositivo.

**[DESENHO TÉCNICO — sessão após logout]** O contrato em [spec/13 §2](13-contrato-primeiro-marco.md#2-conta-e-sessão) preserva o banco isolado e usa credencial limitada de revogação no SecureStore, sem manter refresh utilizável após logout. A implementação e as evidências de recuperação entre SecureStore/SQLite estão no [relatório de sessão](../docs/analises/2026-09-26-sessao-e-isolamento.md). O aceite físico em iPhone continua pendente; reentrada online e retenção permanecem aprovadas.

**REQ-CTA-004a — Claims do token.** O JWT carrega `sub` (user_id), `plan` (`free`\|`pro`) e `tz`. O `plan` existe desde a Fase 1 sempre como `free`, para que billing futuro não exija mudança de contrato (ADR-006).

**REQ-CTA-005** — Múltiplos dispositivos na mesma conta são suportados desde o v1 (regras em `specs/06-sincronizacao.md`).

**REQ-CTA-006 — Não existe modo convidado.** Conta é obrigatória antes de qualquer uso (ADR-010 do PRD). `user_id` é a base de toda RLS, de todo índice de sincronização e de toda tabela — permitir uso sem conta exigiria um usuário local fantasma e uma migração posterior de dados, complexidade que não se paga num app de um usuário. Se o app for comercializado, reavaliar.

### Estados observáveis da sessão

Contrato de comportamento aceito em R1-Q4 e R2-Q5 a R2-Q7; armazenamento e revogação estão concretizados no spec/13 §2, no contrato HTTP e no spec/00 §12.7.

| Situação | Acesso local | Sincronização e recuperação |
|---|---|---|
| Sessão mantida, sem rede ou com token expirado | Uso local continua disponível | Pendências preservadas; acesso remoto depende de credencial válida |
| Logout deliberado, com ou sem rede | Acesso à conta encerrado | Dados pendentes isolados; reentrada exige autenticação online como a conta de origem |
| Conta B autenticada, com pendências de A | Apenas dados de B disponíveis | Pendências de A aguardam autenticação como A |
| Autenticação remota recusada, sem confirmação de exclusão da conta | Não implica descarte de dados | Solicitar reautenticação para acesso remoto; preservar pendências |
| Exclusão da conta confirmada | Aplicar o fluxo de exclusão | Descartar pendências dessa conta conforme REQ-CTA-011 |

## 2. Onboarding

### Recorte do primeiro marco — aprovado em R6-Q27

Depois da autenticação, confirmar fuso/início do dia e permitir criar o primeiro **hábito binário diário**, com opção visível de pular. O fluxo é retomável; em seguida, abrir o Briefing mínimo com saudação, hábitos e XP básico. Se a criação for pulada, apresentar boas-vindas e uma ação de criar hábito, sem lista em branco.

Neste recorte, não demonstrar voz indisponível nem pedir acesso ao Google, microfone ou notificações antes de existir a capacidade correspondente. Consentimento de telemetria continua obrigatório antes da coleta, caso ela seja habilitada. As etapas ligadas aos demais módulos acompanham seus incrementos da Fase 1; isso não os retira do escopo final.

### Onboarding da Fase 1 completa

Teto de **5 telas**, conforme REQ-CTA-010. A sequência abaixo corresponde às capacidades completas, não a uma exigência de implementá-las antes do primeiro valor do marco inicial.

1. **Boas-vindas** — a promessa em uma frase, com demonstração de 5 s do registro por voz
2. **Fuso e início do dia** — detectado automaticamente, apenas confirmar. Grava `timezone` e `day_start_hour`
3. **Primeiros hábitos** — escolher de 1 a 3 de uma lista sugerida ou criar o próprio. **Pular é permitido e visível**
4. **Agenda** — conectar o Google Calendar, com explicação do que será lido. **Pular é permitido e visível**; o módulo fica inativo até ser conectado (spec/12)
5. **Permissões** — notificação e microfone, pedidas com explicação de valor antes do diálogo do sistema. Negar não bloqueia nada

**REQ-CTA-007** — Consentimentos de IA (`ai_consent_at`) e de telemetria (`analytics_consent_at`) são apresentados na última tela, **separados entre si** e separados das permissões do sistema, em linguagem simples. Recusar qualquer um não bloqueia o app.

> O onboarding agora tem 5 telas. Esse é o teto (REQ-CTA-010). Módulo novo não ganha tela de onboarding: ganha configuração posterior.

**REQ-CTA-008** — Onboarding é retomável: fechar o app no meio volta no mesmo ponto.

**REQ-CTA-009** — Após o onboarding, o **Briefing** (spec/08) **nunca** está vazio: se o usuário pulou a tela 3, mostra-se card de boas-vindas com ações sugeridas, não uma lista em branco.

**REQ-CTA-010 — Teto de 5 telas no onboarding.** Já atingido. O módulo Notícias (Fase 2A) **não** ganha tela: a seleção de temas de `specs/09-noticias.md` §2 acontece na primeira abertura do módulo, não no onboarding.

## 3. Perfil e configurações

Editar nome, fuso, hora de início do dia, ativar/desativar ofensiva, horário de silêncio, gerenciar permissões, ver uso de IA do dia, exportar dados, excluir conta.

## 4. Exclusão e exportação (LGPD)

**REQ-CTA-012 — Exportar.** Gera JSON com todas as entidades do usuário e envia por e-mail ou compartilhamento nativo, em até 24h. Formato documentado. Identificador corrigido em 25/09/2026: a antiga duplicidade de `REQ-CTA-010` confundia exportação com o teto de telas do onboarding, sem mudança de comportamento.

**REQ-CTA-011 — Excluir conta.** Fluxo dentro do app (exigência da App Store), com confirmação por digitação. Anonimização imediata e **job agendado** que apaga fisicamente em até 30 dias — com backend próprio, esse job é seu: precisa existir, ter teste e ser monitorado. Todos os refresh tokens são revogados e o acesso ao Google Calendar é revogado na conta do usuário.

## 5. Edge cases mapeados

1. Mesmo e-mail via senha e depois via Google → vincular à conta existente, nunca duplicar
2. Onboarding concluído sem rede → permitido; a conta já existe (o cadastro exige rede), e os hábitos criados entram na fila de sync normalmente
3. Login numa conta que já tem dados, em aparelho novo → pull completo com barra de progresso e retomada em caso de queda; nada é mesclado, porque não há dados locais anteriores
4. Token expirado offline → app continua funcionando em modo local; sync retoma no próximo login
5. Exclusão confirmada de conta com fila de sync pendente → fila dessa conta é descartada; logout, token expirado ou erro de autenticação isolado não comprovam exclusão
6. Apple Private Relay (e-mail ocultado) → suportado; nunca usar e-mail como chave de negócio, só `user_id`
7. Logout offline com alterações ainda não sincronizadas → saída permitida; pendências preservadas sem expiração automática e isoladas; reentrada exige autenticação online como a mesma conta (ADR-016)
8. Login como B com pendências de A → uso de B permitido; os dados de A não aparecem nem são exportados ou enviados na sessão de B
9. Pendência mais antiga que o refresh token ou a retenção de tombstones → não descartar por idade; recuperar após autenticação na mesma conta e reconciliar conforme o contrato de sync


## Recuperação operacional — Q36/Q37, 02/10/2026

Após recuperação integral do servidor, invalidar access/refresh, sessões e links de recuperação anteriores e exigir novo login online, preservando a senha correta recuperada. Recusa remota não encerra a conta local ativa nem apaga SQLite/pendências; logout deliberado e troca de conta mantêm ADR-016. Durante quarentena, identidade e sync retornam indisponibilidade transitória. [ADR-019](../docs/adr/0019-recuperacao-operacional-sem-perda-de-confirmacoes.md) e [procedimento/contrato](13-contrato-primeiro-marco.md#19-contenção-e-retomada-operacional--02102026).
