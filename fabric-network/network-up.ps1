Param(
  [string]$ChannelName = "alumni-channel"
)

$ErrorActionPreference = "Stop"

function Assert-LastExitCode([string]$Step) {
  if ($LASTEXITCODE -ne 0) {
    throw "Step failed ($Step). Exit code: $LASTEXITCODE"
  }
}

function Assert-DockerRunning {
  docker info *> $null
}

function Ensure-ExternalNetwork {
  $netName = "cvsu_alumni_blockchain_network"
  $exists = docker network ls --format "{{.Name}}" | Select-String -SimpleMatch $netName
  if (-not $exists) {
    Write-Host "Creating external docker network $netName"
    docker network create $netName *> $null
  }
}

function New-CleanDir([string]$Path) {
  if (Test-Path $Path) { Remove-Item -Recurse -Force $Path }
  New-Item -ItemType Directory -Path $Path | Out-Null
}

function Remove-CleanDir([string]$Path) {
  if (Test-Path $Path) { Remove-Item -Recurse -Force $Path }
}

Write-Host "Starting Hyperledger Fabric network (Docker)..." -ForegroundColor Cyan

Assert-DockerRunning
Ensure-ExternalNetwork

$root = Split-Path -Parent $PSScriptRoot
$workdir = Join-Path $root "fabric-network"

Push-Location $workdir

Write-Host "Cleaning any existing Fabric containers/volumes..." -ForegroundColor Cyan
docker compose -f docker-compose-fabric.yml down -v --remove-orphans
$fabricContainers = @("ca.org1.example.com", "couchdb0", "orderer.example.com", "peer0.org1.example.com", "fabric-cli")
foreach ($container in $fabricContainers) {
  $containerExists = docker ps -a --format "{{.Names}}" | Where-Object { $_ -eq $container }
  if ($containerExists) {
    docker rm -f $container *> $null
  }
}

Remove-CleanDir (Join-Path $workdir "organizations")
New-CleanDir (Join-Path $workdir "system-genesis-block")
New-CleanDir (Join-Path $workdir "channel-artifacts")

Write-Host "Generating crypto material (cryptogen)..." -ForegroundColor Cyan
$cryptoArchive = Join-Path $workdir "generated-organizations.tar.gz"
if (Test-Path $cryptoArchive) { Remove-Item -Force $cryptoArchive }
docker compose -f docker-compose-fabric.yml run --rm cli sh -c "rm -rf /tmp/organizations && cryptogen generate --config=/workdir/config/crypto-config.yaml --output=/tmp/organizations && tar -C /tmp/organizations -czf /workdir/generated-organizations.tar.gz ."
Assert-LastExitCode "cryptogen generate"
New-CleanDir (Join-Path $workdir "organizations")
tar -xzf $cryptoArchive -C (Join-Path $workdir "organizations")
Remove-Item -Force $cryptoArchive

Write-Host "Generating genesis block + channel tx (configtxgen)..." -ForegroundColor Cyan
docker compose -f docker-compose-fabric.yml run --rm cli sh -c "FABRIC_CFG_PATH=/workdir/config configtxgen -profile AlumniGenesis -channelID system-channel -outputBlock /workdir/system-genesis-block/genesis.block && FABRIC_CFG_PATH=/workdir/config configtxgen -profile AlumniChannel -outputCreateChannelTx /workdir/channel-artifacts/$ChannelName.tx -channelID $ChannelName"
Assert-LastExitCode "configtxgen genesis+channel"

Write-Host "Starting Fabric services..." -ForegroundColor Cyan
docker compose -f docker-compose-fabric.yml up -d ca.org1.example.com couchdb0 orderer.example.com peer0.org1.example.com
Assert-LastExitCode "docker compose up"

Write-Host "Waiting briefly for peer/orderer..." -ForegroundColor Cyan
Start-Sleep -Seconds 5

Write-Host "Creating channel + joining peer..." -ForegroundColor Cyan
docker compose -f docker-compose-fabric.yml run --rm cli sh -c "FABRIC_CFG_PATH=/etc/hyperledger/fabric peer channel create -o orderer.example.com:7050 --tls --cafile `$ORDERER_CA -c $ChannelName -f /workdir/channel-artifacts/$ChannelName.tx --outputBlock /workdir/channel-artifacts/$ChannelName.block && FABRIC_CFG_PATH=/etc/hyperledger/fabric peer channel join -b /workdir/channel-artifacts/$ChannelName.block && FABRIC_CFG_PATH=/etc/hyperledger/fabric peer channel list"
Assert-LastExitCode "peer channel create/join/list"

Write-Host "Done. Fabric is up." -ForegroundColor Green
Write-Host "CA: http://localhost:7054  Orderer: localhost:7050  Peer: localhost:7051  CouchDB: http://localhost:5984" -ForegroundColor Green

Pop-Location

