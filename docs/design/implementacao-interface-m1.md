# Interface M1 — aplicação da referência entregue

Data: 09/10/2026. Fonte visual: [spec/11](../../specs/11-design-system.md); comportamento: [spec/13](../../specs/13-contrato-primeiro-marco.md) e seus specs. [Revisão do pacote](../analises/2026-10-09-revisao-do-prototipo.md).

## Telas e núcleo real

| Superfície | Referência | Integração/aceite |
|---|---|---|
| Entrada/cadastro/login | M1 / D01 e D08 | Identidade real; persistir credenciais antes de ativar; online/offline e campos preservados; sem convidado/social |
| Fuso/início do dia | M1 / D02 | Onboarding por comando local; IANA/dia lógico reais; retomada após reinício |
| Primeiro hábito/pular | M1 / D01–D03 | Binário diário e conclusão locais; pular abre Briefing útil; falha não conclui etapa |
| Briefing | M1 / D03–D06 | View local/AccountStore, provider, data/saudação/hábitos/XP; marcar/desfazer no card, persistir antes de anunciar sucesso |
| Gestão | M1 / lista/formulário | Criar/patch de título/ícone/cor/ordem; patch só dos campos alterados; exclusão já contratada com confirmação |
| Ajustes | M1 / D08/D10 | Perfil/sync reais, aparência/privacidade/logout; respeitar bloqueios da Session |
| Recuperação | M1 / D09 | Pedido uniforme; abrir link não consome; salvar online; inválido/usado/expirado; volta ao login sem autenticar automaticamente |
| Aparelho novo | M1 / D11 | Snapshot retomável/atômico; retry sem conta vazia; progresso mensurável ou indeterminado |

Nome 1–80, e-mail até 254 e senha 8–128 sem trim conforme contrato; título de hábito até 120 com normalização canônica. O input HTML de nome permite 120 mas validação/handoff dizem 80: usar o contrato. Relógio, saldo 1.240, contas e Belém são fixtures, não dados iniciais.

## Matriz de estados

| Estado | Apresentação | Ações/limites |
|---|---|---|
| Sem hábitos | EmptyState/saudação/convite | Criar hábito; sem capacidades futuras |
| Offline/remoto indisponível | Pílula e estado por operação local | Uso local da conta ativa saudável; fila preservada, sem confirmação remota fictícia |
| Envio ativo | ↻ e texto | Scheduler real; sem temporizador que confirme por decurso de tempo |
| Falha local | Não salvo, conteúdo e retry | Sem check/XP durável antes da transação; não chamar de pendência salva |
| Rejeição comprovada | Motivo + revisão | Correção/descarte aprovados e dependentes pelo núcleo; identidade nova só no fluxo correspondente |
| Identidade incerta / Q53 | Aviso específico/intenção bloqueada | Diagnóstico para intervenção; sem descartar, trocar identidade ou reenviar automaticamente; independentes continuam |
| Cofre indisponível / Q52 | Sync pausado + recuperar acesso | Conta ativa/bases saudáveis mantêm uso local; preservar referências; retryVault; erro não equivale a ausência de credencial |
| Base/conta inacessível / Q51 | ErrorState + nova tentativa | Preservar arquivos, fechar handles pelo núcleo; sem fallback de conta/substituição do SQLite |
| Controle ilegível / Q51 | Bloqueio da abertura | Sem descoberta por arquivos/cofre nem reset automático |
| Sessão remota expirada/recusada | Aviso + autenticar | Uso local quando autorizado; login online, sem apagar pendências |
| Logout incompleto | Bloqueio + terminar saída | Sem voltar à conta por rota/gesto; limpeza/revogação pelo núcleo |
| B / reentrada A | Somente dados da conta ativa | Invalidar leituras/subscrições da geração anterior; resultado de A não atualiza B |
| Atualização/build não verificado | Somente leitura | Escrita só após verificação permitida; sair conforme contrato |
| Snapshot em andamento | Progresso/erro reais | Sem dashboard vazio ou ativação de conta parcial |
| 429/Retry-After | Remoto pausado/mensagem discreta | Preservar local e backoff; retry manual não burla janela |
| Quarentena/503 | Serviço indisponível | Preservar intenção; sem retomada simulada ou nova conta |

Prioridade de bloqueios vem de Session/LocalInstallation/compatibilidade, não da ordem de banners. Banco ilegível/logout incompleto não viram acesso liberado por uma pílula offline.

## XP e exclusão

Q31/REQ-GAM-002a prevalece sobre o handoff: **10 XP se couber integralmente; caso contrário, cumprimento sem XP**. Não aplicar “+4 XP”. Remarcar restaura concessão/decisão original, sem consumir orçamento de novo. “Cada hábito feito vale 10 XP” precisa refletir o limite, não prometer prêmio sempre.

O handoff omite exclusão no M1; spec/13 §3 inclui habit.delete/M1-13. Usar a Sheet existente e confirmar perda de hábito/histórico, reversão do XP e orçamento não devolvido (REQ-HAB-007/Q30). Arquivar permanece no incremento posterior.

## Fronteiras

- Componentes leem projeções locais e enviam comandos pelos módulos existentes; sem banco paralelo em React nem normalização/XP copiados do HTML.
- Troca de conta cancela leituras/subscrições antigas e respeita geração. Um resultado assíncrono de A nunca atualiza B.
- Reusar Session, AccountStore, scheduler, relógio e recuperação. Ligação da UI às mudanças locais/pull precisa ser explícita; timers não são essa ligação.
- UI strings em app/src/i18n/pt-BR.ts e tokens em app/src/theme/tokens.ts. Resolver dependências compatíveis com Expo 57 nas fontes oficiais, na fatia que as usar.
- Preservar entradas dos harnesses ao introduzir a entrada do produto; não renomear um harness como aplicação final.
- Preferências de aparência/áudio e compatibilidade de metadados antigos serão especificadas antes de persistir/migrar; nenhuma tabela/campo novo implícito nesta revisão.

## Implementação e aceite pendente

O [recorte 01](../analises/2026-10-09-interface-primeira-jornada.md) implementa entrada, onboarding, primeiro hábito/pular, criação posterior, Briefing/XP e ajustes mínimos com persistência/sync reais. Bloqueios mínimos protegem a abertura; o detalhe das ações desta matriz permanece nos recortes 03/04. O [recorte 02](../analises/2026-10-09-interface-gestao-de-habitos.md) entrega gestão dos hábitos ativos, edição de título/ícone/cor, ordenação e exclusão confirmada com Q30, offline/reinício e convergência. Hábitos antes do início permanecem na gestão, com estado de nenhum devido no Briefing. Preferências persistidas, recuperação por link, acessibilidade integral, iPhone adiado, domínio/e-mail/links e operação externa continuam pendentes. Chromium não substitui o [aceite dos aparelhos](../../.scratch/aceite-m1/spec.md).

Em10/10/2026, [refinamento de fidelidade dos recortes01/02](../analises/2026-10-10-fidelidade-visual-m1.md) alinhou composição/tipografia/catálogo/XP/gestão/painéis à referência, corrigiu contraste/textura e recebeu aprovação dos três críticos nos três grupos.156 testes do app e jornada Android visível final passaram; limitações da inspeção e matriz ainda pendente constam do relatório.

[Sessão/cofre/abertura — recorte 03](../analises/2026-10-10-interface-sessao-e-recuperacao-local.md) concluído localmente em 10/10/2026: estados distintos/diagnóstico limitado, retomada sem perder fila, isolamento A/B/A e autenticação da mesma conta. 164 testes do app, API check e Android visível passaram. Próximo recomendado: recorte 04, resultados de sync/identidade/compatibilidade. Links, aparência, matriz integral de acessibilidade/iPhone e gates externos continuam abertos.

[Resultados de sync — recorte 04](../analises/2026-10-10-interface-resultados-de-sincronizacao.md) concluído localmente em 10/10/2026: pílula/painéis e estado por item, recusa corrigível com cadeia explícita, Q53 preservado, espera 429/503 e snapshot/compatibilidade reais. 171 testes do app, API check e Android visível final passaram; texto 200% e sete alvos observados no escopo registrado. Próximo recomendado: 05 — recuperação de senha. Aparência, leitores de tela, iPhone e operação externa continuam pendentes.
