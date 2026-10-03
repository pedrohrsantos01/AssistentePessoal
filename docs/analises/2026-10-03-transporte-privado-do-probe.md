# Transporte privado do probe e vigilância recíproca — 03/10/2026

Recorte local autorizado por Pedro na tarefa 04/4B de [recuperação operacional](../../.scratch/recuperacao-operacional/spec.md), sob REQ-NFR-004. [Contrato e runbook](../../api/ops/probe-transport.md). Não encerra 4B, a tarefa 04, REQ-NFR-004 externo ou M1.

## Resultado

Transporte OpenSSH implementado com endereço privado fixo, chave exclusiva, pin de host conferido previamente, conta restrita, ForceCommand e sudo com argumentos exatos. Wrappers fetch-probe/fetch-detector não aceitam comando arbitrário. Exportador privilegiado publica somente metadados filtrados e versionados, sem campos internos dos eventos/catálogo. JSON limitado a 256 KiB, cliente até 10 s, worker até 8 s; subprocessos pertencem ao grupo da coleta para encerramento pelo prazo externo.

Detector C integra a coleta privada de B e exige agenda/watchdog. Watchdog nativo em B consulta saúde de C (host, agenda, execução, ciclo, SMTP e disco) e usa configuração SMTP separada, com canal alternativo independente a escolher/prover no ensaio externo. Reutiliza duas coletas/falha imediata, estado/fsync, dedupe e transições existentes. Sucesso posterior não apaga falha nativa latente. SMTP STARTTLS/certificado/auth/NOOP não comprova recebimento; envio recusado permanece pendente.

## Provas

TDD começou com falha por ausência do módulo de transporte; consulta autorizada passou pela cadeia SSH/sudo reais. Nova regra de watchdog falhou antes da implementação e depois passou. A prova de deadline encontrou um cliente SSH órfão; a correção de herança de grupo passou no mesmo cenário.

[Fixture Linux descartável](../../api/src/test/java/dev/ritmo/ProbeTransportTests.java), systemd como PID 1/cgroup privado, OpenSSH/sudo reais e dois SMTP loopback com TLS e autenticação. Nove cenários:
- Metadados restritos de C, sem credenciais e com agenda real.
- Detector SSH parado, alerta recebido pelo canal alternativo.
- Deadline externo encerra também cliente SSH aninhado.
- Receiver parado/primário inacessível, catálogo/eventos filtrados e agenda watchdog exigida.
- Falha do SMTP principal: abertura, dedupe após reabrir estado, recusa e nova tentativa de resolução pelo alternativo; unit watchdog real.
- Shell, PTY, forwarding e argumentos extras/generic Python em sudo recusados.
- SMTP recusa certificado não confiável, credencial incorreta e ausência de STARTTLS.
- Timeout, saída excessiva, JSON inválido e campo extra recusados.
- Chave não autorizada, pin divergente, papel trocado, IP público, limites inválidos, arquivo público ou symlink recusados.

A fixture de receptor não finge replicação saudável: PG está inacessível e receiver nativo parado. As provas PG/TLS/WAL saudáveis dos recortes anteriores integram o check completo. Relógio é controlado no teste de regras de 60 s; fixture de protocolo acelera intervalo para 1 s. Não mede desempenho/entrega/independência de VPS reais.

Ubuntu 24.04 local: [verificador sem instalação](../../api/src/test/fixtures/transport/verify_ubuntu.py) validou quatro units (monitor/watchdog), sudoers e opções do cliente SSH com systemd 255.4-1ubuntu8.16. sshd não está instalado no WSL; configuração/server reais foram comprovados na fixture Debian, e precisam de validação efetiva no destino Ubuntu.

## Checks finais

- App: typecheck e lint aprovados; 94/94 testes aprovados.
- API: gradlew check --no-daemon aprovado em 13m27s; 65 testes Java, 64 aprovados e 1 Android opt-in ignorado; zero falhas/erros. ModularityTests e provas PostgreSQL/WAL/recuperação aprovadas.
- Operações: 10/10 testes de regras; nova fixture executou 9/9 cenários Linux com SSH/sudo/SMTP reais. Agenda anterior passou com seus 5 cenários e reinício de PID 1.
- Sintaxe Ubuntu: quatro units, sudoers e opções SSH aprovados, sem instalação.
- Documentação/encoding: 36 arquivos UTF-8 e 136 links locais verificados; configurações de exemplo são JSON válido.

Logs de teste locais ignorados pelo Git: api/build/transport-result.log, api/build/transport-image.log, api/build/test-results/test e api/build/reports/tests/test. Credenciais constantes são exclusivas de serviços descartáveis.

## Pendências e próximo recorte

Próximo incremento local recomendado: proxy/TLS e origem confiável do cliente, preservando rate limiting e quarentena. Telemetria de disco/slot do primário ainda exige implementação. Custos/fornecedores/rede privada, recursos B/C reais, canais SMTP/cofre/custódia e entrega, instalação/reboot, janela PITR integral/ensaio mensal-major, RTO <=24h e latência/capacidade continuam gates 4C/4D. Protótipo/UI/aparelhos/distribuição iOS seguem nos gates do M1.

Nenhuma VPS foi contratada, acessada ou alterada; não houve envio externo, upload R2, criação de chave real, configuração de Coolify, firewall ou DNS. O Resend existente permanece candidato principal; nenhum provedor alternativo foi selecionado por inferência.

Fontes primárias usadas: [OpenSSH servidor](https://man.openbsd.org/sshd_config.5), [restrições de chave](https://man.openbsd.org/sshd.8), [cliente/pinning](https://man.openbsd.org/ssh_config.5), [sudoers](https://github.com/sudo-project/sudo/blob/main/docs/sudoers.man.in), [Python SMTP/TLS](https://docs.python.org/3.11/library/smtplib.html), [SSL](https://docs.python.org/3.11/library/ssl.html), [subprocess](https://docs.python.org/3.11/library/subprocess.html). Provas locais verificam o pacote; referências não aceitam o ambiente externo.
