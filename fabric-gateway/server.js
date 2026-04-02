import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import express from 'express';
import grpc from '@grpc/grpc-js';
import { connect, signers } from '@hyperledger/fabric-gateway';

function mustEnv(name, fallback = undefined) {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === '') throw new Error(`Missing required env: ${name}`);
  return v;
}

function readFirstFile(dir) {
  const entries = fs.readdirSync(dir).filter((f) => !f.startsWith('.'));
  if (entries.length === 0) throw new Error(`No files found in ${dir}`);
  return path.join(dir, entries[0]);
}

function newGateway() {
  const peerEndpoint = mustEnv('PEER_ENDPOINT', 'peer0.org1.example.com:7051');
  const peerTlsRootCertPath = process.env.PEER_TLS_ROOTCERT;
  const mspId = mustEnv('MSP_ID', 'Org1MSP');
  const certPathOrDir = mustEnv('CERT_PATH');
  const keyDir = mustEnv('KEY_DIR');

  const certPath = fs.existsSync(certPathOrDir) && fs.statSync(certPathOrDir).isDirectory()
    ? readFirstFile(certPathOrDir)
    : certPathOrDir;
  const cert = fs.readFileSync(certPath);
  const keyPath = fs.statSync(keyDir).isDirectory() ? readFirstFile(keyDir) : keyDir;
  const privateKeyPem = fs.readFileSync(keyPath);
  const privateKey = crypto.createPrivateKey(privateKeyPem);

  const client = new grpc.Client(
    peerEndpoint,
    peerTlsRootCertPath
      ? grpc.credentials.createSsl(fs.readFileSync(peerTlsRootCertPath))
      : grpc.credentials.createInsecure()
  );

  const identity = { mspId, credentials: cert };
  const signer = signers.newPrivateKeySigner(privateKey);

  return connect({
    client,
    identity,
    signer,
    evaluateOptions: () => ({ deadline: Date.now() + 10_000 }),
    endorseOptions: () => ({ deadline: Date.now() + 10_000 }),
    submitOptions: () => ({ deadline: Date.now() + 20_000 }),
    commitStatusOptions: () => ({ deadline: Date.now() + 20_000 })
  });
}

const channelName = mustEnv('CHANNEL_NAME', 'alumni-channel');
const chaincodeName = mustEnv('CHAINCODE_NAME', 'document-verification');

const gateway = newGateway();
const network = gateway.getNetwork(channelName);
const contract = network.getContract(chaincodeName);

const app = express();
app.use(express.json({ limit: '1mb' }));

app.get('/health', async (_req, res) => {
  res.json({ ok: true, channel: channelName, chaincode: chaincodeName });
});

app.post('/store', async (req, res) => {
  try {
    const { document_id, document_hash, metadata } = req.body ?? {};
    if (!document_id || !document_hash) return res.status(400).json({ ok: false, error: 'document_id and document_hash required' });
    const metaStr = metadata ? JSON.stringify(metadata) : '';
    const resultBytes = await contract.submitTransaction('StoreDocument', String(document_id), String(document_hash), metaStr);
    const result = resultBytes?.length ? JSON.parse(Buffer.from(resultBytes).toString('utf8')) : { ok: true };
    res.json({ ok: true, result });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message ?? e) });
  }
});

app.post('/verify', async (req, res) => {
  try {
    const { document_id, document_hash } = req.body ?? {};
    if (!document_id || !document_hash) return res.status(400).json({ ok: false, error: 'document_id and document_hash required' });
    const resultBytes = await contract.evaluateTransaction('VerifyDocument', String(document_id), String(document_hash));
    const resultStr = Buffer.from(resultBytes).toString('utf8');
    const verified = resultStr.trim().toLowerCase() === 'true';
    res.json({ ok: true, verified });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message ?? e) });
  }
});

app.get('/history/:document_id', async (req, res) => {
  try {
    const { document_id } = req.params;
    const resultBytes = await contract.evaluateTransaction('GetDocumentHistory', String(document_id));
    const resultStr = Buffer.from(resultBytes).toString('utf8');
    const history = resultStr ? JSON.parse(resultStr) : [];
    res.json({ ok: true, history });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message ?? e) });
  }
});

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Fabric gateway listening on :${port}`);
});

