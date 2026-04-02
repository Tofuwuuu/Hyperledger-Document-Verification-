$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$workdir = Join-Path $root "fabric-network"

Push-Location $workdir

Write-Host "Stopping Fabric services..." -ForegroundColor Cyan
docker compose -f docker-compose-fabric.yml down --remove-orphans

Write-Host "Done." -ForegroundColor Green

Pop-Location

