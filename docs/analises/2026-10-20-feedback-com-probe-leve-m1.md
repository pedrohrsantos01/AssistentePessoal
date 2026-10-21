# Feedback do cumprimento com probe leve — M1, 20/10/2026

O modo leve foi implementado e a coorte válida terminou na primeira tentativa: dez processos frios/vinte alterações offline, reinício e convergência independente de um hábito/10 XP. A meta de feedback continua aberta: 11/20≤100 ms, p50 88,2632 ms, p95 242,4520 ms e máximo 450,0828 ms. Nenhuma amostra alta foi excluída. [Evidências e protocolo](../design/evidencias/2026-10-20/feedback-leve-android/README.md), [confirmação integral](../design/evidencias/2026-10-20/feedback-leve-android/confirmation.json).

## O que mudou

`lightweight` mantém o probe nativo v4 e os marcos JS essenciais, com o PressEvent correspondente ao mesmo UP. Não registra o módulo de relógio síncrono, não lê spans detalhados e não grava Perfetto. `detailed` conserva o perfil anterior e suas validações. Os dois modos têm seleção explícita no build e no lançador; o build exige a flag pública estática, conforme [documentação Expo](https://docs.expo.dev/guides/environment-variables/). O lançador verifica modo/hash antes de abrir recursos; os marcos validam o modo durante a coleta. Dados detalhados ausentes continuam falhando, sem fallback silencioso.

Não houve alteração em hábitos, projeção, fila, identidade, XP, limites de dia ou transações. O sucesso visual continua após commit SQLite; os testes com falha real de escrita continuam aprovados. APKs detalhados anteriores, instalação normal, fontes do probe v4 e analisadores de frame/correlação foram preservados. Os metadados ligam o APK leve `9c6bdca5c13bf1dc6d9e7873f1b44a0c6763b4e468f46c5edc0870136ee59fff` ao bundle e ao modo.

## Resultado e limites

| Medida | P50 | P95 / máximo | Dentro da meta |
|---|---:|---:|---:|
| Feedback | 88,2632 ms | 242,4520 / 450,0828 ms | 11/20≤100 ms |
| Partida interativa | 1008,9210 ms | 5451,6263 / 5451,6263 ms | 8/10≤2 s |
| Cards locais, mesma origem de abertura | 1008,9210 ms | 5451,6263 / 5451,6263 ms | 0/10≤300 ms |

As nove alterações acima de 100 ms estão listadas na confirmação, inclusive 9/2 com 100,3508 ms. P50/p95 usam nearest-rank; não há desconto de overhead, troca de origem ou arredondamento para aceite. A coorte usou AVD/API35/3 GB/GPU host, fonte 100%, TalkBack/animações desligados. O endpoint é o frame renderizado e emitido, não fótons da tela. Aparelho mediano físico e iPhone não foram aceitos.

Na maior alteração, 3/2, as parcelas foram: evento→dispatch 0,6639 ms, dispatch→handler 13,5029 ms, handler→commit 36,7558 ms, commit→retorno 34,5419 ms, retorno→React 43,4988 ms e React→frame 321,1195 ms. Houve um refresh por alteração nas 20 amostras. Isso localiza o intervalo dominante da amostra, sem identificar função React, GPU, GC, E/S ou interferência do host. Distribuições das parcelas não são aditivas.

As partidas 3/4 levaram 5451,6263/4546,9457 ms. O marco `app.module` apareceu a 3751,4998/3091,0625 ms da solicitação de abertura. O atraso antecede esse marco JS, mas estes dados não estabelecem a causa. Os valores permanecem no aceite de abertura/cards com a origem original.

O perfil detalhado anterior teve outra distribuição (18/20≤100 ms). Modos de observação diferentes e coortes distintas não permitem declarar ganho ou regressão causal da aplicação. O resultado leve não demonstra que retirar o profiler resolve as metas; elas continuam abertas.

## Verificação

Tipos, lint e 261 testes do app aprovados: 210 de domínio/51 de componentes. Novos testes cobrem seleção explícita, incompatibilidade, falta de perfis, ausência de chamadas síncronas no modo leve/desligado e propagação intacta de erros. A seleção errada de modo foi recusada antes de iniciar recursos. Os analisadores atuais reproduziram exatamente o resumo e a atribuição armazenados, validando também o modo leve.

Check completo da API aprovado em 15 min 54 s: 14 suítes, 93 casos/85 executados/oito opt-in ignorados, zero falhas/erros e modularidade aprovada. A primeira execução reprovou uma fixture de expiração que misturava o relógio corrente do banco com o Clock congelado da API. [Diagnóstico e regressão](2026-10-20-fixture-expiracao-snapshot.md): diferença deliberada de uma hora reproduziu o erro no SQL anterior; expiração parametrizada pelo Clock e contagem da linha corrigiram o teste, sem mudança de produção. A repetição completa passou; falha e sondagem ficaram preservadas. A correção da fixture ficou no commit separado `f9b5bb3`. Reinício/convergência, restauração de configurações, hash da instalação normal e remoção dos pacotes temporários foram confirmados. Emulador e acompanhamento próprios fechados após o ensaio. A auditoria confirmou APK/configuração nativa normais, APKs detalhados, ADB e metadados selecionados do AVD original; recursos próprios encerrados. Oito containers preexistentes conservaram identidade. O banco de outro projeto `supabase_db_care-platform` apareceu recriado com outro ID e saudável durante o intervalo; autoria não estabelecida e nenhuma ação de parada/recriação dele foi emitida nesta tarefa. A preservação integral dos nove IDs não foi confirmada: [auditoria original](../design/evidencias/2026-10-20/feedback-leve-android/preservation.json) permanece com passed=false, com [avaliação do estado](../design/evidencias/2026-10-20/feedback-leve-android/preservation-assessment.json).

## Próximo recorte

[Perfil da apresentação do cumprimento](../../.scratch/interface-m1/apresentacao-do-cumprimento.md): investigar retorno→React/React→frame e o pico preservado de 321,1195 ms antes de modificar componentes. A partida dos cards vem depois; os picos de abertura desta confirmação também permanecem na fila de investigação. Demais estados/leitura/paletas, aparelho físico/iPhone e gates externos mantêm 06/M1 abertos.
