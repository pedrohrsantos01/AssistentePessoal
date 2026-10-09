param([Parameter(Mandatory=$true)][string]$Log,[Parameter(Mandatory=$true)][string]$CompletionPath)
$Host.UI.RawUI.WindowTitle='Ritmo — jornada visível no Android'
$taskDeadline=(Get-Date).AddMinutes(15)
$taskPosition=0
Write-Host 'RITMO | JORNADA E GESTAO NO ANDROID' -ForegroundColor Cyan
Write-Host 'Cadastro → onboarding → Briefing → offline → reabertura → sincronização → editar/ordenar → excluir'
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
