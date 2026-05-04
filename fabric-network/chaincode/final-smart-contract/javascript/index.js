/*
  Final Smart Contract - document hash verification chaincode.
  - Primary key: doc:{documentId}
  - Secondary key: hash:{sha256}
*/

const { Contract } = require('fabric-contract-api');

class DocumentVerificationContract extends Contract {
  async StoreDocument(ctx, documentId, documentHash, metadataJson) {
    const metadata = metadataJson ? JSON.parse(metadataJson) : null;
    const txId = ctx.stub.getTxID();
    const record = {
      documentId,
      hash: documentHash,
      metadata,
      txId,
      updatedAt: new Date().toISOString()
    };

    await ctx.stub.putState(`doc:${documentId}`, Buffer.from(JSON.stringify(record)));
    await ctx.stub.putState(`hash:${documentHash}`, Buffer.from(JSON.stringify(record)));

    return JSON.stringify({
      documentId,
      hash: documentHash,
      txId
    });
  }

  async VerifyDocument(ctx, documentId, documentHash) {
    const bytes = await ctx.stub.getState(`doc:${documentId}`);
    if (!bytes || bytes.length === 0) {
      return 'false';
    }

    const record = JSON.parse(bytes.toString());
    return String(record.hash === documentHash);
  }

  async VerifyHash(ctx, documentHash) {
    const bytes = await ctx.stub.getState(`hash:${documentHash}`);
    if (!bytes || bytes.length === 0) {
      return JSON.stringify({ verified: false });
    }

    const record = JSON.parse(bytes.toString());
    return JSON.stringify({
      verified: true,
      documentId: record.documentId,
      hash: record.hash,
      metadata: record.metadata,
      txId: record.txId,
      updatedAt: record.updatedAt
    });
  }

  async GetDocumentHistory(ctx, documentId) {
    const iter = await ctx.stub.getHistoryForKey(`doc:${documentId}`);
    const out = [];

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const res = await iter.next();
      if (res.value) {
        out.push({
          txId: res.value.txId,
          timestamp: res.value.timestamp,
          isDelete: res.value.isDelete,
          value: res.value.value ? res.value.value.toString('utf8') : null
        });
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
