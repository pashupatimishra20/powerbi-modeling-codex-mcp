param(
    [string]$PluginParent = "$HOME\plugins",
    [string]$MarketplacePath = "$HOME\.agents\plugins\marketplace.json",
    [string]$SkillParent = $(if ($env:CODEX_HOME) { Join-Path $env:CODEX_HOME 'skills' } else { Join-Path (Join-Path $HOME '.codex') 'skills' }),
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $scriptDir 'plugin-install-common.ps1')

$repoRoot = Resolve-Path (Join-Path $scriptDir '..')
$sourcePluginPath = $repoRoot.Path
$pluginInfo = Get-PluginManifestInfo -PluginRoot $sourcePluginPath
$pluginName = $pluginInfo.PluginName
$marketplaceSourcePath = $pluginInfo.MarketplaceSourcePath
$destinationPluginPath = Join-Path $PluginParent $pluginName
$standaloneSkillName = 'powerbi-modeling-mcp'
$sourceSkillPath = Join-Path $sourcePluginPath "skills\$standaloneSkillName"
$destinationSkillPath = Join-Path $SkillParent $standaloneSkillName
$installInPlace = Test-SameResolvedPath -PathA $sourcePluginPath -PathB $destinationPluginPath

if ($Force) {
    Write-Host "Compatibility note: -Force is accepted but no longer required. This installer now performs a clean reinstall by default."
}

if (-not (Test-Path -LiteralPath $sourceSkillPath)) {
    throw "Standalone skill source not found at $sourceSkillPath"
}

if ($installInPlace) {
    Write-Host "Source path already matches install target. Skipping folder replacement and refreshing the install in place."
} else {
    Remove-PluginInstall `
        -DestinationPluginPath $destinationPluginPath `
        -MarketplacePath $MarketplacePath `
        -PluginName $pluginName `
        -MarketplaceSourcePath $marketplaceSourcePath

    New-Item -ItemType Directory -Path $PluginParent -Force | Out-Null
    Copy-DirectoryChildren `
        -SourcePath $sourcePluginPath `
        -DestinationPath $destinationPluginPath `
        -ExcludeNames @('.git', 'node_modules')
}

$workingPluginPath = if ($installInPlace) { $sourcePluginPath } else { $destinationPluginPath }
$packageJsonPath = Join-Path $workingPluginPath 'package.json'
if (Test-Path -LiteralPath $packageJsonPath) {
    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
        throw "npm is required to install the local PBIR report authoring server dependencies."
    }

    Write-Host "Installing Node dependencies in: $workingPluginPath"
    Push-Location $workingPluginPath
    try {
        & npm install --omit=dev
        if ($LASTEXITCODE -ne 0) {
            throw "npm install failed with exit code $LASTEXITCODE"
        }
    }
    finally {
        Pop-Location
    }
}

Remove-InstalledPath -Path $destinationSkillPath
New-Item -ItemType Directory -Path $SkillParent -Force | Out-Null
Copy-DirectoryChildren -SourcePath $sourceSkillPath -DestinationPath $destinationSkillPath

$marketplace = Read-Marketplace -MarketplacePath $MarketplacePath
$marketplace = Set-PluginMarketplaceEntry -Marketplace $marketplace -PluginName $pluginName -MarketplaceSourcePath $marketplaceSourcePath
Write-Marketplace -MarketplacePath $MarketplacePath -Marketplace $marketplace

Write-Host "Installed plugin path: $workingPluginPath"
Write-Host "Installed standalone skill path: $destinationSkillPath"
Write-Host "Updated marketplace: $MarketplacePath"
Write-Host "Marketplace source path: $marketplaceSourcePath"
Write-Host 'Restart Codex desktop to load the plugin and standalone skill into session context.'
