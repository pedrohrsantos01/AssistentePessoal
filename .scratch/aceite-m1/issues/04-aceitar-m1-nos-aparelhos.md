# 04 — Aceitar M1 com PWA no iPhone16e e app Android

Status: needs-info
Blocked by: 03-integrar-recuperacao-nativa-android.md; ../../primeiro-marco/issues/03-integrar-prototipo.md; ../../recuperacao-operacional/issues/04-validar-operacao-externa.md; ../../pwa-m1/issues/07-preparar-publicacao-e-aceite.md

Origem: [primeiro marco](../../primeiro-marco/spec.md), [spec/13 §9](../../../specs/13-contrato-primeiro-marco.md#9-cenários-de-aceite-do-contrato) e [plano](../spec.md).

## Critérios de aceite

- Q65: validar PWA no Safari e na Tela de Início do iPhone16e e app React Native no emulador Android. Registrar iOS/Safari, identidades de instalação, release e adaptações aprovadas em spec/14. Instalação/links nativos iOS ficam na tarefa05 posterior.
- Integrar interface aprovada, estados vazios/carregamento/erro/recuperação e acessibilidade; seguir spec/11 consolidado e a tarefa visual existente; referência recebida não equivale a aceite nativo.
- Registrar evidência M1-01 a M1-20, separando provas automáticas de domínio/API e verificações nos aparelhos. Exercitar onboarding retomável/pular hábito, offline/reinício, logout A/B/A, falhas/retry, mesma conta e XP único entre iPhone e Android.
- Exercitar recuperação por mensagem/link na PWA iPhone e no build Android correto; Universal Links nativos iOS ficam posteriores. WEB-01–10 complementam M1-01–20. Desktop não substitui Safari físico.
- Referenciar gates operacionais 4D existentes, com limitações/janela real. Não repetir instalação em tarefa paralela.
- Identificar commit/build, aparelhos/versões, cenários e evidências sanitizadas; manter gates pendentes abertos.

## Resultado

Concluída: não — implementação/provas PWA, pendências Android/visuais e aceite externo ainda necessários. Q65 retirou a distribuição nativa iOS deste gate. M1 não encerra toda a Fase1.

## Comments

08/10/2026 — Q55=B não dispensa iPhone nem muda critério do marco. Quando retomada, definir pré-requisitos antes da integração iOS.

21/10/2026 — Q65 substitui a obrigação de build/Universal Links nativos iOS para o aceite funcional M1. A prova PWA é preparada na trilha pwa-m1 e consolidada aqui com Android e operação, sem duplicar tarefas externas. Nenhum aceite foi declarado; a validação nativa iOS permanece na tarefa05.
