# spec/06 — Offline e sincronização

**Prioridade:** P0. Este é o subsistema de maior risco técnico do projeto (R4 do PRD). Implemente-o **junto com o primeiro módulo**, nunca depois — retrofitar sync em um app online-first é reescrita.

---

## 1. Princípio

**Local-first.** O SQLite é a fonte da verdade para a UI. Nenhuma tela espera rede. Toda escrita segue:

```
UI → repositório → escreve SQLite → enfileira em sync_mutations → responde à UI
                                            │
                                    (em background, com rede)
                                            ▼
                          push → POST /api/v1/sync/push → pull incremental
```

**REQ-SYN-001** — Nenhum componente chama a API remota diretamente. Sempre pelo repositório.

**REQ-SYN-002** — A UI **nunca** mostra spinner esperando a rede numa ação de escrita. Atualização otimista sempre.

Esse caminho é o de escrita de domínio. Cadastro, login, renovação e recuperação de senha exigem rede por REQ-CTA-004b e passam pela interface de Identity; componentes continuam sem HTTP direto. Fila e projeção de domínio são persistidas atomicamente; falha de armazenamento desfaz feedback otimista e informa que não foi salvo. Detalhamento de engenharia em [spec/13](13-contrato-primeiro-marco.md).

Salvar uma edição de regra de hábito offline confirma sua persistência como proposta, não sua vigência. A regra anterior continua ativa até a aceitação e a data efetiva de REQ-HAB-007b. Não mostrar a nova agenda/meta como já aplicada enquanto estiver "aguardando conexão" (R6-Q25).

**REQ-SYN-015 — Autoridade na reconciliação.** O armazenamento local serve à UI e permite resposta imediata offline. O servidor valida e reconcilia os fatos durante a sincronização; os aparelhos incorporam o resultado canônico e recalculam as projeções locais de progresso. Dois aparelhos marcando o mesmo hábito no mesmo dia devem convergir para um cumprimento e uma concessão de XP. Esta divisão foi aceita no [ADR-015](../docs/adr/0015-autoridade-na-reconciliacao.md). Identidade, confirmações e rejeições têm proposta técnica em spec/13 e modelo em spec/00 §12; schemas executáveis ainda precisam ser fechados. A comunicação dos resultados segue REQ-SYN-017.

**REQ-SYN-016 — Pendências após logout.** Sair da conta não descarta alterações ainda não confirmadas pelo servidor. Elas permanecem sem expiração automática, isoladas por conta, até sincronização confirmada, descarte explícito ou exclusão confirmada da conta. A reentrada exige autenticação online como a conta de origem; é permitido usar outra conta enquanto isso, sem expor nem enviar os dados preservados. Ver [ADR-016](../docs/adr/0016-preservar-pendencias-no-logout.md) e REQ-CTA-004b/c. Revogação remota do logout offline e recuperação diante de tombstones já expirados ainda precisam de contrato técnico.

**REQ-SYN-017 — Resultado de cada alteração.** Falha transitória mantém a alteração pendente e segue o retry de REQ-SYN-005. Reenvio ou duplicação reconciliada com sucesso permanece silencioso. Rejeição definitiva preserva o conteúdo recuperável e mostra aviso discreto com motivo e opção de corrigir ou descartar; não exige modal de resolução de conflito. Uma alteração recusada não pode aparecer como sincronizada nem continuar em retry automático indefinido. A classificação de resultados e seus códigos serão definidos no contrato de push.

**REQ-SYN-018 — Registro offline e janela retroativa.** A janela de sete dias de REQ-HAB-006 limita criar agora um novo registro para um dia passado; não é prazo de validade de envio de um registro já criado legitimamente no aparelho. O caso de duas semanas offline continua suportado. Idade do envio, sozinha, não autoriza rejeitar ou descartar essa pendência. Validar os fatos e suas regras, distinguindo criação retroativa de transmissão atrasada; o formato dos metadados e os critérios de validação serão definidos no protocolo. Esse esclarecimento deriva do suporte offline existente e da retenção aceita em R2-Q6, sem alterar a janela retroativa.

**REQ-SYN-019 — Confirmação de mudança de regra.** A aceitação de uma proposta de agenda/meta devolve sua regra canônica e a data de vigência. Retry de uma proposta já aceita devolve o mesmo resultado; não adia sua vigência novamente. Rejeição mantém a regra anterior e segue REQ-SYN-017. A representação física será definida no protocolo; o comportamento está em REQ-HAB-007b.

## 2. Push

**REQ-SYN-003** — Mutações são enviadas em ordem de criação, em lotes de até 50, para `POST /api/v1/sync/push`. Cada lote carrega um `Idempotency-Key`; reenvio do mesmo lote **não** duplica nada no servidor.

**REQ-SYN-003a — Contrato versionado.** Endpoints sob `/api/v1/`. Quebra de contrato exige `/v2` e convivência das duas versões durante a transição — nunca alteração silenciosa (ver REQ-SYN-014).

**REQ-SYN-004** — A convenção vigente usa UUID v7 gerado no cliente para as entidades criadas pelo app. Isso permite identificar um registro, mas não garante sozinho idempotência de ações ou deduplicação entre aparelhos: identidade de envio, identidade de lançamento e identidade de cumprimento/concessão têm papéis distintos (ADR-017). As exceções para entidades de origem exclusiva do servidor e o mapeamento das identidades ainda precisam ser fechados em spec/00; não inferir que cada UUID de log autoriza um novo XP.

**REQ-SYN-005** — Retry com backoff exponencial: 1s, 2s, 4s… até 5 minutos. Após 10 tentativas, marca `failed` e mostra aviso discreto com opção de tentar de novo.

**REQ-SYN-006** — Edições ainda não enviadas podem ser coalescidas quando preservarem o resultado e o contexto necessários à reconciliação: três edições sequenciais do mesmo título podem virar uma. A coalescência não pode apagar contribuições quantitativas, sua identidade, correções ou a informação necessária para distinguir uma nova marcação de uma marcação concorrente ao desfazer. Um envio já iniciado precisa conservar sua identidade de retry; o formato será definido no contrato de push.

## 3. Pull

**REQ-SYN-007** — Pull incremental por conta via `GET /api/v1/sync/pull?cursor=...`, com cursor opaco e até 500 envelopes de transação por página. Um envelope preserva conjuntamente fato de hábito, efeitos de XP e confirmação da operação; não separar esses efeitos em cursores por módulo. Essa concretização substitui o antigo `since` por módulo. O contrato proposto de revisão, paginação, recibos e snapshot está em spec/13 §6–7; confirmação de push não avança o cursor de pull.

**REQ-SYN-008** — Gatilhos de sync: abertura do app, volta do background, a cada 5 minutos com app aberto, e ao recuperar conectividade.

**REQ-SYN-009** — Tombstones: registros com `deleted_at` são retornados no pull para propagar exclusão. Retenção de 90 dias.

Exclusão/tombstones em 30/09/2026: `habit.delete` persiste offline, invalida hábito e XP local, grava o ID excluído e reverte XP na aceitação sem devolver consumo (Q30). Pendência/ack antigo não restaura o ID; intenção recusada permanece recuperável. Snapshot conserva tombstones mesmo após expiração do cursor/feed. Exclusão extensa cruza o limite de 32 efeitos via `resync_required` e snapshot estável, inclusive depois do push. [Contrato](13-contrato-primeiro-marco.md#18-contrato-do-incremento-de-exclusão--30092026) e [evidências](../docs/analises/2026-09-30-exclusao-e-tombstones.md). A confirmação visual e a rotina física de expurgo/compactação continuam pendentes.

### 3.1 Recorte implementado em 28/09/2026

REQ-SYN-005/008 têm núcleo, adapters Expo e testes: sync na abertura/login, retorno ao primeiro plano, reconexão e a cada cinco minutos; timers/envios seguintes pausam sem rede ou fora do primeiro plano. Gatilhos concorrentes são agrupados; uma resposta em trânsito pode concluir, mas a geração da sessão impede aplicar dados de outra conta. O scheduler consulta o prazo persistido antes da primeira requisição após reiniciar. Revogações pendentes usam execução independente da conta ativa.

Falhas de rede, timeout e HTTP 408/429/5xx seguem backoff; `Retry-After` em segundos ou data HTTP estabelece espera mínima, inclusive acima de cinco minutos. Gatilhos de conectividade/foreground e retry manual não encurtam essa espera. Dez falhas expõem `failed`; o retry explícito preserva o envelope. Persistência de tentativas de push: spec/00 §12.3. Contadores de pull sem push e de revogações ficam em memória por execução; fila e segredos continuam duráveis. HTTP 401/426 e falhas não transitórias interrompem tentativas automáticas e preservam dados.

O núcleo expõe estado e ação para a futura UI. Aviso visual, correção/descarte de rejeições e modo completo de leitura local por atualização obrigatória ainda não estão entregues. O adapter nativo foi empacotado para Android; execução HTTP em aparelho e aceite iPhone/Android continuam pendentes. [Relatório e testes](../docs/analises/2026-09-28-sincronizacao-automatica.md).

### 3.2 Recuperação implementada em 28/09/2026

O núcleo de REQ-SYN-017 expõe conteúdo/motivo/cadeia, correção transacional com novos IDs e descarte explícito por item. Filhas de uma rejeição ficam bloqueadas, fora de envio e projeção, com conteúdo preservado. Corrigir remapeia referências para as substitutas; descartar o pai mantém as filhas abertas. Resoluções sobrevivem a reinício e repetição do recibo. Rejeição recebida e bloqueio local são distinguíveis na interface.

Contextos acima de 4096 referências ficam recuperáveis sem truncamento e não seguem para o HTTP. Ciclos no lote recebem rejeição definitiva com suas referências; dependências realmente desconhecidas continuam adiadas. A interface visual, conflitos de identidade com resultado original incerto e a ampliação/compactação segura do limite continuam fora deste incremento. [Relatório](../docs/analises/2026-09-28-recuperacao-de-rejeicoes.md).

## 4. Conflitos

**REQ-SYN-010 — Reconciliação por significado da alteração.** Aceito em R3-Q11 a Q14, [ADR-017](../docs/adr/0017-reconciliacao-de-registros-e-correcoes.md). Alterações em campos independentes são combinadas: mudar título em um aparelho e prazo em outro preserva ambas. Campos dependentes, como meta e unidade, exigem validação conjunta; não combinar cegamente.

**REQ-SYN-010a — Mesmo campo concorrente.** Aceito em R4-Q15: entre alterações efetivamente concorrentes do mesmo campo, prevalece a última alteração aceita pelo servidor. Exemplo: o iPhone edita às 10h offline, o Android edita às 11h e sincroniza, e a edição do iPhone é aceita às 12h → prevalece o título do iPhone. O horário informado pelo aparelho não desempata essas alterações; a ordem de aceitação não pretende representar a ordem real da intenção.

Reenvio de uma alteração já processada conserva seu resultado original: não é nova edição e não recebe nova posição na ordem de aceitação. Quando uma ação já incorporou a anterior, respeitar essa sequência conhecida. Exclusão, desfazer cumprimento e demais regras específicas da tabela abaixo prevalecem sobre o desempate geral. O protocolo deve registrar uma ordem de aceitação inequívoca, inclusive para aceitações simultâneas; seu formato físico ainda será definido.

Exceções obrigatórias:

| Caso | Resolução |
|---|---|
| Exclusão vs edição | **Exclusão vence**, sempre |
| Marcações binárias do mesmo hábito/dia | Um cumprimento lógico e uma concessão de XP; IDs locais diferentes não criam cumprimentos distintos |
| Desfazer cumprimento vs marcação que desconhecia a correção | Desfazer prevalece, independentemente da ordem de chegada; nova marcação após incorporar a correção pode restabelecer o cumprimento |
| Lançamentos quantitativos independentes | Somar cada contribuição uma vez; desfazer retira apenas a contribuição identificada, sem afetar as demais |
| Reenvio de lançamento ou de seu desfazer | Não acrescenta nem retira quantidade novamente |
| Concessões de XP do mesmo fato lógico | Uma concessão canônica; refazer após reversão restaura seu valor e dia originais, sem outro consumo do teto |
| Contadores derivados (`user_progress`, `habit_streaks`) | **Nunca sincronizados.** Sempre recalculados localmente a partir dos fatos |

**REQ-SYN-011** — Conflitos cobertos pelas regras automáticas e duplicações reconciliadas não geram diálogo no v1. Rejeição definitiva de uma alteração é um resultado distinto: exige o aviso discreto e a preservação previstos em REQ-SYN-017. A regra de silêncio não autoriza ocultar uma rejeição como se fosse salvamento concluído.

O protocolo deve distinguir o que o aparelho já havia incorporado ao produzir uma nova ação; comparar apenas horários não demonstra isso. O formato dessa evidência e as constraints serão especificados antes da implementação. As regras de cumprimento binário não devem ser estendidas silenciosamente a desfazer conclusão recorrente ou a zerar todos os lançamentos quantitativos.

Para desfazer conclusão recorrente, aplicar a regra específica de REQ-TAR-005b, aceita em R5-Q20: sucessora usada impede o desfazer. A confirmação/rejeição precisa reconciliar tarefa, série e XP de forma coerente. A indisponibilidade de informação sobre outro aparelho não autoriza apagar trabalho posterior.

## 5. Migrations locais

**REQ-SYN-012** — O SQLite local tem versão de schema própria, com migrations sequenciais aplicadas na abertura. Migration nunca perde dado do usuário. Toda migration tem teste com banco de exemplo da versão anterior.

**REQ-SYN-013** — Se a migration falhar, o app entra em modo de recuperação. Ressincronizar do servidor não pode apagar a única cópia de pendências locais, inclusive de contas sem sessão ativa: é necessário preservá-las e preservar os dados necessários à sua recuperação antes de reconstruir o banco. Sem recuperação segura, interromper a reconstrução e informar o problema; descarte exige escolha explícita. O procedimento técnico será definido com o contrato de migrations.

Concretização parcial em 28/09/2026: abertura de conta/instalação recusa histórico Drizzle desconhecido e devolve erro tipado quando a migration falha. Fecha o handle e interrompe a abertura, preservando arquivos e pendências; não reconstrói bancos automaticamente. Testes com SQLite real exercitam rollback, nova tentativa, conta inativa e fence de logout. A UI de recuperação e eventual exportação/reparo de arquivo corrompido continuam pendentes; [relatório](../docs/analises/2026-09-28-abertura-segura.md).

## 5.1 Compatibilidade entre versões do app

**REQ-SYN-014** — Dois aparelhos do mesmo usuário podem estar em versões diferentes do app. Regras:
- Campos adicionais opcionais e tipos explicitamente compatíveis podem ser ignorados. Efeito obrigatório desconhecido exige atualização; nunca avançar cursor perdendo uma parte essencial da transação. O sync usa schemas de mensagens, não replicação arbitrária de tabelas (spec/13 §7)
- Toda coluna nova nasce **nullable ou com default**; migration que quebra versão antiga é proibida sem versão mínima obrigatória
- O app envia sua versão no cabeçalho; o servidor mantém `min_supported_version` numa tabela de config e responde `426 Upgrade Required` abaixo dela
- Abaixo da versão mínima, o app entra em **modo somente leitura local** com aviso de atualização obrigatória — nunca sincroniza com schema incompatível

Concretização do núcleo em 29/09/2026: restrição persistida por instalação, compartilhada entre identidade e sync. Mesmo build não contorna por retry/reinício/logout; outro build conserva leitura até confirmação online válida na geração atual. Leitura e logout local permanecem; novas intenções, correção/descarte e aplicação de respostas ficam protegidos. O scheduler expõe `update_required` e a sessão expõe o modo de acesso. API consulta a tabela global criada por Flyway V3, compara versões numericamente e falha com 503 quando não pode ler a política. Modelo físico em spec/00 §12.8; [testes e limites](../docs/analises/2026-09-29-compatibilidade-e-leitura-local.md). O aviso visual e o aceite nativo continuam pendentes do protótipo/aparelhos.

## 6. Edge cases mapeados

1. 500 mutações offline por 2 semanas → envio em lote com progresso; nunca timeout único
2. App morto pelo sistema no meio do push → fila é persistida, retoma do ponto (é por isso que a fila fica no SQLite, não em memória)
3. Dois dispositivos editam a mesma tarefa offline → combinar campos independentes; no mesmo campo concorrente, prevalece a última alteração aceita pelo servidor, conforme REQ-SYN-010a
4. Relógio do dispositivo errado → não usá-lo para desempatar edições concorrentes. Respeitar a sequência conhecida e a ordem de aceitação do servidor, sem transformar retries em novas edições; validação de datas de domínio permanece separada
5. Conta excluída no servidor, dispositivo offline → descartar dados dessa conta somente após confirmação inequívoca de exclusão. Um `401` isolado exige tratamento de autenticação e preservação das pendências, pois não comprova exclusão; a sinalização de conta excluída será definida no contrato de API
6. Rede lenta e instável → timeout de 15 s por lote, com retomada
7. Usuário troca de fuso offline → `day_key` já gravado permanece; nada é reinterpretado
8. Storage do dispositivo cheio → falha de escrita é capturada, avisada e não corrompe o banco
9. Aparelho antigo com versão defasada do app → REQ-SYN-014; nunca corromper dado por incompatibilidade
10. App desinstalado e reinstalado → banco local vazio, pull completo; o token de push antigo é invalidado pelo servidor ao receber erro do Expo (spec/10 §6)

## 7. Testes obrigatórios

`sync.test.ts`: fila persistente sobrevivendo a reinício simulado; coalescência; exclusão vs edição; log duplicado no mesmo dia; pull incremental sem lacuna; retomada após falha no meio do lote; logout offline seguido de reentrada online sem perda; isolamento ao alternar contas; pendência sem descarte por idade; rejeição definitiva recuperável sem retry automático indefinido; `401` sem descarte local; recuperação de migration sem perder pendências.

Cenários acrescentados em R3: desfazer vs marcação concorrente nas duas ordens de chegada; remarcar após incorporar correção; soma de contribuições e reversão individual; retry de incremento e de reversão; título e prazo editados separadamente; ciclo de desfazer/refazer com uma concessão de XP. A coalescência deve preservar esses resultados.

Cenários acrescentados em R4-Q15: edição anterior no relógio do aparelho aceita depois vence o mesmo campo concorrente; retry da edição já processada não sobrescreve uma edição posterior; relógios incorretos não mudam o desempate; sequência conhecida e regras específicas de desfazer/exclusão continuam prevalecendo.


## Evidência nativa Android — 30/09/2026

O harness HTTP exerce REQ-SYN-005/008 com os adapters reais de SQLite/SecureStore, fetch, AppState e expo-network. Preserva a fila após force-stop offline, pausa envios ao recuperar rede em segundo plano e converge automaticamente no retorno ao primeiro plano, sem duplicar XP após replay e marcação por outro cliente. [Relatório e comando reproduzível](../docs/analises/2026-09-30-http-nativo-android.md).

A evidência cobre emulador Android 15 e um cliente SQLite de desktop contra API/Postgres reais descartáveis. Não conclui o aceite iPhone/Android nem a matriz de fusos/concorrência, UI ou operação. O pacote de teste e a exceção HTTP de loopback são separados da configuração padrão.
