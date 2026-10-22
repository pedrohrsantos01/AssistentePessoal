# PWA — contrato executável02a

22/10/2026. **Recorte02a concluído como especificação verificável; produto web ainda não implementado/aceito.** Pedro confirmou Q75=A e autorizou iniciar o detalhamento. Referências: [contrato](../../contracts/pwa-m1/README.md), [modelo](../../specs/00-modelo-de-dados.md#representação-web-especificada-em02a--22102026), [tarefa08](../../.scratch/pwa-m1/issues/08-especificar-contrato-executavel.md), [spec/14](../../specs/14-pwa-primeiro-marco.md).

## Resultado

Contrato consolidado em17 rotas POST propostas e65 schemas de transporte, com tipos de domínio m1.1 copiados sem alteração;10 tipos de registros locais. Especificados estados/permissões/erros, prazos30/90dias e auxiliares, cookies exclusivos pelo Path de contexto, CSRF por origem/header/JSON, recuperação sem quinta sessão, posse monotônica local/remota e commits assíncronos de domínio/snapshot.

Q61–Q74 foram preservadas.02a concretiza decisões de engenharia sob Q75, sem atribuir a Pedro a escolha individual de nomes/headers/tabelas. O spec/00 registra campos/índices e privacidade; não há DDL ou migration aplicada. Nenhum endpoint foi habilitado ou consumidor de produto gerado a partir deste pacote.

Challenge grava reserva vazia antes da resposta, para que uma interrupção entre marcar envio e fazer fetch tenha um registro consultável. Prepare não cria contexto desconhecido. Cancelamento antes do despacho ou prova terminal de nunca autenticado podem liberar a preparação sem liberar/descartar intenção de domínio.

Limpeza conserva o registro mínimo de contextos após expirar seus hashes: uma instalação que volta meses depois ainda pode provar encerramento/recuperar com a conta original. Apagar todo o registro e tratar404 como encerramento deixaria ambiguidade ou vagas irrecuperáveis. Cookie Path reduz envio cruzado/headers; não substitui CSRF nem garante quota/durabilidade do navegador.

Posse remota exige época crescente e autorização no mesmo commit/conexão do domínio; um filtro HTTP isolado não cumpre a garantia. Commit no banco visual continua independente do principal: uma transação já iniciada pode concluir após crash, e retomada deve reler o resultado. Nenhum novo requisito de atomicidade entre bancos foi prometido.

## Evidência executada

- `build_contract.py` gerou OpenAPI/JSON Schema/política; validação de OpenAPI3.1.1 e schemas passou. Regeneração determinística: hashes dos três artefatos idênticos.
- 50 exemplos:27 positivos e23 negativos, incluindo vazamento de credenciais, perfil de outra conta, seleção inválida, sequência divergente e overflow de época.
- 61 cenários do oráculo: limites30/90dias, replay/close anterior ao login, capacidade antes da senha, CSRF, dono/conta divergentes, claim remoto monotônico, quatro contextos/recuperação, logout/ativação tardia e snapshot incompleto.
- App: typecheck, lint,213 testes de domínio e51 componentes aprovados. API: `check --no-daemon` passou;13 testes operacionais executados e tarefa Java `test` UP-TO-DATE.

Conferência documental:14 arquivos Markdown,115 links relativos existentes e UTF-8 sem caracteres de substituição; diff sem erro de whitespace.

Os exemplos/cenários validam **o documento e o oráculo**, não os adapters reais. HTTP/cookie jar, SQL/grants/RLS, Web Locks/IDB e Safari não foram exercitados neste incremento. App/API/web/contrato nativo/migrations permanecem no baselineb5ac917; só o pacote de desenho e a documentação mudaram. Nenhum navegador/emulador/servidor foi iniciado.

## Próximo recorte

[Tarefa09](../../.scratch/pwa-m1/issues/09-provar-sessao-web-e-cookies.md): prova de sessão/cookies e autorização transacional no Java com dados sintéticos e navegador visível; está ready-for-agent. [Tarefa10](../../.scratch/pwa-m1/issues/10-provar-coordenacao-e-commits-web.md): coordenação/commits/upgrade, dependente dessa prova. Juntas concretizam02b.

02c mantém HTTPS e Safari/Tela de Início no iPhone16e; nome/domínio Q54 e ambiente seguem externos. Task02 continua needs-info até provas/gates; task03 permanece bloqueada. M1/Fase1 não foram encerrados e não houve publicação/contratação. Não há nova pergunta de aprovação para iniciar a próxima prova já autorizada pelo plano.
