# Aceite restante do M1 — consolidação de 08/10/2026

Preparação autorizada na continuação do marco. Referencia a [tarefa 05](../primeiro-marco/issues/05-completar-sessao-e-recuperacao.md) e os contratos atuais; não acrescenta funcionalidades nem substitui a [matriz M1-01 a M1-20](../../specs/13-contrato-primeiro-marco.md#9-cenários-de-aceite-do-contrato).

## Definições e fronteira atual

- Q54: Pedro ainda não tem domínio disponível; escolherá o nome e pediu instruções para configurar pelo provedor. Gratuidade e plano da conta não foram conferidos. [Guia manual](../../api/ops/domain-and-email-setup.md).
- Q55=B: adiar a rota iOS. iPhone 16e continua exigido para aceitar M1; não substituir por desktop ou dispensar Universal Links.
- Q28: protótipo em preparação; integração visual permanece na [tarefa 03 existente](../primeiro-marco/issues/03-integrar-prototipo.md).
- Q47: artefatos locais primeiro, fornecedores/orçamento/contratação depois. Operação externa permanece na [tarefa 04 existente](../recuperacao-operacional/issues/04-validar-operacao-externa.md). Pacote 4B verificado localmente; 4A/4C/4D abertos.

## Árvore de dependências

```text
Fonte atual → reconstruir harness Android → comprovar cenário técnico atual
Escolha/registro do domínio → DNS autoritativo + Resend verificado
  → origem HTTPS/remetente + identidade/certificado Android confirmados
  → recuperação no build próprio Android
Protótipo entregue → tarefa 03 existente → interface/estados/acessibilidade
Retomada explícita da rota iOS → conta/build/identificadores/associação iOS
  → instalação e validação no iPhone 16e
4A definidos → instalação isolada 4C → gates externos 4D (tarefa existente)
Interfaces + builds + operação aceitos → matriz M1 nos aparelhos → fechar M1
```

Nome do domínio, subdomínios, remetente, identificadores finais e fingerprints não estão escolhidos. Perguntas dependentes ficam para a rodada seguinte, após configuração manual. Rota iOS adiada por decisão expressa; não solicitar compra agora. Implementação nova resultante da entrevista exige entendimento consolidado confirmado; renovar a prova Android já autorizada pode avançar independentemente.

## Tarefas delimitadas

| Tarefa | Entrega | Triagem |
|---|---|---|
| [01 — Renovar evidência Android](issues/01-renovar-evidencia-android.md) | Reconstruir fontes atuais e executar cenário nativo existente + checks integrais (concluído localmente) | ready-for-agent |
| [02 — Preparar domínio/DNS/Resend](issues/02-preparar-dominio-e-resend.md) | Configuração manual por Pedro e retorno de parâmetros públicos | ready-for-human |
| [03 — Recuperação nativa Android](issues/03-integrar-recuperacao-nativa-android.md) | Link recebido pelo SO, reset e preservação local no build próprio | needs-info |
| [04 — Aceitar M1 nos aparelhos](issues/04-aceitar-m1-nos-aparelhos.md) | Evidência final da matriz e convergência iPhone/Android | needs-info |

Desenvolvimento visual e instalação operacional não recebem tarefas duplicadas aqui. Não iniciar Agenda, tipos adicionais de hábitos ou gamificação ampliada para contornar gates do M1.

## Critério de encerramento

Cada prova registra commit/build, ambiente, interfaces exercitadas, resultado e limites. O caso Android atual cobre o caminho técnico da tarefa 01; não comprova todos os estados excepcionais em SQLite/SecureStore nativos. Aceite final precisa de interface aprovada, aparelhos previstos e critérios operacionais existentes. Compilar APK, verificar DNS, receber SMTP local ou ter scripts operacionais não encerram esses gates.

## Resultado

Concluída: não — consolidação preparada; M1 permanece aberto. [Análise/evidência atual](../../docs/analises/2026-10-08-plano-de-aceite-m1.md).


08/10/2026 — Continuação autorizada antes do domínio: [aceite técnico de exceções e isolamento Android](../aceite-android-excecoes/spec.md) concluído. Cinco casos novos aprovados com os adapters nativos, falhas externas controladas e reinício; cenário original e checks integrais reexecutados (app 121, API 87 Java/zero ignorados, 13 operacionais). [Relatório e limites](../../docs/analises/2026-10-08-excecoes-e-isolamento-android.md). Estas provas não encerram as tarefas 02–04 nem o M1.
