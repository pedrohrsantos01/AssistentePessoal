# 01 — Fechar schemas e invariantes do primeiro marco

Status: ready-for-agent
Blocked by: none

## Problema e resultado

O contrato descreve comportamento e falhas, mas seus exemplos abreviados não podem gerar APIs nem migrations. Produzir schemas completos de comandos, respostas, erros, recibos e snapshot, com modelo validado para o primeiro marco; atualizar os documentos canônicos no mesmo trabalho.

## Escopo

Partir de [spec/13](../../../specs/13-contrato-primeiro-marco.md) e [spec/00 §12](../../../specs/00-modelo-de-dados.md). Delimitar comprimentos, enums, normalização de título/e-mail, tamanho de lotes/contextos e payload imutável. Fechar dependências, decisões de XP sem prêmio, snapshot estável e recuperação SecureStore/SQLite. Não alterar comportamento aprovado nem gerar schema completo de módulos futuros.

## Aceite

- Exemplos completos válidos para sucesso, retry, rejeição, dependência recusada, conflito de ID, sessão expirada e ressync; nenhuma representação essencial usa `{}` como substituto do schema.
- Matriz campo/proprietário/transporte e constraints por conta; nenhum segredo pode entrar em push/pull.
- Recibos e fatos correspondem ao mesmo corte do snapshot; confirmação e rebase não reaplicam intenção resolvida.
- Cenários M1-01 a M1-20 rastreados a invariantes verificáveis; pontos de produto restantes explicitamente resolvidos ou demonstrados fora do caminho implementado.

## Resultado

Concluída: sim — preparação de contratos, 25/09/2026.

Entregues [OpenAPI e instruções](../../../contracts/primeiro-marco/README.md), schemas completos de transporte, exemplos, fixtures de domínio e DDL de referência Postgres/SQLite, incorporados em spec/00 §12. Passaram: validação OpenAPI 3.1.1, 50 schemas, 47 fixtures (37 positivas/10 negativas), 11 fixtures de normalização/teto e oito verificações SQLite. O parser aceitou 25 instruções do DDL Postgres; isso não demonstra execução de RLS/roles no Postgres.

Snapshot, limites, hash, recuperação entre armazenamentos e dependências rejeitadas foram concretizados. O caso de saldo parcial de XP foi demonstrado fora das sequências válidas do M1 e permanece pendente antes de ampliar esse recorte. Migrations efetivas, integração Java/TypeScript, roles e cenários M1-01 a M1-20 pertencem à implementação, não foram declarados concluídos.

## Comments

25/09/2026: tarefa de preparação técnica, autorizada pela continuação documental; não depende do protótipo visual. Correção de comportamento ainda aberto exige decisão do Pedro, não inferência no schema.

25/09/2026: baseline m1.1 e resultado reproduzível em `contracts/primeiro-marco/validation-result.json`. Implementação não iniciada por esta conclusão.
