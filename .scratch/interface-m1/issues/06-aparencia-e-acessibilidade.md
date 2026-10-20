# 06 — Preferências e acabamento acessível

Status: in-progress
Blocked by: none

## Resultado esperado

Direção define Holograma padrão, três aparências, claro/escuro, fontes/geometria/redução de movimento. Entregar seleção/persistência e revisar jornadas implementadas.

## Definições antes da persistência

Q56–Q58=A fecharam custódia por instalação e armazenamento visual isolado/versionado, com preservação e nova tentativa nas falhas. [Contrato](../preferencias.md). Áudio fica em incremento próprio; não há seletor inoperante. Implementação funcional e rodada Android3 verificadas; matriz final de contraste/paletas passou; Roteiro básico TalkBack a100% aprovado pela ponte física; matriz completa/medidas permanecem abertas.

## Aceite

- Seis conjuntos nos mesmos componentes; escolha persistida conforme contrato aprovado; seguir sistema reage à mudança do sistema.
- Fontes embarcadas offline, identidade de cor do hábito e contrastes válidos.
- 100%/200%, conteúdo longo, teclado/safe areas sem cortar campos/ações; alturas crescem, sheets/abas não ocultam destinos.
- Link de privacidade/bordas corrigidos; cores/transparências/toasts/foco/estados verificados.
- TalkBack/redução de movimento Android; VoiceOver/iPhone no aceite físico existente quando retomado. Documentar limites.
- Tempos reais de abertura/cards/feedback; nenhum timer é prova. Não antecipar cinco abas/nível da Fase 1.

## Referências

REQ-DS-001/002/003/005/006; spec/07 §1; spec/08 §6; tarefa visual 03/aceite dos aparelhos.

## Resultado

Concluída: não. Preferências implementadas; [relatório e evidências](../../../docs/analises/2026-10-12-interface-aparencia-e-preferencias.md). Instrumentação/coleta entregue em20/10; metas de cards/feedback e matriz integral de acessibilidade/estados continuam pendentes; iPhone/VoiceOver segue adiado e não é dispensado. A matriz final passou; a entrada física e o roteiro básico TalkBack passaram no [incremento de continuidade](../../../docs/analises/2026-10-12-talkback-e-continuidade-do-briefing.md). A atualização do cumprimento preserva o foco. O roteiro a200% de formulários/diálogos/falhas locais passou em15/10, com foco obrigatório nos cinco diálogos observados; cobertura integral dos estados e medidas permanecem abertas. [Próximo recorte](../leitor-e-desempenho.md).

## Comments

09/10/2026: criado após incorporar o protótipo; execução/aceite nativo pendentes.

09/10/2026: dependência 02 removida após entrega de gestão. Preferências, leitores de tela, conteúdo longo, matriz completa e medidas de desempenho continuam neste recorte/aceite dos aparelhos; o ensaio de gestão a 200% não os substitui.

10/10/2026: dependências 03/04 removidas após entregas verificadas. Status needs-info mantido: custódia/representação das preferências e som ainda exigem definição antes de persistir. Leitores de tela, temas/modos, matriz integral e desempenho continuam pendentes.

12/10/2026: Q56/Q57/Q58=A fecharam o [contrato de preferências](../preferencias.md). Implementação iniciada, áudio em recorte próprio; matriz Android e medidas ainda não aceitas.

12/10/2026: ponte SDK/JWT e observador sem supressão aprovados; providers locais preservam identidade/foco. Rodada7:12 paletas/36 alvos e roteiro básico no APK assinado, mantendo dados; rodada10 repete o roteiro após cold boot com foco retido e restauração registrada; instrumento/roteiro completo e gates externos continuam abertos.

13/10/2026: [matriz ampliada TalkBack](../../../docs/analises/2026-10-13-talkback-formularios-dialogos-e-erros.md) completou18 fases funcionais a200%, com35 medições de controles/9 de campo-IME e conferência independente na API; modo de observação mantém aprovação integral falsa. Q60 aguarda definição do destino de foco dos diálogos; não aceitar a proposta por silêncio. Desempenho, cobertura integral de estados/leitura e iPhone continuam abertos.

14/10/2026: Q60=A confirma título inicial e retorno protegido ao acionador, com invalidação em saída/troca de conta/recuperação e tratamento de revisão aninhada. Implementação e218 testes locais verificados; [relatório](../../../docs/analises/2026-10-14-foco-protegido-dos-dialogos.md). A nova repetição visível aguarda Pedro avisar que liberou memória; nenhuma aprovação nativa por testes de componentes.


15/10/2026: [APK Q60 preparado e218 testes repetidos](../../../docs/analises/2026-10-15-preparacao-do-ensaio-q60.md). Motor Docker indisponível; Pedro escolheu reiniciar e avisar. API/nativo não iniciados, nenhum emulador aberto ou processo preexistente encerrado; aguardar seu aviso. Recorte permanece in-progress.


15/10/2026, continuação: Docker voltou após ação de Pedro. Matriz estrita encontrou e corrigiu seleção do corpo no lugar do título; versão final sem logs passou18 fases/cinco diálogos, com35 alvos/9 campos-IME e restauração. [Relatório](../../../docs/analises/2026-10-15-talkback-foco-dos-dialogos.md). Recorte permanece in-progress pelos cenários restantes, medidas e aceite integral.


15/10/2026, revisões de sincronização: [matriz ampliada](../../../docs/analises/2026-10-15-talkback-revisoes-de-sincronizacao.md) aprovada a200% no APK7430a6f8:24 fases/nove registros de foco,75 controles/13 campos-IME. Corrigida a revelação do acionador fora do viewport; cancelamento aninhado, correção com dependente, fallback no título, diagnóstico incerto e persistência após reinício verificados. Cliente independente confirma10 XP e trabalho independente; configurações restauradas e recursos próprios fechados. App:225 testes/tipos/lint; API check:85 executados/oito nativos opt-in ignorados,13 verificações operacionais e modularidade aprovados. Recuperação de senha/preempção, demais estados, travessia entre janelas, edição falada, desempenho, novas paletas e iPhone mantêm06/M1 abertos.


15/10/2026, leitor na recuperação: [roteiro aprovado](../../../docs/analises/2026-10-15-talkback-recuperacao-de-senha.md) no mesmo APK7430a6f8, sem alteração do produto ou de app/harness:12 fases a200%, duas interrupções de diálogo,44 medições de controle/14 campos-IME. SMTP/API locais, entrada quente/fria, senha inválida/offline, usado/expirado/origem inválida, resposta uniforme, reautenticação e preservação de hábito/10 XP com isolamento entre contas verificados. Configurações restauradas e recursos próprios fechados. App:226 testes/tipos/lint aprovados; API check aprovado:85 executados/oito nativos opt-in ignorados,13 verificações operacionais e modularidade, sem falhas. Q60 não impõe título inicial a páginas. Travessia entre janelas/edição falada, demais estados, desempenho, paletas e iPhone mantêm06/M1 abertos.

16/10/2026, navegação linear: [matriz nativa](../../../docs/analises/2026-10-16-talkback-navegacao-dos-dialogos.md) aprovada no mesmo APK7430a6f8:31 fases/sete contextos,145 gestos e297 observações de foco, com nós/janelas efetivos e probes de borda nos dois sentidos. Privacidade, exclusão, saída, sincronização e revisões aninhadas permaneceram confinadas; sessão/hábito/XP e retorno protegido verificados. Duas tentativas interrompidas pelo driver ficaram separadas da rodada3 aceita; produto inalterado. Tipos/lint e227 testes do app passaram; API check aprovado em10m40s:85 executados/oito nativos opt-in ignorados,zero falhas/erros,13 verificações operacionais e modularidade. Configurações restauradas e recursos próprios fechados. Descarte/demais estados, edição falada, desempenho, paletas e iPhone mantêm06/M1 abertos.


16/10/2026, descarte e esperas com leitor: [roteiro delimitado aprovado](../../../docs/analises/2026-10-16-talkback-descarte-e-espera.md) na rodada4, APK d9c8fd34: nove fases a 200%, 79 medições de controles e 12 campos/IME. Cancelamento preservou original; descarte por item conservou dependente/histórico e estado canônico remoto. Push 429/503 preservou prazo após reinício e retomou sem duplicar o resultado. Cópia interrompida antes da primeira página manteve o bloqueio e, completa, preservou isolamento A/B/A. Produto/schema inalterados; fixtures de push e driver ampliados. Tentativas reprovadas e diagnóstico parcial continuam separados. Configurações restauradas, instalação preservada e emulador/painel próprios fechados. Tipos/lint e 228 testes do app aprovados; check completo da API aprovado em 10m43s: 85 executados/oito nativos opt-in ignorados, zero falhas/erros, 13 verificações operacionais e modularidade. Atualização obrigatória/estado somente leitura no leitor, retry esgotado, staging não zero interrompido, demais estados, edição falada, medidas, paletas do novo hash e iPhone mantêm 06/M1 abertos.


18/10/2026 — [Atualização obrigatória e leitura local com TalkBack](../../../docs/analises/2026-10-17-talkback-somente-leitura.md). Rodada 12 aprovada a 200% no AVD separado/API 35/4 GB: 11 fases, 76 controles e 11 campos/IME. Corrigidos aviso de atualização e retorno de foco. Originais, diagnóstico e 10 XP preservados na atualização sintética em lugar, com conferência independente e limpeza confirmada. App: 231 testes/tipos/lint; API check completo aprovado. Retry esgotado, staging não zero, edição falada, desempenho, paletas integrais e iPhone mantêm 06/M1 abertos.


18/10/2026 — [Retentativas esgotadas e retomada manual com TalkBack](../../../docs/analises/2026-10-18-talkback-retentativas-esgotadas.md). Corrigida perda de Retry-After na décima falha, mantendo prazo/IDs/dependência e exigindo ação após o vencimento. Red/green de núcleo/componente e rodada 3 a 200% aprovados: seis fases, 40 controles/seis campos-IME/cinco retornos, reinício/gatilhos sem autoenvio e convergência de um hábito e 10 XP. Tipos/lint e 234 testes do app; API check completo em 17m39s, 85 executados/oito opt-in ignorados, 13 operacionais/modularidade, zero falhas. Restauração e isolamento confirmados; recursos próprios encerrados. Próximo: staging não zero interrompido; demais estados/leitura, edição falada, desempenho, paletas do novo APK e iPhone mantêm 06/M1 abertos.


19/10/2026 — [Cópia parcial interrompida com TalkBack](../../../docs/analises/2026-10-19-talkback-copia-parcial.md). Rodada 1 aprovada a 200% no APK a7f47a73: seis fases, 46 controles/dez campos-IME/três retornos. Staging real de 500 entidades preservado no reinício offline, base anterior/intenções dependentes/10 XP conservados, conta inicial bloqueada até completar e A/B/A isoladas. Três conjuntos originais idênticos e confirmação independente sem duplicação. Fontes de produto/schema inalterados; testes/harness/lançador ampliados. Tipos/lint e 237 testes do app; API check completo em 19m15s, 85 executados/oito opt-in ignorados, 13 operacionais/modularidade, zero falhas. Restauração/isolamento confirmados e recursos próprios encerrados. Próximo recomendado: medidas instrumentadas de abertura/cards/feedback; leitura/edição falada restante, paletas integrais, iPhone e gates externos mantêm 06/M1 abertos.

20/10/2026 — [Desempenho instrumentado](../../../docs/analises/2026-10-20-desempenho-instrumentado-m1.md). Rodada8/schema2 válida no AVD/API35/3GB:10 processos frios/20 alterações offline. Abertura: p95/máximo1091,88ms,10/10≤2s. Cards: p50 de883,51ms,0/10≤300ms. Feedback: p95 de135,03ms/máximo3014,37ms,0/20≤100ms. Origem de abertura/cards no launcher do próprio Android antes do Intent; PID ausente/novo e relógios correlacionados ao frame, sem incluir comunicação do ADB. Reinício/convergência independente10XP e restauração confirmados; recursos próprios fechados. Tipos/lint e249 testes app; check API85 executados/oito opt-in ignorados,13 operacionais/modularidade, zero falhas. Sete tentativas rejeitadas separadas; metas não relaxadas. Próximo: atribuir/reduzir latência do cumprimento, depois partida dos cards. AVD não aceita aparelho mediano físico/iPhone;06/M1 continuam abertos.
