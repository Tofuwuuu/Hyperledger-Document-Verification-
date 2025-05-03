package main

import (
	"log"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
	"github.com/hyperledger/fabric-samples/chaincode/document-verification/go/document"
)

func main() {
	documentVerificationContract := new(document.DocumentVerificationContract)

	cc, err := contractapi.NewChaincode(documentVerificationContract)
	if err != nil {
		log.Panicf("Error creating document-verification chaincode: %v", err)
	}

	if err := cc.Start(); err != nil {
		log.Panicf("Error starting document-verification chaincode: %v", err)
	}
} 