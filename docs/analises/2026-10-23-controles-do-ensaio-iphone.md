# Controles do ensaio no iPhone — recorte12

23/10/2026. Origem: [tarefa12](../../.scratch/pwa-m1/issues/12-preparar-controles-do-ensaio-iphone.md), [contrato do cliente técnico](../../.scratch/pwa-m1/ensaio-iphone.md), spec/14 e Q61–Q75. **Concluído no escopo local.** Este recorte não libera03 nem aceita Safari/Tela de Início ou M1.

## Entrega

Build separado `pnpm --dir web build:iphone` em web/dist-iphone/, sem copiar index/probe/coordination, suporte Expo ou bridge global. Manifest id/scope/start_url `/ensaio/`; worker `/ensaio/sw.js`; fontes/licenças locais e PNG192/512 com marcador técnico construído dos tokens. HTML referencia somente o cliente do ensaio. O artefato é para origem isolada/contas sintéticas; nenhum deploy foi realizado.

A UI DOM usa textos em i18n e tokens Ritmo-App Holograma escuro, sem valores de paleta inventados ou mudança no banco de aparência. Não é a jornada React de produto. Formulários/botões acionam o controlador; HTTP fica fora da UI, com LocalRepository/Coordinator/Remote e respostas conferidas contra02a. Reutiliza Java/domínio/XP existentes, preservando o cliente nativo SQLite; nenhum campo local/SQL ou migration Flyway novo.

Controles: cadastro/login explícitos, inspeção de resposta incompleta, perfil de ensaio São Paulo/início4, criar/marcar, rodada manual de sync, ler/assumir posse, gate, quota e migração abortada, logout local, resolver contextos e recuperar com a conta original. Diagnóstico de capacidades, contagens, seq/IDs públicos e waiting do worker. Não exibe senha/ticket/Cookie/e-mail de formulário, dump canônico ou link de reset. Senha/ticket não são persistidos no journal.

A confirmação de reserva usa **PreparationReceipt**, conforme o Java/02a; ReservationProof é do status público. A primeira execução local detectou essa ligação incorreta antes de enviar senha. Corrigido o cliente e a fixture de teste, sem mudar servidor/contrato. Entrada com corpo de login inválido é recuperada por inspect explícito, sem repetir senha automaticamente. Preparação de documento anterior não recebe rebind inferido: conservar/encerrar com prova ou recuperar antes da próxima entrada.

O gesto Marcar obtém os desfazimentos canônicos e locais observados dentro da mesma transação de enqueue, conforme o nativo. Não fixa observedUndoIds vazio para um hábito com histórico; teste cobre canonical + unmark pendente e restauração da projeção. Nova tentativa explícita de senha reconfirma o close cookie; se essa prova desapareceu, a senha não é enviada. Guardas de instalação/conta/geração/posse/build antes/depois de rede. Leitura inválida retira a apresentação anterior e bloqueia controles, preservando dados. Journals incertos continuam contando até prova terminal. Flag upgrade_required não é apagada ao reabrir. Troca de conta/ocultação invalida apresentação/rascunho; entrada nova não carrega texto da conta anterior. Saída/reabertura/tomada de posse/migração com rascunho exigem confirmação de descarte.

O SW só precacheia recursos do artefato técnico; não guarda API ou credenciais e não escreve domínio. `skipWaiting:false`, `clientsClaim:false`, sem mensagem automática de ativação. **Consultar atualização** apenas verifica/informa; o build antigo não força recarga do formulário ou limpa a fila.

## Verificação

- Web: typecheck/lint e30 testes (20 anteriores +10 do controlador/gesto) aprovados na rodada local.
- App: typecheck/lint e213 testes de domínio +51 de componentes aprovados, com código nativo preservado.
- Prova manual visível final com Java/Postgres/IndexedDB reais:12 cenários aprovados em1m09s no Chrome155.0.8059.85, incluindo XP10 após sync, migração abortada, métricas de toque/reflow e ausência de Web Locks. O gesto usa a observação de undo no adapter.
- API: check completo aprovado em13m45s:113 casos,102 aprovados e11 opt-ins ignorados, além de13 testes operacionais aprovados. Dois checks anteriores tiveram timeout na fixture WAL (detalhes abaixo).
- Documentação:14 arquivos Markdown/169 links locais válidos; diff sem erros de espaço. Chrome/driver próprios:0 processos restantes após o finally; API/PG/certificado/proxy descartáveis encerrados.

O driver [verify-iphone](../../web/scripts/verify-iphone.mjs) despacha o caminho manual por controles acessíveis, sem evaluate de comandos ou bridge. Usa inspeção de DOM/atributos/layout somente para conferir resultados e uma falha de ambiente para remover Web Locks de um perfil sintético. Perfis próprios são fechados em finally; API/PG/certificado/proxy descartáveis encerrados pela fixture Java. Recursos preexistentes preservados; nenhum emulador ou recurso externo iniciado.

Cookies **HttpOnly/Secure reais e não vazios** são copiados entre perfis sintéticos sem IDB compartilhado, somente dentro do driver; não são exportados no relatório. Isso testa Q70 no candidato Chrome, sem afirmar como Safari copia seus dados. Mesmo com cookies, nova instalação exige login próprio, com identificadores/contextos independentes.

Quota injetada aborta a próxima transação e remove seu hook em finally. Migração experimentalV2 muda next_sequence dentro de uma transação e lança erro: reabertura válida de V1 comprova rollback, conservando seq/fila. Não se trata de schemaV2 ou migração de produto. Limite de quatro contextos, recibos e invariantes de domínio continuam nos testes anteriores; recuperação no cliente técnico não cria quinta sessão.

A captura inicial mostrou ações estreitas no viewport móvel; os botões agora quebram em linhas a partir de token nativo, com verificação de alvo mínimo44px/sem overflow horizontal na rodada final. As capturas são de uma UI técnica; não aceitam pixel perfect do produto ou VoiceOver.

Artefatos ignorados em output/playwright/web-iphone/: driver.log, result.json, api-check-summary.json, perfis sintéticos, builds e capturas01/02/03. Logs de checks em api/build/iphone-*.log. A captura03 final foi inspecionada; não há overflow horizontal no viewport415px do ensaio. Não compartilhar perfis, cookies ou arquivos de credenciais. O certificado autoassinado/exceção do Chrome é local e não valida cadeia pública ou iPhone.

## Ocorrência na regressão operacional

Dois checks completos falharam em `WalRecoveryTests.independentPhysicalBaseAndPartialWalRestorePostBaseConfirmationsAfterPrimaryLoss`, na espera awaitFlush após recuperar e reativar o receptor: condição não concluiu em15s. No primeiro diagnóstico posterior, durable=true e flush já estava adiante do marcador; no segundo, o receptor ainda estava atrás. Isso não comprova a causa do atraso nem uma regressão da PWA.

Nenhum código/limite/assertion de WAL foi alterado. O caso isolado passou sem alterações, junto à prova manual visível (3m29s). A repetição completa no worker compartilhado voltou a falhar. Investigadas três hipóteses: latência do polling via Docker exec; retomada/timeline do receptor; retenção de fixtures/contextos entre classes. Não foi introduzido patch de polling, timeline ou produção sem comprovação.

A inspeção mostrou PostgreSQL estático sem teardown de classe em RuntimeTests/SyncRetentionTests e contextos Spring compartilhando a JVM do worker. A execução foi ajustada para `forkEvery=1`, `maxParallelForks=1`, isolando os recursos por classe e mantendo a suíte sequencial. Todas as asserções, o limite15s e os budgets de WAL/API permanecem. O check completo nesse modo passou em13m45s, incluindo os cinco casos WalRecoveryTests, restauração, isolamento e sincronização. O resumo dos XML foi preservado em output/playwright/web-iphone/api-check-summary.json antes de executar novamente o opt-in manual. O custo é criar uma JVM por classe. Isso isola a interferência entre fixtures; não comprova qual mecanismo causou os timeouts nem certifica a VPS. Existe histórico de outro timeout15s de recuperação em08/10, sem causa comprovada, mas isso não estabelece causa comum. Nenhuma durabilidade foi reduzida, nenhum teste foi desabilitado e nenhum timeout foi ampliado.

## Próximo gate

Pedro confirmou que ainda não escolheu o domínio. O [roteiro02c](../../web/ops/https-iphone.md) agora mapeia casos aos botões; falta origem HTTPS aprovada e execução Safari/Tela de Início no iPhone16e, iOS26.6.2 apenas declarado. Não houve instalação real, VoiceOver, medição de desempenho do produto ou envio de e-mail.

O próximo passo é preparar/autorizar o ambiente de ensaio e executar02c físico; não iniciar03 enquanto02 mantiver needs-info. Tarefas06/07 conservam visual/acessibilidade/publicação/aceite de produto. Native iOS continua posterior conforme Q65; M1/Fase1 abertos.

Fontes técnicas: [Vite publicDir/base](https://github.com/vitejs/vite/blob/main/docs/config/shared-options.md), [template de SW Workbox](https://github.com/googlechrome/workbox/blob/v7/packages/workbox-build/src/templates/sw-template.ts), além dos contratos locais citados. Não há biblioteca ou serviço novo contratado.

Referência do isolamento: [Gradle8.14 — execução de testes e pressão de memória](https://github.com/gradle/gradle/blob/v8.14.3/platforms/documentation/docs/src/docs/userguide/optimizing-builds/performance.adoc). A versão do wrapper permanece8.14.4.
