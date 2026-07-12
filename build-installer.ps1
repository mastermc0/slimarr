# build-installer.ps1 - Build the Slimarr Windows installer
# Output: dist/installer/SlimarrSetup-1.8.0.0.exe
#
# Prerequisites (install once):
#   pip install pyinstaller -r requirements-tray.txt   (in your venv)
#   winget install JRSoftware.InnoSetup   (or https://jrsoftware.org/isdl.php)
#
# Usage:
#   .\build-installer.ps1
#   .\build-installer.ps1 -SkipFrontend    # skip npm build if already built
#   .\build-installer.ps1 -SkipPyInstaller # skip PyInstaller if already built

param(
    [switch]$SkipFrontend,
    [switch]$SkipPyInstaller
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

function Write-Step($n, $msg) {
    Write-Host ""
    Write-Host "  [$n] $msg" -ForegroundColor Cyan
}
function Write-Ok($msg)  { Write-Host "      OK: $msg" -ForegroundColor Green }
function Write-Err($msg) { Write-Host "      ERROR: $msg" -ForegroundColor Red; exit 1 }
function Test-FrontendManifest() {
    $indexPath = "$Root\frontend\dist\index.html"
    if (-not (Test-Path $indexPath)) {
        Write-Err "frontend/dist/index.html not found"
    }

    $html = Get-Content $indexPath -Raw
    $assetRefs = [regex]::Matches($html, '(?:src|href)="(/assets/[^"]+)"')
    $missing = @()
    foreach ($match in $assetRefs) {
        $asset = $match.Groups[1].Value.TrimStart("/")
        $assetPath = Join-Path "$Root\frontend\dist" $asset
        if (-not (Test-Path $assetPath)) {
            $missing += $asset
        }
    }

    if ($missing.Count -gt 0) {
        Write-Err "frontend/dist references missing asset(s): $($missing -join ', ')"
    }
    Write-Ok "frontend/dist asset manifest verified ($($assetRefs.Count) asset reference(s))"
}
function Test-BundleManifest() {
    $bundleRoot = "$Root\dist\Slimarr"
    $resourceRoot = "$bundleRoot"
    if (Test-Path "$bundleRoot\_internal") {
        $resourceRoot = "$bundleRoot\_internal"
    }

    $required = @(
        "$bundleRoot\Slimarr.exe",
        "$resourceRoot\frontend\dist\index.html",
        "$resourceRoot\frontend\dist\assets",
        "$resourceRoot\images\icon.PNG",
        "$resourceRoot\config.yaml.example"
    )

    $missing = @()
    foreach ($path in $required) {
        if (-not (Test-Path $path)) {
            $missing += $path.Replace("$Root\", "")
        }
    }

    if ($missing.Count -gt 0) {
        Write-Err "PyInstaller bundle is missing required file(s): $($missing -join ', ')"
    }
    Write-Ok "PyInstaller bundle resources verified"
}

function New-InstallerStartScript() {
    $startBatPath = "$Root\dist\Slimarr\start.bat"
    # IMPORTANT: Use single-quote here-string @'...'@ so that PowerShell does NOT
    # interpolate $deadline, $resp, etc. — those are PowerShell variables INSIDE the
    # bat file that must remain literal and be evaluated by the child powershell.exe.
    @'
@echo off
setlocal

cd /d "%~dp0"

if not exist "Slimarr.exe" (
  echo.
  echo [ERROR] Slimarr.exe was not found in this folder.
  echo.
  pause
  exit /b 1
)

set "SLIMARR_NO_AUTO_BROWSER=1"
start "Slimarr" /min "Slimarr.exe" --tray

echo Waiting for Slimarr to start (up to 60 seconds)...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$deadline=(Get-Date).AddSeconds(60);" ^
  "while ((Get-Date) -lt $deadline) {" ^
  "  try {" ^
  "    $r=Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:9494/api/v1/system/health' -TimeoutSec 2;" ^
  "    if ($r.StatusCode -ge 200) { Start-Process 'http://localhost:9494'; exit 0 }" ^
  "  } catch {}" ^
  "  Start-Sleep -Milliseconds 500" ^
  "};" ^
  "Start-Process 'http://localhost:9494'"
exit /b 0
'@ | Set-Content -Path $startBatPath -Encoding ASCII
    Write-Ok "Installer launcher created (dist/Slimarr/start.bat)"
}

Write-Host ""
Write-Host "  +-------------------------------------+" -ForegroundColor Green
Write-Host "  |  Slimarr Installer Builder v1.8.0  |" -ForegroundColor Green
Write-Host "  +-------------------------------------+" -ForegroundColor Green

# ---- 0. Sanity checks -------------------------------------------------------
Write-Step "0" "Checking prerequisites"

$Python = "$Root\venv\Scripts\python.exe"
if (-not (Test-Path $Python)) { Write-Err "venv not found. Run install.ps1 first." }
Write-Ok "Python venv: $Python"

$PyInstaller = "$Root\venv\Scripts\pyinstaller.exe"
if (-not (Test-Path $PyInstaller)) {
    Write-Host "      Installing PyInstaller..." -ForegroundColor Yellow
    & "$Root\venv\Scripts\pip.exe" install pyinstaller --quiet
}
Write-Ok "PyInstaller: found"

$ISSPaths = @(
    "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
    "${env:ProgramFiles}\Inno Setup 6\ISCC.exe",
    "${env:ProgramFiles(x86)}\Inno Setup 7\ISCC.exe",
    "${env:ProgramFiles}\Inno Setup 7\ISCC.exe",
    "ISCC.exe"
)
$ISCC = $null
foreach ($p in $ISSPaths) {
    try { if (Test-Path $p -ErrorAction Stop) { $ISCC = $p; break } } catch {}
    try { if (Get-Command $p -ErrorAction Stop) { $ISCC = $p; break } } catch {}
}
if (-not $ISCC) {
    Write-Err "Inno Setup 6 or 7 not found. Install from: https://jrsoftware.org/isdl.php or run: winget install JRSoftware.InnoSetup"
}
Write-Ok "Inno Setup: $ISCC"

# ---- 1. Convert icon PNG -> ICO --------------------------------------------
Write-Step "1" "Creating Windows icon (icon.ico)"
& $Python "$Root\scripts\build_icon.py" "$Root"
if ($LASTEXITCODE -ne 0) { Write-Err "Icon conversion failed" }
Write-Ok "images/icon.ico created"

# ---- 2. Verify config.yaml.example ------------------------------------------
# config.yaml.example is a source-controlled, hand-maintained file (kept in
# sync with backend/config.py defaults). It used to be regenerated here from a
# hardcoded copy embedded in this script, which silently went stale and once
# overwrote real NAS-safety settings with old defaults (including flipping
# enable_media_probe back to true). Verify it exists instead of duplicating it.
Write-Step "2" "Verifying config.yaml.example"
if (-not (Test-Path "$Root\config.yaml.example")) {
    Write-Err "config.yaml.example not found in repo root - this file should be source-controlled, not generated."
}
Write-Ok "config.yaml.example present (source-controlled)"

# ---- 3. Build frontend ------------------------------------------------------
if (-not $SkipFrontend) {
    Write-Step "3" "Building frontend (npm run build)"
    Push-Location "$Root\frontend"
    npm run build
    Pop-Location
    if ($LASTEXITCODE -ne 0) { Write-Err "npm build failed" }
    Write-Ok "frontend/dist built"
} else {
    Write-Step "3" "Skipping frontend build (-SkipFrontend)"
}
Test-FrontendManifest

# ---- 4. PyInstaller ---------------------------------------------------------
if (-not $SkipPyInstaller) {
    Write-Step "4" "Running PyInstaller (this takes 2-5 minutes)"
    if (Test-Path "$Root\dist\Slimarr") { Remove-Item "$Root\dist\Slimarr" -Recurse -Force }
    $pyArgs = @(
        "$Root\slimarr.spec",
        "--distpath", "$Root\dist",
        "--workpath", "$Root\build\pyinstaller",
        "--noconfirm"
    )
    $pyProc = Start-Process -FilePath $PyInstaller -ArgumentList $pyArgs -NoNewWindow -Wait -PassThru
    if ($pyProc.ExitCode -ne 0) { Write-Err "PyInstaller failed with exit code $($pyProc.ExitCode)" }
    # PyInstaller may exit non-zero due to warnings even on a successful build; verify output instead.
    if (-not (Test-Path "$Root\dist\Slimarr\Slimarr.exe")) { Write-Err "PyInstaller failed - Slimarr.exe not produced" }
    Write-Ok "dist/Slimarr/ created"
} else {
    Write-Step "4" "Skipping PyInstaller (-SkipPyInstaller)"
    if (-not (Test-Path "$Root\dist\Slimarr\Slimarr.exe")) {
        Write-Err "dist/Slimarr/Slimarr.exe not found - build with PyInstaller first"
    }
}
New-InstallerStartScript
Test-BundleManifest

# ---- 5. Inno Setup ----------------------------------------------------------
Write-Step "5" "Building installer with Inno Setup"
New-Item -ItemType Directory -Path "$Root\dist\installer" -Force | Out-Null
$isccProc = Start-Process -FilePath $ISCC -ArgumentList @("$Root\installer\slimarr.iss") -NoNewWindow -Wait -PassThru
if ($isccProc.ExitCode -ne 0) { Write-Err "Inno Setup failed with exit code $($isccProc.ExitCode)" }

$installer = Get-ChildItem "$Root\dist\installer\SlimarrSetup*.exe" |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
Write-Ok "Installer: $($installer.FullName)"

# ---- Done -------------------------------------------------------------------
Write-Host ""
Write-Host "  Build complete!" -ForegroundColor Green
Write-Host "  Installer: dist\installer\$($installer.Name)" -ForegroundColor White
Write-Host ""
Write-Host "  Share SlimarrSetup-*.exe with others - they just run it." -ForegroundColor Gray
Write-Host ""
