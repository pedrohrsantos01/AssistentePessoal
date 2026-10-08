# Domínio, DNS e Resend — roteiro manual para Pedro

Data: 08/10/2026. Origem: Q54 da [entrevista](../../.scratch/fundacao/entrevista.md) e [tarefa 02](../../.scratch/aceite-m1/issues/02-preparar-dominio-e-resend.md). Pedro escolherá o nome; ainda não há domínio nem configuração real verificados. Q55=B mantém a rota iOS adiada.

Use este roteiro para escolher/registrar o domínio e preparar envio de e-mail. Os passos de Hostinger se aplicam se esse for o provedor da sua conta mencionada em Q54; a Hostinger da VPS foi confirmada em Q44, mas o plano de e-mail não foi inspecionado. Se a conta estiver em outro provedor, use o painel equivalente.

## 1. Escolher e registrar o domínio

1. Abra sua conta Hostinger e procure **Claim Domain / Reivindicar domínio** no painel inicial ou em **Domains / Domínios → Get a new domain**.
2. Pesquise o nome escolhido. Confira disponibilidade, extensão elegível, valor inicial, renovação e data antes de finalizar.
3. Verifique se sua conta realmente mostra o benefício. A gratuidade pode cobrir apenas o primeiro ano de um plano elegível; possuir e-mail ou VPS não comprova um benefício disponível.
4. Complete os dados do titular diretamente no provedor e a verificação solicitada. Confirme domínio ativo; anote privadamente renovação e recuperação da conta.

Se não houver benefício ou a opção aparecer paga, decida o custo antes de registrar. Este documento não recomenda mudar seu plano para obter gratuidade. [Instruções oficiais e condições atuais](https://www.hostinger.com/support/1583407-how-to-register-a-domain-for-free-at-hostinger/).

## 2. Identificar onde editar DNS

Em **Domínios → gerenciar domínio → DNS / Nameservers**, confira nameservers e registros. Edite a zona do provedor que é autoritativo para o domínio; uma zona inativa não altera a resolução pública. Mantenha o DNS existente se ele atender à configuração; Cloudflare R2 não exige transferir o DNS para Cloudflare. O editor pode permitir preparar registros antes de uma troca de nameservers, mas isso não torna essa zona autoritativa. [Editor DNS Hostinger](https://www.hostinger.com/support/how-to-use-hostingers-dns-zone-editor/).

Antes de editar, preserve os registros que atendem às suas caixas de e-mail. Não troque nameservers nem use reset da zona só para adicionar o Ritmo.

## 3. Separar os nomes antes de apontar a API

Exemplo ilustrativo com domínio reservado; **não é escolha aprovada nem valor a copiar**:

| Função | Exemplo | Ação agora |
|---|---|---|
| Domínio registrado | `seu-dominio.example` | Escolher nome real |
| API e origem de recuperação | `api.seu-dominio.example` | Anotar sugestão; confirmar antes de criar rota |
| Domínio de envio Resend | `notificacoes.seu-dominio.example` | Escolher no Resend e verificar DNS |
| Remetente de serviço | `Ritmo <recuperacao@notificacoes.seu-dominio.example>` | Confirmar endereço autorizado no domínio de envio |

Subdomínio de envio é recomendação de isolamento do e-mail transacional, ainda a confirmar. Recuperação mantém o contrato `https://<origem-confirmada>/password-reset#token=<segredo>`; abrir o link não consome o token. A origem pública deve ser HTTPS, sem caminho, query, fragmento ou barra final. [Contrato local](email-recovery.md).

Não aponte a API para uma hospedagem compartilhada só porque registrou o domínio ali. O destino será o proxy do ambiente Ritmo, após seus gates. Nenhum IP/AAAA/rota foi escolhido neste documento.

## 4. Verificar o domínio de envio no Resend

No Resend, adicione o domínio/subdomínio de envio escolhido. Recomendação: começar apenas com **Sending**; recebimento de e-mail pelo Resend não é necessário à recuperação de senha.

Copie **tipo, nome, valor e prioridade exatos apresentados pelo seu painel** para a zona DNS autoritativa. Verificação de envio envolve SPF e DKIM; se houver registro MX para o subdomínio de retorno do envio, ele não é o MX da caixa postal principal. Não substitua o MX do domínio raiz. Aguarde o status de envio verificado; nenhum valor DKIM/SPF foi inventado aqui. [Passos e registros exatos do Resend](https://resend.com/docs/add-a-domain).

Se já houver SPF no mesmo nome DNS, revise a configuração antes de adicionar outro: o protocolo não permite vários registros SPF nesse nome. [RFC 7208 §3.2](https://www.rfc-editor.org/rfc/rfc7208#section-3.2).

No domínio de recuperação, recomendo manter tracking de abertura/clique desativado; é a orientação do Resend para mensagens transacionais importantes como reset de senha. Se a verificação ficar pendente, confira zona autoritativa, nome final do registro sem duplicar o domínio, tipo/valor/prioridade e o diagnóstico do painel; não gere registros substitutos por tentativa. [Orientação de domínio/subdomínio](https://resend.com/docs/dashboard/domains/introduction).

O Resend envia mensagens; a caixa de e-mail da sua hospedagem continua sendo gerida pelo provedor correspondente. Preserve seus registros de recebimento e envio. Confira também limites de sua conta Resend, sem presumir quota disponível.

## 5. Preparar SMTP no canal privado

Somente depois do domínio verificado e antes de instalar a API, configure os valores no cofre/runtime pelo canal privado. Não envie API key no chat nem a grave no Git.

| Parâmetro | Contrato inicial do Ritmo |
|---|---|
| Host | `smtp.resend.com` |
| Porta | `587` com STARTTLS; validar saída do host escolhido |
| Usuário | `resend` |
| Senha | API key própria do Resend, guardada privadamente |
| Remetente | Endereço de serviço do domínio de envio autorizado |

Resend oferece outras portas; 2587 com STARTTLS pode ser candidata conforme restrições do host. Porta 465 usa TLS implícito e exige configuração compatível; não basta trocar o número no pacote atual. [SMTP Resend](https://resend.com/docs/send-with-smtp), [variáveis e validação do Ritmo](email-recovery.md).

A senha da caixa postal Hostinger não é a credencial SMTP do Resend. Canal alternativo do watchdog operacional permanece uma definição separada em [provisionamento](external-provisioning.md).

## 6. O que devolver para prosseguirmos

Copie esta ficha com os valores **públicos** preenchidos:

```text
Domínio registrado e status:
Provedor do registro:
Provedor de DNS autoritativo:
Domínio/subdomínio de envio Resend:
Status de verificação de envio:
Remetente de serviço proposto:
Hostname proposto para a API:
```

Não envie dados do titular, destinatário pessoal, senha, API key, arquivo de segredos ou link real de recuperação. Nome do domínio e estado de verificação bastam para a próxima rodada.

## 7. O que ainda falta para aceitar a recuperação

Domínio registrado e DNS verificado liberam a confirmação dos parâmetros públicos. Depois serão necessários ambiente HTTPS isolado, segredo SMTP no runtime, associação Android pelo package/certificado e abertura nativa com app encerrado/aberto. A entrega visual aguarda o protótipo.

Envio externo, recebimento da mensagem e reset/reuso/relogin com pendências preservadas serão ensaiados na etapa apropriada, com destinatário privado e autorização explícita para o envio. Rota iOS fica adiada; Universal Links do iPhone continuam obrigatórios para fechar M1. [Plano e tarefas](../../.scratch/aceite-m1/spec.md).

## Checklist manual

- [ ] Nome escolhido; benefício/registro/renovação conferidos.
- [ ] Registro ativo e recuperação da conta acessível.
- [ ] DNS autoritativo identificado; e-mail existente preservado.
- [ ] Domínio de envio verificado no Resend e quota conferida.
- [ ] Ficha pública devolvida; segredos mantidos privados.
- [ ] API/nativo/envio real permanecem com seus gates de aceite.

Nenhum painel, registro, DNS ou credencial foi alterado nesta preparação.
