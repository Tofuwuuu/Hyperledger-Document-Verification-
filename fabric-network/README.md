# Hyperledger Fabric (Docker) – CVSU Alumni

This folder deploys a **real Hyperledger Fabric network** in Docker:

- **CA**: `ca.org1.example.com:7054`
- **Orderer**: `orderer.example.com:7050`
- **Peer**: `peer0.org1.example.com:7051`
- **CouchDB**: `localhost:5984` (state DB for the peer)
- **Channel**: `alumni-channel`

It is intentionally minimal (1 org, 1 peer, 1 orderer) and is designed to run on Windows Docker Desktop.

## Quick start (Windows PowerShell)

From the repo root:

```powershell
.\fabric-network\network-up.ps1
```

To stop:

```powershell
.\fabric-network\network-down.ps1
```

## What the scripts do

1. Generate MSP/TLS crypto using `cryptogen` (inside the `fabric-tools` container)
2. Generate genesis + channel tx using `configtxgen`
3. Start Fabric services with `docker compose -f fabric-network/docker-compose-fabric.yml up -d`
4. Create the channel and join the peer

## Verify it’s running

```powershell
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"
docker logs -n 50 orderer.example.com
docker logs -n 50 peer0.org1.example.com
docker exec peer0.org1.example.com peer channel list
```

## Notes

- `network-up.ps1` deletes and regenerates `organizations/`. That directory is gitignored, including private keys. Run the script on a new clone before the gateway can sign.
- The FastAPI app uses an in-memory mock ledger unless `USE_REAL_BLOCKCHAIN=true`. Real calls go to the Node service in `fabric-gateway/`, which uses `@hyperledger/fabric-gateway`. See [docs/local-setup.md](../docs/local-setup.md).

## Chaincode: Final Smart Contract

The committed chaincode name is **`final-smart-contract`** (display name: **Final Smart Contract**). Source: [`chaincode/final-smart-contract/javascript/`](chaincode/final-smart-contract/javascript/) (Node.js, `fabric-contract-api`).

After the network is up, package and commit it:

```powershell
cd fabric-network
.\deploy-chaincode.ps1
```

Defaults: channel `alumni-channel`, chaincode `final-smart-contract`, version `1.0`, **sequence `1`**.

### Lifecycle sequence (upgrades)

- First deploy on a channel: use `-Sequence 1` (default).
- If you change the chaincode package and need a new definition on the **same** channel/name, increment **sequence** (e.g. `2`, `3`) and keep **version** in sync with your labeling strategy. Re-run approve + commit with the new package ID.

Root [`docker-compose.yml`](../docker-compose.yml) must set `fabric-gateway` env `CHAINCODE_NAME=final-smart-contract` so the gateway invokes the same name.

