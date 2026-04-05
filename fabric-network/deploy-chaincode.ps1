Param(
  [string]$ChannelName = "alumni-channel",
  [string]$ChaincodeName = "final-smart-contract",
  [string]$ChaincodeVersion = "1.0",
  [int]$Sequence = 1
)

$ErrorActionPreference = "Continue"

Push-Location $PSScriptRoot

$label = "${ChaincodeName}_${ChaincodeVersion}"
$pkg = "${ChaincodeName}.tar.gz"

Write-Host "Packaging chaincode..." -ForegroundColor Cyan
docker compose -f docker-compose-fabric.yml run --rm cli sh -c "peer lifecycle chaincode package $pkg --path /workdir/chaincode/final-smart-contract/javascript --lang node --label $label"
if ($LASTEXITCODE -ne 0) { throw "Package failed" }

Write-Host "Installing chaincode..." -ForegroundColor Cyan
$installOut = docker compose -f docker-compose-fabric.yml run --rm cli sh -c "peer lifecycle chaincode install $pkg" 2>&1
if ($LASTEXITCODE -ne 0) {
  if ($installOut -match "already successfully installed") {
    Write-Host "Chaincode already installed; continuing." -ForegroundColor DarkGray
  } else {
    Write-Host $installOut
    throw "Install failed"
  }
}

Write-Host "Resolving package ID..." -ForegroundColor Cyan
$installed = docker compose -f docker-compose-fabric.yml run --rm cli sh -c "peer lifecycle chaincode queryinstalled"
if ($LASTEXITCODE -ne 0) { throw "queryinstalled failed" }

# Match: Package ID: <id>, Label: <label>
$pkgId = (
  $installed -split "`n" |
    Where-Object { $_ -match "Package ID:\s*(.+),\s*Label:\s*${label}\s*$" } |
    ForEach-Object { $Matches[1] } |
    Select-Object -First 1
)
if (-not $pkgId) {
  Write-Host $installed
  throw "Could not determine package ID"
}
$pkgId = $pkgId.Trim()
Write-Host "Package ID: $pkgId" -ForegroundColor DarkGray

Write-Host "Approving chaincode for Org1..." -ForegroundColor Cyan
docker compose -f docker-compose-fabric.yml run --rm cli sh -c "peer lifecycle chaincode approveformyorg -o orderer.example.com:7050 --tls --cafile `$ORDERER_CA --channelID $ChannelName --name $ChaincodeName --version $ChaincodeVersion --package-id $pkgId --sequence $Sequence"
if ($LASTEXITCODE -ne 0) { throw "Approve failed" }

Write-Host "Committing chaincode..." -ForegroundColor Cyan
docker compose -f docker-compose-fabric.yml run --rm cli sh -c "peer lifecycle chaincode commit -o orderer.example.com:7050 --tls --cafile `$ORDERER_CA --channelID $ChannelName --name $ChaincodeName --version $ChaincodeVersion --sequence $Sequence --peerAddresses peer0.org1.example.com:7051 --tlsRootCertFiles `$CORE_PEER_TLS_ROOTCERT_FILE"
if ($LASTEXITCODE -ne 0) { throw "Commit failed" }

Write-Host "Done. Chaincode deployed." -ForegroundColor Green

Pop-Location

