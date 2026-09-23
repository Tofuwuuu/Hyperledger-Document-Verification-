# Local setup

Commands below match the scripts and Compose file in this repo. Fabric startup scripts are Windows PowerShell.

## 1. Environment files

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

`backend/.env` is gitignored. The example uses placeholder `SECRET_KEY=change_me`. Do not commit a real secret.

Backend variables the process actually reads:

| Variable | Where | Purpose |
| --- | --- | --- |
| `MONGODB_URL` or `MONGODB_URI` | `backend/app/config.py` | MongoDB connection. Default `mongodb://localhost:27017/cvsu_alumni`. |
| `SECRET_KEY` | `backend/app/config.py` | HMAC secret for JWTs. |
| `CORS_ORIGINS` | `backend/app/config.py` | Comma-separated browser origins. |
| `USE_REAL_BLOCKCHAIN` | `backend/app/services/blockchain_manager.py` | `true` calls the gateway. Anything else uses the in-memory mock. Default `false`. |
| `FABRIC_GATEWAY_URL` | `backend/app/clients/fabric_client.py` | Default `http://localhost:3001`. Inside Compose the API uses `http://fabric-gateway:3001`. |
| `CHANNEL_NAME` | `blockchain_manager.py` | Default `alumni-channel`. |
| `CHAINCODE_NAME` | `blockchain_manager.py` | Default `final-smart-contract`. |

`docker-compose.yml` sets `USE_REAL_BLOCKCHAIN=false` on the `backend` service. A `backend/.env` file is not automatically passed into that container. Change the Compose environment block if you want the containerized API to use Fabric.

Frontend:

| Variable | Purpose |
| --- | --- |
| `VITE_API_URL` | API origin, default `http://localhost:8000`. `frontend/src/config.js` also accepts `VITE_API_ORIGIN` and strips a trailing `/api/v1`. |
| `VITE_POLLING_INTERVAL` | Milliseconds for `frontend/src/services/polling.js`. Default `5000`. |

Gateway (host process). Defaults also live in `fabric-gateway/src/server.js`. See `fabric-gateway/.env.example`. Compose overrides these with container paths under `/crypto`.

## 2. App without Fabric (mock ledger)

Create the external network Compose expects, then start MongoDB, the API, and the gateway container:

```bash
docker network create cvsu_alumni_blockchain_network
docker compose up -d --build
```

`fabric-gateway` will be up, but chain calls fail until the peer is running. With `USE_REAL_BLOCKCHAIN=false` the API never calls it.

Frontend on the host (the Compose `frontend` service is profile `docker-frontend` and is not started by the command above):

```bash
cd frontend
npm install --legacy-peer-deps
npm run dev
```

API docs: http://127.0.0.1:8000/docs  
Vite: http://localhost:5173

From the repo root, after `npm install`:

```bash
npm start          # API via python backend/run.py and Vite together
npm run gateway    # node fabric-gateway/src/server.js
```

`npm run install-all` installs root, frontend, and gateway npm packages and `pip install -r backend/requirements.txt`.

To run the API in Docker *and* the production frontend image:

```bash
docker compose --profile docker-frontend up -d --build
```

That image listens on port 5173. Set `VITE_API_URL` for the browser (for example `http://localhost:8000`) when you build it. The Compose default `http://backend:8000` is a Docker DNS name the browser cannot resolve.

`mongo-express` is published on port 8081. The `blockchain-explorer` service mounts `./blockchain-explorer`, which is not in the repo. Compose can create that path as an empty directory; nginx then has nothing to serve. Skip the service if you do not need it:

```bash
docker compose up -d --build mongodb mongo-express backend fabric-gateway
```

## 3. Fabric network and chaincode

On Windows, from the repo root:

```powershell
.\fabric-network\network-up.ps1
cd fabric-network
.\deploy-chaincode.ps1
cd ..
docker compose up -d --build
```

`network-up.ps1` deletes `fabric-network/organizations/`, `system-genesis-block/`, and `channel-artifacts/`, runs `cryptogen` and `configtxgen` inside the Fabric tools container, then starts the CA, CouchDB, orderer, and `peer0.org1.example.com` and creates `alumni-channel`.

Stop the peer network with `.\fabric-network\network-down.ps1`.

Point the API at the gateway:

```text
USE_REAL_BLOCKCHAIN=true
FABRIC_GATEWAY_URL=http://localhost:3001
```

Use `http://fabric-gateway:3001` only when the API runs inside Compose.

There is no bash equivalent of the PowerShell scripts in this repo. On Linux or macOS, follow the same steps in `fabric-network/network-up.ps1` (external network, cryptogen, configtxgen, channel create/join) or run them with PowerShell.

## 4. What not to commit

`network-up.ps1` regenerates MSP material under `fabric-network/organizations/`. That tree, `priv_sk` files, `*.key`, and `wallet/` directories are gitignored. They are local dev credentials for `*.example.com`, and older commits may still contain them. This repository was not history-rewritten, so those blobs can remain on GitHub until someone rewrites history on purpose.

`node_modules/` at the repo root used to be tracked. It is gitignored now. Existing history still has it.

`backend/uploads/` is runtime file storage and is gitignored except `.gitkeep`.
