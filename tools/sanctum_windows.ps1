#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Sanctum Windows Launcher & Packager.
.DESCRIPTION
    Provides the Windows native interface to the Sanctum on-device platform.
    Runs the confined runtime inside WSL2 with seamless loopback forwarding,
    or launches the browser frontend directly against the local gateway.
#>

param(
    [switch]$Package,
    [switch]$Run,
    [string]$Config = "profiles/runtime-cpu.json"
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$RootDir = Split-Path -Parent $ScriptDir
$DistDir = Join-Path $RootDir "dist"

if ($Package) {
    Write-Host "=== Packaging Sanctum Windows Distribution ===" -ForegroundColor Cyan
    if (-not (Test-Path $DistDir)) { New-Item -ItemType Directory -Path $DistDir | Out-Null }
    
    $PkgDir = Join-Path $DistDir "sanctum-windows-x64"
    if (Test-Path $PkgDir) { Remove-Item -Recurse -Force $PkgDir }
    New-Item -ItemType Directory -Path (Join-Path $PkgDir "bin") | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $PkgDir "web") | Out-Null
    
    # Copy web assets
    $WebDist = Join-Path $RootDir "apps/web/dist"
    if (Test-Path $WebDist) {
        Copy-Item -Recurse -Force "$WebDist/*" (Join-Path $PkgDir "web")
    }
    
    # Copy launcher script
    Copy-Item -Force $MyInvocation.MyCommand.Definition (Join-Path $PkgDir "bin/sanctum.ps1")
    Copy-Item -Force (Join-Path $RootDir "LICENSE") $PkgDir
    Copy-Item -Force (Join-Path $RootDir "THIRD_PARTY_NOTICES.md") $PkgDir
    
    # Archive
    $ZipPath = Join-Path $DistDir "sanctum-windows-x64.zip"
    if (Test-Path $ZipPath) { Remove-Item -Force $ZipPath }
    Compress-Archive -Path "$PkgDir/*" -DestinationPath $ZipPath
    $Hash = (Get-FileHash -Algorithm SHA256 $ZipPath).Hash.ToLower()
    Set-Content -Path "$ZipPath.sha256" -Value "$Hash  sanctum-windows-x64.zip"
    
    Write-Host "Windows package created at: $ZipPath" -ForegroundColor Green
    Write-Host "SHA256: $Hash"
    exit 0
}

if ($Run) {
    Write-Host "=== Launching Sanctum Windows WSL2 Gateway ===" -ForegroundColor Cyan
    wsl -e bash -c "cd '$RootDir' && bin/sanctum-runtime --config '$Config'"
} else {
    Write-Host "Sanctum Windows Launcher. Use -Run to start the local daemon or -Package to create distributable archive."
}
