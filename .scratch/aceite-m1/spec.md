# Aceite restante do M1 — revisão de 21/10/2026

Q65 revisa a consolidação de 08/10: PWA no iPhone16e (Safari/Tela de Início) + app Android podem encerrar o M1 funcional. Provas nativas iOS ficam na entrega posterior05. Planejamento em [spec/14](../../specs/14-pwa-primeiro-marco.md); implementação web não iniciada.

Preparação autorizada na continuação do marco. Referencia a [tarefa 05](../primeiro-marco/issues/05-completar-sessao-e-recuperacao.md) e os contratos atuais; não acrescenta funcionalidades nem substitui a [matriz M1-01 a M1-20](../../specs/13-contrato-primeiro-marco.md#9-cenários-de-aceite-do-contrato).

## Definições e fronteira atual

- Q54: Pedro ainda não tem domínio disponível; escolherá o nome e pediu instruções para configurar pelo provedor. Gratuidade e plano da conta não foram conferidos. [Guia manual](../../api/ops/domain-and-email-setup.md).
- Q55=B continua adiando a distribuição nativa iOS. Q65 agora permite usar PWA no iPhone16e para aceitar M1 com Android; Universal Links/build nativo iOS ficam na tarefa05 posterior. Desktop não substitui prova no iPhone.
- Q28: protótipo recebido em 09/10/2026 e direção consolidada em spec/11; integração visual permanece na [tarefa 03 existente](../primeiro-marco/issues/03-integrar-prototipo.md), decomposta nos recortes de interface M1.
- Q47: artefatos locais primeiro, fornecedores/orçamento/contratação depois. Operação externa permanece na [tarefa 04 existente](../recuperacao-operacional/issues/04-validar-operacao-externa.md). Pacote 4B verificado localmente; 4A/4C/4D abertos.

## Árvore de dependências

```text
Fonte atual → reconstruir harness Android → comprovar cenário técnico atual
Escolha/registro do domínio → DNS autoritativo + Resend verificado
  → origem HTTPS/remetente + identidade/certificado Android confirmados
  → recuperação no build próprio Android
Protótipo entregue → tarefa 03 existente → interface/estados/acessibilidade
Trilha PWA → contratos/implementação → Safari + Tela de Início no iPhone16e
4A definidos → instalação isolada 4C → gates externos 4D (tarefa existente)
PWA iPhone + app Android + operação aceitos → matriz M1 → fechar M1 funcional
Entrega posterior05 → retomada da rota iOS → build/associação/validação nativa
```

Nome do domínio, subdomínios, remetente, identificadores finais e fingerprints não estão escolhidos. Perguntas dependentes ficam para a rodada seguinte, após configuração manual. Rota iOS adiada por decisão expressa; não solicitar compra agora. Implementação nova resultante da entrevista exige entendimento consolidado confirmado; renovar a prova Android já autorizada pode avançar independentemente.

## Tarefas delimitadas

| Tarefa | Entrega | Triagem |
|---|---|---|
| [01 — Renovar evidência Android](issues/01-renovar-evidencia-android.md) | Reconstruir fontes atuais e executar cenário nativo existente + checks integrais (concluído localmente) | ready-for-agent |
| [02 — Preparar domínio/DNS/Resend](issues/02-preparar-dominio-e-resend.md) | Configuração manual por Pedro e retorno de parâmetros públicos | ready-for-human |
| [03 — Recuperação nativa Android](issues/03-integrar-recuperacao-nativa-android.md) | Link recebido pelo SO, reset e preservação local no build próprio | needs-info |
| [04 — Aceitar M1 nos aparelhos](issues/04-aceitar-m1-nos-aparelhos.md) | Matriz e convergência PWA no iPhone + app Android (Q65) | needs-info |
| [05 — Validar iOS nativo depois](issues/05-validar-ios-nativo.md) | Instalação/Universal Links/validação iOS, sem bloquear este M1 | needs-info |

Desenvolvimento visual e instalação operacional não recebem tarefas duplicadas aqui. Não iniciar Agenda, tipos adicionais de hábitos ou gamificação ampliada para contornar gates do M1.

## Critério de encerramento

Cada prova registra commit/build, ambiente, interfaces exercitadas, resultado e limites. O caso Android atual cobre o caminho técnico da tarefa 01; não comprova todos os estados excepcionais em SQLite/SecureStore nativos. Aceite final precisa de interface aprovada, aparelhos previstos e critérios operacionais existentes. Compilar APK, verificar DNS, receber SMTP local ou ter scripts operacionais não encerram esses gates.

## Resultado

Concluída: não — consolidação preparada; M1 permanece aberto. [Análise/evidência atual](../../docs/analises/2026-10-08-plano-de-aceite-m1.md).


08/10/2026 — Continuação autorizada antes do domínio: [aceite técnico de exceções e isolamento Android](../aceite-android-excecoes/spec.md) concluído. Cinco casos novos aprovados com os adapters nativos, falhas externas controladas e reinício; cenário original e checks integrais reexecutados (app 121, API 87 Java/zero ignorados, 13 operacionais). [Relatório e limites](../../docs/analises/2026-10-08-excecoes-e-isolamento-android.md). Estas provas não encerram as tarefas 02–04 nem o M1.

21/10/2026 — Q61–Q65 registradas em spec/14. M1 continua aberto: PWA ainda não implementada, provas Android/visuais pertinentes e gates externos ainda necessários. Aceite funcional pode usar PWA iPhone+Android; não exigir a rota nativa iOS para esse encerramento. Os resultados de 08/10 acima preservam seu escopo histórico.
