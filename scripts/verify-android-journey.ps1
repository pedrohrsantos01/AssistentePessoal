param(
 [ValidateSet('journey','session')][string]$Suite='journey',
 [ValidatePattern('^emulator-[0-9]+$')][string]$Serial='emulator-5560',
 [string]$Avd='Pixel_9',
 [string]$EvidenceDirectory='docs/design/evidencias/2026-10-09/gestao-android',
 [switch]$FreshTestInstall,
 [switch]$SkipBuild
)
$ErrorActionPreference='Stop'
$taskRoot=Split-Path $PSScriptRoot -Parent
if(-not $env:JAVA_HOME -or -not $env:ANDROID_HOME) {throw 'Configure JAVA_HOME (Java 21) e ANDROID_HOME.'}
$taskAdb=Join-Path $env:ANDROID_HOME 'platform-tools/adb.exe'
$taskEmulator=Join-Path $env:ANDROID_HOME 'emulator/emulator.exe'
$taskPort=[int]($Serial -replace '^emulator-','')
$taskRuntime=Join-Path $taskRoot '.scratch/runtime/interface'
New-Item -ItemType Directory -Force -Path $taskRuntime | Out-Null
$taskBuildLog=Join-Path $taskRuntime 'android-journey-build.log'
$taskTestLog=Join-Path $taskRuntime 'android-journey-gradle.log'
$taskCompletion=Join-Path $taskRuntime 'android-journey-complete'
$taskNativeLog=Join-Path $taskRoot 'api/build/android-journey-integration.log'
$taskOwnEmulator=$false
$taskEmulatorProcess=$null
$taskPanel=$null
$taskPrevious=@{}
foreach($taskName in @('NODE_ENV','EXPO_PUBLIC_RITMO_HTTP_HARNESS','EXPO_PUBLIC_RITMO_TECHNICAL_HARNESS','EXPO_PUBLIC_RITMO_JOURNEY_TEST','RITMO_ANDROID_JOURNEY_SERIAL','RITMO_ADB','RITMO_JOURNEY_EVIDENCE')) {$taskPrevious[$taskName]=[Environment]::GetEnvironmentVariable($taskName,'Process')}
function Invoke-Checked([string]$File,[string[]]$CommandArguments) {& $File @CommandArguments;if($LASTEXITCODE -ne 0) {throw ('Falhou: '+$File+' ('+$LASTEXITCODE+')')}}
try {
 $env:NODE_ENV='test';$env:EXPO_PUBLIC_RITMO_HTTP_HARNESS=$null;$env:EXPO_PUBLIC_RITMO_TECHNICAL_HARNESS=$null;$env:EXPO_PUBLIC_RITMO_JOURNEY_TEST='1'
 if(-not $SkipBuild) {
  Push-Location (Join-Path $taskRoot 'app')
  try {
   Invoke-Checked 'pnpm.cmd' @('typecheck');Invoke-Checked 'pnpm.cmd' @('lint');Invoke-Checked 'pnpm.cmd' @('test')
   $env:NODE_ENV='production'
   Invoke-Checked 'pnpm.cmd' @('exec','expo','prebuild','--platform','android','--no-install')
   & '.\android\gradlew.bat' -p android :app:assembleRelease -PreactNativeArchitectures=x86_64 --max-workers=2 --no-daemon '-Dorg.gradle.jvmargs=-Xmx2g -XX:MaxMetaspaceSize=1g' *> $taskBuildLog
   if($LASTEXITCODE -ne 0) {throw ('Build falhou. Veja '+$taskBuildLog)}
  } finally {Pop-Location}
 }
 $taskApk=Join-Path $taskRoot 'app/android/app/build/outputs/apk/release/app-release.apk'
 $taskAapt=Get-ChildItem (Join-Path $env:ANDROID_HOME 'build-tools') -Directory | Sort-Object Name -Descending | ForEach-Object {Join-Path $_.FullName 'aapt2.exe'} | Where-Object {Test-Path -LiteralPath $_} | Select-Object -First 1
 if(-not $taskAapt) {throw 'aapt2 ausente.'}
 $taskBadging=& $taskAapt dump badging $taskApk
 if($LASTEXITCODE -ne 0 -or -not ($taskBadging -match "package: name='dev[.]ritmo[.]journeytest'")) {throw 'APK deve pertencer somente à variante descartável dev.ritmo.journeytest.'}
 $taskDevices=& $taskAdb devices
 if(-not ($taskDevices -match ('^'+[regex]::Escape($Serial)+'\s+device'))) {
  $taskAvailable=& $taskEmulator -list-avds
  if($taskAvailable -notcontains $Avd) {throw 'AVD solicitado não existe.'}
  $taskEmulatorProcess=Start-Process -FilePath $taskEmulator -ArgumentList @('-avd',$Avd,'-port',$taskPort,'-no-snapshot','-no-boot-anim','-gpu','swiftshader','-memory','2048') -WindowStyle Normal -RedirectStandardOutput (Join-Path $taskRuntime 'emulator-stdout.log') -RedirectStandardError (Join-Path $taskRuntime 'emulator-stderr.log') -PassThru
  $taskOwnEmulator=$true
  $taskDeadline=(Get-Date).AddMinutes(3)
  do {Start-Sleep -Seconds 2;$taskBoot=& $taskAdb -s $Serial shell getprop sys.boot_completed 2>$null} while($taskBoot -ne '1' -and (Get-Date) -lt $taskDeadline)
  if($taskBoot -ne '1') {throw 'Emulador não iniciou no prazo.'}
  Invoke-Checked $taskAdb @('-s',$Serial,'wait-for-device')
 }
 if((& $taskAdb -s $Serial shell getprop ro.kernel.qemu).Trim() -ne '1') {throw 'Testes restritos ao emulador.'}
 if($FreshTestInstall) {
  # Only the disposable APK variant validated above, and only in an emulator.
  $taskInstalled=& $taskAdb -s $Serial shell pm path dev.ritmo.journeytest
  if($taskInstalled -match '^package:') {Invoke-Checked $taskAdb @('-s',$Serial,'uninstall','dev.ritmo.journeytest')}
 }
 Invoke-Checked $taskAdb @('-s',$Serial,'install','-r',$taskApk)
 $env:RITMO_ANDROID_JOURNEY_SERIAL=$Serial;$env:RITMO_ADB=$taskAdb;$env:RITMO_JOURNEY_EVIDENCE=[IO.Path]::GetFullPath((Join-Path $taskRoot $EvidenceDirectory))
 if(-not $env:RITMO_JOURNEY_EVIDENCE.StartsWith($taskRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) {throw 'Evidencias devem ficar dentro do workspace.'}
 if(Test-Path -LiteralPath $taskCompletion) {Remove-Item -LiteralPath $taskCompletion}
 [IO.File]::WriteAllText($taskNativeLog,'')
 $taskWatcher=Join-Path $PSScriptRoot 'watch-android-journey.ps1'
 $taskPanel=Start-Process -FilePath 'pwsh.exe' -ArgumentList @('-NoProfile','-File',('"'+$taskWatcher+'"'),'-Suite',$Suite,'-Log',('"'+$taskNativeLog+'"'),'-CompletionPath',('"'+$taskCompletion+'"')) -WindowStyle Normal -PassThru
 Push-Location (Join-Path $taskRoot 'api')
 try {
  $taskMethod=if($Suite -eq 'session') {'dev.ritmo.RuntimeTests.androidProductSessionRecoveryPreservesAccountIsolation'} else {'dev.ritmo.RuntimeTests.androidProductJourneyWorksOfflineAndSynchronizesAfterRestart'}
  & '.\gradlew.bat' test --tests $taskMethod --no-daemon *> $taskTestLog
  $taskResult=$LASTEXITCODE
  Get-Content -LiteralPath $taskNativeLog
  if($taskResult -ne 0) {Get-Content -LiteralPath $taskTestLog -Tail 30;throw 'Jornada nativa falhou.'}
 } finally {Pop-Location}
} finally {
 [IO.File]::WriteAllText($taskCompletion,'done')
 if($taskPanel -and -not $taskPanel.HasExited) {Stop-Process -Id $taskPanel.Id -ErrorAction SilentlyContinue}
 if($taskOwnEmulator) {
  & $taskAdb -s $Serial emu kill | Out-Null
  if($taskEmulatorProcess) {
   # If ADB never became available, still close only this launcher's QEMU children.
   Get-CimInstance Win32_Process -Filter ('ParentProcessId='+$taskEmulatorProcess.Id) | Where-Object {$_.Name -like 'qemu-system-*'} | ForEach-Object {Stop-Process -Id $_.ProcessId -ErrorAction SilentlyContinue}
   if(-not $taskEmulatorProcess.HasExited) {Stop-Process -Id $taskEmulatorProcess.Id -ErrorAction SilentlyContinue}
  }
 }
 foreach($taskName in $taskPrevious.Keys) {[Environment]::SetEnvironmentVariable($taskName,$taskPrevious[$taskName],'Process')}
}
