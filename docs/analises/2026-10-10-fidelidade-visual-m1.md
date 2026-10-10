# Fidelidade visual das telas M1 implementadas

Data: 10/10/2026. Resultado: refinamento das telas dos recortes 01/02 concluído, com aprovação dos três críticos nos grupos de entrada/conta/onboarding, Briefing/XP e gestão/ajustes/painéis. O ensaio final no Android visível passou com API e SQLite reais. O marco M1 completo permanece aberto.

## Escopo e referência

Pedro autorizou todas as telas já implementadas e as recomendações da entrevista. Referência: [Ritmo-M1.dc.html](../../Protótipos%20de%20assistente%20pessoal/Ritmo-M1.dc.html), Holograma claro/escuro. Contratos: [spec/11](../../specs/11-design-system.md), [matriz M1](../design/implementacao-interface-m1.md) e requisitos funcionais existentes. Não houve alteração de domínio, esquema, dependências ou requisitos de fases posteriores.

[Critérios de qualidade](../design/fidelidade-m1/criterios-de-qualidade.md) e [sistema da revisão](../design/fidelidade-m1/sistema-de-design.md) foram definidos antes da construção. O ciclo usou GPT-6.1 Sol para construção/Briefing, GPT-6 Luna para Sistema e GPT-6 Astra para Visual, com críticos independentes e limite de três rodadas por grupo.

## Resultado na aplicação

- Entrada com marca/símbolo e ações inferiores; formulários com tipografia, rótulos, gutters e botão de senha próximos da referência. Aviso adulto/privacidade compacto continua sendo ação acessível com alvo mínimo 44; não foi copiado aceite de termos inexistente.
- Onboarding com etapas, cartões simples de fuso/hora, catálogo de cinco colunas, cores circulares e prévia horizontal a 100%, adaptada a 200%.
- Briefing com composição, linhas de hábitos, contador, check, tiles, XP e navegação por ícones de traço. Copy do XP respeita o prêmio inteiro condicionado ao limite; status mantém o nome acessível independente do check decorativo.
- Gestão em superfície compartilhada, controles de ordem e chevron para descobrir a edição. Privacidade, saída e exclusão usam painel inferior rolável. O editor permanece atrás da exclusão e fica oculto da acessibilidade enquanto o modal está aberto; cancelar preserva o rascunho e não cria operação.
- Borda necessária à operação atende contraste sobre ambos os fundos adjacentes. Textura Holograma usa período de 4 unidades lógicas, corrigindo a repetição excessiva em pixels físicos.

## Verificação visual

| Grupo | Rodadas | Briefing | Sistema | Visual |
|---|---:|---|---|---|
| A — entrada/conta/onboarding | 3 | APROVADO | APROVADO | APROVADO |
| B — Briefing/vazios/XP | 2 | APROVADO | APROVADO | APROVADO |
| C — gestão/edição/ajustes/painéis | 2 | APROVADO | APROVADO | APROVADO |

[Histórico e retificações](../design/fidelidade-m1/avaliacoes.md). Os apontamentos iniciais válidos corrigiram prévia, cadastro, contraste, textura e descoberta de edição. Alegações de corte ou glyph ausente foram retiradas após inspeção da mesma imagem original, sem alteração do APK/rodada extra. O crítico final de Sistema C não conseguiu abrir JSONs pelo terminal; recebeu valores classificados do coordenador e inspecionou as imagens por conta própria. Esse limite está registrado.

As 18 comparações sem identificação de lado foram normalizadas pela área útil. Android 1080×2424, densidade 2,625: corte (0,137,1080,2361), redução para 411×847. Referência: somente quadro externo ajustado para 411,43×928,43; retirada das barras fictícias 47/34; estilos internos preservados. [Método, origem dos lados e hashes](../design/evidencias/2026-10-09/fidelidade-android/rodada-3/comparativos/metodo.json). A 200% avaliamos legibilidade, reflow e alcance; Android usa escala não linear e o HTML mantém alguns rótulos fixos em px.

Comparações finais: [cadastro A 03](../design/evidencias/2026-10-09/fidelidade-android/rodada-3/comparativos/A03.png), [primeiro hábito A 05](../design/evidencias/2026-10-09/fidelidade-android/rodada-3/comparativos/A05.png), [Briefing escuro B03](../design/evidencias/2026-10-09/fidelidade-android/rodada-3/comparativos/B03.png), [gestão C05](../design/evidencias/2026-10-09/fidelidade-android/rodada-3/comparativos/C05.png) e [privacidade 200% C04](../design/evidencias/2026-10-09/fidelidade-android/rodada-3/comparativos/C04.png). Em B03, esquerda é referência e direita é app.

## Testes e medidas

| Verificação | Resultado |
|---|---|
| App typecheck/lint | passou |
| App domínio/núcleo + componentes | 144 + 12 = 156 testes passaram |
| API check integral | passou na rodada inicial do ciclo,12m58s |
| APK final de teste | build aprovado,5m41s; pacote dev.ritmo.journeytest |
| Jornada Android visível final | 20 fases passaram; Node 537,043s, Gradle 9m29s |
| Alvos nativos | 28 medições passaram em 100%/200%; tokens 44 unidades, limiar físico 115px a densidade 2,625 com arredondamento inferior nativo |
| Bordas de controles | 72 pares/6 conjuntos; mínimo 3,102339:1 |
| Texto permitido | 192 pares/6 conjuntos; mínimo 5,252708:1 |
| Textura renderizada | picos a 10/11px alternados: média 10,5px = 4 unidades lógicas |

O teste de contraste ampliado falhou nos três modos claros antes da correção e passou depois. Cancelamento verifica rascunho não salvo, fundo oculto do leitor e fila inalterada. Os demais testes continuam verificando falha durável, limite sem XP, isolamento de contas e tombstone.

O ensaio final registra retomada do onboarding, vazio útil, criação/cumprimento/desfazer offline, reinício, sincronização com 10 XP, modo claro/escuro, fonte 200%, redução de movimento, edição/ordem, convergência de campos independentes, cancelamento e exclusão com reversão de XP para 0, sem ressurreição. Também confirma gestão de início futuro sem cumprimento antecipado. O timeout do driver/harness foi ampliado para acomodar capturas e leitura dos alvos; as asserções de persistência/convergência permaneceram.

[Verificação final e hash do APK](../design/evidencias/2026-10-09/fidelidade-android/rodada-3/verificacao.json), [alvos](../design/evidencias/2026-10-09/fidelidade-android/rodada-3/native-targets.json), [bordas por papel](../design/fidelidade-m1/contraste-paletas.json), [texto por papel](../design/fidelidade-m1/contraste-textos.json), [pixels do login](../design/evidencias/2026-10-09/fidelidade-android/rodada-3/contraste-renderizado.json), [scanlines](../design/evidencias/2026-10-09/fidelidade-android/rodada-3/scanline-renderizada.json). Bordas foram medidas nos pixels de cobertura inteira; franjas de antialias não representam essa cor. Não confundir o mínimo 3:1 dos controles com 4,5:1 dos textos.

O emulador e o painel de acompanhamento próprios foram fechados ao terminar. A verificação de processos confirmou a ausência deles; configurações de fonte/tema/animação/rede e o reverse foram restaurados pelo finally. Não há servidor de desenvolvimento persistente criado para o ciclo.

## Limites e próximo recorte

A aprovação refere-se às telas implementadas e às capturas examinadas. Emoji, rasterização, safe areas, dados reais e copy contratual podem diferir do HTML; o crítico aceitou diferença residual de aproximadamente 14 unidades no ritmo vertical do onboarding. Não se declara igualdade de todos os pixels entre Chromium e Android. Entrada/login/fuso não receberam captura200% neste ciclo; TalkBack/VoiceOver e a matriz integral continuam no aceite próprio.

A seleção/persistência de aparência e estilos Cockpit/Neo no aparelho permanecem no recorte 06; suas paletas tiveram contraste auditado, sem afirmar implementação visual completa. Recortes 03–06 e integrações externas ainda estão abertos. iPhone 16e segue adiado por Q55=B; domínio/e-mail/links e aceite operacional continuam pendentes.

Próximo recomendado: [recorte 03 — sessão, cofre e recuperação local](../../.scratch/interface-m1/issues/03-sessao-e-recuperacao-local.md), mantendo a base visual refinada e os bloqueios Q51–Q53. [Plano atual](../../.scratch/interface-m1/spec.md).
