param([ValidatePattern('^emulator-[0-9]+$')][string]$Serial='emulator-5560',[string]$Avd='Pixel_9',[string]$EvidenceDirectory='docs/design/evidencias/2026-10-12/aparencia-android/talkback',[switch]$InspectOnly,[switch]$RemoveOldHttpHarness,[switch]$SkipInstall,[switch]$ReaderOnly,[ValidateRange(2048,8192)][int]$MemoryMegabytes=4096,[switch]$EnableDebugInput)
$ErrorActionPreference='Stop'
$taskRoot=Split-Path $PSScriptRoot -Parent
if(-not $env:ANDROID_HOME) {throw 'Configure ANDROID_HOME.'}
$taskAdb=Join-Path $env:ANDROID_HOME 'platform-tools/adb.exe'
$taskRuntime=Join-Path $taskRoot '.scratch/runtime/interface'
$taskLog=Join-Path $taskRuntime 'android-accessibility.log'
$taskCompletion=Join-Path $taskRuntime 'android-accessibility-complete'
$taskOwnEmulator=$false;$taskOwnDebugRoot=$false;$taskEmulatorProcess=$null;$taskPanel=$null
$taskPrevious=@{};foreach($taskName in @('RITMO_ANDROID_JOURNEY_SERIAL','RITMO_ADB','RITMO_JOURNEY_EVIDENCE','RITMO_ANDROID_READER_ONLY')) {$taskPrevious[$taskName]=[Environment]::GetEnvironmentVariable($taskName,'Process')}
try {
 $taskDevices=& $taskAdb devices
 if(-not ($taskDevices -match ('^'+[regex]::Escape($Serial)+'\s+device'))) {
  $taskEmulator=Join-Path $env:ANDROID_HOME 'emulator/emulator.exe'
  if((& $taskEmulator -list-avds) -notcontains $Avd) {throw 'AVD não encontrado.'}
  $taskEmulatorProcess=Start-Process -FilePath $taskEmulator -ArgumentList @('-avd',$Avd,'-port',($Serial -replace '^emulator-',''),'-no-snapshot','-no-boot-anim','-gpu','swiftshader','-memory',[string]$MemoryMegabytes) -WindowStyle Normal -PassThru -RedirectStandardOutput (Join-Path $taskRuntime 'reader-emulator-out.log') -RedirectStandardError (Join-Path $taskRuntime 'reader-emulator-err.log')
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
 if($EnableDebugInput -and ((& $taskAdb -s $Serial shell id -u).Trim() -ne '0')) {
  if(-not $taskOwnEmulator -or ((& $taskAdb -s $Serial shell getprop ro.debuggable).Trim() -ne '1')) {throw 'Entrada física exige emulador próprio e imagem depurável; não alterar aparelho/processo preexistente.'}
  $taskOwnDebugRoot=$true
  & $taskAdb -s $Serial root
  $taskRootDeadline=(Get-Date).AddSeconds(45)
  do {Start-Sleep -Seconds 1;$taskDeviceUid=& $taskAdb -s $Serial shell id -u 2>$null} while($taskDeviceUid -ne '0' -and (Get-Date) -lt $taskRootDeadline)
  if($taskDeviceUid -ne '0') {throw 'Imagem não oferece entrada física depurável.'}
 }
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
 if($SkipInstall) {
  $taskInstalledPath=((& $taskAdb -s $Serial shell pm path dev.ritmo.journeytest) | Select-Object -First 1) -replace '^package:',''
  if($taskInstalledPath -notmatch '^/data/app/[A-Za-z0-9._~+/=-]+/base[.]apk$') {throw 'Caminho do APK instalado não confirmado.'}
  $taskInstalledHash=((& $taskAdb -s $Serial shell sha256sum $taskInstalledPath) -split '\s+')[0]
  if($taskInstalledHash -ne (Get-FileHash -LiteralPath $taskApk -Algorithm SHA256).Hash) {throw 'APK instalado diverge do build final.'}
 } else {
 & $taskAdb -s $Serial install -r $taskApk
 if($LASTEXITCODE -ne 0) {
  Start-Sleep -Seconds 2
  & $taskAdb -s $Serial install --no-streaming -r $taskApk
 }
 if($LASTEXITCODE -ne 0) {throw 'Instalação da revisão final falhou.'}
 }
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
 $env:RITMO_ANDROID_READER_ONLY=if($ReaderOnly){'1'}else{$null}
 if(Test-Path -LiteralPath $taskCompletion) {Remove-Item -LiteralPath $taskCompletion}
 [IO.File]::WriteAllText($taskLog,'')
 $taskWatcher=Join-Path $PSScriptRoot 'watch-android-journey.ps1'
 $taskPanel=Start-Process -FilePath 'pwsh.exe' -ArgumentList @('-NoProfile','-File',('"'+$taskWatcher+'"'),'-Suite','accessibility','-Log',('"'+$taskLog+'"'),'-CompletionPath',('"'+$taskCompletion+'"')) -WindowStyle Normal -PassThru
 Push-Location (Join-Path $taskRoot 'app')
 try {& node --import tsx --test test/integration/android-accessibility.test.ts *> $taskLog;$taskCode=$LASTEXITCODE;Get-Content -LiteralPath $taskLog;if($taskCode -ne 0) {throw 'Ensaio TalkBack falhou.'}} finally {Pop-Location}
} finally {
 [IO.File]::WriteAllText($taskCompletion,'done')
 if($taskPanel -and -not $taskPanel.HasExited) {Stop-Process -Id $taskPanel.Id -ErrorAction SilentlyContinue}
 if($taskOwnDebugRoot) {& $taskAdb -s $Serial unroot | Out-Null;Start-Sleep -Seconds 2}
 if($taskOwnEmulator) {
  & $taskAdb -s $Serial emu kill | Out-Null
  if($taskEmulatorProcess) {Get-CimInstance Win32_Process -Filter ('ParentProcessId='+$taskEmulatorProcess.Id) | Where-Object {$_.Name -like 'qemu-system-*'} | ForEach-Object {Stop-Process -Id $_.ProcessId -ErrorAction SilentlyContinue};if(-not $taskEmulatorProcess.HasExited) {Stop-Process -Id $taskEmulatorProcess.Id -ErrorAction SilentlyContinue}}
 }
 foreach($taskName in $taskPrevious.Keys) {[Environment]::SetEnvironmentVariable($taskName,$taskPrevious[$taskName],'Process')}
}
