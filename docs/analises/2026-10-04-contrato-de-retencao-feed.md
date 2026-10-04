# Contrato de retenção do feed — Q49/Q50

Data: 04/10/2026.
Resultado: decisões de produto registradas e plano consolidado preparado; implementação ainda não iniciada.

## Definições e rastreabilidade

Pedro escolheu A em Q49 e Q50. Abrangência e cadência constam de [spec/06](../../specs/06-sincronizacao.md), [spec/13 §21](../../specs/13-contrato-primeiro-marco.md), [contratos](../../contracts/primeiro-marco/README.md) e [entrevista](../../.scratch/fundacao/entrevista.md). O [plano para confirmação](../../.scratch/retencao-feed/spec.md) delimita a entrega vertical; a [tarefa](../../.scratch/retencao-feed/issues/01-expurgar-feed-e-snapshots.md) permanece needs-info e não concluída enquanto o entendimento não for confirmado.

## Diagnóstico

A data de emissão do cursor se renova a cada resposta, mas a API ainda não registra até qual revisão o feed foi removido. Um expurgo futuro sem essa proteção poderia saltar alterações. A proposta combina limite por conta, remoção de prefixo elegível, reserva após H e coordenação transacional de snapshots/leitores. Limpeza do feed é distinta de compactar hábitos, fatos/contextos, recibos ou XP.

Os testes existentes de 90 dias removem o feed como fixture após expirar o cursor original. Não provam o cleaner automático nem a retomada de um cursor renovado sobre um prefixo removido. As novas provas estão no aceite da tarefa; não foram executadas porque o comportamento ainda não existe.

## Verificações deste registro documental

- App: typecheck e lint aprovados; 94 testes aprovados.
- API: gradlew check --no-daemon --offline aprovado, em 22 min 13 s; 70 casos JUnit, 69 aprovados, 1 ignorado, sem falhas/erros. ModularityTests aprovado; operationsTest com 13 testes aprovado.
- O teste nativo Android ficou ignorado neste check. Esta execução não substitui aceite iPhone/Android.
- A tentativa inicial dentro do sandbox parou ao acessar a distribuição Gradle. A execução offline com os caches locais completou o check, sem alteração de dependências.
- UTF-8 validado em 10 documentos; 151 alvos de links locais existentes. Revisão e diff --cached --check aprovados antes do commit.

Os checks são da implementação atual: não há código, endpoint, schema ou migration de retenção novo neste registro. O contrato/documentação não torna REQ-SYN-009 nem o M1 completamente aceitos.

## Próximo passo

Confirmar o entendimento do plano consolidado, implementar a tarefa local e produzir as provas de expurgo/ressincronização/execução diária. Instalação externa, UI/protótipo, SMTP/deep link reais, distribuição iOS e aceite nos aparelhos permanecem no acompanhamento do M1.
