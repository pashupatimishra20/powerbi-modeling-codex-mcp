param(
    [string]$PluginParent = "$HOME\plugins",
    [string]$MarketplacePath = "$HOME\.agents\plugins\marketplace.json",
    [string]$SkillParent = $(if ($env:CODEX_HOME) { Join-Path $env:CODEX_HOME 'skills' } else { Join-Path (Join-Path $HOME '.codex') 'skills' }),
    [string]$PluginName = "powerbi-modeling-codex"
)

$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $scriptDir 'plugin-install-common.ps1')

$destinationPluginPath = Join-Path $PluginParent $PluginName
$standaloneSkillName = "powerbi-modeling-mcp"
$destinationSkillPath = Join-Path $SkillParent $standaloneSkillName
$marketplaceSourcePath = "./plugins/$PluginName"

Remove-PluginInstall `
    -DestinationPluginPath $destinationPluginPath `
    -MarketplacePath $MarketplacePath `
    -PluginName $PluginName `
    -MarketplaceSourcePath $marketplaceSourcePath

Remove-InstalledPath -Path $destinationSkillPath

Write-Host "Removed plugin folder if present: $destinationPluginPath"
Write-Host "Removed standalone skill folder if present: $destinationSkillPath"
Write-Host "Removed marketplace entries for: $PluginName"
Write-Host "Updated marketplace: $MarketplacePath"
