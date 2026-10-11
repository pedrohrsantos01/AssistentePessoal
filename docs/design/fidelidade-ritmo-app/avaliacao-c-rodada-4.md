# Pareceres — grupo C, rodada 4

**Resultado: APROVADO pelos três críticos.** Pedro autorizou uma rodada adicional após a reprovação C3. Construtor GPT-6.1 Sol; novos contextos independentes para Briefing GPT-6.1 Sol, Sistema GPT-6 Luna e Visual GPT-6 Astra. Os críticos avaliaram renderizações, sem ler implementação ou pareceres anteriores.

| Crítico | Modelo | Veredicto | Fundamentação |
|---|---|---|---|
| Briefing | GPT-6.1 Sol | APROVADO | Criação/edição/prévia, ordem/exclusão, perfil/privacidade, sessão e sync visíveis; consulta preservada e ações bloqueadas em 100%/200%. |
| Sistema | GPT-6 Luna | APROVADO | Nenhuma violação objetiva comprovada; explicações, ações e quebra de texto seguem o DS. Fotos parciais não foram usadas para inferir falta de rolagem ou padding. |
| Visual | GPT-6 Astra | APROVADO | Nomes, descrições e estados continuam legíveis em somente leitura; esmaecimento restrito aos controles. Hierarquia dos painéis e separação por overlay preservadas. |

Provas novas: [gestão 200%](../evidencias/2026-10-11/ritmo-app-android/sync-rodada-4/11-atualizacao-somente-leitura.png), [Briefing 200% após reabertura](../evidencias/2026-10-11/ritmo-app-android/sync-rodada-4/12-bloqueio-apos-reabertura.png), [Briefing 100%](../evidencias/2026-10-11/ritmo-app-android/sync-rodada-4/13-briefing-somente-leitura-100.png), [gestão 100%](../evidencias/2026-10-11/ritmo-app-android/sync-rodada-4/14-gestao-somente-leitura-100.png) e [correção com teclado](../evidencias/2026-10-11/ritmo-app-android/sync-rodada-4/01-correcao-teclado-rodape.png). As quinze fotos de sync C4, do APK6, substituem as fotos C3 desse fluxo na avaliação atual.

Os críticos também examinaram os quatro pares C01/C02/C03/C05, edição/prévia, gestão/texto ampliado e sessão C3, cujas superfícies não mudaram nesta rodada. Para o Visual, os pares foram apresentados sem identificação. Escolhas: C01 empate, C02 empate, C03 empate, C05 esquerda. Diferenças respectivas: densidade entre Tipo/Ícone; controles de ordem; composição dos grupos de Ajustes; reflow da linha de e-mail. Maior diferença residual declarada: composição de Ajustes decorrente das funções reais; não foi considerada impeditiva pelos critérios.

O teste público de somente leitura verifica opacidade efetiva dos ancestrais, semântica de desabilitado e tentativas de marcar/criar/editar/ordenar sem mudar fila/XP/metadados. App typecheck/lint e 180 testes passaram. API check passou com 85 testes Java e 13 operacionais; cinco casos Android são separados desse check. Sync APK6 passou com cinco fases, nove medições de alvos e quinze capturas: [resumo](../evidencias/2026-10-11/ritmo-app-android/sync-rodada-4/verification-summary.json). Fontes/licenças reauditas; emulador/acompanhamento encerrados.

Imagens não certificam operação, medidas físicas ou leitor de tela. A operação foi verificada pelos testes separados. Sessão completa permanece comprovada no APK5; jornada completa, no APK3. Aprovação limitada às telas e mecanismos observados, sem afirmar igualdade de pixels entre renderizadores nem aceitar todo o M1/iOS. [C3 reprovado](avaliacao-c-rodada-3.md) permanece histórico.
