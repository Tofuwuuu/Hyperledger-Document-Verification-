/*
  Final Smart Contract — minimal chaincode for document hash verification.
  - Key: doc:{documentId}
  - Value: JSON { documentId, hash, metadata, updatedAt }
*/

const { Contract } = require('fabric-contract-api');

class DocumentVerificationContract extends Contract {
  async StoreDocument(ctx, documentId, documentHash, metadataJson) {
    const key = `doc:${documentId}`;
    const metadata = metadataJson ? JSON.parse(metadataJson) : null;
    const record = {
      documentId,
      hash: documentHash,
      metadata,
      updatedAt: new Date().toISOString()
    };
    await ctx.stub.putState(key, Buffer.from(JSON.stringify(record)));
    return JSON.stringify({ documentId, hash: documentHash });
  }

  async VerifyDocument(ctx, documentId, documentHash) {
    const key = `doc:${documentId}`;
    const bytes = await ctx.stub.getState(key);
    if (!bytes || bytes.length === 0) return 'false';
    const record = JSON.parse(bytes.toString());
    return String(record.hash === documentHash);
  }

  async GetDocumentHistory(ctx, documentId) {
    const key = `doc:${documentId}`;
    const iter = await ctx.stub.getHistoryForKey(key);
    const out = [];
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const res = await iter.next();
      if (res.value) {
        const tx = {
          txId: res.value.txId,
          timestamp: res.value.timestamp,
          isDelete: res.value.isDelete,
          value: res.value.value ? res.value.value.toString('utf8') : null
        };
        out.push(tx);
      }
      if (res.done) {
        await iter.close();
        break;
      }
    }
    return JSON.stringify(out);
  }
}

module.exports = DocumentVerificationContract;
