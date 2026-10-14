param([Parameter(Mandatory=$true)][string]$Log)
$ErrorActionPreference='Stop'
$taskRoot=Split-Path $PSScriptRoot -Parent
& (Join-Path $taskRoot 'api/gradlew.bat') -p (Join-Path $taskRoot 'api') test --tests dev.ritmo.RuntimeTests.androidReaderNavigatesLargeTextFormsSheetsAndErrors --no-daemon --max-workers=2 *> $Log
exit $LASTEXITCODE
