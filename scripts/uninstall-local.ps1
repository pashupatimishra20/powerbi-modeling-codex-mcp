param(
    [string]$PluginParent = "$HOME\plugins",
    [string]$MarketplacePath = "$HOME\.agents\plugins\marketplace.json",
    [string]$SkillParent = $(if ($env:CODEX_HOME) { Join-Path $env:CODEX_HOME 'skills' } else { Join-Path (Join-Path $HOME '.codex') 'skills' }),
    [string]$PluginName = "powerbi-modeling-codex"
)

$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $scriptDir 'plugin-install-common.ps1')

$pluginRoot = Resolve-Path (Join-Path $scriptDir '..')
$destinationPluginPath = Join-Path $PluginParent $PluginName
$sourceSkillsRoot = Join-Path $pluginRoot 'skills'
$marketplaceSourcePath = "./plugins/$PluginName"

Remove-PluginInstall `
    -DestinationPluginPath $destinationPluginPath `
    -MarketplacePath $MarketplacePath `
    -PluginName $PluginName `
    -MarketplaceSourcePath $marketplaceSourcePath

$removedSkillPaths = Remove-BundledSkills -SourceSkillsRoot $sourceSkillsRoot -DestinationSkillParent $SkillParent

Write-Host "Removed plugin folder if present: $destinationPluginPath"
Write-Host "Removed bundled standalone skill folders if present:"
$removedSkillPaths | ForEach-Object { Write-Host " - $_" }
Write-Host "Removed marketplace entries for: $PluginName"
Write-Host "Updated marketplace: $MarketplacePath"
