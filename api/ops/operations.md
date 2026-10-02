# Ciclo operacional — REQ-NFR-004, recorte 3

Contrato de engenharia anterior à implementação, derivado de Q38–Q43 e ADR-019. Sem novo schema de domínio, API ou provedor. Ferramentas finitas em Python 3.11+ (stdlib, tzdata do sistema) e clientes PostgreSQL 18, executadas no destino independente. Monitor em outro host, fora do primário e do receptor. Supervisor/agenda/TLS/cofre externos são gate do recorte 4.

## Diretórios e publicação

Raiz privada, exclusiva de um cluster, sem symlinks: `bases/<UUID-hex>/base`, `logical/<UUID-hex>/archive.dump`, `wal/`, `events/`, `frozen/<UUID-hex>/`, `state.json`. Manifest operacional JSON versão 1 guarda instantes UTC, identidade do cluster, hash do manifest PostgreSQL e ranges de WAL; a versão 1 exige segmento de 16 MiB e recusa outro tamanho. Não contém dados de conta, comandos SQL nem segredos. IDs são gerados pelo operador da ferramenta, não por entradas de cliente.

O ciclo diário começa às 03:00 America/Sao_Paulo; captura base e dump sequencialmente, com resultados independentes e instantes reais de início/término próprios. `tick` é chamado ao menos a cada minuto, recupera o horário perdido executando o ciclo do dia civil corrente ainda não iniciado, sem sobreposição nem repetição automática de execução incerta após crash. Sucesso de um não esconde falha do outro. Início, término e falha possuem eventos imutáveis com sequência crescente sob lock; crash deixa execução incompleta detectável. Uma nova execução após falha requer `backup` explícito. Publicação usa arquivo sincronizado e link sem sobrescrita, seguido de fsync do diretório. Base somente entra no catálogo após pg_verifybackup; dump após pg_restore --list/checksum. Falha não altera o último backup válido.

## Alvo independente e cadeia congelada

Após isolar clientes e parar **e verificar parado** o receptor pelo supervisor, `freeze` copia base e todo WAL para novo pacote, valida a base, exige uma cauda `.partial` na timeline mais recente e seleciona o último registro completo pela leitura nativa do WAL. Nenhuma consulta ao primário. Inspeção exige identidade/tamanho de segmentos, continuidade, CRCs nativos e históricos que liguem a base à timeline atual; aceita somente término normal em padding inteiramente zero na cauda. Registro truncado não vazio/corrupção/gap recusam a seleção, mesmo que um alvo anterior pudesse funcionar. Nunca ignorar um erro e escolher um alvo mais antigo. Arquivos e alvo ficam num inventário com SHA256, publicado sem sobrescrita e novamente validado antes da preparação da restauração. A restauração permanece pausada/quarentenada para validar a API e credenciais conforme recovery.md. Esta seleção assume a cópia síncrona independente preservada; perda simultânea dela não está na garantia Q33. Não iniciar/reconectar receiver enquanto o congelamento estiver em curso.

Neste recorte o seletor nativo suporta segmentos de 16 MiB, sem compressão nem tablespaces adicionais, PostgreSQL 18 no mesmo formato/arquitetura. Outra configuração recusa execução. Base que atravessa promoção durante sua captura é recusada; novo backup no primário promovido é necessário.

## Retenção por dependência

`prune` valida primeiro o catálogo e as bases, conserva a base mais recente cuja captura **terminou** antes do início da janela de 30 dias (backup em curso não dá PITR retroativo), todas as bases mais novas e a mais antiga quando ainda não há 30 dias. Calcula WAL necessário desde o menor Start-LSN retido, conservando todos os segmentos daí em diante em todas as timelines, todos os históricos e toda cauda parcial. Gaps/identidades incompatíveis recusam o expurgo. Pacotes congelados são cópias independentes e permanecem preservados para ensaio/incidente; não são expurgados automaticamente. Dumps preservam um âncora e os posteriores. Área incompleta/orfã não é removida automaticamente. Exclusões são explicitamente limitadas aos artefatos listados pelo plano calculado dentro da raiz privada, sob lock operacional; nunca por mtime/idade isolada/quota.

## Detector externo e e-mail

`probe` publica somente metadados de saúde: primário alcançável, receiver vivo/conectado segundo supervisor e feedback (não idade do último WAL), catálogo, eventos e uso de disco. O detector obtém esse relatório por transporte restrito com timeout; ausência do host do receptor é uma falha própria. `monitor` tem relógio, obtenção do probe e envio de e-mail como fronteiras externas. Estado persiste em disco privado no detector. A cada 60 s: disponibilidade exige 2 falhas consecutivas; backup inexistente ou idade >26 h, execução falha/incompleta além de 26 h, catálogo inválido e espaço >=80%/90% geram estados por condição. Eventos de falha geram alerta na próxima coleta (até 60 s, sem esperar 2 probes). Abertura, agravamento e resolução enviam e-mail; estado igual permanece silencioso. Falha de transporte de e-mail não confirma entrega e tenta novamente na próxima execução; SMTP não permite exactly-once após crash, Message-ID estável permite correlação. Não inferir falha do receiver a partir de quietude de WAL.

Limites configuráveis mantendo os valores Q42; mensagens contêm apenas códigos operacionais, severidade e ID de evento. Credenciais SMTP/libpq são fornecidas por arquivo/ambiente protegido, referenciado no cofre Q43. Nenhum conteúdo de dump, exceção SQL ou saída de processos é incluído no e-mail.

## Ensaio e gate externo

`drill` executa o check isolado finito da API (incluindo RestoreTests/WalRecoveryTests), cronometra o processo completo e publica evento com commit/release e sucesso/falha. `drill-due` exige sucesso no mês civil corrente e para cada release major declarado; falha não renova o aceite. Esse ensaio local cobre perda/base/cauda/timeline/API/credenciais/isolamento; não estabelece RTO de produção. O runbook externo deve registrar incidente, reconstrução, restauração, validação, reabertura e duração total <=24h. Antes de expor: provisionar e provar agenda, monitor/email externos, disco/retencão, permissões/TLS, cofre e ensaio integral no ambiente real.

Fontes primárias: [manifest](https://www.postgresql.org/docs/18/backup-manifest-format.html), [ranges](https://www.postgresql.org/docs/18/backup-manifest-wal-ranges.html), [pg_waldump](https://www.postgresql.org/docs/18/pgwaldump.html), [receptor](https://www.postgresql.org/docs/18/app-pgreceivewal.html). pg_waldump não lê `.partial` diretamente: somente um alias privado de inspeção do pacote congelado perde esse sufixo. Nunca inspecionar uma cauda que está sendo alterada.

## Invocação e custódia

Instalação Linux, usuário operacional dedicado, raiz privada fora do primário; Python 3.11+ com IANA tzdata, clientes PG18 e coreutils. Windows executa somente os testes de regras/CLI, sem atestar fsync de diretório Linux. Nenhum comando instala supervisor/cron nem inicia serviço por conta própria.

Arquivos de configuração libpq JSON privados (0600), separados para base e dump, são fornecidos por `--physical-env /run/ritmo/physical.json` e `--logical-env /run/ritmo/logical.json`. Contêm PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSFILE/PGSSLMODE=verify-full/PGSSLROOTCERT; senhas ficam no PGPASSFILE provisionado pelo cofre. Dump usa login administrativo de backup capaz de preservar ACLs/RLS e consultar pg_control_system(). A publicação exige o mesmo System-Identifier do catálogo físico e verifica estabilidade da identidade antes/depois do dump. Esse acesso é operacional e não é concedido ao runtime. O login é separado do runtime. Base/health usam credencial operacional com replicação e visibilidade do receptor, nunca logins de usuário.

`--receiver-state-command /opt/ritmo/receiver-state` é um executável finito controlado pelo operador: consulta o supervisor e retorna exatamente `running` ou `stopped`, após verificar identidade/estado do processo. Não inferir parada por arquivo booleano ou PID sem verificar identidade. Ao congelar, supervisor inibe restart e clientes precisam estar efetivamente em quarentena. A flag da CLI declara essa verificação; não modifica a API. Estado running é combinado com conexão/slot/feedback do PG, sem usar idade do último WAL.

```sh
# Opções globais precedem o subcomando; repetir as opções de ambiente/supervisor nos jobs.
python3 /opt/ritmo/operations.py --root /srv/ritmo-backup --physical-env /run/ritmo/physical.json --logical-env /run/ritmo/logical.json tick
python3 /opt/ritmo/operations.py --root /srv/ritmo-backup --physical-env /run/ritmo/physical.json prune
# Revisar o plano JSON antes do primeiro expurgo; rotina validada pode usar prune --apply.
# Após quarentena e parada verificada/inibição de restart:
RITMO_RECOVERY_QUARANTINE=true python3 /opt/ritmo/operations.py --root /srv/ritmo-backup --receiver-state-command /opt/ritmo/receiver-state freeze
RITMO_RECOVERY_QUARANTINE=true python3 /opt/ritmo/operations.py --root /srv/ritmo-backup restore /srv/ritmo-backup/frozen/ID /novo/pgdata
```

`freeze --before INSTANTE_UTC` escolhe base concluída antes desse instante para PITR histórico isolado. O pacote verifica a cadeia até o último registro durável; o alvo integral padrão nunca é reduzido. Para investigar um instante histórico: preparar outro PGDATA, manter quarentena, configurar recovery_target_lsn='' e recovery_target_time no instante desejado, pause, e validar a consistência da base nesse instante. Recuperação histórica não autoriza publicar estado antigo de Q36. A janela cresce com o histórico desde a consistência da base mais antiga.

Detector em host separado: executar `monitor` a cada minuto, com `--state /srv/ritmo-monitor/state.json --probe-command /opt/ritmo/fetch-probe --smtp-config /run/ritmo/smtp.json`. fetch-probe usa transporte autenticado/restrito e timeout, executa probe no destino com env/supervisor e devolve apenas JSON. Sem endpoint público novo na API. Monitorar também host/agendamento/canal do próprio detector no recorte 4. SMTP JSON privado: host, port, sender, recipients (lista), messageIdDomain e, se necessário, username/passwordFile. STARTTLS e validação do certificado obrigatórios. Testes não entregam e-mail externo.

`drill --major 0` executa o ensaio local finito usando Java21/Docker/Gradle e mede a duração total da preparação dos containers até a verificação HTTP. `drill-due --major 0` sai 1 se faltar prova do mês civil de São Paulo ou do major declarado; usar esse gate mensalmente e antes de release. Eventos scope=local não substituem aceite externo com todas as fases da reconstrução real. Lock deixado por morte abrupta só é removido após confirmar ausência de jobs; a ferramenta não rompe lock automaticamente.

Expurgo online valida segmentos fechados e caudas de timelines ancestrais imutáveis, incluindo a história da timeline atual; não tenta validar CRC de uma cauda em alteração. A seleção integral só ocorre no pacote congelado. Usar diretório exclusivo de um cluster/primário designado; proibir dois primários ativos e promoções paralelas. Se falhar a verificação da cadeia, não apagar para resolver espaço. Receptor e catálogo precisam de capacidade suficiente para a janela/âncora/cópias congeladas. Pacotes congelados são removidos somente depois de encerrar o incidente/ensaio e confirmar cópias/evidências preservadas, por procedimento específico do operador.


## Continuação externa

O [caderno do recorte 4](external-provisioning.md) especifica inventário, dimensionamento, sequência de instalação e matriz de aceite externo. A preparação não instala supervisor/agenda/TLS/proxy nem confirma capacidade, SMTP, janela real ou RTO. O monitor atual recebe disco do receptor: a saúde do próprio detector/canal e disco/slot do primário exigem integração operacional adicional. Estado/decisões ficam na [tarefa 04](../../.scratch/recuperacao-operacional/issues/04-validar-operacao-externa.md).
