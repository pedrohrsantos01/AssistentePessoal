# Matriz TalkBack ampliada — recorte06

Escopo de execução em13/10/2026. Requisitos: spec/11 REQ-DS-003/004 e texto200%; contratos de conta/onboarding/hábitos, Q51/Q52 e resultados de sincronização já implementados. Android visível durante ensaios, com encerramento dos recursos próprios. API/PostgreSQL descartáveis preparados pelo teste RuntimeTests; nenhuma conta de produção é usada.

## Aceite desta matriz

| Superfície | Prova nativa esperada |
|---|---|
| Cadastro | Validação de nome/e-mail, valores preservados, campos focados e acima do teclado. |
| Privacidade do cadastro | Leitor entra na sheet; ações acessíveis; fecha e devolve foco ao acionador. |
| Onboarding | Fuso inválido legível, correção e primeiro hábito pela UI sobre SQLite/API reais. |
| Briefing200% | Hábito longo, explorar/ativar/desfazer e conservar foco após escrita; alvos≥44 unidades. |
| Edição | Nome acessível com teclado; cancelamento da exclusão preserva hábito e foco. |
| Ajustes | Privacidade e saída cancelada com foco de entrada/retorno; seleção não é ativada só pela exploração. |
| Sincronização | Sheet e histórico acessíveis, sem acesso ao fundo; fechamento devolve foco ao acionador. |
| Cofre | Aviso legível, hábito local preservado e controle disponível conforme Q52=A. |
| Banco da conta/instalação | Diagnóstico da conta acessível; controle ilegível bloqueia a jornada; nenhum descarte. |
| Revisão de recusa | Título inicial; cancelar devolve foco ao botão no painel anterior; corrigir com dependente remove acionador antigo e foca o título do painel; servidor confirma10 XP. |
| Identidade incerta | Diagnóstico e fechamento acessíveis; mesmas intenção/evidências após reinício; dependentes bloqueadas, trabalho independente e nenhum XP extra. |
| Persistência | Cliente independente consulta o servidor e comprova hábito preservado, cumprimento desfeito e XP0. |

A consulta usa janela de aplicação própria e geometria do IME, sem texto do teclado ou valor de campos marcados como senha. Gestos de exploração/duplo toque/rolagem são sendTouch com autenticação do SDK; a rolagem usa dois contatos. Texto sintético é inserido por eventos de teclado de hardware: não aceita edição falada por caractere, cursor ou seleção. Não repetir automaticamente ativações após resultado de transporte ambíguo.

## Limites

A matriz não aceita VoiceOver/iPhone (Q55=B), desempenho ou toda leitura falada. Recuperação de senha completa, descarte e demais estados de sincronização, preempção e navegação completa entre janelas permanecem para extensão própria. As revisões de correção/identidade incerta têm critérios no [recorte delimitado](leitor-revisoes.md); consultar o relatório para o resultado efetivamente verificado. Paletas anteriores só pertencem ao APK cujo hash registram. Não fechar recorte06/M1 por sucesso parcial ou por timers do driver.

## Preparação observada

Rodada1 não iniciou o script nativo: PostgreSQL não ficou pronto no timeout existente. API isolada passou em47s. Ordem alterada para preparar API/banco antes do emulador, sem ampliar o timeout do Postgres. Rodada2 alcançou o script, mas sua primeira consulta do observador excedeu30s antes de habilitar o leitor. Resultados falsos preservados; restauração da rodada2 confirmada. A causa do segundo bloqueio está sendo minimizada em consulta sem API, com diagnósticos temporários identificados.


Diagnóstico de transporte: o probe mínimo com GPU host e instalação comum do pequeno observador passou duas consultas; não isolou qual dessas duas opções alterou a condição. Diagnósticos temporários removidos. Rodada3 leu a janela, mas a asserção estrita reprovou um alvo nominal44 exposto como115 pixels a densidade2,625; o driver passou a usar o limite inteiro inferior, conforme os ensaios anteriores. Rodada4 perdeu ADB antes da habilitação do leitor; restauração não comprovada. Recursos preexistentes preservados, pedido de autorização para fechar outro emulador ainda sem execução. Após medição de14GB livres, o probe mínimo voltou a passar duas consultas; repetição completa iniciada na rodada5 sem interromper o emulador preexistente.


Rodada5 alcançou a validação real, mas a prioridade esperada pelo driver estava incorreta: o formulário valida e-mail antes de nome. Rodada6 esperou tempo fixo insuficiente para touch exploration; agora verifica o estado real. Rodada7 passou campos/teclado e validações até nome, mas perdeu os serviços Android durante inserção ADB; restauração incompleta registrada. A rodada8 preservou o observador residual em vez de removê-lo sem prova; recuperação posterior conferiu seu hash e restaurou somente valores capturados pelo ensaio interrompido.

Rodada9: canal experimental sendKey autenticado recusou credencial ausente/audience/emissor incorretos, mas não inseriu texto no campo; resumo falso. Esse canal foi removido e a política conserva somente sendTouch. Rodadas10/11 reprovaram a sequência/foco inicial; o driver agora confirma o toque físico antes de habilitar o leitor e aguarda o formulário distinto, sem repetir ativações ambiguamente. A repetição da API isolada/probes não estabelece causa única para as falhas do emulador.

Rodada12: validação real de e-mail/nome, preenchimento com teclado e campo acima do IME passaram. O diálogo de privacidade abriu com foco no texto explicativo; título e botão presentes, fundo fora da janela interativa. A asserção de título inicial era mais específica que o spec; resultado integral permanece falso. [Q60](foco-dialogos.md) propõe fechar destino inicial e retorno protegido antes de implementar qualquer transferência. A rodada13 usa `RITMO_READER_OBSERVE_FOCUS=1` para coletar os cenários independentes: esse modo jamais marca `matrix-summary.passed=true`, mesmo com todos os passos funcionais aprovados.


Rodada13 em observação: cadastro/HTTP, validações preservadas, fuso inválido/corrigido, primeiro hábito, cumprimento/desfazer com foco, edição e cancelamentos de exclusão/privacidade/saída passaram. Os quatro diálogos observados retornaram aos respectivos acionadores; a entrada nativa foi texto explicativo/nome do hábito. O histórico foi alcançado, mas o driver tentou medir Fechar quando só75 pixels de sua altura estavam expostos. Busca corrigida para rolar até expor o alvo inteiro antes da medição/ativação; não alterar o layout por recorte parcial do viewport. A rodada14 repete o roteiro em observação, sem aceitar Q60 por silêncio.


## Resultado verificado — rodada14 em observação

Dezoito fases funcionais passaram;35 medições de controle e9 de campo/IME. Cadastro/onboarding em HTTP real, hábito longo marcado/desfeito com foco, cancelamentos, histórico, disponibilidade local após falha de cofre, diagnóstico de conta, bloqueio de instalação e conferência independente de hábito/desfazer/XP0 no servidor. Cinco retornos observados aos acionadores. Configurações restauradas (`reader-cleanup.restored=true`), recursos próprios fechados e instalação da jornada preservada.

`functionalPassed=true`, `focusObservationOnly=true`, `passed=false`: a política Q60 ainda aguarda Pedro. O título inicial estrito não pode ser aceito antes dessa definição. [Resumo nativo](../../docs/design/evidencias/2026-10-13/leitor-matriz/rodada14-observacao/matrix-summary.json). APK11cee24a é o mesmo das12 paletas/36 alvos anteriores; o roteiro ampliado observou a configuração atual, sem repetir todas as paletas.


## Q60=A — implementação local em14/10/2026

Pedro confirmou título ao abrir e retorno protegido ao acionador. A implementação central em Sheet controla o ciclo da janela, revalida o contexto atual e não mantém callbacks válidos após saída/troca de conta/recuperação. Revisão aninhada usa a identidade do controle no painel retomado. Typecheck/lint e218 testes passaram; [relatório](../../docs/analises/2026-10-14-foco-protegido-dos-dialogos.md). Nenhum novo ensaio nativo ou APK neste incremento: aguardar o aviso de memória liberada de Pedro antes de abrir o emulador. Repetir com observação desligada e hash novo; rodada14 histórica mantém passed=false.


15/10/2026 — matriz final Q60:18 fases/cinco diálogos passaram sem observação, com35 medições de controles/9 de campo-IME. APKb4996e90, fonte200%, Pixel_9/API35/2GB/GPU host. Regra de foco corrigida no adaptador Android após reprovação real; versões e tentativas preservadas no [relatório](../../docs/analises/2026-10-15-talkback-foco-dos-dialogos.md). Restauração confirmada e recursos próprios fechados. Não aceita integralmente revisões aninhadas/preempção, leitura entre todas as janelas, edição falada, desempenho, novas paletas ou iPhone.


15/10/2026, revisões de sincronização: [matriz ampliada](../../docs/analises/2026-10-15-talkback-revisoes-de-sincronizacao.md) aprovada a200% no APK7430a6f8:24 fases/nove registros de foco,75 controles/13 campos-IME. Corrigida a revelação do acionador fora do viewport; cancelamento aninhado, correção com dependente, fallback no título, diagnóstico incerto e persistência após reinício verificados. Cliente independente confirma10 XP e trabalho independente; configurações restauradas e recursos próprios fechados. App:225 testes/tipos/lint; API check:85 executados/oito nativos opt-in ignorados,13 verificações operacionais e modularidade aprovados. Recuperação de senha/preempção, demais estados, travessia entre janelas, edição falada, desempenho, novas paletas e iPhone mantêm06/M1 abertos.


15/10/2026, leitor na recuperação: [roteiro aprovado](../../docs/analises/2026-10-15-talkback-recuperacao-de-senha.md) no mesmo APK7430a6f8, sem alteração do produto ou de app/harness:12 fases a200%, duas interrupções de diálogo,44 medições de controle/14 campos-IME. SMTP/API locais, entrada quente/fria, senha inválida/offline, usado/expirado/origem inválida, resposta uniforme, reautenticação e preservação de hábito/10 XP com isolamento entre contas verificados. Configurações restauradas e recursos próprios fechados. App:226 testes/tipos/lint aprovados; API check aprovado:85 executados/oito nativos opt-in ignorados,13 verificações operacionais e modularidade, sem falhas. Q60 não impõe título inicial a páginas. Travessia entre janelas/edição falada, demais estados, desempenho, paletas e iPhone mantêm06/M1 abertos.
