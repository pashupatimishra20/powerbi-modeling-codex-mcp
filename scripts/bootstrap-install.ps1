param(
    [string]$RepoOwner = "pashupatimishra20",
    [string]$RepoName = "powerbi-modeling-codex-mcp",
    [string]$Ref = "main",
    [string]$PluginParent = "$HOME\plugins",
    [string]$MarketplacePath = "$HOME\.agents\plugins\marketplace.json",
    [switch]$Force,
    [switch]$KeepTemp
)

$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host "[bootstrap] $Message"
}

$zipUrl = "https://github.com/$RepoOwner/$RepoName/archive/refs/heads/$Ref.zip"
$tempRoot = Join-Path $env:TEMP ("pbi-codex-bootstrap-" + [Guid]::NewGuid().ToString("N"))
$zipPath = Join-Path $tempRoot "repo.zip"

New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null

try {
    Write-Step "Downloading $zipUrl"
    try {
        Invoke-WebRequest -Uri $zipUrl -OutFile $zipPath -UseBasicParsing
    }
    catch {
        Write-Step "Direct download failed. Trying GitHub CLI archive fallback."
        if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
            throw "Failed to download $zipUrl and GitHub CLI is not available."
        }

        $token = (& gh auth token).Trim()
        if (-not $token) {
            throw "GitHub CLI is available but no auth token was returned."
        }

        $headers = @{
            Authorization = "Bearer $token"
            "User-Agent" = "powerbi-modeling-codex-bootstrap"
        }

        Invoke-WebRequest -Uri "https://api.github.com/repos/$RepoOwner/$RepoName/zipball/$Ref" -Headers $headers -OutFile $zipPath -UseBasicParsing

        if (-not (Test-Path -LiteralPath $zipPath)) {
            throw "GitHub CLI archive fallback failed to create $zipPath."
        }
    }

    Write-Step "Extracting package"
    try {
        Expand-Archive -Path $zipPath -DestinationPath $tempRoot -Force
    }
    catch {
        throw "Failed to extract bootstrap package: $($_.Exception.Message)"
    }

    $installScript = Get-ChildItem -Path $tempRoot -Recurse -File -Filter "install-local.ps1" |
        Where-Object { $_.FullName -like "*\scripts\install-local.ps1" } |
        Select-Object -First 1 -ExpandProperty FullName

    if (-not $installScript) {
        throw "install-local.ps1 not found in extracted repo."
    }

    Write-Step "Running clean local installer"
    $installArgs = @{
        PluginParent = $PluginParent
        MarketplacePath = $MarketplacePath
    }
    if ($Force) {
        $installArgs.Force = $true
    }

    try {
        & $installScript @installArgs
        if ($LASTEXITCODE -ne 0) {
            throw "install-local.ps1 exited with code $LASTEXITCODE"
        }
    }
    catch {
        throw "Clean install failed: $($_.Exception.Message)"
    }

    Write-Step "Done. Restart Codex desktop to load the plugin into session context."
}
finally {
    if (-not $KeepTemp -and (Test-Path -LiteralPath $tempRoot)) {
        Remove-Item -LiteralPath $tempRoot -Recurse -Force
    }
}
