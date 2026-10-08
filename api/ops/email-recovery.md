# Configurar recuperação por e-mail

A implementação usa SMTP pelo JavaMailSender. O ambiente de teste recebe mensagens somente em GreenMail no loopback; ele não encaminha e-mails à internet. Ainda não há domínio/remetente de produção confirmado.

## Variáveis

| Variável | Conteúdo |
|---|---|
| `RITMO_PUBLIC_ORIGIN` | Origem HTTPS da API, sem caminho, query, fragmento ou barra final; exemplo reservado: `https://api.example.test` |
| `RITMO_MAIL_FROM` | Remetente autorizado pelo provedor |
| `RITMO_SMTP_HOST` | Host SMTP do provedor |
| `RITMO_SMTP_PORT` | Porta; padrão 587 |
| `RITMO_SMTP_USER` / `RITMO_SMTP_PASSWORD` | Credenciais no mecanismo de segredos da infraestrutura |
| `RITMO_SMTP_AUTH` | Autenticação SMTP, padrão true |

O padrão exige STARTTLS e valida a identidade do certificado do servidor. Conexão, leitura e escrita têm timeout de cinco segundos. Provedor com TLS implícito na porta 465 exige configuração compatível antes de usar; não basta trocar a porta. Não desabilitar TLS para usar um provedor externo. Testes locais desabilitam TLS/autenticação explicitamente.

Se host, origem HTTPS ou remetente estiverem ausentes, o endpoint de solicitação retorna 503 para qualquer endereço, sem consultar se existe conta. Não há remetente nem domínio público escolhido automaticamente.

## Link e aceite no aparelho

Formato: `https://<host-da-api>/password-reset#token=<base64url>`. O token é colocado no fragmento para não compor a requisição GET nem o cabeçalho Referer. Abrir o link nunca consome o token; só o POST de confirmação altera a senha. O endpoint de confirmação não devolve sessão nem autentica automaticamente. Uma confirmação bem-sucedida invalida também os outros links ainda abertos da conta; uma nova solicitação, sozinha, não invalida links anteriores. Troca da senha, consumo dos links e revogação das sessões são atômicos. Access JWT já emitido permanece limitado à janela original de 15 minutos.

O domínio ainda precisa de TLS válido e associação com o app: Android App Links com package/certificado corretos; iOS Universal Links com os identificadores e entitlement do build. O protótipo continua pendente; esta etapa não cria tela de recuperação nem uma página web substituta.

O teste SMTP local verifica mensagem, link e consumo por HTTP, mas não certifica entregabilidade, DNS, reputação do remetente, abertura nativa ou instalação no iPhone. SPF/DKIM/DMARC seguem a orientação do provedor escolhido. Nunca colocar credenciais, mensagens de recuperação reais ou seus links em logs, capturas ou documentos.

## Operação

A resposta 202 aceita uma solicitação para processamento e é uniforme para contas existentes/inexistentes. A fila de envio é limitada e em memória, com uma thread e até 32 itens em espera. Processo encerrado pode perder solicitações ainda não processadas; o usuário pode solicitar novamente. Não há promessa de entrega durável nem outbox persistindo tokens em claro.

O hash é confirmado no banco antes do SMTP; falha de envio não troca senha nem encerra sessões. Falhas do worker registram somente `password_reset_delivery_failed`, sem destinatário, token ou exceção que exponha payload. Capacidade esgotada retorna 503 independentemente da existência da conta. Rate limiting por cliente/endereço e monitoramento operacional continuam na tarefa 05 antes de exposição externa.

Antes do aceite real: configurar segredos, verificar remetente/DNS, abrir o link no build correto, trocar a senha, recusar reutilização e comprovar que as pendências locais continuam após novo login.

## Preparação manual de domínio — 08/10/2026

Q54 informou domínio ainda a escolher; Pedro pediu [roteiro de registro/DNS/Resend](domain-and-email-setup.md). Origem/remetente e configurações reais continuam pendentes. Q55=B adia rota iOS, mantendo Universal Links/iPhone obrigatórios para M1. [Plano de aceite](../../.scratch/aceite-m1/spec.md). O guia não altera este contrato nem comprova entrega de e-mail.
