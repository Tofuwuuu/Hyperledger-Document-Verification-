import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import grpc from '@grpc/grpc-js';
import { connect, hash, signers } from '@hyperledger/fabric-gateway';
import express from 'express';

const PORT = Number(process.env.PORT || 3001);
const PEER_ENDPOINT = process.env.PEER_ENDPOINT || 'peer0.org1.example.com:7051';
const PEER_HOST_ALIAS = process.env.PEER_HOST_ALIAS || 'peer0.org1.example.com';
const PEER_TLS_ROOTCERT = process.env.PEER_TLS_ROOTCERT || '/crypto/peer/tls/ca.crt';
const MSP_ID = process.env.MSP_ID || 'Org1MSP';
const CHANNEL_NAME = process.env.CHANNEL_NAME || 'alumni-channel';
const CHAINCODE_NAME = process.env.CHAINCODE_NAME || 'final-smart-contract';
const CERT_PATH = process.env.CERT_PATH || '/crypto/signcerts';
const KEY_DIR = process.env.KEY_DIR || '/crypto/keystore';

let contractPromise;

async function firstFileInDirectory(directory) {
  const files = await fs.readdir(directory);
  const file = files.find((entry) => !entry.startsWith('.'));
  if (!file) {
    throw new Error(`No credential file found in ${directory}`);
  }
  return path.join(directory, file);
}

async function newGrpcConnection() {
  const tlsRootCert = await fs.readFile(PEER_TLS_ROOTCERT);
  const credentials = grpc.credentials.createSsl(tlsRootCert);
  return new grpc.Client(PEER_ENDPOINT, credentials, {
    'grpc.ssl_target_name_override': PEER_HOST_ALIAS,
  });
}

async function newIdentity() {
  const certFile = await firstFileInDirectory(CERT_PATH);
  const credentials = await fs.readFile(certFile);
  return { mspId: MSP_ID, credentials };
}

async function newSigner() {
  const keyFile = await firstFileInDirectory(KEY_DIR);
  const privateKeyPem = await fs.readFile(keyFile);
  const privateKey = crypto.createPrivateKey(privateKeyPem);
  return signers.newPrivateKeySigner(privateKey);
}

async function getContract() {
  if (!contractPromise) {
    contractPromise = (async () => {
      const client = await newGrpcConnection();
      const gateway = connect({
        client,
        identity: await newIdentity(),
        signer: await newSigner(),
        hash: hash.sha256,
        evaluateOptions: () => ({ deadline: Date.now() + 5000 }),
        endorseOptions: () => ({ deadline: Date.now() + 15000 }),
        submitOptions: () => ({ deadline: Date.now() + 5000 }),
        commitStatusOptions: () => ({ deadline: Date.now() + 60000 }),
      });

      return gateway.getNetwork(CHANNEL_NAME).getContract(CHAINCODE_NAME);
    })();
  }

  return contractPromise;
}

function parseJsonBuffer(buffer, fallback = null) {
  const value = Buffer.from(buffer).toString('utf8');
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch (_error) {
    return value;
  }
}

const app = express();
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    channel: CHANNEL_NAME,
    chaincode: CHAINCODE_NAME,
    peer: PEER_ENDPOINT,
  });
});

app.post('/documents', async (req, res, next) => {
  try {
    const { document_id: documentId, hash: documentHash, metadata = {} } = req.body;
    if (!documentId || !documentHash) {
      return res.status(400).json({ success: false, message: 'document_id and hash are required' });
    }

    const contract = await getContract();
    const result = await contract.submitTransaction(
      'StoreDocument',
      String(documentId),
      String(documentHash),
      JSON.stringify(metadata || {}),
    );
    const parsed = parseJsonBuffer(result, {});

    return res.json({
      success: true,
      document_id: String(documentId),
      hash: String(documentHash),
      transaction_id: parsed.txId || parsed.transaction_id || null,
      record: parsed,
    });
  } catch (error) {
    return next(error);
  }
});

app.post('/documents/verify', async (req, res, next) => {
  try {
    const { document_id: documentId, hash: documentHash } = req.body;
    if (!documentId || !documentHash) {
      return res.status(400).json({ success: false, message: 'document_id and hash are required' });
    }

    const contract = await getContract();
    const result = await contract.evaluateTransaction('VerifyDocument', String(documentId), String(documentHash));
    const verified = Buffer.from(result).toString('utf8') === 'true';

    return res.json({
      success: true,
      verified,
      record: verified ? { document_id: String(documentId), hash: String(documentHash) } : null,
    });
  } catch (error) {
    return next(error);
  }
});

app.post('/hashes/verify', async (req, res, next) => {
  try {
    const { hash: documentHash } = req.body;
    if (!documentHash) {
      return res.status(400).json({ success: false, message: 'hash is required' });
    }

    const contract = await getContract();
    const result = await contract.evaluateTransaction('VerifyHash', String(documentHash));
    const parsed = parseJsonBuffer(result, { verified: false });

    return res.json({
      success: true,
      verified: Boolean(parsed.verified),
      record: parsed.verified ? parsed : null,
    });
  } catch (error) {
    return next(error);
  }
});

app.get('/documents/:documentId/history', async (req, res, next) => {
  try {
    const contract = await getContract();
    const result = await contract.evaluateTransaction('GetDocumentHistory', String(req.params.documentId));
    const history = parseJsonBuffer(result, []);

    return res.json({
      success: true,
      document_id: String(req.params.documentId),
      history: Array.isArray(history) ? history : [],
    });
  } catch (error) {
    return next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error('Fabric gateway error:', error);
  res.status(502).json({
    success: false,
    message: error.message || 'Fabric gateway error',
  });
});

app.listen(PORT, () => {
  console.log(`Fabric Gateway listening on ${PORT}`);
});
