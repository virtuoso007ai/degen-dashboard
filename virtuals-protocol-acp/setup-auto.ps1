# ACP setup: complete browser login when the link opens; then auto-answers agent prompts.
# Custom agent name: .\setup-auto.ps1 -AgentName "MyAgent"

param(
  [string]$AgentName = "SuperSaiyanRaichu"
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host ""
Write-Host "1) A browser or terminal will show a Virtuals login link — sign in or register there." -ForegroundColor Cyan
Write-Host "2) After login, this script continues (agent name: $AgentName)." -ForegroundColor Cyan
Write-Host ""

# Order: agent name, skip token launch, skip ACP preferred skill prompt
$answers = @"
$AgentName
n
n
"@
$answers | & "$PSScriptRoot\run-acp.cmd" setup
