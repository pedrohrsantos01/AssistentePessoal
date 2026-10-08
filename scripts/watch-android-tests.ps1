param(
    [Parameter(Mandatory=$true)][string]$GradleLog,
    [Parameter(Mandatory=$true)][string]$CompletionPath
)
$ErrorActionPreference='Stop'
$taskRoot=Split-Path $PSScriptRoot -Parent
$Host.UI.RawUI.WindowTitle='Ritmo - testes Android de recuperação'
$taskStarted=Get-Date
$taskDeadline=$taskStarted.AddMinutes(30)
$taskLogs=@($GradleLog,(Join-Path $taskRoot 'api/build/android-http-integration.log'),(Join-Path $taskRoot 'api/build/android-exceptions-integration.log'))
$taskPositions=@{}
$taskLabels=@{
    prepared='Conta preparada; intenções locais gravadas'
    offline='Registro sem rede'
    restored='Dados preservados após reinício'
    background='App em segundo plano'
    background_online='Rede restaurada; envio ainda pausado'
    converged='Retomada automática e sincronização'
    verified='Conferência após nova reabertura'
    vault_blocked='Falha controlada do cofre; uso local preservado'
    vault_recovered='Cofre recuperado; sincronização retomada'
    account_open_blocked='Abertura da conta bloqueada, conforme esperado'
    account_open_recovered='Nova tentativa abriu a conta com os dados preservados'
    account_pragma_blocked='PRAGMA falhou; handle da conta encerrado'
    account_pragma_recovered='PRAGMA recuperado; intenções preservadas'
    account_migration_blocked='Migration de ensaio falhou; rollback observado'
    account_migration_recovered='Reabertura após rollback; envelopes preservados'
    installation_open_blocked='Controle da instalação bloqueado; nenhuma conta aberta'
    installation_open_recovered='Controle recuperado; conta e pendências restauradas'
    identity_blocked='Identidade incerta bloqueada; trabalho independente sincronizado'
    offline_logout='Logout offline; acesso à conta encerrado'
    account_b='Conta B isolada e sincronizada'
    account_a_restored='Reentrada online em A; pendências recuperadas'
    account_a_converged='Conta A sincronizada; dados de B preservados'
}
Write-Host 'RITMO | TESTES ANDROID DE RECUPERAÇÃO' -ForegroundColor Cyan
Write-Host 'Cofre -> abertura SQLite -> identidade/recibos -> isolamento A/B/A'
Write-Host 'Etapas exibidas somente quando observadas nos logs atuais.'
Write-Host 'Falhas do cofre/abertura são controladas nas fronteiras nativas.'
Write-Host 'O harness ainda não contém a interface do produto.'
Write-Host ''
while ((Get-Date) -lt $taskDeadline) {
    foreach ($taskLog in $taskLogs) {
        if (-not (Test-Path -LiteralPath $taskLog)) { continue }
        if ((Get-Item -LiteralPath $taskLog).LastWriteTime -lt $taskStarted) { continue }
        if (-not $taskPositions.ContainsKey($taskLog)) { $taskPositions[$taskLog]=0 }
        $taskLines=@(Get-Content -LiteralPath $taskLog -ErrorAction SilentlyContinue)
        while ($taskPositions[$taskLog] -lt $taskLines.Count) {
            $taskLine=$taskLines[$taskPositions[$taskLog]]
            if ($taskLine.StartsWith('{') -and -not $taskLine.EndsWith('}')) { break }
            $taskPositions[$taskLog]++
            if ($taskLine.StartsWith('{')) {
                try { $taskEvent=$taskLine | ConvertFrom-Json -ErrorAction Stop } catch { continue }
                if ($taskEvent.passed -eq $true -and $taskLabels.ContainsKey([string]$taskEvent.phase)) {
                    $taskScenario=if ($taskEvent.scenario) { $taskEvent.scenario } else { 'HTTP nativo' }
                    Write-Host ("OK | {0} | {1}" -f $taskScenario,$taskLabels[[string]$taskEvent.phase]) -ForegroundColor Green
                    if ($null -ne $taskEvent.pending) {
                        Write-Host ("     Pendências: {0} | XP: {1} | Bloqueadas: {2}" -f $taskEvent.pending,$taskEvent.xp,$taskEvent.blocked)
                    } elseif ($taskEvent.database) {
                        Write-Host ("     Diagnóstico: {0}" -f $taskEvent.database) -ForegroundColor Yellow
                    }
                }
            } elseif ($taskLog -eq $GradleLog -and $taskLine -match '(^> Task| PASSED$| FAILED$| SKIPPED$|BUILD SUCCESSFUL|BUILD FAILED)') {
                $taskColor=if ($taskLine -match 'FAILED') {'Red'} else {'Cyan'}
                Write-Host $taskLine -ForegroundColor $taskColor
            } elseif ($taskLog -ne $GradleLog -and $taskLine -match '(tests |pass |fail |skipped |native |Android )') {
                Write-Host $taskLine
            }
        }
    }
    if ((Test-Path -LiteralPath $CompletionPath) -and (Get-Item -LiteralPath $CompletionPath).LastWriteTime -ge $taskStarted) {
        try { $taskResult=Get-Content -LiteralPath $CompletionPath -Raw | ConvertFrom-Json -ErrorAction Stop } catch { Start-Sleep -Milliseconds 200;continue }
        Write-Host ''
        if ($taskResult.exitCode -eq 0) { Write-Host 'EXECUÇÃO APROVADA.' -ForegroundColor Green }
        else { Write-Host 'EXECUÇÃO COM FALHA — relatório será diagnosticado pelo agente.' -ForegroundColor Red }
        Write-Host 'Este painel será fechado em 5 segundos para liberar recursos.'
        Start-Sleep -Seconds 5
        exit
    }
    Start-Sleep -Milliseconds 200
}
Write-Host 'Prazo do acompanhamento atingido; consulte os logs locais.' -ForegroundColor Yellow
