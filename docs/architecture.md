# Architecture

CVSU Carmona alumni profiles, with document hashes anchored on Hyperledger Fabric.

```text
Browser
  React 18 + Vite
  src/App.jsx routes, src/services/api.js (axios, JWT)
        |
        |  REST JSON, prefix /api/v1
        v
FastAPI  (backend/app/main.py, started by backend/run.py)
  MongoDB via Motor          files under backend/uploads/
        |
        |  BlockchainManager
        |    USE_REAL_BLOCKCHAIN=false  -> backend/app/blockchain/fabric.py (process memory)
        |    USE_REAL_BLOCKCHAIN=true   -> backend/app/clients/fabric_client.py
        v
fabric-gateway  (fabric-gateway/src/server.js, port 3001)
  Express + @hyperledger/fabric-gateway
  identity: Org1 admin cert and key mounted from fabric-network/organizations/
        |
        |  gRPC + TLS
        v
peer0.org1.example.com
  channel alumni-channel
  chaincode final-smart-contract
```

The Fabric network itself is started separately with `fabric-network/network-up.ps1` and `fabric-network/docker-compose-fabric.yml`. Root `docker-compose.yml` joins the external Docker network `cvsu_alumni_blockchain_network` and does not create the peer or orderer.

## Roles in the app

Fabric has one organization in this repo (`Org1MSP`). App roles are accounts in MongoDB, not Fabric MSPs.

- **Verifier.** `frontend/src/pages/VerifyPage.jsx` posts the file to `POST /api/v1/verification/blockchain/verify-file`. That route does not require a login. The API hashes the bytes with SHA-256 and calls `VerifyDocument` when a document id is present, otherwise `VerifyHash`.
- **Alumni.** Register and login (`backend/app/api/register.py`). Document upload and document requests sit behind a verified-account check in `frontend/src/App.jsx`.
- **Admin (the issuer in this app).** `POST /api/v1/admin/verifications/{document_id}/approve` writes the hash through `StoreDocument`. The same router rejects documents without a chain write.

`POST /api/v1/verification/blockchain/store` is a second, admin-only path that also calls `StoreDocument`.

## Chaincode

`fabric-network/chaincode/final-smart-contract/javascript/index.js`:

| Function | State |
| --- | --- |
| `StoreDocument` | `doc:{documentId}` and `hash:{sha256}` |
| `VerifyDocument` | Compares the stored hash for that id |
| `VerifyHash` | Looks up a hash with no id |
| `GetDocumentHistory` | Fabric history for `doc:{documentId}` |

Gateway routes match those calls: `POST /documents`, `POST /documents/verify`, `POST /hashes/verify`, `GET /documents/:documentId/history`, `GET /health`.

## What is not on the ledger

Uploaded files, alumni profiles, events, and notifications stay in MongoDB. Admin approval still updates MongoDB if the gateway errors or exceeds 10 seconds, and then stores a fallback transaction id instead of a Fabric transaction id.
