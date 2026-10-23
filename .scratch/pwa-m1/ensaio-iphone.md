# Cliente técnico02c — contrato de implementação

23/10/2026. Origem: tarefa12, contrato02a e Q61–Q75. Implementação técnica isolada, sem liberação de03 ou aceite físico.

Entrada `/ensaio/`, manifest id/scope/start_url `/ensaio/`, SW `/ensaio/sw.js`, bundle próprio `web/dist-iphone`. Não incluir index/probe/coordination ou bridge de automação. Fonte/licenças locais e tokens existentes. Somente origem de teste isolada/contas sintéticas; banco V1 `ritmo-main`, sem importar outra base ou apagar dados. O nome físico e campos não mudam.

UI DOM sem HTTP: controlador usa LocalRepository, Coordinator, Remote e transporte de sessão validado. Login/cadastro explícitos; journal antes de preparar/enviar. Senha e ticket só em memória, nunca no diagnóstico. Confirmação da reserva antes da senha e inspect antes da ativação. Resposta perdida oferece inspeção explícita no mesmo documento, sem repetir senha automaticamente. Preparação de documento antigo pode ser encerrada com prova antes de uma nova entrada; nenhum rebind de journal ou sucesso inferido. Quatro contextos e recuperação por senha da conta original seguem02a.

Uma aba escreve; leitura secundária só na mesma seleção/geração. Perder seleção ou sair invalida apresentação/rascunho; outra conta não aparece automaticamente na aba anterior. Guardas antes/depois de HTTP, incluindo respostas tardias. Preservar flag upgrade_required de um build já bloqueado. Cofre indisponível não é simulado com localStorage.

Marcar deriva os IDs de desfazimento observados na mesma transação local da intenção, mantendo a semântica nativa/ADR-017. Controles: perfil sintético São Paulo/início4, criar hábito, marcar, sincronizar, atualizar leitura, assumir escrita, sair localmente, resolver contextos encerrados/preparações e recuperação autenticada por contexto. Falha de quota injetada só na próxima transação do controlador, com hook removido em finally. Migração experimentalV2 altera seq dentro da transação e aborta, verificando V1 preservado; não é migration de produto. Gate pode ser segurado/liberado explicitamente fora de transação para reproduzir espera, sem steal/TTL; liberação continua acessível.

Rascunho do título só no documento/jornada; sair/ocultar invalida por privacidade. Reabrir deliberadamente exige confirmação de descarte enquanto existir rascunho; nenhuma ativação forçada do SW. Atualização apenas consulta e informa waiting. Fechar todos os documentos técnicos permite ativação normal. Não salvar rascunho automaticamente.

Diagnóstico: build, modo Safari/standalone observado, capacidades, posse, contagens, sequência e IDs de operações/instalação públicos; sem Cookie, ticket, senha, e-mail, dump canônico ou link real. Estado indisponível deve permanecer legível quando Web Locks/IDB/crypto/SW/contexto seguro faltarem. A indisponibilidade de persist() não é falha de atomicidade nem garantia de durabilidade.

Prova local por controles acessíveis, navegador visível e Java/IndexedDB reais; sem evaluate para despachar comandos do caminho manual. Inspeções técnicas e falhas de ambiente do driver não equivalem a interação no aparelho. Instalação real/Home Screen/VoiceOver continuam não executados até02c físico.
