# Abertura segura de bancos locais — 28/09/2026

## Resultado

Recorte de REQ-SYN-012/013 e M1-13, autorizado na continuação da [tarefa 05](../../.scratch/primeiro-marco/issues/05-completar-sessao-e-recuperacao.md). A abertura dos bancos de conta e instalação verifica se o histórico aplicado é um prefixo do journal conhecido. Schema desconhecido ou mais novo impede a abertura; falha do migrator expõe `LocalRecoveryRequired`, com identificação do banco e código estável. A conexão é fechada sem apagar arquivos, filas ou chaves protegidas.

Mantivemos o migrator oficial do Drizzle 0.45.3 e sua transação. Não há alteração de schema nem nova migration de produção. A proteção lê o histórico `__drizzle_migrations` já mantido pelo framework; não valida hashes de conteúdo, que diferem entre os adapters Expo e desktop. A aplicação continua usando migrations sequenciais versionadas e bundle gerado para Expo.

## Evidências

Os [três testes de abertura](../../app/test/migrations.test.ts) usam SQLite real e observam interfaces públicas:

- Um app com journal antigo recusa histórico desconhecido e conserva a intenção original.
- Uma migration seguinte de fixture altera um envelope, falha e sofre rollback. A conta inativa recupera bytes, sequência e dependências originais; a outra conta conserva seu trabalho. A fixture corrigida é aplicada uma vez e continua correta após reabrir.
- Uma falha assíncrona no banco da instalação não desfaz o fence de logout nem perde referências às credenciais/capacidade de revogação. Reabertura e retry conservam o estado anterior.

`pnpm typecheck`, `pnpm lint` e os testes locais passaram. O bundle Android de `openExpoRuntime` foi gerado com 753 módulos. Os checks obrigatórios da API (`check bootJar`) também passaram na validação conjunta deste recorte com a recuperação de snapshots.

A documentação oficial de [migrations embarcadas do Expo](https://orm.drizzle.team/docs/connect-expo-sqlite) foi consultada via Context7; o comportamento transacional foi conferido no código instalado e exercitado pelo migrator real de desktop. A geração do bundle não equivale à execução da falha em Android/iPhone.

## Limites

A interface visual de recuperação depende do protótipo. Este núcleo bloqueia a abertura com erro tipado; não implementa exportação, reparo de corrupção física, restauração de backup ou descarte. Não tenta substituir o único arquivo com pendências por dados remotos. Cada migration futura ainda precisa da sua própria fixture de versão anterior; as migrations adicionadas pelos testes existem somente em diretórios descartáveis.
