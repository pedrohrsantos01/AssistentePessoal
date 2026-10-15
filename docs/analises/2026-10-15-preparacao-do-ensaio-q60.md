# Preparação do ensaio Q60 — 15/10/2026

Continuação da [implementação Q60=A](2026-10-14-foco-protegido-dos-dialogos.md), commit a0e6168. Fonte do produto inalterada nesta etapa; nenhum aceite nativo novo.

Build Android x86_64 da variante dev.ritmo.journeytest passou em2m57s. APK assinado com chave pública de teste, assinatura v2/v3 verificada e sidecar v4 gerado. O comando verify usado não verificou v4; geração do sidecar não é evidência de instalação incremental. SHA-256 final: `efc6633690a86301ebd80badd4b2326e22b06977f0ed14e6fc913064948d30c4`. [Proveniência do APK](../design/evidencias/2026-10-15/q60-preparacao/apk-ready.json).

Typecheck/lint e218 testes passaram novamente:175 domínio/controlador e43 componentes. [Resumo de checks e hash do log](../design/evidencias/2026-10-15/q60-preparacao/checks-summary.json).

A leitura inicial encontrou8,9GB livres e nenhum emulador ativo. Docker Desktop estava aberto, mas seu motor retornou stopped e a consulta ao servidor falhou com “Docker Desktop is unable to start”. O comando oficial start respondeu “already running”; a causa do motor parado não foi comprovada. Nenhuma reinicialização foi executada pelo agente. Pedro escolheu reiniciar o Docker Desktop e avisar quando estiver pronto; aguardar esse aviso antes de nova tentativa de API.

API check não foi executado nesta etapa: depende do Docker indisponível. O check de14/10 permanece a última prova da API, explicitamente histórica. Nenhuma fixture, emulador ou painel de acompanhamento foi iniciado, nenhum APK foi instalado e nenhum processo preexistente foi encerrado. A ferramenta ai-memory não estava disponível nesta sessão; continuidade conferida nos contratos, relatórios e código do checkout, sem atualização remota da memória.

Após o aviso: confirmar Docker, preparar API/PostgreSQL descartáveis e executar a matriz visível com observação de foco desligada, instalação preservada e conferência do hash novo. Registrar restauração e encerramento dos recursos próprios. As paletas do APK anterior não pertencem a este build. Recorte06/M1 continuam abertos, incluindo cobertura integral do leitor, desempenho e iPhone/VoiceOver adiado.


Continuação posterior no mesmo dia: Pedro avisou que ajustou o Docker. O ensaio foi executado, revelou e corrigiu falha real de foco e passou na versão final; [resultado e pendências](2026-10-15-talkback-foco-dos-dialogos.md). Este documento e seus JSONs preservam a fotografia anterior de preparação, não o estado atual da entrega.
