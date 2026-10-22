# Contratos PWA — rodada3 e plano de execução

21/10/2026. **Decisões Q70–Q74 aprovadas em A; desenho técnico proposto, ainda não implementado.** Fontes canônicas: [spec/14](../../specs/14-pwa-primeiro-marco.md), [ADR-022](../adr/0022-sessao-opaca-e-entrada-por-instalacao-web.md), [entrevista](../../.scratch/pwa-m1/entrevista.md). Complementa as rodadas1/2 e mantém o alcance da prova01.

## 1. Resultado das respostas

| Pergunta | Escolha de Pedro | Consequência |
|---|---|---|
| Q70 | Login explícito em instalação nova | Safari e Tela de Início não restauram automaticamente a mesma sessão a partir de cookies copiados sem controle local |
| Q71 | Sessão opaca no Java/PostgreSQL | Credenciais fora do JS; nativo mantém bearer/SQLite e ciclo atual |
| Q72 | Rascunho somente na aba | Adiar recarga durante edição e confirmar descarte deliberado; sem recuperação prometida após encerramento pelo navegador |
| Q73 | 30 dias de inatividade e90dias absolutos | Uso remoto autenticado renova janela até o limite absoluto. Depois, login online para sincronizar; uso local ainda ativo preservado |
| Q74 | Quatro contextos por instalação | Ativo, preparações e encerramentos pendentes contam. Quinta entrada aguarda recuperação sem descartar intenções |

Os30/90dias são política aprovada do Ritmo; não são valores prescritos pela [OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html#automatic-session-expiration). Não alteram access15min/refresh30dias nativos, reset1h ou retenção da outbox.

## 2. Desenho concreto para a próxima etapa

O [documento de contratos do navegador](../../.scratch/pwa-m1/contratos-navegador.md) detalha transições, pré-condições, limites e matriz de testes. É proposta de engenharia, sem nomes físicos de tabelas/rotas/cookies aprovados por inferência.

- **Sessão:** reservar contexto e comprovar capacidade limitada de encerramento antes da senha; autenticação emite segredo opaco distinto, em cookie próprio do contexto. Seleção pública nunca autoriza por si só. Login/close/reset serializados; respostas tardias não substituem a credencial de outro contexto. Resultado desconhecido é inspecionado, sem replay automático da senha.
- **Recuperação:** limite local não comprova limite físico de cookies. Especificar órfãos/cópias/header máximo e coleta; recuperar capacidade perdida mediante prova da conta original, sem exigir uma quinta sessão. Não apagar journal ou fila para liberar espaço.
- **Abas:** dono e época persistidos, presença por documento e gate curto não roubável; CAS para autoaquisição. Toda transação confere conta/geração, posse e compatibilidade. Pedido já aceito remotamente não é cancelado por fence local; posse remota precisa de barreira própria e idempotência.
- **Armazenamento:** comandos, sequência, intenção e projeção no mesmo commit; beginAttempt atômico, ack/pull com efeitos/cursor corretos e swap revalidando as intenções vigentes em H. Journal só público, sem credenciais ou senha.
- **Atualização:** coordenar conexões/versionchange, código antigo e SW; compatibilidade por build/schema/protocolo. Não recarregar descartando rascunho nem limpar dados para forçar upgrade.

A revisão técnica encontrou um limite na aparência: banco separado não compartilha transação com controle/domínio. Após destruição do documento, uma gravação de aparência já iniciada pode terminar ou abortar enquanto locks são liberados. A proposta relê o valor realmente salvo na retomada, sem anunciar um resultado não observado nem bloquear hábitos por falha visual. Não se promete atomicidade entre os dois bancos. Essa delimitação deriva da leitura dos algoritmos de [Web Locks](https://www.w3.org/TR/web-locks/#termination-of-locks) e [IndexedDB](https://www.w3.org/TR/IndexedDB/#committing), e ainda exige ensaio.

O candidato abandona steal como autoridade de posse; o experimento da prova01 permanece evidência histórica do mecanismo anterior. Nenhuma fonte ou ensaio anterior comprova o novo protocolo.

## 3. Recortes e critérios de avanço

| Recorte interno | Entrega | Estado |
|---|---|---|
| 02a | Especificação executável de transições/erros/representações, limites auxiliares, CSRF/cookies/recuperação e fixtures negativas. Mudança implementada no schema exige spec/00+Flyway no mesmo commit | Proposto para depois da confirmação de entendimento Q75 |
| 02b | Provas locais Java/navegador dos cenários negativos, com ensaio visual quando houver UI e recursos próprios encerrados ao terminar | Depende do contrato exato de02a |
| 02c | HTTPS acessível e testes Safari/Tela de Início no iPhone16e; cookies, offline, atualização, VoiceOver e desempenho | Depende do endereço/ambiente e participação no aparelho |

Ainda exigem trabalho técnico: nomes/atributos/expiração física dos cookies, TTLs de preparação/encerramento, retenção contra replay após expurgo, contabilização/limpeza de órfãos, recuperação sem vaga, schema e migrações, aquisição de posse remota e prova de crash/upgrade. Não são garantias implementadas. Se o detalhamento exigir nova escolha de produto, expor a lacuna com recomendação; não repetir Q61–Q74.

Task02 permanece **needs-info**; task03 continua **bloqueada** por contrato/provas. Q66=iOS26.6.2 é declaração do operador, não teste. Nome/domínio Q54, ambiente HTTPS e ensaio físico continuam pendentes. O plano não contrata, publica ou aceita WEB-01–10/M1/Fase1.

## 4. Verificação deste incremento

Somente documentação e instruções foram alteradas; fontes app/API/web, contratos executáveis e scripts permanecem no baseline92a919b. Sem novo schema, migration, dependência, build web ou serviço iniciado.

- App: `pnpm typecheck`, `pnpm lint`, `pnpm test` aprovados;213 testes de domínio e51 de componentes, seis suítes Jest.
- API: `gradlew.bat check --no-daemon` aprovado com Java21;13 testes operacionais executados, tarefa Java `test` UP-TO-DATE. Não se afirma reexecução integral da suíte Java.
- Estes checks verificam o baseline existente. Não testam sessão/concorrência web ainda propostas. Nenhum navegador ou emulador foi aberto neste incremento.

Conferência local:10 documentos UTF-8 sem caracteres de substituição;78 links relativos existentes; oito respostas A para Q67–Q74 na entrevista, com Q75 ainda pendente. Diff conferido sem erro de whitespace. As decisões aceitas estão na ADR-022; a confirmação Q75 é sobre o entendimento e o plano de próximos recortes.

**Resposta posterior/consolidação em22/10/2026:** Q75=A confirmou iniciar02a, concluído como [contrato executável](../../contracts/pwa-m1/README.md). [Relatório atual](2026-10-22-contrato-executavel-pwa.md). A confirmação deixou de ser pendência; adapters/provas físicas continuam abertos.
