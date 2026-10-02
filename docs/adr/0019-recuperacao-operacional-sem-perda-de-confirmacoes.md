---
status: accepted
date: 2026-10-02
---

# ADR-019 — Recuperação operacional preserva confirmações

Pedro respondeu A em Q33–Q43 e confirmou o [plano](../../.scratch/recuperacao-operacional/spec.md) em 02/10/2026. Objetivo: RPO zero para transações confirmadas pela API na perda total da VPS primária; RTO alvo até 24 horas incluindo reconstrução, restauração, verificação e reabertura, a comprovar no ambiente real.

Usar receptor contínuo de WAL fora da VPS primária e base física recuperável, sem segundo PostgreSQL completo aplicando WAL neste recorte. Exigir WAL durável remoto antes da confirmação; indisponibilidade pode impedir a confirmação/sincronização, sem fallback assíncrono. Dump periódico sozinho não atende esse objetivo. Sincronismo, cancelamento/resultado incerto, cauda parcial e timelines precisam de provas locais e externas.

Enquanto a completude não estiver comprovada, manter toda API de clientes em quarentena; conta local ativa pode ler e criar novas intenções, preservando SQLite e envelopes. Nunca substituir silenciosamente por snapshot antigo ou reenviar acknowledged para reconstruir histórico perdido. Recuperação incompleta não pode ser publicada sob esta decisão.

Após recuperação integral, invalidar access/refresh, famílias de sessão e links de recuperação anteriores e exigir novo login online. Preservar senha recuperada correta, SQLite e pendências; invalidação remota não é logout. Rotação de chave invalida access e cursores, mas não substitui revogação dos hashes persistidos de refresh/reset. Reautenticação e ressincronização devem manter isolamento e convergência sem duplicar XP. ADR-016 permanece válido.

Base física completa e dump lógico diários às 03:00, America/Sao_Paulo, com WAL contínuo. Janela PITR recuperável de 30 dias, incluindo base âncora anterior e WAL necessário mesmo mais antigos; expurgo por dependência. Ensaio isolado mensal e por release major, verificando integridade/API e duração integral.

Detector fora da VPS primária e alertas por e-mail. Parâmetros iniciais configuráveis: probes a cada 60 s, duas falhas consecutivas; último backup físico ou lógico válido com mais de 26 h; falha de execução imediatamente; armazenamento 80% aviso e 90% crítico. Alertar na abertura, agravamento e resolução, sem repetição do mesmo estado. Detectar ausência de execução e perda do receptor; não inferir falha só pela ausência de novas escritas.

Credenciais/configurações sensíveis e eventuais chaves em cofre externo aos servidores, acessível por Pedro após perda da VPS. Somente referências em documentos/Git/memória. Fornecedor, custos, capacidade, e-mail e acessos reais serão definidos no provisionamento após a prova local. A confirmação do plano autoriza implementação local; não compra/publicação.

Consequência: acrescentar um destino operacional independente para durabilidade, sem ampliar a arquitetura de domínio, adicionar microserviços ou instalar módulos futuros. O M1, UI/protótipo Q28 e aceite dos aparelhos continuam pendentes. Evidência anterior de dump permanece limitada ao corte capturado.

Origem: [entrevista Q33–Q43](../../.scratch/fundacao/entrevista.md). Contratos: [confiabilidade](../../specs/07-nao-funcionais-e-lgpd.md), [conta](../../specs/01-conta-e-onboarding.md), [sync](../../specs/06-sincronizacao.md) e [contrato M1](../../specs/13-contrato-primeiro-marco.md).


## Concretização local do WAL — 02/10/2026

[Recorte 2](../analises/2026-10-02-wal-e-recuperacao-fisica.md): receptor pg_receivewal --synchronous com slot físico/nome dedicados; barreira de publicação com marcador vazio e flush remoto, incluindo leituras/replay e commit incerto. Base/cauda/timeline foram recuperadas após duas perdas, com fatos confirmados verificados pela API; corrupção/ausência e disco sem espaço recusaram avanço. [Procedimento](../../api/ops/wal-recovery.md) e spec/13 §20 registram engenharia/permissões/ativação, sem ampliar o domínio. Inventário/alvo conservador fora do primário e ciclo operacional ficam no incremento 3; aceite externo de RPO/RTO permanece obrigatório.
