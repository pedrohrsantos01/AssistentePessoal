param([switch]$Performance,[switch]$CompareRefresh)
# Finite build fixture. Preserve the normal journey APK and regenerate its native config afterwards.
$ErrorActionPreference='Stop'
$taskRoot=Split-Path $PSScriptRoot -Parent
$taskApp=Join-Path $taskRoot 'app'
$taskBuild=Join-Path $taskRoot '.scratch/runtime/interface/readonly-journey'
$taskApk=Join-Path $taskApp 'android/app/build/outputs/apk/release/app-release.apk'
if(-not $env:JAVA_HOME -or -not $env:ANDROID_HOME) {throw 'Configure Java21 e SDK Android.'}
if($CompareRefresh -and -not $Performance) {throw 'CompareRefresh exige a variante Performance isolada.'}
$taskJourney=Join-Path $taskApp 'src/features/journey/journey.ts'
$taskJourneySource=[IO.File]::ReadAllText($taskJourney)
$taskRefreshGuard='if(this.snapshot===previous)this.refresh();'
if($CompareRefresh -and ([regex]::Matches($taskJourneySource,[regex]::Escape($taskRefreshGuard))).Count -ne 1) {throw 'Origem da comparacao de refresh nao corresponde a implementacao esperada.'}
$taskBaselineSource=$taskJourneySource.Replace($taskRefreshGuard,'this.refresh();')
$taskVersions=if($CompareRefresh){@('baseline','current')}elseif($Performance){@('current')}else{@('current','updated')}
$taskSourceHashes=@{}
New-Item -ItemType Directory -Force -Path $taskBuild | Out-Null
$taskBackup=Join-Path $taskBuild ('preserved-'+(Get-FileHash -LiteralPath $taskApk -Algorithm SHA256).Hash.ToLowerInvariant()+'.apk')
Copy-Item -LiteralPath $taskApk -Destination $taskBackup -Force
$taskPrevious=@{};foreach($taskKey in @('EXPO_PUBLIC_RITMO_JOURNEY_TEST','EXPO_PUBLIC_RITMO_READONLY_TEST','EXPO_PUBLIC_RITMO_READONLY_UPDATED','EXPO_PUBLIC_RITMO_HTTP_HARNESS','EXPO_PUBLIC_RITMO_TECHNICAL_HARNESS','NODE_ENV','CI','EXPO_PUBLIC_RITMO_PERF_TEST')) {$taskPrevious[$taskKey]=[Environment]::GetEnvironmentVariable($taskKey,'Process')}
Push-Location $taskApp
try {
 $env:EXPO_PUBLIC_RITMO_PERF_TEST=if($Performance){'1'}else{$null}
 $env:NODE_ENV='production';$env:CI='1';$env:EXPO_PUBLIC_RITMO_JOURNEY_TEST='1';$env:EXPO_PUBLIC_RITMO_HTTP_HARNESS=$null;$env:EXPO_PUBLIC_RITMO_TECHNICAL_HARNESS=$null;$env:EXPO_PUBLIC_RITMO_READONLY_TEST='1'
 foreach($taskVersion in $taskVersions) {
  if($CompareRefresh) {
   if([IO.File]::ReadAllText($taskJourney) -cnotin @($taskJourneySource,$taskBaselineSource)) {throw 'Fonte alterada durante a comparacao; preservar edicao concorrente.'}
   [IO.File]::WriteAllText($taskJourney,$(if($taskVersion -eq 'baseline'){$taskBaselineSource}else{$taskJourneySource}),[Text.UTF8Encoding]::new($false))
   $taskSourceHashes[$taskVersion]=(Get-FileHash -LiteralPath $taskJourney -Algorithm SHA256).Hash.ToLowerInvariant()
  }
  $env:EXPO_PUBLIC_RITMO_READONLY_UPDATED=if($taskVersion -eq 'updated'){'1'}else{$null}
  $env:CI='1'
  if(-not $CompareRefresh -or $taskVersion -eq 'baseline') {
   & pnpm exec expo prebuild --platform android --no-install
   if($LASTEXITCODE -ne 0) {throw 'Prebuild da fixture falhou.'}
  }
  # Expo CLI suppresses React Native's reset-cache in CI; each fixture needs its own public flags inlined.
  $env:CI=$null
  & ./android/gradlew.bat -p android :app:assembleRelease -PreactNativeArchitectures=x86_64 --max-workers=2 --no-daemon '-Dorg.gradle.jvmargs=-Xmx2g -XX:MaxMetaspaceSize=1g'
  if($LASTEXITCODE -ne 0) {throw 'Build da fixture falhou.'}
  & (Join-Path $env:JAVA_HOME 'bin/java.exe') --enable-native-access=ALL-UNNAMED -jar (Join-Path $env:ANDROID_HOME 'build-tools/36.0.0/lib/apksigner.jar') sign --ks (Join-Path $taskApp 'android/app/debug.keystore') --ks-pass pass:android --key-pass pass:android --v4-signing-enabled true --out (Join-Path $taskBuild ($taskVersion+'.apk')) $taskApk
  if($LASTEXITCODE -ne 0) {throw 'Assinatura de debug da fixture falhou.'}
 }
 $taskBundles=@{}
 foreach($taskVersion in $taskVersions) {
  $taskArchive=[IO.Compression.ZipFile]::OpenRead((Join-Path $taskBuild ($taskVersion+'.apk')))
  try {
   $taskEntry=$taskArchive.GetEntry('assets/index.android.bundle')
   if(-not $taskEntry) {throw 'Bundle da fixture ausente no APK.'}
   $taskReader=[IO.BinaryReader]::new($taskEntry.Open())
   try {$taskBytes=$taskReader.ReadBytes([int]$taskEntry.Length)} finally {$taskReader.Dispose()}
   $taskBundles[$taskVersion]=@{sha256=[Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($taskBytes)).ToLowerInvariant();updatedVersionLiteral=[Text.Encoding]::ASCII.GetString($taskBytes).Contains('0.1.1')}
  } finally {$taskArchive.Dispose()}
 }
 if($taskBundles.current.updatedVersionLiteral -or (-not $Performance -and ($taskBundles.current.sha256 -eq $taskBundles.updated.sha256 -or -not $taskBundles.updated.updatedVersionLiteral))) {throw 'Bundles de versao da fixture divergentes do esperado; nao executar ensaio nativo.'}
 if($CompareRefresh -and ($taskBundles.baseline.sha256 -eq $taskBundles.current.sha256 -or $taskBundles.baseline.updatedVersionLiteral)) {throw 'Comparacao exige bundles distintos sem alterar a versao do protocolo.'}
 if($CompareRefresh) {[IO.File]::WriteAllText((Join-Path $taskBuild 'comparison-sources.json'),($taskSourceHashes | ConvertTo-Json)+"`n",[Text.UTF8Encoding]::new($false))}
 [IO.File]::WriteAllText((Join-Path $taskBuild 'bundle-metadata.json'),($taskBundles | ConvertTo-Json)+"`n")
} finally {
 try {
  if($CompareRefresh) {
   if([IO.File]::ReadAllText($taskJourney) -cnotin @($taskJourneySource,$taskBaselineSource)) {throw 'Fonte alterada por outro processo; nao sobrescrever.'}
   [IO.File]::WriteAllText($taskJourney,$taskJourneySource,[Text.UTF8Encoding]::new($false))
  }
  $env:EXPO_PUBLIC_RITMO_PERF_TEST=$null
  $env:CI='1';$env:EXPO_PUBLIC_RITMO_JOURNEY_TEST='1';$env:EXPO_PUBLIC_RITMO_READONLY_TEST=$null;$env:EXPO_PUBLIC_RITMO_READONLY_UPDATED=$null
  & pnpm exec expo prebuild --platform android --no-install
  if($LASTEXITCODE -ne 0) {Write-Warning 'Configuração nativa normal não foi regenerada; APK original será preservado.'}
 } finally {
  New-Item -ItemType Directory -Force -Path (Split-Path $taskApk -Parent) | Out-Null
  Copy-Item -LiteralPath $taskBackup -Destination $taskApk -Force
  foreach($taskKey in $taskPrevious.Keys) {[Environment]::SetEnvironmentVariable($taskKey,$taskPrevious[$taskKey],'Process')}
  Pop-Location
 }
}
$taskPaths=@((Join-Path $taskBuild 'current.apk'),$taskApk)
if(-not $Performance){$taskPaths+=(Join-Path $taskBuild 'updated.apk')}
if($CompareRefresh){$taskPaths+=(Join-Path $taskBuild 'baseline.apk')}
Get-FileHash -Algorithm SHA256 -LiteralPath $taskPaths
