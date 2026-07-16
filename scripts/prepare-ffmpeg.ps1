param(
  [switch]$Force
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$lock = Get-Content -Raw -Encoding UTF8 (Join-Path $PSScriptRoot 'ffmpeg-lock.json') | ConvertFrom-Json
$cache = Join-Path $root 'src-tauri\.cache\ffmpeg'
$archive = Join-Path $cache $lock.archiveName
$expanded = Join-Path $cache 'expanded'
$resources = Join-Path $root 'src-tauri\resources'
$destination = Join-Path $resources 'ffmpeg.exe'
$licenseDestination = Join-Path $resources 'FFMPEG_LICENSE.txt'

New-Item -ItemType Directory -Force -Path $cache, $resources | Out-Null

if ($Force -or -not (Test-Path -LiteralPath $archive)) {
  Invoke-WebRequest -Uri $lock.url -OutFile $archive
}

function Get-Sha256Hex([string]$Path) {
  $stream = [System.IO.File]::OpenRead($Path)
  $sha256 = [System.Security.Cryptography.SHA256]::Create()
  try {
    return -join ($sha256.ComputeHash($stream) | ForEach-Object { $_.ToString('x2') })
  } finally {
    $sha256.Dispose()
    $stream.Dispose()
  }
}

$actualHash = Get-Sha256Hex $archive
if ($actualHash -ne $lock.sha256) {
  throw "FFmpeg archive checksum mismatch. Expected $($lock.sha256), got $actualHash."
}

if ($Force -or -not (Test-Path -LiteralPath $destination)) {
  if (Test-Path -LiteralPath $expanded) {
    Remove-Item -LiteralPath $expanded -Recurse -Force
  }
  Expand-Archive -LiteralPath $archive -DestinationPath $expanded
  $ffmpeg = Get-ChildItem -LiteralPath $expanded -Recurse -Filter 'ffmpeg.exe' | Select-Object -First 1
  if (-not $ffmpeg) {
    throw 'The pinned archive does not contain ffmpeg.exe.'
  }
  Copy-Item -LiteralPath $ffmpeg.FullName -Destination $destination -Force

  $license = Get-ChildItem -LiteralPath $expanded -Recurse -File |
    Where-Object { $_.Name -in @('LICENSE.txt', 'COPYING.LGPLv2.1', 'COPYING.LGPLv3') } |
    Select-Object -First 1
  if ($license) {
    Copy-Item -LiteralPath $license.FullName -Destination $licenseDestination -Force
  } else {
    @(
      'FFmpeg is licensed under the GNU Lesser General Public License (LGPL).',
      'License text: https://www.gnu.org/licenses/old-licenses/lgpl-2.1.txt',
      "Corresponding source: $($lock.sourceUrl)",
      "Build scripts: $($lock.buildSource)"
    ) | Set-Content -Encoding UTF8 -LiteralPath $licenseDestination
  }
}

function Invoke-FfmpegProbe([string]$Argument) {
  $stdout = Join-Path $cache 'probe.stdout.txt'
  $stderr = Join-Path $cache 'probe.stderr.txt'
  $process = Start-Process -FilePath $destination -ArgumentList $Argument -NoNewWindow -Wait -PassThru `
    -RedirectStandardOutput $stdout -RedirectStandardError $stderr
  return [pscustomobject]@{
    ExitCode = $process.ExitCode
    Output = ((Get-Content -Raw -ErrorAction SilentlyContinue $stdout) + (Get-Content -Raw -ErrorAction SilentlyContinue $stderr))
  }
}

$versionProbe = Invoke-FfmpegProbe '-version'
if ($versionProbe.ExitCode -ne 0 -or $versionProbe.Output -notmatch 'ffmpeg version n?8\.1\.2') {
  throw 'The staged FFmpeg executable is not the pinned 8.1.2 release.'
}
$buildProbe = Invoke-FfmpegProbe '-buildconf'
if ($buildProbe.ExitCode -ne 0 -or $buildProbe.Output -match '--enable-(gpl|nonfree)') {
  throw 'The staged FFmpeg executable is not an LGPL-compatible build.'
}

Write-Host "Prepared FFmpeg $($lock.version) at $destination"
