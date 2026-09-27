# Sessão e isolamento — incremento da tarefa 05

Data: 26/09/2026. Recorte: REQ-CTA-004/004b/004c, ADR-016 e caminho de sessão de M1-10. Continuação da [primeira fatia executável](2026-09-26-primeiro-recorte-executavel.md), sem interface visual.

## Ajuste aprovado

A revisão encontrou uma inconsistência: refresh prometia devolver o segredo de revogação, embora o servidor guardasse somente seu hash. Pedro aprovou uma resposta própria, `RefreshResponse`, sem `revokeToken`. O aparelho conserva a capacidade original da família durante as rotações; perder a resposta não elimina a capacidade de revogar.

Gerador, OpenAPI, fixture e validadores foram atualizados juntos: 51 schemas, 11 endpoints e 48 exemplos aprovados, além de 8 verificações SQLite e 11 fixtures de domínio. Refinamento explícito da baseline m1.1 antes de implementar/publicar refresh, sem cliente publicado para migrar.

## Implementação

Identity implementa refresh de uso único e revoke idempotente, serializando as duas ações pelo lock da família numa transação. Duas renovações simultâneas do mesmo token geram um sucessor e um 401. Cada refresh novo vale 30 dias e estende a família. Reutilizar um token consumido é recusado sem invalidar seu sucessor legítimo. Revoke não autentica nem lê dados; bloqueia renovação imediatamente. Access stateless já emitido continua limitado aos 15 minutos originais. Tokens aleatórios ficam no Postgres somente como hashes.

O app usa `Session`, transporte HTTP de Identity, SecureStore 57.0.4 e IDs nativos via Crypto 57.0.3. Cada consulta/escrita no repositório verifica a geração que abriu a conta. Sincronização captura a sessão e tenta renovar no máximo uma vez após 401.

A migration Drizzle de `installation.db` é independente dos bancos por conta e guarda apenas IDs, estado e referências opacas, conforme spec/00 §12.7. O registro de referências precede escritas protegidas, permitindo limpar operações interrompidas. Não houve alteração do schema Postgres nem reset dos bancos existentes.

Logout grava `logging_out` e incrementa a geração antes de esperar pelo cofre, fecha a conta e remove access/refresh. A capacidade de revogação já está protegida separadamente. Falha de limpeza mantém o bloqueio; `restore` retoma a remoção. Falha ao gravar o fence SQLite não é anunciada como logout concluído.

A renovação tem uma única requisição em voo. Antes do envio, o ponteiro antigo é desanexado duravelmente; o novo conjunto é salvo em outra chave antes de ativá-la. Resultado ambíguo ou falha de gravação exige login online para retomar rede, preservando uso local quando não houve logout. Recuperação confere schema, conta e sessão das credenciais antes de utilizá-las.

Login na mesma conta recupera pendências. Outra conta exige logout; referências antigas e respostas atrasadas ficam bloqueadas. `flushRevocations` envia capacidades pendentes sem tocar na família ativa. Uma instância de `Session` deve ser dona do controle por processo. A proteção é de acesso pela aplicação, sem promessa de criptografia integral do SQLite ou biometria.

## Verificações

`pnpm typecheck`, `pnpm lint` e `pnpm test` aprovados: 13 testes locais. O incremento cobre:

1. A → logout offline → B → reentrada online em A, preservando intenção.
2. Falha de remoção no SecureStore e reinício durante logout.
3. Resposta de refresh perdida sem reutilizar token antigo.
4. Credenciais de outra conta recusadas na recuperação.
5. Refresh/pull atrasados de A após autenticar B.
6. Retomada da fila de revogação, preservando a família ativa.
7. Falha ao salvar a credencial rotacionada.
8. Logout enquanto uma escrita protegida já estava em andamento.

As fronteiras de teste são HTTP real, repositórios SQLite e coordenador público de sessão. Cofre e transporte são substituídos somente nos testes locais de falha. Integração de desktop usa Spring e PostgreSQL descartável de verdade, com dois cenários TypeScript: reconciliação de domínio e ciclo de sessão com troca de conta/refresh/sync.

`api/gradlew.bat -p api check bootJar --no-daemon` aprovado em 26/09/2026 às 22:59 (America/Sao_Paulo): 13 testes Java, nenhum erro/falha, incluindo Modulith e ambos os cenários integrados TypeScript. JAR atualizado gerado. A conferência final detectou os claims `plan`/`tz` ausentes no JWT; um teste HTTP demonstrou a falha, a implementação foi corrigida e o teste passou, incluindo a validade exata de 900 segundos.

## Android

Build x86_64 aprovado com SecureStore e Crypto: APK técnico de 28.756.628 bytes; SHA-256 `0231be257af0c579f1dcfff28867282f0b13973bbf72f9689b147c4a52d95fb9`. Persistem avisos de depreciação do ecossistema Gradle/Expo já registrados anteriormente.

O harness usa SQLite e SecureStore reais, com credenciais fictícias que não autenticam em servidor algum. Primeira execução aprovada no Pixel 9/Android 15: logout, troca A/B, retorno a A, duas pendências e 10 XP provisórios. A segunda execução após `am force-stop` também foi aprovada: `restarting=true`, `secureStore=true`, duas pendências e 10 XP provisórios. A reabertura foi observada em 26/09/2026 às 22:59 (America/Sao_Paulo). Logs técnicos ficam em `.scratch/runtime/session-android-*.log`, sem tokens.

## Continuação

A tarefa 05 e o M1 continuam abertos. Este incremento entrega o núcleo de sessão; ainda faltam:

- Recuperação por e-mail: endpoints de reset, envio e teste de token único/expiração/revogação de sessões; host HTTPS, SMTP e associação de links para aceite real.
- Scheduler/backoff, acionamento automático de revogações ao reconectar, recuperação de rejeições, novos IDs e ciclos/limites de dependências.
- Restante da matriz de paginação/snapshot/migration, expiração temporal das famílias e refresh, rate limiting, retenção, roles/segredos reais, backup/restore e deploy.
- HTTP nativo no Android e convergência com iPhone 16e. O teste HTTP de desktop não os substitui.
- Interface aprovada: Q28 segue aberta, aguardando o protótipo de Pedro.

Próximo recorte: recuperação de senha e transporte de e-mail. Segredos devem entrar no mecanismo apropriado da infraestrutura, nunca em valores no chat. Pedro informou não ter Apple Developer ativo; alternativa com Mac ainda não confirmada.

Nenhuma publicação, mudança na VPS, compra, commit ou push. O diretório permanece sem Git inicializado. Revisão de quatro semanas mantida em 23/10/2026.

O emulador iniciado para a verificação foi encerrado após coletar os dois resultados. Verificação documental: 43 arquivos Markdown, nenhum link local ausente nem indício de codificação corrompida. Nenhum bloqueio de permissão ficou pendente.
