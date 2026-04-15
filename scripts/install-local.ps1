param(
    [string]$PluginParent = "$HOME\plugins",
    [string]$MarketplacePath = "$HOME\.agents\plugins\marketplace.json",
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir '..')
$sourcePluginPath = $repoRoot.Path
$pluginManifestPath = Join-Path $sourcePluginPath '.codex-plugin\plugin.json'

if (-not (Test-Path -LiteralPath $pluginManifestPath)) {
    throw "Plugin manifest not found at $pluginManifestPath"
}

$pluginManifest = Get-Content $pluginManifestPath -Raw | ConvertFrom-Json
$pluginName = $pluginManifest.name
if (-not $pluginName) {
    throw 'Plugin name missing in plugin.json'
}

$destinationPluginPath = Join-Path $PluginParent $pluginName

if (Test-Path -LiteralPath $destinationPluginPath) {
    if (-not $Force) {
        throw "Destination exists: $destinationPluginPath. Re-run with -Force to overwrite."
    }

    Remove-Item -LiteralPath $destinationPluginPath -Recurse -Force
}

New-Item -ItemType Directory -Path $PluginParent -Force | Out-Null
New-Item -ItemType Directory -Path $destinationPluginPath -Force | Out-Null
Copy-Item -Path (Join-Path $sourcePluginPath '*') -Destination $destinationPluginPath -Recurse -Force

$marketplaceDir = Split-Path -Parent $MarketplacePath
New-Item -ItemType Directory -Path $marketplaceDir -Force | Out-Null

if (Test-Path -LiteralPath $MarketplacePath) {
    $marketplace = Get-Content $MarketplacePath -Raw | ConvertFrom-Json
} else {
    $marketplace = [ordered]@{
        name = 'local-kb461vt-marketplace'
        interface = @{ displayName = 'KB461VT Local Plugins' }
        plugins = @()
    }
}

if (-not $marketplace.plugins) {
    $marketplace | Add-Member -NotePropertyName plugins -NotePropertyValue @()
}

$entry = [ordered]@{
    name = $pluginName
    source = [ordered]@{
        source = 'local'
        path = "./plugins/$pluginName"
    }
    policy = [ordered]@{
        installation = 'AVAILABLE'
        authentication = 'ON_INSTALL'
    }
    category = 'Productivity'
}

$existingIndex = -1
for ($i = 0; $i -lt $marketplace.plugins.Count; $i++) {
    if ($marketplace.plugins[$i].name -eq $pluginName) {
        $existingIndex = $i
        break
    }
}

if ($existingIndex -ge 0) {
    $marketplace.plugins[$existingIndex] = $entry
} else {
    $marketplace.plugins += $entry
}

$marketplace | ConvertTo-Json -Depth 10 | Set-Content -Path $MarketplacePath -Encoding UTF8

Write-Host "Installed plugin to: $destinationPluginPath"
Write-Host "Updated marketplace: $MarketplacePath"
Write-Host 'Restart Codex desktop to load the plugin.'
