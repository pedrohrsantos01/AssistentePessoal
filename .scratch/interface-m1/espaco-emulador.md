# Espaço do emulador para o ensaio final

12/10/2026: /data tem5,8GB, uso5,3GB, livres349MB. Instalação do APK final44,6MB foi recusada pelo PackageInstaller por espaço insuficiente. Código do Android35 define reserva baixa padrão até500MiB; o problema é o volume do emulador, não os discos C/H do host, com48,88/77,1GiB livres observados.

Inspeção confirmou somente dev.ritmo.httpharness como variante técnica antiga instalada; foundationharness não está instalado. Jornada atual usa dev.ritmo.journeytest. O lançador anterior não autoriza remover variantes antigas ou seus dados; Q59 solicita autorização específica para remover dev.ritmo.httpharness e fixtures sintéticas. As evidências anteriores permanecem nos relatórios. Reconstrução do harness usa o fluxo técnico existente.

A opção -RemoveOldHttpHarness é explícita e desativada por padrão no novo lançador. Após conferir ro.kernel.qemu=1, ela remove somente aquele ID literal; nunca generaliza por prefixo. Nenhuma execução dessa remoção ocorreu antes da resposta Q59. -InspectOnly lê o espaço/pacotes e fecha o emulador próprio; não limpa caches ou dados. Configuração e capacidade do AVD não foram alteradas.

Q59=A executada em12/10: `adb uninstall dev.ritmo.httpharness` devolveu Success; somente esse pacote foi removido. O volume passou a402MB livres, e `adb install -r` do APK final passou. Jornada atual/dados preservados, constatados no ensaio subsequente. Nenhuma limpeza genérica, alteração do AVD ou pacote adicional removido.
