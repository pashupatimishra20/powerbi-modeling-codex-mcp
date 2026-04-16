function New-DefaultMarketplace {
    return [pscustomobject][ordered]@{
        name = 'local-kb461vt-marketplace'
        interface = [pscustomobject][ordered]@{
            displayName = 'KB461VT Local Plugins'
        }
        plugins = @()
    }
}

function Get-PluginManifestInfo {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PluginRoot
    )

    $pluginManifestPath = Join-Path $PluginRoot '.codex-plugin\plugin.json'
    if (-not (Test-Path -LiteralPath $pluginManifestPath)) {
        throw "Plugin manifest not found at $pluginManifestPath"
    }

    $pluginManifest = Get-Content $pluginManifestPath -Raw | ConvertFrom-Json
    if (-not $pluginManifest.name) {
        throw 'Plugin name missing in plugin.json'
    }

    return [ordered]@{
        Manifest = $pluginManifest
        PluginName = [string]$pluginManifest.name
        MarketplaceSourcePath = "./plugins/$($pluginManifest.name)"
    }
}

function Read-Marketplace {
    param(
        [Parameter(Mandatory = $true)]
        [string]$MarketplacePath
    )

    if (-not (Test-Path -LiteralPath $MarketplacePath)) {
        return New-DefaultMarketplace
    }

    $marketplace = Get-Content $MarketplacePath -Raw | ConvertFrom-Json

    if (-not ($marketplace.PSObject.Properties.Name -contains 'plugins')) {
        $marketplace | Add-Member -NotePropertyName plugins -NotePropertyValue @()
    }

    if (-not ($marketplace.PSObject.Properties.Name -contains 'interface')) {
        $marketplace | Add-Member -NotePropertyName interface -NotePropertyValue ([ordered]@{ displayName = 'KB461VT Local Plugins' })
    }

    return $marketplace
}

function Write-Marketplace {
    param(
        [Parameter(Mandatory = $true)]
        [string]$MarketplacePath,
        [Parameter(Mandatory = $true)]
        [object]$Marketplace
    )

    $marketplaceDir = Split-Path -Parent $MarketplacePath
    if ($marketplaceDir) {
        New-Item -ItemType Directory -Path $marketplaceDir -Force | Out-Null
    }

    $Marketplace | ConvertTo-Json -Depth 10 | Set-Content -Path $MarketplacePath -Encoding UTF8
}

function Remove-PluginMarketplaceEntries {
    param(
        [Parameter(Mandatory = $true)]
        [object]$Marketplace,
        [Parameter(Mandatory = $true)]
        [string]$PluginName,
        [Parameter(Mandatory = $true)]
        [string]$MarketplaceSourcePath
    )

    $filteredPlugins = @(
        @($Marketplace.plugins) | Where-Object {
            $entryName = if ($_.PSObject.Properties.Name -contains 'name') { [string]$_.name } else { '' }
            $entrySource = if (
                $_.PSObject.Properties.Name -contains 'source' -and
                $_.source -and
                $_.source.PSObject.Properties.Name -contains 'path'
            ) {
                [string]$_.source.path
            } else {
                ''
            }

            $entryName -ne $PluginName -and $entrySource -ne $MarketplaceSourcePath
        }
    )

    $Marketplace.plugins = $filteredPlugins
    return $Marketplace
}

function New-PluginMarketplaceEntry {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PluginName,
        [Parameter(Mandatory = $true)]
        [string]$MarketplaceSourcePath
    )

    return [pscustomobject][ordered]@{
        name = $PluginName
        source = [pscustomobject][ordered]@{
            source = 'local'
            path = $MarketplaceSourcePath
        }
        policy = [pscustomobject][ordered]@{
            installation = 'AVAILABLE'
            authentication = 'ON_INSTALL'
        }
        category = 'Productivity'
    }
}

function Set-PluginMarketplaceEntry {
    param(
        [Parameter(Mandatory = $true)]
        [object]$Marketplace,
        [Parameter(Mandatory = $true)]
        [string]$PluginName,
        [Parameter(Mandatory = $true)]
        [string]$MarketplaceSourcePath
    )

    $Marketplace = Remove-PluginMarketplaceEntries -Marketplace $Marketplace -PluginName $PluginName -MarketplaceSourcePath $MarketplaceSourcePath
    $Marketplace.plugins = @($Marketplace.plugins) + @(New-PluginMarketplaceEntry -PluginName $PluginName -MarketplaceSourcePath $MarketplaceSourcePath)
    return $Marketplace
}

function Remove-PluginInstall {
    param(
        [Parameter(Mandatory = $true)]
        [string]$DestinationPluginPath,
        [Parameter(Mandatory = $true)]
        [string]$MarketplacePath,
        [Parameter(Mandatory = $true)]
        [string]$PluginName,
        [Parameter(Mandatory = $true)]
        [string]$MarketplaceSourcePath
)

    if (Test-Path -LiteralPath $DestinationPluginPath) {
        Remove-Item -LiteralPath $DestinationPluginPath -Recurse -Force
    }

    $marketplaceExisted = Test-Path -LiteralPath $MarketplacePath
    $marketplace = Read-Marketplace -MarketplacePath $MarketplacePath
    $marketplace = Remove-PluginMarketplaceEntries -Marketplace $marketplace -PluginName $PluginName -MarketplaceSourcePath $MarketplaceSourcePath
    if ($marketplaceExisted -or @($marketplace.plugins).Count -gt 0) {
        Write-Marketplace -MarketplacePath $MarketplacePath -Marketplace $marketplace
    }
}

function Test-SameResolvedPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PathA,
        [Parameter(Mandatory = $true)]
        [string]$PathB
    )

    $fullA = [System.IO.Path]::GetFullPath($PathA).TrimEnd('\')
    $fullB = [System.IO.Path]::GetFullPath($PathB).TrimEnd('\')
    return $fullA -eq $fullB
}
