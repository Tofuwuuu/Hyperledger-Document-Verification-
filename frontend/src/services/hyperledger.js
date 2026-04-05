import api from './api';

// Hyperledger Network Services
export const networkService = {
  createNetwork: async (networkData) => {
    return api.post('/hyperledger/networks', networkData);
  },
  
  getNetwork: async (networkId) => {
    return api.get(`/hyperledger/networks/${networkId}`);
  },
  
  updateNetwork: async (networkId, updateData) => {
    return api.put(`/hyperledger/networks/${networkId}`, updateData);
  },
  
  listNetworks: async (activeOnly = true, networkType = null) => {
    const params = { active_only: activeOnly };
    if (networkType) {
      params.network_type = networkType;
    }
    return api.get('/hyperledger/networks', { params });
  },
  
  deleteNetwork: async (networkId) => {
    return api.delete(`/hyperledger/networks/${networkId}`);
  },
  
  // Helper method to format connection profile for UI display
  formatConnectionProfile: (profile) => {
    if (!profile) return {};
    
    // Extract key info for display
    return {
      name: profile.name || 'Unknown Network',
      organizations: Object.keys(profile.organizations || {}),
      peers: Object.keys(profile.peers || {}),
      orderers: Object.keys(profile.orderers || {}),
      channels: Object.keys(profile.channels || {})
    };
  }
};

// Hyperledger Channel Services
export const channelService = {
  createChannel: async (channelData) => {
    return api.post('/hyperledger/channels', channelData);
  },
  
  getChannel: async (channelId) => {
    return api.get(`/hyperledger/channels/${channelId}`);
  },
  
  updateChannel: async (channelId, updateData) => {
    return api.put(`/hyperledger/channels/${channelId}`, updateData);
  },
  
  listChannels: async (networkId, activeOnly = true) => {
    const params = { 
      network_id: networkId,
      active_only: activeOnly 
    };
    return api.get('/hyperledger/channels', { params });
  },
  
  deleteChannel: async (channelId) => {
    return api.delete(`/hyperledger/channels/${channelId}`);
  }
};

// Hyperledger Chaincode Services
export const chaincodeService = {
  createChaincode: async (chaincodeData) => {
    return api.post('/hyperledger/chaincodes', chaincodeData);
  },
  
  getChaincode: async (chaincodeId) => {
    return api.get(`/hyperledger/chaincodes/${chaincodeId}`);
  },
  
  updateChaincode: async (chaincodeId, updateData) => {
    return api.put(`/hyperledger/chaincodes/${chaincodeId}`, updateData);
  },
  
  listChaincodes: async (channelId, activeOnly = true) => {
    const params = { 
      channel_id: channelId,
      active_only: activeOnly 
    };
    return api.get('/hyperledger/chaincodes', { params });
  },
  
  deleteChaincode: async (chaincodeId) => {
    return api.delete(`/hyperledger/chaincodes/${chaincodeId}`);
  },
  
  // Helper method to format arguments for chaincode invocation
  formatArgs: (args) => {
    // Ensure all args are strings
    return args.map(arg => {
      if (typeof arg === 'object') {
        return JSON.stringify(arg);
      }
      return String(arg);
    });
  }
};

// Hyperledger Interaction Services
export const fabricService = {
  invokeChaincode: async (networkId, channelName, chaincodeName, functionName, args) => {
    // Format args to ensure they're all strings
    const formattedArgs = chaincodeService.formatArgs(args);
    
    return api.post('/hyperledger/invoke', {
      network_id: networkId,
      channel_name: channelName,
      chaincode_name: chaincodeName,
      function_name: functionName,
      args: formattedArgs
    });
  },
  
  queryChaincode: async (networkId, channelName, chaincodeName, functionName, args) => {
    // Format args to ensure they're all strings
    const formattedArgs = chaincodeService.formatArgs(args);
    
    return api.post('/hyperledger/query', {
      network_id: networkId,
      channel_name: channelName,
      chaincode_name: chaincodeName,
      function_name: functionName,
      args: formattedArgs
    });
  },
  
  // Document verification via blockchain
  verifyDocument: async (documentId, documentHash) => {
    // We'll use the document verification chaincode
    return fabricService.queryChaincode(
      'mychannel-network',       // Default network
      'mychannel',               // Default channel 
      'final-smart-contract',   // Final Smart Contract (document verification chaincode)
      'VerifyDocument',          // Function name
      [documentId, documentHash] // Args: document ID and hash to verify
    );
  },
  
  // Store document hash on blockchain
  storeDocument: async (documentId, documentHash, metadata) => {
    // Convert metadata to string if it's an object
    const metadataStr = typeof metadata === 'object' ? 
      JSON.stringify(metadata) : 
      String(metadata || '');
    
    return fabricService.invokeChaincode(
      'mychannel-network',       // Default network
      'mychannel',               // Default channel
      'final-smart-contract',   // Final Smart Contract (document verification chaincode)
      'StoreDocument',           // Function name
      [documentId, documentHash, metadataStr] // Args: document ID, hash, and metadata
    );
  },
  
  // Get document history from blockchain
  getDocumentHistory: async (documentId) => {
    return fabricService.queryChaincode(
      'mychannel-network',       // Default network
      'mychannel',               // Default channel
      'final-smart-contract',   // Final Smart Contract (document verification chaincode)
      'GetDocumentHistory',      // Function name
      [documentId]               // Args: document ID
    );
  }
};

// Types and constants
export const NETWORK_TYPES = {
  FABRIC: 'fabric',
  BESU: 'besu',
  SAWTOOTH: 'sawtooth',
  IROHA: 'iroha'
};

export const CHAINCODE_LANGUAGES = {
  GOLANG: 'golang',
  JAVASCRIPT: 'javascript',
  TYPESCRIPT: 'typescript',
  JAVA: 'java'
};

// Export all services as a single object
const hyperledgerService = {
  networks: networkService,
  channels: channelService,
  chaincodes: chaincodeService,
  fabric: fabricService,
  types: {
    NETWORK_TYPES,
    CHAINCODE_LANGUAGES
  }
};

export default hyperledgerService; 