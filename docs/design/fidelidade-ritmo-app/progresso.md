# Correção da referência visual — Ritmo-App

Objetivo: corrigir todas as telas M1 já implementadas para Ritmo-App.dc.html. Pedro corrigiu a seleção de Ritmo-M1 em 11/10/2026. Escopo, modelos e limite reutilizam as decisões aprovadas; nenhum módulo futuro foi adicionado.

Pré-verificação: fonte/support.js disponíveis; Chromium visível capturou a referência e estados equivalentes; Android visível com acompanhamento; fontes/licenças locais auditadas. Memórias consultadas em default/ProjetoAssistentePessoal e conferidas no checkout.

| Grupo | Rodadas | Briefing | Sistema | Visual | Estado |
|---|---:|---|---|---|---|
| A entrada/conta/onboarding | 3 | APROVADO | APROVADO | APROVADO | concluído, com teclado físico 100%/200% |
| B Briefing/vazios/hábitos | 2 | APROVADO | APROVADO | APROVADO | concluído |
| C gestão/criação/ajustes/painéis | 4 | APROVADO | APROVADO | APROVADO | concluído na rodada adicional autorizada |

Três de três grupos concluídos: A3, B2 e C4 (nove rodadas ao todo). [A3](avaliacao-a-rodada-3.md), [B2](avaliacao-b-rodada-2.md), [C3 histórico](avaliacao-c-rodada-3.md) e [C4](avaliacao-c-rodada-4.md) registram pareceres e limites. Os três críticos precisam aprovar; não existe aprovação por maioria. C3 reprovou o esmaecimento de nomes/descrições dos hábitos no modo somente leitura. Pedro autorizou uma quarta rodada para corrigir essa lacuna e repetir a revisão; o limite adicional foi uma rodada, sem aprovação automática. C4 recebeu as três aprovações após novas capturas e revisão independente.

## Histórico das lacunas

- A1: Sistema pediu alcance de Já tenho conta com teclado. A prova inicial XML/IME transitório foi invalidada. Driver passou a decodificar entidades numéricas de emoji.
- A2: offset da safe area não resolveu o Android edge-to-edge em 200%; viewport terminava em 2361px e teclado começava em 1116px.
- A3: limite físico pela altura real do IME/safe areas/dimensões; Page e Sheet restauram ao fechar. Quatro casos de componente e capturas nativas 100%/200%. Sistema corrigiu atribuição de A01 nas mesmas imagens, sem quarta alteração.
- B1: card allDone/rodapé extra e glyphs diferentes. B2 remove esses blocos e segue composição/caracteres da referência, preservando sync real.
- C1: ACK repetido inflava linhas; glyphs/decoração divergiam. C2 usa linha 64/caption da referência e só estados necessários; geometria final de Sheet 88%, padding 10/20/40, gap 14, handle 40×5/raio 3. C04 pareava temas diferentes e foi excluído; C05 usa fonte escura 200%.
- C2: Sistema reprovou a pílula longa do cofre, cuja borda atravessava linhas em 200%.
- C3: cinco estados descritivos usam resumo compacto, preservando explicação e rótulo acessível. Cofre, autenticação e somente leitura têm testes públicos ampliados. Sistema retirou duas premissas: atenção de identidade pode coexistir com indisponibilidade; captura de Fechar abaixo da dobra não comprova falta de padding final. Visual encontrou a lacuna real de legibilidade em somente leitura.

- C4: conteúdo consultável mantém opacidade normal; check/chevron/ordem/criação ficam desabilitados e esmaecidos. Teste de opacidade ancestral e tentativas de ação preserva fila/XP/metadados. Sync repetido no APK6, com fotos100/200; três novos críticos aprovaram.

## Verificação atual

App: 180 testes (150 de domínio / 30 de componentes), typecheck e lint passaram no congelamento C4. API check C4 passou: 85 testes Java e 13 testes operacionais executados/aprovados; 5 casos Android separados ficaram pulados nesse check. O teste público de somente leitura verifica opacidade efetiva dos ancestrais e preservação de fila/XP/metadados após ações bloqueadas. Jornada APK 3: 20 fases e 30 medições de alvos, incluindo teclado 100%/200%. Sessão/sync APK 5: 8/5 fases e 9/9 medições, respectivamente. Sync APK6 passou novamente: cinco fases, nove medições e quinze capturas, incluindo somente leitura100/200. Fontes/licenças auditadas no APK6; emulador/acompanhamento encerrados.

A primeira tentativa de sessão APK 4 falhou no leitor XML, por emoji numérico no rótulo; leitor alinhado ao da jornada e repetição aprovada sem mudar APK. Essa falha e avaliações antigas foram preservadas como histórico.

Aceite integral de aparelhos/leitores de tela, iOS e recortes 05/06 permanecem pendentes. A aprovação visual não substitui esses aceites. A memória mantém o resultado verificado e avisos nos dois registros antigos que selecionavam Ritmo-M1.
