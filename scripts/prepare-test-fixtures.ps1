param(
  [string]$OutputDirectory = "e2e/fixtures/generated"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$ffmpeg = Join-Path $root "src-tauri/resources/ffmpeg.exe"
$output = Join-Path $root $OutputDirectory

if (-not (Test-Path -LiteralPath $ffmpeg -PathType Leaf)) {
  throw "Bundled FFmpeg is missing. Run npm run ffmpeg:prepare first."
}

New-Item -ItemType Directory -Force -Path $output | Out-Null
$sample = Join-Path $output "sample.wav"
& $ffmpeg -hide_banner -loglevel error -y -f lavfi -i "sine=frequency=440:duration=2" -c:a pcm_s16le $sample
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $sample -PathType Leaf)) {
  throw "Failed to generate the E2E WAV fixture."
}

[System.IO.File]::WriteAllBytes((Join-Path $output "corrupt.mp3"), [byte[]](0x49, 0x44, 0x33, 0x00, 0xff, 0x00))
Write-Host "Prepared E2E fixtures in $output"
