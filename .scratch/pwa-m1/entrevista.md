# Entrevista — contratos da PWA

Fonte: spec/14 e tarefa02. Método grilling: decisões por dependência; fatos apurados no código/fontes oficiais. Recomendações só viram contrato depois da resposta e consolidação. Não implementar os ramos pendentes.

## Decisões anteriores

Q61–Q65 aprovadas em [spec/14](../../specs/14-pwa-primeiro-marco.md): M1 funcional adicional; Safari/Tela de Início; durabilidade web com risco explícito; uma aba escritora; aceite funcional PWA+iPhone/Android. ADR-020 escolhe React DOM/Vite/Router+Dexie+Workbox. Prova01 local concluída em `b8c8e46`, sem aceite Safari.

## Fato informado — Q66, 21/10/2026

Pedro informou **iOS26.6.2** instalado no iPhone16e. Não é resultado de teste físico nem confirmação da versão exata do Safari/WebKit. Origem HTTPS de teste e nome do domínio seguem pendentes conforme Q54; nenhuma compra/publicação solicitada.

## Rodada1 — respondida em 21/10/2026

Proposta concreta, opções e diagnóstico: [contratos rodada1](../../docs/analises/2026-10-21-contratos-pwa-rodada-1.md).

- **Q67 — Origem pública:** A, mesmo endereço HTTPS para frontend estático+API Java, recomendada; B, origens distintas com CORS/credenciais. **Pedro respondeu A.** Não define nome/DNS nem autoriza deploy.
- **Q68 — Credenciais web:** A, credenciais HttpOnly/Secure fora do JS, recomendada; B, access só em memória JS com refresh protegido por cookie. **Pedro respondeu A.** Nativo permanece bearer e não muda TTL nesta rodada.
- **Q69 — Banco transacional:** A, controle+domínio no mesmo IndexedDB por instalação com partição obrigatória por conta e preferências separadas, recomendada; B, bases de domínio separadas por conta com outro protocolo de coordenação. **Pedro respondeu A.** Não promover a prova a schema de produto.

## Árvore de decisões

```mermaid
flowchart TD
  Base["Q61–Q65 e ADR-020 aprovados"] --> Origem["Q67=A: mesma origem"]
  Base --> Credenciais["Q68=A: credenciais protegidas"]
  Base --> Banco["Q69=A: banco transacional"]
  Origem --> Sessao["Instalação, sessão, cookies copiados e reset"]
  Credenciais --> Sessao
  Credenciais --> Concorrencia["HTTP tardio, logout e transferência entre abas"]
  Banco --> Concorrencia
  Banco --> Upgrade["Schema, migrações e código antigo"]
  Concorrencia --> Upgrade
  Sessao --> Contratos["Consolidar contratos e fixtures"]
  Sessao --> Entrada["Q70=A: login na instalação nova"]
  Sessao --> Modelo["Q71=A: sessão opaca no Java"]
  Upgrade --> Rascunho["Q72=A: rascunho só na aba"]
  Entrada --> Contratos
  Modelo --> Validade["Q73=A: 30 dias de inatividade/90 absolutos"]
  Modelo --> Contextos["Q74=A: até quatro contextos"]
  Validade --> Contratos
  Contextos --> Contratos
  Rascunho --> Contratos
  Upgrade --> Contratos
  Contratos --> Prova["HTTPS e Safari/Tela de Início físicos"]
```

As três raízes Q67/Q68/Q69 foram aprovadas em A e consolidadas no [ADR-021](../../docs/adr/0021-fronteira-de-sessao-e-armazenamento-web.md). Q70/Q71/Q72 também foram aprovadas em A no [ADR-022](../../docs/adr/0022-sessao-opaca-e-entrada-por-instalacao-web.md). Q73/Q74 também aprovadas em A; prazo e limite de contextos definidos. Desenho de execução proposto abaixo; não promover a proposta a contrato de produto já implementado.

Garantias que não serão reperguntadas: ADR-016, Q51–Q53, Q56–Q58, Q61–Q65, domínio/XP/idempotência/dia lógico. Configuração operacional ainda depende dos gates existentes; fase M1 continua aberta.

## Rodada2 — respondida em 21/10/2026

Proposta concreta: [rodada2](../../docs/analises/2026-10-21-contratos-pwa-rodada-2.md).

- **Q70 — Contêiner novo:** A, autenticação online explícita e sessão própria, recomendada; B, transferência autenticada específica. **Pedro respondeu A.** Não apagar controle ilegível nem recuperar intenções ainda locais do Safari como se já estivessem no servidor.
- **Q71 — Modelo de sessão web:** A, sessão opaca controlada no Java/PostgreSQL, recomendada; B, ciclo nativo em cookies segregados por sessão/tentativa. **Pedro respondeu A.** Q68 não escolheu esse modelo; ambas precisam proteger respostas tardias.
- **Q72 — Formulário não salvo:** A, rascunho só na aba com recarga adiada e confirmação de descarte deliberado, recomendada; B, recuperação durável por conta. **Pedro respondeu A.** Intenções já salvas e isolamento pós logout mantêm suas garantias anteriores.

Próximos ramos dependem dessa rodada: protocolo exato de sessão, validade/renovação, cookies/CSRF e revogação; campos/stores/migrações e posse distinta da geração; atualização e recuperação; prova física. Não pedir novamente aprovação para logout offline, leitura da mesma sessão ativa ou invalidar conteúdo antigo após troca: já estão definidos.

21/10/2026 — Pedro confirmou A em Q70–Q72. [ADR-022](../../docs/adr/0022-sessao-opaca-e-entrada-por-instalacao-web.md) registra entrada explícita por instalação, sessão opaca e rascunho sem persistência. Prazo e protocolo da sessão web permanecem a detalhar; os15min/30dias do nativo não foram alterados.

## Rodada3 — respondida em 21/10/2026

Proposta e desenho: [contratos do navegador](contratos-navegador.md). Consolidação: [relatório da rodada3](../../docs/analises/2026-10-21-contratos-pwa-rodada-3.md).

- **Q73 — Validade web:** A,30dias sem comunicação remota autenticada, renovados pelo uso até90dias desde o login, recomendada; B,30dias fixos. **Pedro respondeu A.** Exigir login online para voltar a sincronizar após vencer; preservar uso/pendências da sessão local não encerrada. Valores do Ritmo, sem alterar os prazos nativos.
- **Q74 — Contextos locais:** A, até quatro contando ativo/preparações/encerramentos pendentes, recomendada; B, outro limite dependente de capacidade do browser. **Pedro respondeu A.** Nova entrada espera recuperação sem descartar intenções; sessão local ativa continua. Não inferir que quatro contextos provam oito cookies físicos ou que a recuperação já está implementada.

## Confirmação do entendimento — Q75 pendente

Proposta concreta: avançar em02a, especificando o protocolo e as representações/erros/fixtures, seguido de02b para provas locais visíveis;02c preserva o gate HTTPS/Safari/Tela de Início. Inclui reserva antes da senha, credenciais segregadas, recuperação sem quinta sessão, posse por época/CAS e limite de commit independente da aparência. O desenho ainda precisa provar cookies órfãos/limpeza, transições e crash/upgrade.

A confirmação abrange o plano local e o entendimento consolidado. Não aceita a PWA/M1, não publica/contrata e não libera tarefa03 sem os contratos/provas. Conforme grilling, aguardar confirmação antes de executar o desenho; não reabrir decisões Q61–Q74 já aprovadas.
