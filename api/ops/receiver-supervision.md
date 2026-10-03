# Supervisão nativa do receptor WAL — contrato do recorte 4B

Status: engenharia local autorizada em 03/10/2026; aceite externo pendente. Origem: REQ-NFR-004, ADR-019 e [plano confirmado](../../.scratch/recuperacao-operacional/spec.md).

O receptor contínuo roda como `ritmo-wal-receiver.service` no systemd do Server B. Não é um resource Compose do Coolify. O painel pode gerenciar outros recursos desse servidor; sua parada, perda ou redeploy não controla este serviço. Requer Linux com systemd, cgroup v2, Python >=3.12 e ferramentas PostgreSQL 18. Não instalar/ativar nada remotamente neste recorte.

## Ciclo de vida e segurança do congelamento

- `receiver.py run` é exclusivamente o ExecStart da unidade, sob `ritmo-receiver`. Mantém a trava no supervisor Python e no filho PG18 real. Executa o binário PG18 aprovado com `--no-password --synchronous --slot=ritmo_wal --status-interval=1 --directory=ROOT/wal`. Preserva os arquivos `.partial`, WAL e `.history` e o slot existente. Credenciais de replicação separadas; TLS `verify-full`; passfile privado, nunca senha em argumentos ou logs.
- `state` exige root e responde `running` ou `stopped` somente após consultar o systemd e conferir identidade/argumentos/UID/cgroup do processo real, ausência de outros escritores e a trava de escrita. A identidade do diretório usa device/inode através de /proc/PID/root ou cwd do escritor, sem depender da grafia do caminho. Unidade ausente, estado transitório, processo divergente ou inspeção inconclusiva falham. Um processo vivo não comprova flush: o probe também exige feedback síncrono/slot no PostgreSQL.
- `inhibit` grava e fsynca um marcador persistente root-owned antes de pedir Stop. Só conclui depois de conferir a unidade parada e ausência de escritores. Falha conserva o marcador. Não remove WAL/partial/history, slot ou catálogo.
- O marcador sobrevive a reboot e bloqueia ExecStart, inclusive um `systemctl start` explícito. A unidade usa `Restart=on-failure` para crash; saída fatal 1 do pg_receivewal e saída 78 do guard não entram em loop automático. Erro fatal de armazenamento/configuração exige intervenção. O guard lê diagnósticos PG18 em locale C com linhas limitadas, sem publicar o texto bruto. Reconhece positivamente erros de transporte (recepção/envio/conexão); mantém a reconexão nativa e tenta novamente em 5 s se a conexão inicial falhar por transporte. Erro desconhecido, de armazenamento, credencial, TLS ou protocolo termina com 1 e exige intervenção; crash do filho termina com 75 e usa Restart. A identidade verificada inclui o supervisor Python, exatamente um filho PG18 e ambos no mesmo cgroup. Não reduzir o sincronismo.
- `operations.py freeze` em execução nativa exige `--receiver-config` e quarentena. Mantém uma trava de administração e uma trava de escrita exclusivas durante **toda** a cópia/verificação/publicação do inventário; exige marcador persistente e parada comprovada. `resume` concorrente falha. Um Start direto não atravessa o marcador/trava. Erro ou encerramento abrupto libera a trava pelo kernel, mas conserva a inibição. A trava preexistente `.lock` do catálogo continua exigindo inspeção manual se o job morrer.
- `resume` é a única retomada administrativa: exige parada comprovada e trava livre, remove o marcador com fsync, inicia o serviço e verifica o processo real. Se a partida falhar, repõe a inibição e pede Stop. Não há retomada automática ao terminar um freeze. Verificar destino/identidade/cadeia e fechar a recuperação antes de retomar.

Arquivos de controle são persistentes e pertencem a root; o usuário do serviço pode ler/adquirir a trava, mas não substituir arquivos ou remover a inibição. O kernel `flock` é a exclusão; a mera presença de arquivo não comprova processo ou trava. Root malicioso ou alteração manual de unidade/guard/locks é fora dessa garantia: mudanças de instalação exigem parada/inibição e novo ensaio. Todos os caminhos confiáveis recusam symlinks e configurações graváveis por grupo/outros. Serviços/probes/jobs administrativos locais usam root; não conceder acesso a esses comandos para a API ou usuários da aplicação.

## Instalação preparada, não executada

Copiar o diretório `api/ops` para `/opt/ritmo` (root-owned, arquivos sem escrita de grupo/outros). Criar `ritmo-receiver` sem login. Criar `/etc/ritmo` root:ritmo-receiver 0750; `/var/lib/ritmo-receiver` root:ritmo-receiver 0750; arquivos vazios `writer.lock` e `admin.lock` root:ritmo-receiver 0640. Criar `/srv/ritmo-recovery` e `wal` ritmo-receiver:ritmo-receiver 0700. A sandbox da unidade só permite escrita em `wal`; jobs finitos root cuidam de bases, dumps, inventários e expurgo.

Criar `/etc/ritmo/receiver.json` root:ritmo-receiver 0640, com caminhos absolutos (sem segredos):

```json
{"root":"/srv/ritmo-recovery","control":"/var/lib/ritmo-receiver","binary":"/usr/lib/postgresql/18/bin/pg_receivewal","environmentFile":"/etc/ritmo/receiver-env.json"}
```

Criar `receiver-env.json` root:ritmo-receiver 0640 com `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER=ritmo_wal_receiver`, `PGAPPNAME=ritmo_wal`, `PGSSLMODE=verify-full`, `PGSSLROOTCERT` e `PGPASSFILE`; não usar `PGPASSWORD`. PGHOST é um único endereço TCP/DNS (sem socket Unix/múltiplos hosts); porta 1–65535 e connect timeout 1–30 s. O passfile fica ritmo-receiver:ritmo-receiver 0600 e o certificado CA é confiável e somente leitura. Valores reais ficam no cofre Q43 e arquivos externos, nunca no Git/memória. O binário deve ser real PG18, não wrapper genérico que mude de versão. Montagens/caminhos precisam existir antes da unidade e dos jobs; não usar disco efêmero.

Instalar `ritmo-wal-receiver.service` em `/etc/systemd/system`, verificar com `systemd-analyze verify` e `daemon-reload` durante futura instalação isolada. Criar a inibição via `inhibit` **antes** de `enable`, para que o primeiro boot também fique bloqueado. Configurar TLS, HBA restrito, slot e sincronismo conforme [wal-recovery.md](wal-recovery.md); só então usar `resume`. Manter o marcador até a identidade do primário/destino estar validada. Não usar `systemctl start` como procedimento normal de retomada.

```sh
sudo python3 /opt/ritmo/receiver.py inhibit
sudo python3 /opt/ritmo/receiver.py state
# Recuperação: isolar API; confirmar parada e inibição; congelar mantendo a trava.
sudo env RITMO_RECOVERY_QUARANTINE=true python3 /opt/ritmo/operations.py \
  --root /srv/ritmo-recovery --receiver-config /etc/ritmo/receiver.json freeze
# Apenas após encerramento da recuperação e validação do destino:
sudo python3 /opt/ritmo/receiver.py resume
```

Em probes, usar `--receiver-config` no lugar do adaptador genérico `--receiver-state-command`. Esse adaptador continua disponível para integrações antigas de saúde, mas não autoriza congelamento nativo. A ausência de guarda agora recusa freeze antes de copiar.

## Provas e limites

Testar pelos comandos públicos, supervisor/processos Linux reais, PostgreSQL real e filesystem: reconexão/flush após interrupção do transporte, reinício após crash, preservação de cauda, Stop/inibição, Start explícito e reboot, ausência de escritores e exclusão durante freeze, unidade/processo divergente, erro fatal e retomada manual. A fixture systemd privilegiada é descartável e tem cgroup privado; esse privilégio não integra a configuração de produção. Não modificar a instalação WSL do operador.

Agenda nativa, transporte autenticado do probe, detector externo, proxy/TLS da API, capacidade/retencão e RTO externo continuam nos próximos recortes. Prova local não demonstra independência física dos fornecedores, janela histórica de 30 dias, latência de armazenamento/flush ou RTO da VPS.

Referências primárias: [systemd.service v255](https://github.com/systemd/systemd/blob/v255/man/systemd.service.xml), [systemd.kill v255](https://github.com/systemd/systemd/blob/v255/man/systemd.kill.xml), [pg_receivewal PG18](https://www.postgresql.org/docs/18/app-pgreceivewal.html) e [flock Linux](https://man7.org/linux/man-pages/man2/flock.2.html). Consultadas em 03/10/2026; validar novamente a versão instalada no aceite externo.

Evidência local e limites: [relatório de 03/10/2026](../../docs/analises/2026-10-03-supervisao-do-receptor-wal.md).
