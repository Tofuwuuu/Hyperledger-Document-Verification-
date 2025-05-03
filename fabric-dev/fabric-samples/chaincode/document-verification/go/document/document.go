package document

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// DocumentVerificationContract defines the smart contract for document verification
type DocumentVerificationContract struct {
	contractapi.Contract
}

// Document represents a document stored on the ledger
type Document struct {
	DocID      string    `json:"docId"`
	Hash       string    `json:"hash"`
	Owner      string    `json:"owner"`
	DocumentType string  `json:"documentType"`
	Issuer     string    `json:"issuer,omitempty"`
	IssuedAt   time.Time `json:"issuedAt,omitempty"`
	VerifiedAt time.Time `json:"verifiedAt,omitempty"`
	Status     string    `json:"status"`
	Metadata   string    `json:"metadata,omitempty"`
}

// DocumentHistory represents a historical record of a document
type DocumentHistory struct {
	TxID        string    `json:"txId"`
	Hash        string    `json:"hash"`
	Status      string    `json:"status"`
	Timestamp   time.Time `json:"timestamp"`
	VerifiedBy  string    `json:"verifiedBy,omitempty"`
}

// InitLedger adds a base set of documents to the ledger
func (c *DocumentVerificationContract) InitLedger(ctx contractapi.TransactionContextInterface) error {
	fmt.Println("Document Verification Chaincode Initialized")
	return nil
}

// StoreDocument adds a new document to the ledger
func (c *DocumentVerificationContract) StoreDocument(ctx contractapi.TransactionContextInterface, 
	docID string, hash string, owner string, docType string, metadata string) error {
	
	// Check if document already exists
	exists, err := c.DocumentExists(ctx, docID)
	if err != nil {
		return fmt.Errorf("failed to check if document exists: %v", err)
	}
	if exists {
		return fmt.Errorf("document with ID %s already exists", docID)
	}

	// Create document object
	document := Document{
		DocID:        docID,
		Hash:         hash,
		Owner:        owner,
		DocumentType: docType,
		IssuedAt:     time.Now(),
		Status:       "STORED",
		Metadata:     metadata,
	}

	// Store history record
	err = c.addHistoryRecord(ctx, docID, hash, "STORED", "")
	if err != nil {
		return fmt.Errorf("failed to record history: %v", err)
	}

	// Convert to JSON
	documentJSON, err := json.Marshal(document)
	if err != nil {
		return fmt.Errorf("failed to marshal document: %v", err)
	}

	// Save to state
	return ctx.GetStub().PutState(docID, documentJSON)
}

// VerifyDocument verifies a document against a stored hash
func (c *DocumentVerificationContract) VerifyDocument(ctx contractapi.TransactionContextInterface, 
	docID string, hash string, verifier string) (bool, error) {
	
	// Get document from ledger
	documentJSON, err := ctx.GetStub().GetState(docID)
	if err != nil {
		return false, fmt.Errorf("failed to get document: %v", err)
	}
	if documentJSON == nil {
		return false, fmt.Errorf("document with ID %s does not exist", docID)
	}

	// Parse document
	var document Document
	err = json.Unmarshal(documentJSON, &document)
	if err != nil {
		return false, fmt.Errorf("failed to unmarshal document: %v", err)
	}

	// Verify hash
	verified := document.Hash == hash

	// Update verification status if verified
	if verified {
		document.Status = "VERIFIED"
		document.VerifiedAt = time.Now()
		
		// Store history record
		err = c.addHistoryRecord(ctx, docID, hash, "VERIFIED", verifier)
		if err != nil {
			return false, fmt.Errorf("failed to record verification history: %v", err)
		}

		// Update document
		updatedDocumentJSON, err := json.Marshal(document)
		if err != nil {
			return false, fmt.Errorf("failed to marshal updated document: %v", err)
		}

		err = ctx.GetStub().PutState(docID, updatedDocumentJSON)
		if err != nil {
			return false, fmt.Errorf("failed to update document verification status: %v", err)
		}
	} else {
		// Record failed verification attempt
		err = c.addHistoryRecord(ctx, docID, hash, "VERIFICATION_FAILED", verifier)
		if err != nil {
			return false, fmt.Errorf("failed to record failed verification: %v", err)
		}
	}

	return verified, nil
}

// GetDocument retrieves a document by ID
func (c *DocumentVerificationContract) GetDocument(ctx contractapi.TransactionContextInterface, docID string) (*Document, error) {
	documentJSON, err := ctx.GetStub().GetState(docID)
	if err != nil {
		return nil, fmt.Errorf("failed to read document: %v", err)
	}
	if documentJSON == nil {
		return nil, fmt.Errorf("document with ID %s does not exist", docID)
	}

	var document Document
	err = json.Unmarshal(documentJSON, &document)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal document: %v", err)
	}

	return &document, nil
}

// UpdateDocumentStatus updates a document's status
func (c *DocumentVerificationContract) UpdateDocumentStatus(ctx contractapi.TransactionContextInterface, 
	docID string, newStatus string, updatedBy string) error {
	
	// Get document
	document, err := c.GetDocument(ctx, docID)
	if err != nil {
		return err
	}

	// Update status
	document.Status = newStatus
	
	// Record history
	err = c.addHistoryRecord(ctx, docID, document.Hash, newStatus, updatedBy)
	if err != nil {
		return fmt.Errorf("failed to record status update history: %v", err)
	}

	// Update document
	documentJSON, err := json.Marshal(document)
	if err != nil {
		return fmt.Errorf("failed to marshal document: %v", err)
	}

	return ctx.GetStub().PutState(docID, documentJSON)
}

// GetDocumentHistory returns the history of a document
func (c *DocumentVerificationContract) GetDocumentHistory(ctx contractapi.TransactionContextInterface, docID string) ([]*DocumentHistory, error) {
	// Check if document exists
	exists, err := c.DocumentExists(ctx, docID)
	if err != nil {
		return nil, fmt.Errorf("failed to check if document exists: %v", err)
	}
	if !exists {
		return nil, fmt.Errorf("document with ID %s does not exist", docID)
	}

	// Get document's composite key for history records
	historyIterator, err := ctx.GetStub().GetStateByPartialCompositeKey("history", []string{docID})
	if err != nil {
		return nil, fmt.Errorf("failed to get history: %v", err)
	}
	defer historyIterator.Close()

	var history []*DocumentHistory
	for historyIterator.HasNext() {
		historyRecord, err := historyIterator.Next()
		if err != nil {
			return nil, fmt.Errorf("failed to iterate history: %v", err)
		}

		var historyEntry DocumentHistory
		err = json.Unmarshal(historyRecord.Value, &historyEntry)
		if err != nil {
			return nil, fmt.Errorf("failed to unmarshal history entry: %v", err)
		}

		history = append(history, &historyEntry)
	}

	return history, nil
}

// QueryDocumentsByOwner searches for documents by owner
func (c *DocumentVerificationContract) QueryDocumentsByOwner(ctx contractapi.TransactionContextInterface, owner string) ([]*Document, error) {
	// Get all documents
	resultsIterator, err := ctx.GetStub().GetStateByRange("", "")
	if err != nil {
		return nil, fmt.Errorf("failed to get documents: %v", err)
	}
	defer resultsIterator.Close()

	var documents []*Document
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return nil, fmt.Errorf("failed to iterate documents: %v", err)
		}

		var document Document
		err = json.Unmarshal(queryResponse.Value, &document)
		if err != nil {
			continue // Skip invalid documents
		}

		if document.Owner == owner {
			documents = append(documents, &document)
		}
	}

	return documents, nil
}

// DocumentExists checks if a document exists in the ledger
func (c *DocumentVerificationContract) DocumentExists(ctx contractapi.TransactionContextInterface, docID string) (bool, error) {
	documentJSON, err := ctx.GetStub().GetState(docID)
	if err != nil {
		return false, fmt.Errorf("failed to read from world state: %v", err)
	}

	return documentJSON != nil, nil
}

// Helper function to add a history record
func (c *DocumentVerificationContract) addHistoryRecord(ctx contractapi.TransactionContextInterface, 
	docID string, hash string, status string, verifiedBy string) error {
	
	// Create history record
	historyRecord := DocumentHistory{
		TxID:       ctx.GetStub().GetTxID(),
		Hash:       hash,
		Status:     status,
		Timestamp:  time.Now(),
		VerifiedBy: verifiedBy,
	}

	// Convert to JSON
	historyJSON, err := json.Marshal(historyRecord)
	if err != nil {
		return fmt.Errorf("failed to marshal history record: %v", err)
	}

	// Create composite key for history record
	historyKey, err := ctx.GetStub().CreateCompositeKey("history", []string{docID, ctx.GetStub().GetTxID()})
	if err != nil {
		return fmt.Errorf("failed to create composite key: %v", err)
	}

	// Save to state
	return ctx.GetStub().PutState(historyKey, historyJSON)
} 