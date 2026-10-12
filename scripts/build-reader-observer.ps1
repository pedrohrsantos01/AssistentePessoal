$ErrorActionPreference='Stop'
$taskRoot=Split-Path $PSScriptRoot -Parent
if(-not $env:ANDROID_HOME -or -not $env:JAVA_HOME) {throw 'Configure ANDROID_HOME e JAVA_HOME.'}
$taskSource=Join-Path $taskRoot 'app/harness/reader-observer'
$taskBuild=Join-Path $taskRoot '.scratch/runtime/interface/reader-observer'
$taskClasses=Join-Path $taskBuild 'classes'
$taskDex=Join-Path $taskBuild 'dex'
New-Item -ItemType Directory -Force -Path $taskClasses,$taskDex | Out-Null
$taskTools=Join-Path $env:ANDROID_HOME 'build-tools/36.0.0'
$taskAndroid=Join-Path $env:ANDROID_HOME 'platforms/android-35/android.jar'
& (Join-Path $env:JAVA_HOME 'bin/javac.exe') --release 17 -encoding UTF-8 -classpath $taskAndroid -d $taskClasses (Join-Path $taskSource 'ReaderObserver.java')
if($LASTEXITCODE -ne 0) {throw 'Compilação do observador falhou.'}
& (Join-Path $taskTools 'd8.bat') --lib $taskAndroid --output $taskDex (Join-Path $taskClasses 'dev/ritmo/readerobserver/ReaderObserver.class')
if($LASTEXITCODE -ne 0) {throw 'DEX do observador falhou.'}
$taskUnsigned=Join-Path $taskBuild 'unsigned.apk'
& (Join-Path $taskTools 'aapt2.exe') link -o $taskUnsigned -I $taskAndroid --manifest (Join-Path $taskSource 'AndroidManifest.xml')
if($LASTEXITCODE -ne 0) {throw 'Manifest do observador falhou.'}
Add-Type -AssemblyName System.IO.Compression
$taskArchive=[IO.Compression.ZipFile]::Open($taskUnsigned,[IO.Compression.ZipArchiveMode]::Update)
try {[IO.Compression.ZipFileExtensions]::CreateEntryFromFile($taskArchive,(Join-Path $taskDex 'classes.dex'),'classes.dex') | Out-Null} finally {$taskArchive.Dispose()}
$taskAligned=Join-Path $taskBuild 'aligned.apk'
& (Join-Path $taskTools 'zipalign.exe') -f 4 $taskUnsigned $taskAligned
if($LASTEXITCODE -ne 0) {throw 'Alinhamento do observador falhou.'}
$taskApk=Join-Path $taskBuild 'observer.apk'
# Conventional disposable Android debug signing, unrelated to production signing credentials.
& (Join-Path $env:JAVA_HOME 'bin/java.exe') --enable-native-access=ALL-UNNAMED -jar (Join-Path $taskTools 'lib/apksigner.jar') sign --ks (Join-Path $taskRoot 'app/android/app/debug.keystore') --ks-pass pass:android --key-pass pass:android --out $taskApk $taskAligned
if($LASTEXITCODE -ne 0) {throw 'Assinatura de debug do observador falhou.'}
Write-Output $taskApk
