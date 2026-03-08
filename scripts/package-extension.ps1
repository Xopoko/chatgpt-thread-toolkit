param(
  [string]$OutputPath
)

$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path -Parent $PSScriptRoot
$ExtensionDir = Join-Path $RepoRoot 'extension'
$ManifestPath = Join-Path $ExtensionDir 'manifest.json'

if (-not (Test-Path $ManifestPath)) {
  throw "Could not find manifest.json at $ManifestPath"
}

$Manifest = Get-Content $ManifestPath -Raw | ConvertFrom-Json
if (-not $OutputPath) {
  $OutputDir = Join-Path $RepoRoot 'output'
  New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
  $OutputPath = Join-Path $OutputDir ("chatgpt-thread-toolkit-extension-v{0}.zip" -f $Manifest.version)
}

$ResolvedOutputPath = [System.IO.Path]::GetFullPath($OutputPath)
$ResolvedOutputDir = Split-Path -Parent $ResolvedOutputPath
New-Item -ItemType Directory -Force -Path $ResolvedOutputDir | Out-Null

$StagingDir = Join-Path ([System.IO.Path]::GetTempPath()) ("chatgpt-thread-toolkit-extension-" + [System.Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $StagingDir | Out-Null

try {
  Copy-Item -Path (Join-Path $ExtensionDir '*') -Destination $StagingDir -Recurse -Force

  if (Test-Path $ResolvedOutputPath) {
    Remove-Item $ResolvedOutputPath -Force
  }

  Compress-Archive -Path (Join-Path $StagingDir '*') -DestinationPath $ResolvedOutputPath -Force
  Write-Output $ResolvedOutputPath
}
finally {
  if (Test-Path $StagingDir) {
    Remove-Item $StagingDir -Force -Recurse
  }
}
