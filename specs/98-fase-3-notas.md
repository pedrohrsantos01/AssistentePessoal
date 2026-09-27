# spec/98 — Notas dos módulos adiados (não implementar)

Este arquivo existe para que as ideias dos módulos adiados não se percam **e** para que nenhum agente as implemente por engano. Nada aqui está aprovado nem especificado.

> Notícias e Esportes **saíram deste arquivo** — foram promovidos à Fase 2A e têm specs próprios (`09-noticias.md` e `10-esportes.md`).

---

## Treinos (primeiro candidato da Fase 2B)

Reaproveita bem a engine: rotina é checklist, sessão é registro diário, série tem ofensiva.

Problemas a resolver **antes** de escrever o spec:
- Biblioteca de exercícios: de onde vem? Curada à mão (~150 exercícios, viável) ou base externa com licença?
- Unidade de carga (kg/lb) e configuração por usuário
- Cardio tem shape de dado diferente de musculação — duas entidades, não uma
- Timer de descanso com tela bloqueada exige notificação local precisa e som
- Superset, dropset, falha, RIR
- Sessão interrompida no meio (perda de conexão, app morto) precisa de rascunho persistido
- **Guardrail obrigatório:** REQ-GAM-020 — XP por registrar, nunca por carga atingida ou peso corporal

## Finanças (segundo candidato)

Categoria de maior retenção do mercado (D30 de 10–15%) e maior disposição a pagar no Brasil. Mas a régua subiu: Organizze e Mobills importam extrato automaticamente via Open Finance, e o país já passou de 100 milhões de contas conectadas e 154 milhões de consentimentos ativos. Lançamento manual puro não compete.

**Condição de entrada:** só começa com agregador (Pluggy ou Belvo) contratado. Caso contrário, não entra.

Entidades que o PRD v1 não previa e sem as quais o módulo não fecha:
- `accounts` (conta corrente, poupança, carteira, cartão)
- `credit_cards` com dia de fechamento e de vencimento
- `assets` e `liabilities` — **patrimônio líquido não sai de receita e despesa**, exige saldo de contas, bens e dívidas
- `transfers` — transferência entre contas não é receita nem despesa; sem isso o relatório dobra valores

Problemas de domínio conhecidos:
- Gestão por fatura é onde a maioria dos apps erra: cartão não é conta, o gasto agrupa por fatura
- Compra parcelada em 12x: regime de caixa vs competência. Decisão de produto, não técnica
- Estorno e reembolso
- Edição retroativa que altera relatório já visto
- Dinheiro sempre em **centavos inteiros**, nunca float
- Categoria excluída com lançamentos dentro
- Toda ação financeira do assistente exige confirmação, sem exceção (REQ-IA-003)

## Refeições (Fase 3)

- Base nutricional: TACO (brasileira, gratuita, limitada) ou base paga. Sem base, não há macro
- Lista de compras automática esconde dois problemas difíceis: conversão de unidade (200g vs 1 xícara vs 2 unidades) e deduplicação entre receitas
- Escala de porção (receita para 4, comeu 1)
- **Maior risco de dano do produto inteiro.** Se entrar, entra sem meta calórica agressiva, sem ofensiva de déficit e sem qualquer copy de restrição

## Leitura (Fase 3)

Barato de construir, mas frequência semanal — não move retenção. Audiolivro mede tempo, ebook mede *location*, livro mede página: três unidades diferentes. Importação por ISBN via Google Books ou OpenLibrary.

## Busca global unificada (Fase 2B)

Motor de busca sobre todos os módulos, com texto livre e voz. Só faz sentido quando houver 4+ módulos com volume real. Problemas a resolver antes: índice (Postgres full-text com `tsvector` e dicionário em português resolve o caso de um usuário — não precisa de Elasticsearch), ranqueamento entre tipos diferentes de entidade, e como a busca por voz difere do assistente (busca **encontra**, assistente **age**).

## Notion — **cortado** (ADR-012)

Sincronização bidirecional criaria três fontes de verdade (app, Google Calendar, Notion) disputando o mesmo evento, e a API do Notion tem limite de taxa restritivo. Se voltar, volta como espelho de mão única: app → Notion, sem leitura de volta.

## OCR de recibo fiscal (Fase 3)

Depende do módulo Finanças existir. Nota fiscal brasileira tem QR Code com chave de acesso — ler o QR é muito mais confiável que OCR do papel, e deve ser a primeira via.

## LLM on-device (Fase 3)

Para comandos rápidos sem rede. Avaliar só depois de ter métrica real de quanto do uso do assistente é offline. Custo de bundle e de bateria é alto; o ganho pode ser pequeno.

## Wearables (Fase 3)

Apple HealthKit e Google Health Connect, alimentando Treinos. Dado de saúde tem tratamento especial na LGPD — rever `specs/07` antes.

## Esportes — **promovido**

Não está mais aqui. Foi reinstaurado e especificado em `10-esportes.md` (ver ADR-001 do PRD). Os edge cases levantados no corte original foram todos incorporados àquele spec.
