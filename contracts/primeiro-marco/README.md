# Contratos executáveis — primeiro marco

Revisão: 30/09/2026 (exclusão de hábito, Q30/Q31 e recuperação de histórico extenso). Baseline de engenharia `m1.1`, OpenAPI 3.1.1. São arquivos de especificação e verificação, **não um backend ou app implementado**. Decisões de produto: [spec/13](../../specs/13-contrato-primeiro-marco.md) e [entrevista](../../.scratch/fundacao/entrevista.md).

- `openapi.json`: formatos completos de 11 endpoints e suas mensagens.
- `examples.json`: fixtures positivas/negativas, com credenciais fictícias.
- `domain-fixtures.json`: resultados esperados de normalização e teto para compartilhar entre Java e TypeScript; não substituem testes nas duas implementações.
- `postgres.sql` / `sqlite.sql`: concretização física de spec/00 §12. Postgres foi parseado; SQLite exercitado em memória. A implementação já exercita roles, grants e migrations no Postgres real; evidências na [primeira fatia](../../docs/analises/2026-09-26-primeiro-recorte-executavel.md) e no [incremento de sessão](../../docs/analises/2026-09-26-sessao-e-isolamento.md).
- `build_contract.py`: fonte que gera OpenAPI e exemplos; modificar essa fonte antes de regenerar.
- `validate.py` e `validation-result.json`: verificação reproduzível do OpenAPI e dos exemplos.
- `requirements.txt`: ferramentas de validação, sem dependências da aplicação.

## Executar a verificação

Na raiz, com Python 3.11:

```powershell
python -m pip install --target .scratch/contract-tools -r contracts/primeiro-marco/requirements.txt
python contracts/primeiro-marco/build_contract.py
python contracts/primeiro-marco/validate.py
```

O diretório de ferramentas é ignorado pelo Git. A validação comprova formato e invariantes expressamente verificadas; não demonstra que a aplicação implementa as regras.

## Regras de formato e limites

Requisições usam JSON UTF-8, `Content-Type: application/json`, cabeçalhos `X-Ritmo-Protocol: m1.1` e `X-App-Version`. IDs UUID v7 minúsculos; revisões int64 em strings decimais até `9223372036854775807`; sequências locais até `Number.MAX_SAFE_INTEGER`. Instantes em UTC com `Z`; datas devem existir no calendário. Limite de corpo descomprimido: 2 MiB. Lote: 1–50 operações; pull: até 500 envelopes indivisíveis.

Campos desconhecidos em comandos são erro de entrada. Respostas produzidas pelo servidor têm allowlist explícita, validada por estes schemas; clientes toleram campos adicionais opcionais em versões compatíveis. Um novo efeito obrigatório não pode ser ignorado: exige atualização e não avança cursor. Não usar os schemas estritos do produtor como justificativa para quebrar clientes em toda adição opcional.

As restrições de tamanho são técnicas: título 120 caracteres, nome 80, senha 8–128, identificadores de ícone/token 64, fuso IANA 100. São contados pontos de código Unicode, com rejeição de surrogates isolados. Título e nome em NFC, trim de espaços externos; título só de espaços é inválido. Para unicidade entre hábitos ativos, `title_key` é NFKC + casefold Unicode + espaços internos consecutivos reduzidos a um. Guardar a versão da normalização no contrato de persistência; o servidor determina a unicidade e fixtures compartilhadas impedem divergência Java/TypeScript.

E-mail de autenticação: sintaxe ASCII de endereço, até 254 caracteres; trim externo e lowercase independente de locale, preservando pontos e sufixos `+`. Não aplicar regras particulares de Gmail nem unificar provedores. A senha nunca é aparada, normalizada, truncada ou registrada. O servidor faz hash adequado para senha; tokens aleatórios de refresh/reset/revogação são persistidos somente como hashes.

`dayStartHour`: 0–23; fuso precisa existir na base IANA da versão fixada. Em transição de horário civil, a virada usa o primeiro instante válido a partir da hora configurada; numa hora repetida, a primeira ocorrência. Não calcular “dia anterior” subtraindo 24 horas de um instante. O `dayKey` existente nunca é recalculado com o perfil atual.

Registro criado agora para o passado: no máximo sete dias lógicos anteriores ao dia de `occurredAt`, e nunca antes de `startDayKey` do hábito. Criação de hábito no M1 começa no dia lógico de sua criação. Envio tardio não reinicia essa janela; `occurredAt` mais de 24h à frente da aceitação e `dayKey` além do limite futuro de spec/04 §2 são rejeitados. Metadados do aparelho permitem validação de consistência, mas não provam criptograficamente quando uma ação offline aconteceu.

Contextos/dependências têm até 4096 IDs por operação/dia nesta baseline. Não truncar contexto, descartar fatos antigos nem dividir uma marcação para contornar o limite. Excedê-lo produz erro recuperável `context_limit_reached`, preserva conteúdo e exige tratamento explícito antes de ampliar essa capacidade. Não apresentar a alteração recusada como salva no servidor. Esse limite operacional não expira pendências por idade.

## Idempotência, dependências e erros

Rejeitar JSON com chaves duplicadas antes da canonicalização. Hash de operação = SHA-256 do envelope integral canonicalizado por RFC 8785, sem cabeçalhos/credenciais. Normalização de negócio acontece depois do hash; mesmo conteúdo de negócio com envelope diferente não permite reutilizar ID. Conta faz parte da chave de consulta do recibo, extraída da autenticação.

`Idempotency-Key` identifica o corpo completo do lote. Persistir hash por conta/chave enquanto a conta existir; reutilização com outro corpo devolve HTTP 409 `idempotency_key_conflict` sem executar comandos. Lotes parcialmente confirmados retomam pelas identidades individuais. Reutilização indevida de `operationId` devolve `id_content_conflict` sem substituir seu recibo original. IDs repetidos dentro do mesmo lote são `400 invalid_request` antes de executar o lote.

Resultados aceitos/reconciliados guardam recibo original imutável. `projections` do ack representa todos os dados afetados em suas revisões atuais, que podem ser posteriores ao recibo num retry; aplicar por revisão da entidade. Não guardar cópias indefinidas de perfis antigos apenas para reproduzir um ack: recibo mantém resultado, hash e chaves afetadas, e as projeções podem ser relidas. Ack não avança cursor de pull.

Dependência desconhecida: `deferred`. Dependência definitivamente rejeitada: recibo `rejected/dependency_rejected`; pai e filhas permanecem recuperáveis, sem retry infinito. Uma correção cria nova cadeia e novos IDs, com `supersedesOperationId`; não reescrever envelopes enviados. Validar referências na mesma conta e, para desfazeres, no mesmo hábito/dia. Não exigir sequências numéricas contíguas nem usar relógio como desempate.

| HTTP | Situação | Consequência |
|---|---|---|
| 200 | Push válido, inclusive com operações rejeitadas/adiadas | Interpretar cada resultado; não confundir HTTP com aceite de todas as intenções |
| 400 | JSON/envelope inválido, lote com IDs repetidos | Não executar lote; conteúdo local preservado |
| 401 | Login inválido, sessão/refresh/reset inválido | Reautenticar quando aplicável; não apagar base |
| 409 | E-mail indisponível, chave de lote em conflito ou cursor requer resync | Tratar pelo código tipado; não repetir cegamente |
| 404/410 | Snapshot inacessível/expirado | Não revelar outra conta; reiniciar somente cópia em staging |
| 413 | Corpo acima do limite | Dividir o lote mantendo operações imutáveis; operação individual excessiva exige recuperação, sem truncar |
| 426 | Protocolo/app incompatível | Leitura local preservada, atualização necessária |
| 429/503 | Limite transitório/indisponibilidade | Retry com backoff; respeitar `Retry-After` quando presente |

Falhas antes de autenticar não recebem recibo de domínio. Falhas transitórias não encerram operações. Mensagens humanas são traduzidas no app a partir dos códigos; erros não incluem senha, token, SQL ou payload original.

## Snapshot e confirmação ao corte H

O primeiro pull sem cursor retorna `409 resync_required`. `POST /sync/snapshots` materializa, em uma transação de leitura consistente, as projeções permitidas e a revisão H observada naquela mesma visão. Gravar um manifesto e itens imutáveis ordenados por tipo/chave; publicar o manifesto somente quando todos os itens estiverem disponíveis. Não manter uma conexão/transação aberta entre requisições HTTP.

O snapshot vence em 15 minutos; páginas de até 500 entidades usam cursor autenticado que vincula conta, snapshot e posição. Retentar a mesma página devolve a mesma página. Reservar o feed após H enquanto o snapshot estiver válido; sua limpeza não pode abrir lacuna entre cópia e retomada. Hashes/segredos de Identity, recibos privados e o registro interno de IDs excluídos não entram no snapshot.

No aparelho: pausar novas tentativas de push durante a troca, continuar persistindo ações locais e manter a base atual até staging estar completo. Consultar `/sync/receipts` para todas as operações sem confirmação ao corte H, incluindo as criadas durante a cópia; a seleção e o swap são serializados com o escritor local. Operações processadas depois de H retornam `notProcessedAtH` e serão reconhecidas no feed seguinte. Não inferir rejeição por ausência.

Uma rejeição definitiva sem revisão pode ser reconhecida na consulta; ela não exige estado posterior ao snapshot. Remover somente operações confirmadas da projeção aplicada; conteúdo rejeitado permanece recuperável. Trocar base canônica + cursor + reconhecimentos de fila numa transação SQLite no banco da conta, usando tabelas de staging no mesmo banco. Não depender de uma troca atômica de arquivos WAL abertos. Interrupção antes do commit conserva a base antiga; depois do commit, a nova base é completa.

## Sessão e recuperação entre armazenamentos

Não existe transação conjunta SQLite/SecureStore. Um pequeno registro local de controle, sem credenciais, mantém geração de sessão, conta selecionada e estados `active/logging_out/locked`. Logout grava duravelmente `logging_out` e incrementa geração antes de remover credenciais. A UI bloqueia a conta imediatamente; após reinício, `logging_out` conclui remoção e nunca restaura acesso pelos tokens antigos.

Persistir a capacidade limitada de revogação antes de remover refresh; ela permite somente revogar aquela família. Encerrar como `locked` após a limpeza. Falha no SecureStore conserva o bloqueio e oferece retry; não declara acesso reaberto. Respostas de gerações antigas não escrevem base nem credenciais da sessão atual.

Na rotação, gravar o novo conjunto de credenciais numa chave protegida de geração nova antes de apontar o controle para ela; validar o conjunto na recuperação e retirar a chave antiga após confirmação. Resposta perdida antes de gravar o refresh novo exige login online; preservar base e acesso local quando não houve logout. Nenhum refresh antigo é reativado para esconder uma falha.

Revogação invalida imediatamente renovação. Access JWT stateless já emitido tem janela máxima de 15 minutos; logout remove a cópia local. Exclusão de conta tem fluxo próprio fora deste recorte e deve impedir acesso ao domínio quando confirmada. Link de reset usa HTTPS no host da API (`/password-reset#token=<base64url>`) e é consumido via POST pelo app. Uma confirmação invalida os outros links abertos e revoga as sessões da conta na mesma transação; solicitar outro link não invalida os anteriores. Endpoints e integração com SMTP local foram [verificados](../../docs/analises/2026-09-27-recuperacao-de-senha.md); domínio/associação de links e SMTP externo são parâmetros operacionais a fornecer antes do aceite no aparelho.

## XP e fronteira deste recorte

O núcleo do M1 acrescenta `habit.delete` em 30/09/2026; a UI de confirmação depende do protótipo. Q30 reverte XP do hábito excluído sem devolver consumo e substitui o antigo caso de preservação de XP. Q31 aprova prêmio inteiro: conceder 10 somente se couber no saldo; caso contrário, decidir `limit_reached`, sem prêmio parcial. Desfazer/refazer conserva a decisão original.

Exclusão grava tombstone/ID excluído e reverte os cumprimentos/XP na mesma revisão. O tombstone invalida a projeção local mesmo contra pendências e ack antigo, sem apagar as intenções recuperáveis. Quando a transação exceder 32 entidades, ack/replay devolvem o tombstone e pull exige snapshot paginado; não aumentar limites nem emitir envelope truncado. Ver spec/13 §18.

## Invariantes além de JSON Schema

Validar em domínio/transação: unicidade de título; existência/pertença de recursos; dependências acíclicas e conhecidas; relação entre `dayKey` e contexto; sequência/id imutáveis; mesmo dia nos desfazeres; revisão no int64; prêmio exatamente 10 no M1; `budgetCost=amount`; soma de consumo; resultado de operação com correspondência um a um à requisição; revisão de cada envelope e todas as suas entidades iguais; snapshots completos e recibos limitados a H. O schema não consulta banco nem autentica usuários.

Fontes técnicas de formato: [OpenAPI 3.1.1](https://spec.openapis.org/oas/v3.1.1.html), [JSON Schema 2020-12](https://json-schema.org/draft/2020-12/json-schema-validation), [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785). As políticas específicas do Ritmo acima são decisões de engenharia deste contrato, não prescrições dessas fontes.

### Refinamento de sessão — 26/09/2026

Aprovado por Pedro: refresh retorna `RefreshResponse`, com os campos de sessão exceto `revokeToken`. Cadastro/login continuam retornando `SessionResponse`. O cliente conserva a capacidade de revogação original durante todas as rotações da mesma família. Nenhum segredo de revogação é recuperado a partir de hash nem substituído ao renovar. Este ajuste da baseline m1.1 antecede a primeira implementação de refresh e qualquer implantação pública; não há cliente publicado dependente da resposta anterior.


## Compatibilidade implementada — 29/09/2026

`X-App-Version` segue SemVer com até 64 caracteres, componentes principais de até seis dígitos e sem zeros à esquerda; pré-release e metadados podem coexistir. O servidor compara contra a mínima estável em `app_compatibility`, com 426 antes do processamento e 503 quando a configuração não pode ser lida. O protocolo de mensagens permanece m1.1. A migration Flyway V3 mantém grants de leitura operacional; a restrição local usa Drizzle 0001 no banco separado da instalação. [Modelo físico](../../specs/00-modelo-de-dados.md) e [validação do incremento](../../docs/analises/2026-09-29-compatibilidade-e-leitura-local.md).
