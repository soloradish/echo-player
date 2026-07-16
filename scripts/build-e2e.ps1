$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$source = Join-Path $root "e2e/capabilities/e2e.json"
$generated = Join-Path $root "src-tauri/capabilities/e2e.generated.json"
$tauri = Join-Path $root "node_modules/.bin/tauri.cmd"

if (-not (Test-Path -LiteralPath $tauri -PathType Leaf)) {
  throw "Tauri CLI is not installed. Run npm ci first."
}

try {
  Copy-Item -LiteralPath $source -Destination $generated -Force
  $env:VITE_E2E = "1"
  if (-not $env:CARGO_TARGET_DIR) {
    $env:CARGO_TARGET_DIR = Join-Path $root ".e2e-target"
  }
  & $tauri build --debug --no-bundle --features e2e --config src-tauri/tauri.e2e.conf.json
  if ($LASTEXITCODE -ne 0) {
    throw "Tauri E2E build failed with exit code $LASTEXITCODE."
  }
} finally {
  Remove-Item -LiteralPath $generated -Force -ErrorAction SilentlyContinue
}
