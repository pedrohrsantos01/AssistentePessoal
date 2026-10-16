param([ValidatePattern('^emulator-[0-9]+$')][string]$Serial='emulator-5560',[string]$Avd='Pixel_9',[string]$EvidenceDirectory='docs/design/evidencias/2026-10-12/aparencia-android/talkback',[string]$PaletteEvidenceDirectory='',[switch]$InspectOnly,[switch]$RemoveOldHttpHarness,[switch]$SkipInstall,[switch]$TrimCaches,[switch]$ReaderOnly,[switch]$Matrix,[switch]$Recovery,[switch]$Traversal,[ValidateSet('swiftshader','host')][string]$GpuMode='swiftshader',[ValidateRange(2048,8192)][int]$MemoryMegabytes=4096,[ValidateRange(1024,65535)][int]$GrpcPort=8590)
$ErrorActionPreference='Stop'
if($Recovery -and $Traversal) {throw 'Escolha somente Recovery ou Traversal.'}
if($Recovery -or $Traversal) {$Matrix=$true}
$taskRoot=Split-Path $PSScriptRoot -Parent
if(-not $env:ANDROID_HOME) {throw 'Configure ANDROID_HOME.'}
$taskAdb=Join-Path $env:ANDROID_HOME 'platform-tools/adb.exe'
$taskRuntime=Join-Path $taskRoot '.scratch/runtime/interface'
$taskLog=Join-Path $taskRuntime 'android-accessibility.log'
$taskCompletion=Join-Path $taskRuntime 'android-accessibility-complete'
$taskApiProcess=$null;$taskBootstrap=$null;$taskOwnObserver=$false;$taskOwnEmulator=$false;$taskEmulatorProcess=$null;$taskPanel=$null
$taskPrevious=@{};foreach($taskName in @('RITMO_ANDROID_JOURNEY_SERIAL','RITMO_ADB','RITMO_JOURNEY_EVIDENCE','RITMO_ANDROID_READER_ONLY','RITMO_EMULATOR_DISCOVERY','RITMO_EMULATOR_GRPC_PORT','RITMO_PALETTE_EVIDENCE','RITMO_ANDROID_READER_MATRIX','RITMO_READER_PROGRESS','RITMO_READER_BOOTSTRAP','RITMO_READER_RECOVERY','RITMO_READER_TRAVERSAL')) {$taskPrevious[$taskName]=[Environment]::GetEnvironmentVariable($taskName,'Process')}
New-Item -ItemType Directory -Force -Path $taskRuntime | Out-Null
try {
 if($Matrix) {
  if(-not $env:JAVA_HOME) {throw 'Configure JAVA_HOME com Java21.'}
  $taskBootstrap=Join-Path $taskRuntime ('reader-bootstrap/'+[guid]::NewGuid().ToString())
  New-Item -ItemType Directory -Force -Path $taskBootstrap | Out-Null
  $env:RITMO_READER_RECOVERY=if($Recovery){'1'}else{$null}
  $env:RITMO_READER_TRAVERSAL=if($Traversal){'1'}else{$null}
  $env:RITMO_READER_BOOTSTRAP=$taskBootstrap;$env:RITMO_ANDROID_READER_MATRIX='1';$env:RITMO_ANDROID_JOURNEY_SERIAL=$Serial;$env:RITMO_ADB=$taskAdb
  $env:RITMO_JOURNEY_EVIDENCE=[IO.Path]::GetFullPath((Join-Path $taskRoot $EvidenceDirectory))
  if(-not $env:RITMO_JOURNEY_EVIDENCE.StartsWith($taskRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) {throw 'Evidências fora do workspace.'}
  $env:RITMO_READER_PROGRESS=$taskLog
  if(Test-Path -LiteralPath $taskCompletion) {Remove-Item -LiteralPath $taskCompletion}
  [IO.File]::WriteAllText($taskLog,'Preparando API e PostgreSQL descartáveis antes do emulador.'+"`n")
  $taskWatcher=Join-Path $PSScriptRoot 'watch-android-journey.ps1'
  $taskPanel=Start-Process -FilePath 'pwsh.exe' -ArgumentList @('-NoProfile','-File',('"'+$taskWatcher+'"'),'-Suite','reader-matrix','-Log',('"'+$taskLog+'"'),'-CompletionPath',('"'+$taskCompletion+'"')) -WindowStyle Normal -PassThru
  $taskApiRunner=Join-Path $PSScriptRoot 'run-reader-matrix-api.ps1'
  $taskApiLog=Join-Path $taskRuntime 'reader-matrix-gradle.log'
  $taskApiProcess=Start-Process -FilePath 'pwsh.exe' -ArgumentList @('-NoProfile','-File',('"'+$taskApiRunner+'"'),'-Log',('"'+$taskApiLog+'"')) -WindowStyle Hidden -PassThru
  $taskApiDeadline=(Get-Date).AddMinutes(3)
  while(-not (Test-Path -LiteralPath (Join-Path $taskBootstrap 'api-ready'))) {
   if($taskApiProcess.HasExited -or (Get-Date) -gt $taskApiDeadline) {Get-Content -LiteralPath $taskApiLog -Tail 30;throw 'API descartável não ficou pronta; não iniciar emulador.'}
   Start-Sleep -Milliseconds 500
  }
  Write-Output 'API/PostgreSQL preparados; iniciando agora o emulador visível.'
 }
 $taskDevices=& $taskAdb devices
 if(-not ($taskDevices -match ('^'+[regex]::Escape($Serial)+'\s+device'))) {
  if(Get-NetTCPConnection -LocalPort $GrpcPort -ErrorAction SilentlyContinue) {throw 'Porta gRPC ocupada; não reutilizar endpoint alheio.'}
  $taskEmulator=Join-Path $env:ANDROID_HOME 'emulator/emulator.exe'
  if((& $taskEmulator -list-avds) -notcontains $Avd) {throw 'AVD não encontrado.'}
  $taskEmulatorProcess=Start-Process -FilePath $taskEmulator -ArgumentList @('-avd',$Avd,'-port',($Serial -replace '^emulator-',''),'-no-snapshot','-no-boot-anim','-gpu',$GpuMode,'-memory',[string]$MemoryMegabytes,'-grpc',[string]$GrpcPort,'-grpc-use-jwt','-grpc-allowlist',(Join-Path $PSScriptRoot 'android-reader-access.json')) -WindowStyle Normal -PassThru -RedirectStandardOutput (Join-Path $taskRuntime 'reader-emulator-out.log') -RedirectStandardError (Join-Path $taskRuntime 'reader-emulator-err.log')
  $taskOwnEmulator=$true;$taskDeadline=(Get-Date).AddMinutes(3)
  do {Start-Sleep -Seconds 2;$taskBoot=& $taskAdb -s $Serial shell getprop sys.boot_completed 2>$null} while($taskBoot -ne '1' -and (Get-Date) -lt $taskDeadline)
  if($taskBoot -ne '1') {throw 'Emulador não iniciou.'}
 }
 if((& $taskAdb -s $Serial shell getprop ro.kernel.qemu).Trim() -ne '1') {throw 'Somente emulador.'}
 if($InspectOnly) {
  & $taskAdb -s $Serial shell df -h /data
  foreach($taskPackage in @('dev.ritmo.foundationharness','dev.ritmo.httpharness','dev.ritmo.journeytest')) {
   $taskPackagePath=& $taskAdb -s $Serial shell pm path $taskPackage
   Write-Output $taskPackage
   Write-Output $taskPackagePath
   foreach($taskPackageApk in $taskPackagePath) {if($taskPackageApk -match '^package:(/data/app/[A-Za-z0-9._~+/=-]+/base[.]apk)$') {& $taskAdb -s $Serial shell du -sm ($Matches[1] -replace '/base[.]apk$','')}}
  }
  & $taskAdb -s $Serial shell df -h /data
  return
 }
 if(-not ((& $taskAdb -s $Serial shell pm path dev.ritmo.journeytest) -match '^package:')) {throw 'Execute primeiro a suite appearance para instalar/preparar somente a variante descartável.'}
 $taskApk=Join-Path $taskRoot 'app/android/app/build/outputs/apk/release/app-release.apk'
 $taskAapt=Get-ChildItem (Join-Path $env:ANDROID_HOME 'build-tools') -Directory | Sort-Object Name -Descending | ForEach-Object {Join-Path $_.FullName 'aapt2.exe'} | Where-Object {Test-Path -LiteralPath $_} | Select-Object -First 1
 if(-not $taskAapt -or -not ((& $taskAapt dump badging $taskApk) -match "package: name='dev[.]ritmo[.]journeytest'")) {throw 'Somente APK descartável dev.ritmo.journeytest.'}
 if(-not $taskOwnEmulator) {throw 'Ensaio de toque exige emulador iniciado por este lançador; processo preexistente foi preservado.'}
 $taskDiscoveryDirectory=Join-Path $env:LOCALAPPDATA 'Temp/avd/running'
 $taskDiscoveryDeadline=(Get-Date).AddSeconds(30);$taskDiscovery=$null
 do {
  $taskPids=@($taskEmulatorProcess.Id)+@(Get-CimInstance Win32_Process -Filter ('ParentProcessId='+$taskEmulatorProcess.Id) | Where-Object {$_.Name -like 'qemu-system-*'} | Select-Object -ExpandProperty ProcessId)
  foreach($taskPid in $taskPids) {
   foreach($taskFileName in @(('pid_'+$taskPid+'.ini'),('pid_'+$taskPid+'_info.ini'))) {
    $taskCandidate=Join-Path $taskDiscoveryDirectory $taskFileName
    if(Test-Path -LiteralPath $taskCandidate) {$taskDiscovery=$taskCandidate;break}
   }
   if($taskDiscovery) {break}
  }
  if(-not $taskDiscovery) {Start-Sleep -Milliseconds 300}
 } while(-not $taskDiscovery -and (Get-Date) -lt $taskDiscoveryDeadline)
 if(-not $taskDiscovery) {throw 'Discovery do emulador próprio não encontrado.'}
 $taskFields=@{};foreach($taskLine in [IO.File]::ReadAllLines($taskDiscovery)) {
  if($taskLine -match '^([^=]+)=(.*)$') {$taskFields[$Matches[1].Trim()]=$Matches[2].Trim()}
 }
 if($taskFields['port.serial'] -ne ($Serial -replace '^emulator-','') -or $taskFields['avd.id'] -ne $Avd) {throw 'Discovery diverge do AVD/serial iniciado.'}
 if($taskFields['grpc.port'] -ne [string]$GrpcPort -or -not $taskFields['grpc.jwks'] -or -not $taskFields['grpc.jwk_active']) {throw 'Endpoint JWT não confirmado.'}
 if([IO.Path]::GetFullPath($taskFields['grpc.allowlist']) -ne [IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'android-reader-access.json'))) {throw 'Política de acesso isolada não confirmada.'}
 $taskListeners=@(Get-NetTCPConnection -LocalPort $GrpcPort -State Listen -ErrorAction Stop)
 if($taskListeners.Count -eq 0 -or @($taskListeners | Where-Object {$_.LocalAddress -notin @('127.0.0.1','::1') -or $_.OwningProcess -notin $taskPids}).Count -gt 0) {throw 'Endpoint deve pertencer ao emulador próprio e escutar somente em loopback.'}
 $env:RITMO_EMULATOR_DISCOVERY=$taskDiscovery;$env:RITMO_EMULATOR_GRPC_PORT=[string]$GrpcPort
 Write-Output 'sendTouch: endpoint próprio em loopback, autenticação JWT obrigatória.'
 if($TrimCaches) {
  Write-Output 'Preparação: pedindo ao Android liberação de caches até 1 GB livre; bancos e pacotes preservados.'
  & $taskAdb -s $Serial shell pm trim-caches 1000000000 internal
  if($LASTEXITCODE -ne 0) {throw 'O Android não conseguiu liberar caches.'}
  & $taskAdb -s $Serial shell df -h /data
 }
 $taskObserverApk=Join-Path $taskRuntime 'reader-observer/observer.apk'
 if(-not (Test-Path -LiteralPath $taskObserverApk)) {throw 'Compile antes scripts/build-reader-observer.ps1.'}
 if((& $taskAdb -s $Serial shell pm path dev.ritmo.readerobserver) -match '^package:') {throw 'Observador preexistente preservado; este ensaio exige instalar seu próprio pacote temporário.'}
 & $taskAdb -s $Serial install -t --no-incremental $taskObserverApk
 if($LASTEXITCODE -ne 0) {throw 'Instalação do observador de teste falhou.'}
 $taskOwnObserver=$true
 if($RemoveOldHttpHarness) {
  # Explicit opt-in: remove only the historical synthetic-fixture package, never the product or current test journey.
  $taskOldPackage='dev.ritmo.httpharness'
  if((& $taskAdb -s $Serial shell pm path $taskOldPackage) -match '^package:') {
   Write-Output 'Q59: removendo somente dev.ritmo.httpharness; preservando dev.ritmo.journeytest.'
   & $taskAdb -s $Serial uninstall $taskOldPackage
   if($LASTEXITCODE -ne 0) {throw 'Não foi possível remover a variante HTTP antiga.'}
  }
 }
 & $taskAdb -s $Serial shell df -h /data
 if(-not $SkipInstall) {
  & $taskAdb -s $Serial install -r $taskApk
  if($LASTEXITCODE -ne 0) {
   Start-Sleep -Seconds 2
   & $taskAdb -s $Serial install --no-streaming -r $taskApk
  }
  if($LASTEXITCODE -ne 0) {throw 'Instalação da revisão final falhou.'}
 }
 $taskInstalledPath=((& $taskAdb -s $Serial shell pm path dev.ritmo.journeytest) | Select-Object -First 1) -replace '^package:',''
 if($taskInstalledPath -notmatch '^/data/app/[A-Za-z0-9._~+/=-]+/base[.]apk$') {throw 'Caminho do APK instalado não confirmado.'}
 $taskInstalledHash=((& $taskAdb -s $Serial shell sha256sum $taskInstalledPath) -split '\s+')[0]
 $taskLocalHash=(Get-FileHash -LiteralPath $taskApk -Algorithm SHA256).Hash.ToLowerInvariant()
 if($taskInstalledHash -ne $taskLocalHash) {throw 'APK instalado diverge do build final.'}
 # A package update can reconnect ADB. Require a stable ready transport before screen inspection.
 $taskReadyDeadline=(Get-Date).AddSeconds(45);$taskStable=0
 do {
  $taskReady=& $taskAdb -s $Serial shell getprop sys.boot_completed 2>$null
  if($LASTEXITCODE -eq 0 -and $taskReady -eq '1') {$taskStable++} else {$taskStable=0}
  Start-Sleep -Seconds 1
 } while($taskStable -lt 5 -and (Get-Date) -lt $taskReadyDeadline)
 if($taskStable -lt 5) {throw 'Transporte ADB não estabilizou após instalar.'}
 $env:RITMO_ANDROID_JOURNEY_SERIAL=$Serial;$env:RITMO_ADB=$taskAdb;$env:RITMO_JOURNEY_EVIDENCE=[IO.Path]::GetFullPath((Join-Path $taskRoot $EvidenceDirectory))
 if(-not $env:RITMO_JOURNEY_EVIDENCE.StartsWith($taskRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) {throw 'Evidências fora do workspace.'}
 New-Item -ItemType Directory -Force -Path $env:RITMO_JOURNEY_EVIDENCE | Out-Null
 [IO.File]::WriteAllText((Join-Path $env:RITMO_JOURNEY_EVIDENCE 'installed-apk.json'),(@{passed=$true;package='dev.ritmo.journeytest';serial=$Serial;avd=$Avd;apkSha256=$taskLocalHash;installedSha256=$taskInstalledHash} | ConvertTo-Json)+"
")

 $env:RITMO_ANDROID_READER_MATRIX=if($Matrix){'1'}else{$null}
 $env:RITMO_ANDROID_READER_ONLY=if($ReaderOnly){'1'}else{$null}
 $env:RITMO_PALETTE_EVIDENCE=if($PaletteEvidenceDirectory){[IO.Path]::GetFullPath((Join-Path $taskRoot $PaletteEvidenceDirectory))}else{$env:RITMO_JOURNEY_EVIDENCE}
 if(-not $env:RITMO_PALETTE_EVIDENCE.StartsWith($taskRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) {throw 'Origem das paletas fora do workspace.'}
 if(-not $Matrix) {
 if(Test-Path -LiteralPath $taskCompletion) {Remove-Item -LiteralPath $taskCompletion}
 [IO.File]::WriteAllText($taskLog,'')
 $taskWatcher=Join-Path $PSScriptRoot 'watch-android-journey.ps1'
 $taskPanel=Start-Process -FilePath 'pwsh.exe' -ArgumentList @('-NoProfile','-File',('"'+$taskWatcher+'"'),'-Suite','accessibility','-Log',('"'+$taskLog+'"'),'-CompletionPath',('"'+$taskCompletion+'"')) -WindowStyle Normal -PassThru
 }
 Push-Location (Join-Path $taskRoot 'app')
 try {
  if($Matrix) {
   [IO.File]::WriteAllText((Join-Path $taskBootstrap 'device.json'),(@{discovery=$taskDiscovery;port=$GrpcPort} | ConvertTo-Json))
   $taskApiProcess.WaitForExit();$global:LASTEXITCODE=$taskApiProcess.ExitCode
  } else {& node --import tsx --test test/integration/android-accessibility.test.ts *> $taskLog}
  $taskCode=$LASTEXITCODE;if($taskCode -ne 0 -and $Matrix) {[IO.File]::AppendAllText($taskLog,(@{phase='reader_matrix_failed';exitCode=$taskCode;passed=$false} | ConvertTo-Json -Compress)+"`n")};Get-Content -LiteralPath $taskLog;if($taskCode -ne 0) {throw 'Ensaio TalkBack falhou.'}
 } finally {Pop-Location}
} finally {
 if($taskBootstrap) {[IO.File]::WriteAllText((Join-Path $taskBootstrap 'cancel'),'cancel')}
 if($taskApiProcess -and -not $taskApiProcess.HasExited) {
  # Allow a canceled bootstrap to unwind its fixture; then stop only this wrapper's descendants.
  if(-not $taskApiProcess.WaitForExit(10000)) {
   $taskProcesses=@(Get-CimInstance Win32_Process);$taskOwnedPids=@($taskApiProcess.Id)
   do {$taskCount=$taskOwnedPids.Count;$taskOwnedPids+=@($taskProcesses | Where-Object {$_.ParentProcessId -in $taskOwnedPids -and $_.ProcessId -notin $taskOwnedPids} | Select-Object -ExpandProperty ProcessId)} while($taskOwnedPids.Count -gt $taskCount)
   [array]::Reverse($taskOwnedPids);foreach($taskOwnedPid in $taskOwnedPids){Stop-Process -Id $taskOwnedPid -ErrorAction SilentlyContinue}
  }
 }
 [IO.File]::WriteAllText($taskCompletion,'done')
 if($taskPanel -and -not $taskPanel.HasExited) {Stop-Process -Id $taskPanel.Id -ErrorAction SilentlyContinue}
 if($taskOwnObserver) {& $taskAdb -s $Serial uninstall dev.ritmo.readerobserver | Out-Null}
 if($taskOwnEmulator) {
  & $taskAdb -s $Serial emu kill | Out-Null
  if($taskEmulatorProcess) {Get-CimInstance Win32_Process -Filter ('ParentProcessId='+$taskEmulatorProcess.Id) | Where-Object {$_.Name -like 'qemu-system-*'} | ForEach-Object {Stop-Process -Id $_.ProcessId -ErrorAction SilentlyContinue};if(-not $taskEmulatorProcess.HasExited) {Stop-Process -Id $taskEmulatorProcess.Id -ErrorAction SilentlyContinue}}
 }
 foreach($taskName in $taskPrevious.Keys) {[Environment]::SetEnvironmentVariable($taskName,$taskPrevious[$taskName],'Process')}
}
