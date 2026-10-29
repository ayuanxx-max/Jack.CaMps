# dsh-session-accordion - Windows installer (PowerShell 5.1+ / 7+).
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts\install.ps1 [-Profile <name>] [-DryRun] [-Apply]
#
# Creates a junction in <profile>\node_modules and, with -Apply, patches the
# profile package.json (a backup is written first). Never copies the repo.

[CmdletBinding()]
param(
  [string]$Profile = $env:DSH_PROFILE,
  [switch]$DryRun,
  [switch]$Apply
)

$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$dshHome = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE '.dsh' }
$pkgName = 'dsh-session-accordion'

if (-not $Profile) {
  if (Test-Path (Join-Path $dshHome 'profiles\desktop')) { $Profile = 'desktop' }
  elseif (Test-Path (Join-Path $dshHome 'profiles\web')) { $Profile = 'web' }
  else { throw "cannot detect a DSH profile under $dshHome\profiles; pass -Profile <name>" }
}

$profileDir = Join-Path $dshHome "profiles\$Profile"
$pkgJson = Join-Path $profileDir 'package.json'
$nodeModules = Join-Path $profileDir 'node_modules'
$link = Join-Path $nodeModules $pkgName

if (-not (Test-Path $profileDir)) { throw "profile not found: $profileDir" }
if (-not (Test-Path $pkgJson)) { throw "package.json not found: $pkgJson" }

Write-Output "repo    : $repo"
Write-Output "profile : $Profile ($profileDir)"
Write-Output "link    : $link"

if ($DryRun) { Write-Output '-DryRun: nothing was changed'; return }

if (-not (Test-Path $nodeModules)) { New-Item -ItemType Directory -Path $nodeModules | Out-Null }
if (Test-Path $link) { Remove-Item $link -Recurse -Force }
New-Item -ItemType Junction -Path $link -Target $repo | Out-Null
Write-Output 'junction created'

if ($Apply) {
  Copy-Item $pkgJson "$pkgJson.bak-before-accordion" -Force
  $data = Get-Content $pkgJson -Raw | ConvertFrom-Json
  if (-not $data.dependencies) { $data | Add-Member -NotePropertyName dependencies -NotePropertyValue ([pscustomobject]@{}) }
  $data.dependencies | Add-Member -NotePropertyName $pkgName -NotePropertyValue ("link:" + $repo) -Force
  if (-not $data.dsh) { $data | Add-Member -NotePropertyName dsh -NotePropertyValue ([pscustomobject]@{}) }
  if (-not $data.dsh.profile) { $data.dsh | Add-Member -NotePropertyName profile -NotePropertyValue ([pscustomobject]@{}) }
  $bundles = @($data.dsh.profile.bundles) | Where-Object { $_ -and $_ -ne $pkgName }
  $data.dsh.profile | Add-Member -NotePropertyName bundles -NotePropertyValue (@($bundles) + $pkgName) -Force
  $json = $data | ConvertTo-Json -Depth 20
  # UTF-8 without BOM: a BOM makes package.json unreadable for node/pnpm on Linux and macOS.
  [IO.File]::WriteAllText($pkgJson, $json + "`n", (New-Object System.Text.UTF8Encoding($false)))
  Write-Output "package.json patched (backup: $pkgJson.bak-before-accordion)"
}

Write-Output @"

Next steps:
  1. If -Apply was not used, add to the profile package.json:
       dependencies:       "dsh-session-accordion": "link:<repo path>"
       dsh.profile.bundles: "dsh-session-accordion"
  2. Restart DSH completely.
  3. Settings -> Chat -> "When to collapse work details" = On completion.
  4. DevTools -> __acReport() for diagnostics.
"@
