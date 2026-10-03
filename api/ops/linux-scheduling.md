# Agenda Linux dos jobs finitos — REQ-NFR-004, recorte 4B

Contrato de engenharia anterior à implementação. Deriva de Q38/Q42 e da tarefa 04, sem nova agenda de produto. Timers e serviços nativos ficam fora do ciclo do Coolify; instalar somente no host correspondente, após os gates externos.

## Agenda e fronteiras

No receptor, `ritmo-backup.timer` chama `operations.py tick` a cada minuto UTC. A regra das 03:00 America/Sao_Paulo e a recuperação do horário perdido **do dia civil corrente** pertencem a tick; antes das 03h não há execução. Dias antigos não são reencenados. Persistent recupera uma ativação perdida; OnBootSec=30s garante chamada no boot. Precisão de 1s, sem atraso aleatório. Ativações durante um job em curso não criam fila nem outra instância; a próxima chamada aplica o dia civil corrente após o término. Um serviço oneshot sem RemainAfterExit impede sobreposição; o lock do catálogo também protege chamadas manuais. Crash que deixa lock/evento incompleto exige inspeção, nunca repetição automática do ciclo incerto.

No terceiro host, `ritmo-monitor.timer` chama monitor a cada minuto. Estado e credenciais são persistentes/protegidos; probe externo e SMTP continuam fronteiras, com entrega real pendente. O timer não depende do controller Coolify. Timeout de início/execução: backup 24h, monitor 45s; parada/hooks têm prazo próprio (30s/10s por etapa). Stop termina o cgroup, incluindo filhos. Não há Restart automático dos serviços finitos: a próxima ativação chama a mesma regra pública. Nenhum expurgo ou ensaio local é ativado por estes timers. `drill-due` permanece gate mensal/major; o ensaio integral externo continua obrigatório.

## Evidências persistentes e saúde

`ExecStartPre` publica a tentativa (ID da invocação) antes do job; uma tentativa sem término vira falha retida na próxima ativação, inclusive se o hook final não publicou. `ExecStopPost` executa `schedule.py record --job backup|monitor`, inclusive quando ExecStart falha ou sofre timeout. StateDirectory cria `/var/lib/ritmo-jobs` root:root 0700. Registro JSON versão 1 por job: job, completed UTC, monotonic (segundos), boot (ID do kernel), invocation (ID da última conclusão), attempt (ID pendente ou null), result sanitizado e failure (última falha não reconhecida ou null). Publicação atômica com fsync de arquivo/diretório e flock protege record/ack. Não guarda comandos, saída do processo, exceções, credenciais ou dados de domínio. Sucesso posterior preserva failure; um tick sem trabalho não resolve o incidente. `ack --job ... --failure ID` exige serviço e timer inativos e ID correspondente, após investigar/corrigir e provar a recuperação. Não remove eventos/lock de operações nem confirma restauração.

`health --job ...` consulta unidades nativas carregadas, tipo/usuário/cgroup e timer ativo vinculado ao serviço. Exige execução comprovada desde o boot: serviço em execução com PID, ou registro concluído recente (até 120s pelo relógio monotônico do mesmo boot). Confere última tentativa monotônica do serviço para recusar falha/morte sem publicação final. Falta de registro, unidade/agenda ausente, timer parado, erro de leitura ou evidência vencida retornam available=false. Falha retida ou resultado systemd falho retorna failed=true imediatamente. `completed` é null/monotonic=0 antes da primeira conclusão; boot/monotonic descrevem a última conclusão, e attempt identifica o início atual. `failure.result=unknown` indica término não publicado; os demais códigos são resultados nativos sanitizados. A consulta não altera estado nem cria diretórios. Receptor inclui `schedule` no probe somente com `--schedule-job backup`; Monitor exige o campo quando usado com `--require-schedule`. Condições `agenda-backup` (ausência, 2 coletas) e `job-backup` (falha, próxima coleta); dedupe/escalada/resolução usam o estado atual do Monitor. Probes legados permanecem explícitos, sem alegar aceite da agenda nativa.

A saúde local do timer do detector é verificável com `health --job monitor`. Perda do host/agendamento/canal do próprio detector exige vigilância independente a integrar no próximo recorte; ele não pode enviar alerta estando desligado. Instalação externa, transporte privado, SMTP real, relógio sincronizado, capacidade e RTO continuam gates abertos.

## Prova local prevista

Fronteiras já aprovadas no plano: processos/relógio/armazenamento/transporte, CLI pública e systemd real numa fixture Linux descartável. Verificar chamada automática e exclusão durante job longo; recuperação Persistent sem alterar relógio do host; falha antes do processo, timeout com filhos, falha persistente apesar de sucesso, reconhecimento explícito; ausência de agenda e alertas no Monitor. Sintaxe compatível com systemd 255 do Ubuntu 24.04; runtime da fixture Debian/systemd 257 não substitui o Ubuntu remoto.

Fontes primárias consultadas: [timer v255](https://raw.githubusercontent.com/systemd/systemd/v255/man/systemd.timer.xml) (persistência/exclusão), [service v255](https://raw.githubusercontent.com/systemd/systemd/v255/man/systemd.service.xml) (oneshot, timeout, ExecStopPost) e [variáveis de execução](https://www.freedesktop.org/software/systemd/man/latest/systemd.exec.html#%24SERVICE_RESULT).

## Instalação futura por host

O pacote é local; executar esta sequência no ambiente externo somente na etapa 4C autorizada e isolada. Linux com systemd 255+, cgroup v2, Python 3.11+/tzdata, arquivo/código root e ancestrais sem escrita de grupo/outros. Receptor já preparado conforme [supervisão](receiver-supervision.md). No receptor instalar clientes PG18/coreutils, diretório privado de catálogo, configurações persistentes `/etc/ritmo/physical.json` e `logical.json` root:root 0600, PGPASSFILE/CA protegidos e conectividade TLS conforme [operações](operations.md). Não usar `/run` para a única cópia de configuração: desaparece no boot. `/opt/ritmo` recebe scripts Python/shell/SQL deste pacote, root:root 0644, sem escrita por serviços sem privilégio.

No detector criar `/srv/ritmo-monitor` root:root 0700, instalar os Python do pacote, `/etc/ritmo/smtp.json` root:root 0600, arquivo de senha SMTP 0600 custodiado e o futuro `/opt/ritmo/fetch-probe` root:root 0755. O transporte deve invocar probe no receptor com opções globais `--root`, `--physical-env`, `--receiver-config` e `--schedule-job backup`, antes de `probe`. A unidade exige esse campo; um probe legado não comprova saúde. O transporte ainda será implementado/testado; não habilitar monitor externo só com este guia.

Instalar **apenas backup no receptor** e **apenas monitor no detector**, com o mesmo par de arquivos do repositório. Exemplo no receptor:

```sh
sudo install -d -o root -g root -m 700 /var/lib/ritmo-jobs
sudo install -o root -g root -m 644 /opt/ritmo/ritmo-backup.service /opt/ritmo/ritmo-backup.timer /etc/systemd/system/
sudo systemd-analyze verify /etc/systemd/system/ritmo-backup.service /etc/systemd/system/ritmo-backup.timer
sudo systemctl daemon-reload
# Após provar acesso/backup/identidade/TLS e requisitos externos:
sudo systemctl enable --now ritmo-backup.timer
sudo systemctl list-timers ritmo-backup.timer
sudo python3 /opt/ritmo/schedule.py health --job backup
```

Repetir com `ritmo-monitor`/job `monitor` somente no detector preparado. Não habilitar os services diretamente: habilitar os timers, que iniciam jobs finitos. Sem RemainAfterExit/Restart; persistência em `/var/lib/systemd/timers` e `/var/lib/ritmo-jobs` deve sobreviver ao boot. Configurar e comprovar sincronização do relógio de cada VPS; dependência time-sync.target não atesta NTP por si só. Instalar duplicata no Coolify criaria concorrência e não faz parte deste pacote.

## Pausa, incidente e reconhecimento

Antes de manutenção, restauração ou freeze: parar timer de backup, aguardar término do job quando possível e verificar estado/PID. Em incidente, Stop do serviço encerra todos os filhos e registra falha; verificar ausência de jobs e inspecionar eventos/lock incompleto antes de qualquer remoção manual. Timer parado não inibe receiver: manter também o protocolo `receiver.py inhibit` antes de freeze. Não editar código, unidades ou evidências durante jobs; root que muda esses artefatos não está coberto pela exclusão.

```sh
sudo systemctl stop ritmo-backup.timer
sudo systemctl show ritmo-backup.service -p ActiveState -p MainPID -p Result
# Se a interrupção for necessária:
sudo systemctl stop ritmo-backup.service
sudo journalctl -u ritmo-backup.service --no-pager
```

Falha de job aparece no probe na próxima coleta, sem expor saída. `schedule.py health --job backup` reporta somente available/failed; consultar o registro privado `/var/lib/ritmo-jobs/backup.json` para ID/código. Após diagnóstico, correção e prova manual adequada (`backup` explícito para ciclo falho, sem repetir ciclo incerto nem romper lock automaticamente), parar timer/serviço e reconhecer **o ID exato**:

```sh
sudo python3 /opt/ritmo/schedule.py ack --job backup --failure ID_DE_32_HEXADECIMAIS
sudo systemctl reset-failed ritmo-backup.service
sudo systemctl start ritmo-backup.timer
sudo python3 /opt/ritmo/schedule.py health --job backup
```

`ack` não modifica backups nem eventos. Resolução no detector requer também saúde atual e correção das falhas do catálogo; limpar apenas o registro não transforma backup falho em sucesso. ID incorreto ou unidade em execução é recusado. Falta de montagem/configuração/ExecStopPost pode impedir publicação; a saúde combina registro e estado nativo, sem depender só do hook. O registro de falha mais recente substitui o anterior; journal e eventos de operações são as evidências detalhadas, conforme retenção operacional externa a validar.

## Limites e continuidade

[Relatório local](../../docs/analises/2026-10-03-agenda-operacional-linux.md). A fixture usa systemd real e processos controlados na fronteira externa; a regra civil das 03h é testada com relógio controlado e os backups/PG reais têm provas dos recortes anteriores. Reinício do PID 1 preserva o filesystem do container; não representa perda de energia da VPS. SMTP/transporte e instalação no Ubuntu remoto não foram ativados. Próximo incremento: transporte privado autenticado do probe e integração do detector/canal; proxy/TLS e aceite externo permanecem abertos.

## Transporte e watchdog — continuação local 4B

O [incremento de transporte/detector](probe-transport.md) fornece fetch-probe/fetch-detector e acrescenta job watchdog, com service/timer no receptor B. Monitor C exige saúde do watchdog de B; B verifica detector/ciclo/SMTP usando canal alternativo independente a prover. Evidência, falha latente, deadline, exclusão e ack seguem as mesmas regras nativas. Usar job watchdog/units ritmo-watchdog no procedimento administrativo acima. A [prova local](../../docs/analises/2026-10-03-transporte-privado-do-probe.md) cobre unit real e protocolo, sem aceitar instalação/entrega externas. Próximo incremento local: proxy/TLS/origem confiável.
