# Recuperação de senha — incremento da tarefa 05

Data: 27/09/2026. Recorte: REQ-CTA-003, preservação local de REQ-CTA-004c e contrato M1 de Identity. Continuação do [incremento de sessão](2026-09-26-sessao-e-isolamento.md), sem interface visual. A tarefa 05 e o M1 continuam abertos.

## Decisões e comportamento

Pedro autorizou continuar após as recomendações apresentadas: validar envio em SMTP local enquanto domínio/provedor não forem definidos e invalidar os demais links após uma troca concluída. Não foi fornecido domínio, remetente ou segredo externo.

Solicitar recuperação retorna 202 sem corpo tanto para endereço cadastrado quanto desconhecido. O endereço recebe trim externo e lowercase independente de locale, preservando pontos e sufixos `+`. Consulta da conta e envio acontecem fora do caminho da resposta HTTP. Ausência de configuração ou fila cheia retorna 503 uniformemente.

Cada link contém 32 bytes aleatórios codificados em Base64URL. O servidor persiste somente SHA-256 e expiração de uma hora; não guarda o token em claro. O link tem formato `https://<host-da-api>/password-reset#token=<token>`: o fragmento não é enviado ao servidor pelo GET. Só o POST de confirmação consome o token; ele não cria sessão.

Uma confirmação válida troca a senha, invalida os outros links abertos da mesma conta e revoga suas famílias/refresh tokens na mesma transação. Solicitar um novo link, por si só, não invalida os anteriores; uma solicitação processada depois da troca pode emitir outro link. O lock da conta serializa emissão, confirmação e login; duas confirmações simultâneas do mesmo token produzem um sucesso e um 401. Login com a senha anterior não pode terminar criando uma família depois da revogação.

A senha aceita 8–128 pontos de código Unicode, sem trim nem normalização; surrogates isolados são recusados antes do Argon2. Falha na transação preserva senha, links e sessões anteriores. Access JWT já emitido mantém a janela original máxima de 15 minutos, conforme contrato stateless; renovação fica bloqueada imediatamente.

O app expõe solicitação/confirmação em `HttpIdentity` e valida origem HTTPS/caminho/fragmento em `resetTokenFromLink`. Token do link não é salvo em SQLite nem SecureStore. O parser não instala associação de domínio nem uma rota visual no sistema operacional. Após refresh recusado, `Session` mantém a base e permite novo login na mesma conta para sincronizar.

## Lacunas corrigidas durante os testes

- O validador de e-mail consultava uma lista embutida de TLDs e recusava o endereço reservado `example.test` dos contratos. A validação de formato passou a verificar sintaxe ASCII, sem consulta DNS ou lista de provedores.
- O schema era verificado antes do trim do e-mail. O endpoint de solicitação passou a normalizar o campo antes de validar o objeto, mantendo rejeição de campos e tipos inválidos.
- Inicialmente apenas o link apresentado era consumido. O teste demonstrou que outro link continuava aceito; a transação agora invalida todos os links anteriores da conta.
- Unicode malformado chegava ao hash da nova senha e acabava apresentado como erro de sessão. A validação explícita agora devolve 400 e preserva o link.
- O transporte do app passou a aceitar as respostas vazias 202/204 e a confirmar a nova senha pelo contrato existente.

Não houve alteração do schema físico nem migration nova: a tabela de resets já existia na V1. Dependências SMTP e de teste estão fixadas no lockfile. Os arquivos do app usados pela integração passaram a ser inputs da tarefa Gradle de testes, para que uma mudança TypeScript não reutilize resultado Java antigo.

## Evidências

As fronteiras são HTTP real, SMTP local descartável e interfaces públicas do app com SQLite real. Relógio, falha SMTP e falha de escrita no banco são controlados nos testes. O cofre do cenário integrado é um adapter de teste; esta etapa não substitui a validação de SecureStore nativo feita no incremento anterior.

Cenários de recuperação em `RuntimeTests`:

1. Mensagem recebida em GreenMail com destinatário e link corretos, sem trocar a senha na solicitação.
2. Uso único, troca exata da senha com espaços e revogação das sessões apenas da conta alvo.
3. Link válido aos 3.599 segundos e inválido aos 3.600.
4. Resposta uniforme e normalização preservando pontos/`+`.
5. Invalidação dos demais links, sem invalidá-los por mera nova solicitação.
6. Confirmações simultâneas com apenas um sucesso.
7. Falha de gravação durante revogação: rollback integral e nova tentativa com o mesmo link.
8. SMTP local recusando entrega: resposta uniforme, senha/sessão utilizáveis e recuperação por nova solicitação.
9. E-mail → parser do app → confirmação HTTP → refresh recusado → reinício → login com nova senha → sincronização da pendência preservada.
10. Senhas inválidas sem consumir link, limite Unicode e token desconhecido.

Os testes observaram as falhas antes das correções de formato de e-mail, normalização, outros links, transporte de confirmação e Unicode. Os casos adicionais de concorrência/rollback/SMTP confirmaram as garantias da implementação transacional.

Verificação final aprovada em 27/09/2026 às 04:20 (America/Sao_Paulo):

- App: `pnpm typecheck`, `pnpm lint` e `pnpm test`; 15 testes locais aprovados.
- API: `api/gradlew.bat -p api check bootJar --no-daemon`; 23 testes Java aprovados (22 de runtime e um de fronteiras Modulith), sem falhas ou testes ignorados. Incluem três cenários TypeScript integrados com HTTP/Postgres/SQLite reais. JAR atualizado gerado.
- Contratos: 51 schemas, 11 endpoints, 48 exemplos, oito verificações SQLite, 11 fixtures de domínio e 25 instruções PostgreSQL parseadas. A forma HTTP do contrato não mudou neste incremento.
- Documentação: 47 arquivos Markdown conferidos; nenhum link local ausente nem indício de corrupção de codificação.

Logs técnicos em `.scratch/runtime/reset-*.log`, relatórios em `api/build/reports/tests/test/index.html` e resultados dos clientes em `api/build/mobile-integration.log`/`mobile-recovery.log`. Permanecem os avisos de biblioteca já conhecidos (ByteBuddy e keyword `components`); a simulação de SMTP registra o aviso constante esperado. Nenhum novo warning de compilação foi observado.

## Operação e próximos passos

Configuração concreta: [guia de e-mail](../../api/ops/email-recovery.md). O envio usa uma fila em memória limitada a uma thread e 32 itens aguardando; reinício pode perder solicitações ainda não processadas. O usuário pode solicitar outro link. Não há entrega durável nem retry automático de SMTP. Falhas do worker registram somente código constante, sem e-mail, senha, token ou payload de exceção.

Ainda faltam domínio HTTPS, remetente/provedor SMTP, segredos e entregabilidade real; associações Android App Links/iOS Universal Links, tela conforme protótipo e abertura do link nos aparelhos. Nenhum e-mail externo foi enviado. Não houve novo build nativo neste incremento; o parser foi exercitado no runtime de testes.

A tarefa 05 mantém rate limiting antes de exposição externa, scheduler/backoff/reconexão, recuperação de rejeições, paginação/snapshots/migrations restantes, provisionamento/retenção/backup/restore/deploy e teste HTTP nativo Android/iPhone. O próximo recorte proposto é scheduler de sincronização com backoff e retomada de revogações ao reconectar, preservando as mesmas garantias de sessão.

Q28 continua aberta. Pedro usa iPhone 16e e não tem Apple Developer ativo; a rota alternativa com Mac não foi confirmada. A revisão de quatro semanas permanece em 23/10/2026.

Nenhuma publicação, mudança de VPS, compra, commit ou push. O diretório continua sem Git inicializado.
