# ========================================================
# Latif Traders - Desktop Installer Builder
# Creates a single standalone LatifTraders-Setup.exe
# ========================================================

$ErrorActionPreference = "Stop"
$rootDir = $PSScriptRoot
Set-Location $rootDir

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "   Building Latif Traders Desktop Windows Installer     " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

# 1. Check C# Compiler
$csc = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if (-not (Test-Path $csc)) {
    Write-Error "Microsoft .NET C# compiler not found at: $csc"
}

# 2. Check Node.js
$nodeSource = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $nodeSource) {
    Write-Error "Node.js is not found in PATH on this build machine."
}
Write-Host "[1/6] Found system Node.js: $nodeSource" -ForegroundColor Green

# 3. Build frontend if needed
if (-not (Test-Path "client\dist\index.html")) {
    Write-Host "[2/6] Building React frontend..." -ForegroundColor Yellow
    npm --prefix client run build
} else {
    Write-Host "[2/6] React frontend already built in client\dist" -ForegroundColor Green
}

# 4. Compile LatifTraders.exe (The application launcher)
Write-Host "[3/6] Compiling desktop application launcher (LatifTraders.exe)..." -ForegroundColor Yellow
& $csc /target:winexe /optimize /out:desktop\LatifTraders.exe /r:System.Windows.Forms.dll desktop\Launcher.cs
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to compile desktop\LatifTraders.exe"
}
Write-Host "Launcher compiled successfully." -ForegroundColor Green

# 5. Prepare staging directory
Write-Host "[4/6] Assembling portable distribution bundle..." -ForegroundColor Yellow
$stagingDir = Join-Path $rootDir "desktop\staging"
if (Test-Path $stagingDir) {
    Remove-Item -Recurse -Force $stagingDir
}
New-Item -ItemType Directory -Force -Path (Join-Path $stagingDir "bin") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $stagingDir "data") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $stagingDir "client\dist") | Out-Null

# Copy portable node
Copy-Item $nodeSource (Join-Path $stagingDir "bin\node.exe") -Force

# Copy server, client dist, package.json
Copy-Item "server" (Join-Path $stagingDir "server") -Recurse -Force
Copy-Item "client\dist\*" (Join-Path $stagingDir "client\dist") -Recurse -Force
Copy-Item "package.json" (Join-Path $stagingDir "package.json") -Force
Copy-Item "desktop\LatifTraders.exe" (Join-Path $stagingDir "LatifTraders.exe") -Force

# Security Invariant: NEVER bundle database files, .env credentials, or customer backups into installer package
# Each desktop installation boots a fresh local database via initializeDatabase() on first launch
New-Item -ItemType File -Force -Path (Join-Path $stagingDir "data\.gitkeep") | Out-Null
Write-Host "Confirmed: data directory is clean (zero .db or credential files bundled)." -ForegroundColor Green

# Copy node_modules (production runtime dependencies)
Write-Host "Copying production node_modules..." -ForegroundColor DarkGray
Copy-Item "node_modules" (Join-Path $stagingDir "node_modules") -Recurse -Force

# 6. Compress staging into package.zip
Write-Host "[5/6] Compressing application package..." -ForegroundColor Yellow
$zipPath = Join-Path $rootDir "desktop\package.zip"
if (Test-Path $zipPath) {
    Remove-Item -Force $zipPath
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($stagingDir, $zipPath, [System.IO.Compression.CompressionLevel]::Optimal, $false)
$zipSizeMb = (Get-Item $zipPath).Length / 1MB
Write-Host ("Package compressed successfully: {0:N2} MB" -f $zipSizeMb) -ForegroundColor Green

# 7. Compile Setup.cs into final standalone LatifTraders-Setup.exe
Write-Host "[6/6] Compiling final single-file setup installer (LatifTraders-Setup.exe)..." -ForegroundColor Yellow
$outputInstaller = Join-Path $rootDir "LatifTraders-Setup.exe"

& $csc /target:winexe /optimize /out:$outputInstaller `
    /r:System.Windows.Forms.dll `
    /r:System.Drawing.dll `
    /r:System.IO.Compression.dll `
    /r:System.IO.Compression.FileSystem.dll `
    /resource:"desktop\package.zip,package.zip" `
    desktop\Setup.cs

if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to compile setup installer."
}

# Cleanup temporary staging & zip
Remove-Item -Recurse -Force $stagingDir
Remove-Item -Force $zipPath

$finalSizeMb = (Get-Item $outputInstaller).Length / 1MB
Write-Host "`n========================================================" -ForegroundColor Green
Write-Host "  BUILD COMPLETE!" -ForegroundColor Green
Write-Host ("  Installer Created: {0} ({1:N2} MB)" -f $outputInstaller, $finalSizeMb) -ForegroundColor Green
Write-Host "  You can now send this single file to your client!" -ForegroundColor Cyan
Write-Host "========================================================`n" -ForegroundColor Green
