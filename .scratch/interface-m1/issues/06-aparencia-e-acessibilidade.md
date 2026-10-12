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

Concluída: não. Preferências implementadas; [relatório e evidências](../../../docs/analises/2026-10-12-interface-aparencia-e-preferencias.md). Restam desempenho instrumentado e matriz integral de acessibilidade/estados; iPhone/VoiceOver segue adiado e não é dispensado. A matriz final passou; a entrada física e o roteiro básico TalkBack passaram no [incremento de continuidade](../../../docs/analises/2026-10-12-talkback-e-continuidade-do-briefing.md). A atualização do cumprimento preserva o foco; leitura a200%/forms/sheets/erros e medidas ainda não aceitas. [Próximo recorte](../leitor-e-desempenho.md).

## Comments

09/10/2026: criado após incorporar o protótipo; execução/aceite nativo pendentes.

09/10/2026: dependência 02 removida após entrega de gestão. Preferências, leitores de tela, conteúdo longo, matriz completa e medidas de desempenho continuam neste recorte/aceite dos aparelhos; o ensaio de gestão a 200% não os substitui.

10/10/2026: dependências 03/04 removidas após entregas verificadas. Status needs-info mantido: custódia/representação das preferências e som ainda exigem definição antes de persistir. Leitores de tela, temas/modos, matriz integral e desempenho continuam pendentes.

12/10/2026: Q56/Q57/Q58=A fecharam o [contrato de preferências](../preferencias.md). Implementação iniciada, áudio em recorte próprio; matriz Android e medidas ainda não aceitas.

12/10/2026: ponte SDK/JWT e observador sem supressão aprovados; providers locais preservam identidade/foco. Rodada7:12 paletas/36 alvos e roteiro básico no APK assinado, mantendo dados; rodada10 repete o roteiro após cold boot com foco retido e restauração registrada; instrumento/roteiro completo e gates externos continuam abertos.
