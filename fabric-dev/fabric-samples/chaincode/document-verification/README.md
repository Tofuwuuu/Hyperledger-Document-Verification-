# Document Verification Chaincode

This chaincode provides functionality for storing and verifying document hashes on the blockchain. It's designed to be used in a document verification system where documents need to be verifiably stored and verified.

## Features

- Store document hashes with metadata
- Verify documents against stored hashes
- Track document verification history
- Query documents by owner
- Update document status
- Retrieve complete document history

## Usage

### Prerequisites

- Go 1.18 or higher
- Hyperledger Fabric v2.2+

### Building the Chaincode

From the `go` directory:

```bash
go mod tidy
go build -o document-verification
```

### Installing the Chaincode

Use the Fabric tools to package and install the chaincode:

```bash
peer lifecycle chaincode package document-verification.tar.gz --path ./go --lang golang --label document-verification_1.0

peer lifecycle chaincode install document-verification.tar.gz
```

### Chaincode Functions

#### StoreDocument

Stores a document hash on the blockchain.

Parameters:
- `docID`: Unique identifier for the document
- `hash`: SHA-256 hash of the document
- `owner`: Owner of the document
- `docType`: Type of document (e.g., "diploma", "transcript")
- `metadata`: Additional metadata in JSON format

#### VerifyDocument

Verifies a document against a stored hash.

Parameters:
- `docID`: ID of the document to verify
- `hash`: Hash to verify against
- `verifier`: Identity of the verifier

Returns:
- Boolean indicating whether the document was verified

#### GetDocument

Retrieves a document by ID.

Parameters:
- `docID`: ID of the document to retrieve

#### UpdateDocumentStatus

Updates a document's status.

Parameters:
- `docID`: ID of the document to update
- `newStatus`: New status for the document
- `updatedBy`: Identity of the person updating the status

#### GetDocumentHistory

Retrieves the complete history of a document.

Parameters:
- `docID`: ID of the document to get history for

#### QueryDocumentsByOwner

Searches for documents by owner.

Parameters:
- `owner`: Owner to search for

## Model

### Document

```go
type Document struct {
    DocID        string    `json:"docId"`
    Hash         string    `json:"hash"`
    Owner        string    `json:"owner"`
    DocumentType string    `json:"documentType"`
    Issuer       string    `json:"issuer,omitempty"`
    IssuedAt     time.Time `json:"issuedAt,omitempty"`
    VerifiedAt   time.Time `json:"verifiedAt,omitempty"`
    Status       string    `json:"status"`
    Metadata     string    `json:"metadata,omitempty"`
}
```

### DocumentHistory

```go
type DocumentHistory struct {
    TxID       string    `json:"txId"`
    Hash       string    `json:"hash"`
    Status     string    `json:"status"`
    Timestamp  time.Time `json:"timestamp"`
    VerifiedBy string    `json:"verifiedBy,omitempty"`
}
```

## Example Flow

1. A document is issued and its hash is stored on the blockchain using `StoreDocument`
2. Later, someone wants to verify the document by computing its hash and checking against the blockchain using `VerifyDocument`
3. The verification result and history can be viewed using `GetDocumentHistory` 