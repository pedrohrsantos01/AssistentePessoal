param([ValidateSet('journey','session','sync','recovery')][string]$Suite='journey',[Parameter(Mandatory=$true)][string]$Log,[Parameter(Mandatory=$true)][string]$CompletionPath)
$Host.UI.RawUI.WindowTitle='Ritmo — jornada visível no Android'
$taskDeadline=(Get-Date).AddMinutes(15)
$taskPosition=0
if($Suite -eq 'sync') {
 Write-Host 'RITMO | RESULTADOS DE SINCRONIZACAO NO ANDROID' -ForegroundColor Cyan
 Write-Host 'Recusa → correção → identidade incerta → independentes → 429/503 → snapshot → atualização'
} elseif($Suite -eq 'session') {
 Write-Host 'RITMO | SESSAO E RECUPERACAO NO ANDROID' -ForegroundColor Cyan
 Write-Host 'Cofre → saída offline → B isolada → reentrada A → abertura bloqueada → autenticação'
} else {
 Write-Host 'RITMO | JORNADA E GESTAO NO ANDROID' -ForegroundColor Cyan
 Write-Host 'Cadastro → onboarding → Briefing → offline → reabertura → sincronização → editar/ordenar → excluir'
}
while ((Get-Date) -lt $taskDeadline -and -not (Test-Path -LiteralPath $CompletionPath)) {
 if (Test-Path -LiteralPath $Log) {
  $taskLines=@(Get-Content -LiteralPath $Log -ErrorAction SilentlyContinue)
  while($taskPosition -lt $taskLines.Count) {
   $taskLine=$taskLines[$taskPosition];$taskPosition++
   if($taskLine -match 'phase|passed|fail|tests |BUILD |FAILED|PASSED') {Write-Host $taskLine -ForegroundColor Cyan}
  }
 }
 Start-Sleep -Milliseconds 400
}
Write-Host 'Acompanhamento encerrado.'
