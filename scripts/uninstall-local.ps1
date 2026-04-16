param(
    [string]$PluginParent = "$HOME\plugins",
    [string]$MarketplacePath = "$HOME\.agents\plugins\marketplace.json",
    [string]$PluginName = "powerbi-modeling-codex"
)

$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $scriptDir 'plugin-install-common.ps1')

$destinationPluginPath = Join-Path $PluginParent $PluginName
$marketplaceSourcePath = "./plugins/$PluginName"

Remove-PluginInstall `
    -DestinationPluginPath $destinationPluginPath `
    -MarketplacePath $MarketplacePath `
    -PluginName $PluginName `
    -MarketplaceSourcePath $marketplaceSourcePath

Write-Host "Removed plugin folder if present: $destinationPluginPath"
Write-Host "Removed marketplace entries for: $PluginName"
Write-Host "Updated marketplace: $MarketplacePath"
