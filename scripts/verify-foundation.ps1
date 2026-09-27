param([string]$JavaHome)
$ErrorActionPreference = 'Stop'
$taskRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$taskPreviousJava = $env:JAVA_HOME
try {
    if ($JavaHome) { $env:JAVA_HOME = $JavaHome }
    Push-Location $taskRoot
    pnpm --dir app install --frozen-lockfile
    if ($LASTEXITCODE) { throw 'Dependency installation failed' }
    pnpm --dir app typecheck
    if ($LASTEXITCODE) { throw 'TypeScript check failed' }
    pnpm --dir app lint
    if ($LASTEXITCODE) { throw 'Lint failed' }
    pnpm --dir app test
    if ($LASTEXITCODE) { throw 'SQLite tests failed' }
    & .\api\gradlew.bat -p api check --no-daemon
    if ($LASTEXITCODE) { throw 'API/integration checks failed' }
} finally {
    Pop-Location
    $env:JAVA_HOME = $taskPreviousJava
}
