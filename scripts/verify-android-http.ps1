param(
    [Parameter(Mandatory=$true)][ValidatePattern('^emulator-[0-9]+$')][string]$Serial
)
$ErrorActionPreference='Stop'
$taskRoot=Split-Path $PSScriptRoot -Parent
if(-not $env:JAVA_HOME -or -not $env:ANDROID_HOME) {throw 'Set JAVA_HOME to Java 21 and ANDROID_HOME to the installed Android SDK.'}
$taskAdb=Join-Path $env:ANDROID_HOME 'platform-tools/adb.exe'
function Invoke-Checked {
    param([string]$File,[string[]]$CommandArguments)
    & $File @CommandArguments
    if($LASTEXITCODE -ne 0) {throw ('Command failed: '+$File+' (exit '+$LASTEXITCODE+')')}
}
if((& $taskAdb -s $Serial shell getprop ro.kernel.qemu).Trim() -ne '1') {throw 'An already running Android emulator is required; physical devices are not supported by this test.'}
$taskPrevious=@{}
foreach($taskName in @('NODE_ENV','EXPO_PUBLIC_RITMO_HTTP_HARNESS','RITMO_ANDROID_SERIAL','RITMO_ANDROID_APK','RITMO_ADB')) {
    $taskPrevious[$taskName]=[Environment]::GetEnvironmentVariable($taskName,'Process')
}
try {
    $env:NODE_ENV='production'
    $env:EXPO_PUBLIC_RITMO_HTTP_HARNESS='1'
    $env:RITMO_ANDROID_SERIAL=$Serial
    $env:RITMO_ADB=$taskAdb
    Push-Location (Join-Path $taskRoot 'app')
    try {
        Invoke-Checked 'pnpm.cmd' @('typecheck')
        Invoke-Checked 'pnpm.cmd' @('lint')
        Invoke-Checked 'pnpm.cmd' @('test')
        Invoke-Checked 'pnpm.cmd' @('exec','expo','prebuild','--platform','android','--no-install')
        Invoke-Checked '.\android\gradlew.bat' @('-p','android',':app:assembleRelease','-PreactNativeArchitectures=x86_64','--max-workers=2','--no-daemon')
    } finally {Pop-Location}
    $taskApk=Join-Path $taskRoot 'app/android/app/build/outputs/apk/release/app-release.apk'
    $taskAapt=Get-ChildItem (Join-Path $env:ANDROID_HOME 'build-tools') -Directory |
        Sort-Object Name -Descending | ForEach-Object {Join-Path $_.FullName 'aapt2.exe'} |
        Where-Object {Test-Path -LiteralPath $_} | Select-Object -First 1
    if(-not $taskAapt) {throw 'aapt2 is required to verify the test package before installing.'}
    $taskBadging=& $taskAapt dump badging $taskApk
    if($LASTEXITCODE -ne 0 -or -not ($taskBadging -match "package: name='dev[.]ritmo[.]httpharness'")) {throw 'Refusing to install an APK outside the isolated HTTP harness package.'}
    Invoke-Checked $taskAdb @('-s',$Serial,'install','-r',$taskApk)
    $env:RITMO_ANDROID_APK=$taskApk
    Push-Location $taskRoot
    try {Invoke-Checked '.\api\gradlew.bat' @('-p','api','check','bootJar','--no-daemon')}
    finally {Pop-Location}
} finally {
    foreach($taskName in $taskPrevious.Keys) {[Environment]::SetEnvironmentVariable($taskName,$taskPrevious[$taskName],'Process')}
}
