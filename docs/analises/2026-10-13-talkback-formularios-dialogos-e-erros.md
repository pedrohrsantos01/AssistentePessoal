# TalkBack a200% — formulários, diálogos e erros

Data:13/10/2026. Recorte06 do M1; coleta funcional concluída, política de foco Q60 pendente. A matriz integral e o marco continuam abertos. Este incremento amplia a automação/evidência; não altera código de produção do app/API, schema, paletas ou regras de domínio.

## Resultado

A [rodada14](../design/evidencias/2026-10-13/leitor-matriz/rodada14-observacao/matrix-summary.json) completou18 fases funcionais no Pixel_9/API/PostgreSQL descartáveis, com TalkBack continuamente ativo e fonte2,0. Cadastro e onboarding ocorreram pela UI/HTTP reais; e-mail/nome/fuso inválidos não apagaram valores;9 medições confirmaram campo focado e acima do teclado. Hábito com nome longo foi criado, marcado e desfeito conservando foco. Edição e cancelamentos preservaram o hábito, privacidade/saída fecharam, histórico permaneceu navegável.35 medições de controles atenderam ao alvo nominal44, convertido com arredondamento inteiro inferior na densidade2,625.

Falha sintética do cofre manteve o hábito e seu controle local disponível. Falha da base da conta apresentou diagnóstico; falha do controle de instalação bloqueou a jornada. Após abertura normal, um cliente independente autenticou/sincronizou na API da fixture e comprovou hábito preservado, cumprimento desfeito e XP total0. Isso não aceita reparo de banco nem descarte de pendências.

Cinco diálogos retornaram aos acionadores nos cenários observados. A entrada escolhida pelo TalkBack foi texto de privacidade/saída, nome do hábito ou estado de sincronização. Os destinos estão no resumo. REQ-DS-003 exige administração de foco, mas não fixa destino inicial/retorno; a asserção de título inicial do driver era mais específica que o contrato. A [proposta Q60](../../.scratch/interface-m1/foco-dialogos.md) fecha essa lacuna antes de implementar transferência de foco. Não considerar o comportamento atual uma violação de um destino que ainda não foi aprovado.

**Não há aprovação integral:** `functionalPassed=true`, `focusObservationOnly=true`, `passed=false`. O modo de observação não exige a proposta Q60 e nunca produz aprovação integral. Ao definir a política, ajustar contrato/driver e implementação se necessária, depois repetir a matriz sem observação.

## Reprodução e integridade

Comandos e preparação: [README do app](../../app/README.md#matriz-do-leitor-com-texto-ampliado). A API prepara PostgreSQL/SMTP locais antes do emulador. O lançador verifica propriedade/PID/serial/AVD, listener em loopback e política JWT somente sendTouch. Texto sintético usa teclas de hardware ADB; não prova edição falada por caractere/cursor. Rolagem do leitor usa dois contatos físicos; não há ativação pelo observador nem supressão do serviço.

O observador lê a janela interativa da aplicação pela camada mais alta, inclusive diálogo, e somente geometria do IME; a ausência de controles do fundo nessa árvore não aceita, sozinha, toda a navegação entre janelas pelo leitor; texto de senha é suprimido. TestOnly, sem activity/rede. Tokens/chave privada permanecem em memória; senhas e tokens de conta não são salvos nas evidências. O helper foi recompilado com Java21/SDK35 após remover diagnósticos temporários.

APK instalado/final: `11cee24a408bb8d265c41bf4387a21076cebfb681c6e2b20e8fa544a92d7263f`, pacote exclusivo `dev.ritmo.journeytest`. Nenhuma recompilação/alteração do produto neste incremento. As12 capturas de paletas e36 alvos de12/10 pertencem ao mesmo APK; o roteiro ampliado não foi repetido nas seis combinações. Nenhuma conta de produção ou envio de e-mail a pessoas.

## Tentativas e recuperação

Histórico detalhado na [matriz](../../.scratch/interface-m1/matriz-leitor.md), preservando resultados falsos. Rodada1 falhou na preparação PostgreSQL; API isolada passou em47s. Ordem API antes do emulador adotada, sem aumentar timeout. Probes mínimos passaram com GPU host/instalação comum do helper; não provaram uma causa única. Outras tentativas perderam ADB/serviços Android; restauração incompleta das rodadas4/7 permanece explicitamente registrada.

A recuperação do observador residual conferiu seus bytes com o artefato conhecido do ensaio interrompido; restaurou somente configurações capturadas. O lançador geral continua preservando observadores preexistentes. Canal sendKey experimental não entregou texto e foi removido; política final segue somente sendTouch. Expectativas do driver foram corrigidas quanto à prioridade de validação, arredondamento44, confirmação da navegação, readiness real do leitor e exposição completa de controles parcialmente visíveis. Nenhuma correção de layout foi feita para compensar uma medição parcial.

Na rodada14, [restauração](../design/evidencias/2026-10-13/leitor-matriz/rodada14-observacao/reader-cleanup.json) terminou sem passos faltantes. Emulador5560, painel e observador temporário próprios foram encerrados; bancos/instalação da jornada preservados. O emulador5554 preexistente foi preservado, inclusive quando voltou a ficar ativo. Não executamos fechamento alheio enquanto o pedido de autorização não foi respondido.

## Verificações e pendências

App: typecheck/lint e203 testes passaram (164 domínio/39 componentes). Sintaxe dos três scripts PowerShell e diff-check passaram. Native fixture da rodada14 terminou com exit0,6m15s de preparação/execução (o Node registrou302s de corpo/354s totais); esses tempos incluem automação e não medem performance do produto. O primeiro API check reprovou o ensaio de coleta ausente por concorrência com o produtor da própria fixture. [Diagnóstico e correção isolada do teste](2026-10-13-isolamento-do-teste-de-transporte.md). Dez cenários de transporte passaram isoladamente; a nova rodada completa terminou com exit0 em11m36s:93 casos,85 executados/8 nativos opt-in ignorados, zero falhas/erros, além dos13 checks operacionais. [Resumo de verificações](../design/evidencias/2026-10-13/checks-summary.json). A rodada inicial reprovada permanece registrada.

Pendências: resposta Q60 e repetição da matriz conforme contrato; cobertura integral de recuperação de senha/rejeições/identidade incerta com leitor, edição falada e medidas de abertura/cards/feedback. iPhone/VoiceOver permanece adiado por Q55=B e necessário ao aceite M1, junto aos gates externos. Recorte06 permanece in-progress.
