# Finite build fixture. Preserve the normal journey APK and regenerate its native config afterwards.
$ErrorActionPreference='Stop'
$taskRoot=Split-Path $PSScriptRoot -Parent
$taskApp=Join-Path $taskRoot 'app'
$taskBuild=Join-Path $taskRoot '.scratch/runtime/interface/readonly-journey'
$taskApk=Join-Path $taskApp 'android/app/build/outputs/apk/release/app-release.apk'
if(-not $env:JAVA_HOME -or -not $env:ANDROID_HOME) {throw 'Configure Java21 e SDK Android.'}
New-Item -ItemType Directory -Force -Path $taskBuild | Out-Null
$taskBackup=Join-Path $taskBuild ('preserved-'+(Get-FileHash -LiteralPath $taskApk -Algorithm SHA256).Hash.ToLowerInvariant()+'.apk')
Copy-Item -LiteralPath $taskApk -Destination $taskBackup -Force
$taskPrevious=@{};foreach($taskKey in @('EXPO_PUBLIC_RITMO_JOURNEY_TEST','EXPO_PUBLIC_RITMO_READONLY_TEST','EXPO_PUBLIC_RITMO_READONLY_UPDATED','EXPO_PUBLIC_RITMO_HTTP_HARNESS','EXPO_PUBLIC_RITMO_TECHNICAL_HARNESS','NODE_ENV','CI')) {$taskPrevious[$taskKey]=[Environment]::GetEnvironmentVariable($taskKey,'Process')}
Push-Location $taskApp
try {
 $env:NODE_ENV='production';$env:CI='1';$env:EXPO_PUBLIC_RITMO_JOURNEY_TEST='1';$env:EXPO_PUBLIC_RITMO_HTTP_HARNESS=$null;$env:EXPO_PUBLIC_RITMO_TECHNICAL_HARNESS=$null;$env:EXPO_PUBLIC_RITMO_READONLY_TEST='1'
 foreach($taskVersion in @('current','updated')) {
  $env:EXPO_PUBLIC_RITMO_READONLY_UPDATED=if($taskVersion -eq 'updated'){'1'}else{$null}
  $env:CI='1'
  & pnpm exec expo prebuild --platform android --no-install
  if($LASTEXITCODE -ne 0) {throw 'Prebuild da fixture falhou.'}
  # Expo CLI suppresses React Native's reset-cache in CI; each fixture needs its own public flags inlined.
  $env:CI=$null
  & ./android/gradlew.bat -p android :app:assembleRelease -PreactNativeArchitectures=x86_64 --max-workers=2 --no-daemon '-Dorg.gradle.jvmargs=-Xmx2g -XX:MaxMetaspaceSize=1g'
  if($LASTEXITCODE -ne 0) {throw 'Build da fixture falhou.'}
  & (Join-Path $env:JAVA_HOME 'bin/java.exe') --enable-native-access=ALL-UNNAMED -jar (Join-Path $env:ANDROID_HOME 'build-tools/36.0.0/lib/apksigner.jar') sign --ks (Join-Path $taskApp 'android/app/debug.keystore') --ks-pass pass:android --key-pass pass:android --v4-signing-enabled true --out (Join-Path $taskBuild ($taskVersion+'.apk')) $taskApk
  if($LASTEXITCODE -ne 0) {throw 'Assinatura de debug da fixture falhou.'}
 }
 $taskBundles=@{}
 foreach($taskVersion in @('current','updated')) {
  $taskArchive=[IO.Compression.ZipFile]::OpenRead((Join-Path $taskBuild ($taskVersion+'.apk')))
  try {
   $taskEntry=$taskArchive.GetEntry('assets/index.android.bundle')
   if(-not $taskEntry) {throw 'Bundle da fixture ausente no APK.'}
   $taskReader=[IO.BinaryReader]::new($taskEntry.Open())
   try {$taskBytes=$taskReader.ReadBytes([int]$taskEntry.Length)} finally {$taskReader.Dispose()}
   $taskBundles[$taskVersion]=@{sha256=[Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($taskBytes)).ToLowerInvariant();updatedVersionLiteral=[Text.Encoding]::ASCII.GetString($taskBytes).Contains('0.1.1')}
  } finally {$taskArchive.Dispose()}
 }
 if($taskBundles.current.sha256 -eq $taskBundles.updated.sha256 -or $taskBundles.current.updatedVersionLiteral -or -not $taskBundles.updated.updatedVersionLiteral) {throw 'Bundles de versao da fixture divergentes do esperado; nao executar ensaio nativo.'}
 [IO.File]::WriteAllText((Join-Path $taskBuild 'bundle-metadata.json'),($taskBundles | ConvertTo-Json)+"`n")
} finally {
 try {
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
Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $taskBuild 'current.apk'),(Join-Path $taskBuild 'updated.apk'),$taskApk
