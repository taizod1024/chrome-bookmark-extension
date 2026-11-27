$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$package = Get-Content -Raw (Join-Path $repoRoot "package.json") | ConvertFrom-Json
$archiveName = "$($package.name)-$($package.version).zip"
$archivePath = Join-Path $repoRoot $archiveName
$extensionPath = Join-Path $repoRoot "extension\*"

Compress-Archive -Path $extensionPath -DestinationPath $archivePath -Force
Write-Output "Created $archiveName"
