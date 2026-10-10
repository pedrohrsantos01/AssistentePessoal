# 04 — Resultados de sync, identidade e compatibilidade

Status: ready-for-agent
Blocked by: none

## Resultado esperado

Pílula, estado por item e sheets com resultados reais de fila/transporte/snapshot/compatibilidade/identidade. Não juntar falhas em “descartar tudo”.

## Aceite

- Confirmado/local/enviando/não salvo/recusa têm texto e forma distintos; recibo/projeção canônica confirma remoto.
- Rejeição comprovada permite correção/descarte aprovados; dependentes/intenção rastreáveis, campos preservados na falha.
- Q53 preserva intenção incerta e dependentes bloqueados sem descarte/nova identidade/reenvio automático; independentes continuam.
- 429 respeita Retry-After; 503/quarentena pausa remoto sem apagar fila; retry manual não burla espera.
- Snapshot usa progresso real ou indeterminado; falha/reinício retoma sem conta vazia/parcial como pronta.
- Atualização/build offline conserva somente leitura até verificação; formulários também desabilitam escrita.
- Retry/pull não celebra XP; concessão/limite reais. Redução de movimento e anúncio acessível sem repetição por render.
- Testes pelos pontos públicos, falhas controladas nas fronteiras e Android visível distinguem identidade incerta de recusa.

## Referências

REQ-SYN-017; REQ-GAM-002a/003a; Q32/Q53; spec/13 §§6–8/22; matriz de interface.

## Resultado

Concluída: não.

## Comments

09/10/2026: criado após incorporar o protótipo; execução/aceite nativo pendentes.

10/10/2026: recorte 03 concluído e verificado; dependência removida. Este é o próximo recorte recomendado.
