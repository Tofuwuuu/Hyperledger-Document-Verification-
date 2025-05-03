"""
Hyperledger Fabric HTTP Client

This module provides a wrapper for interacting with Hyperledger Fabric networks
through a REST API gateway. This can be used as an alternative to direct SDK
integration, especially when using a managed blockchain service or an existing
API gateway.
"""

import os
import json
import logging
import httpx
from typing import Dict, List, Optional, Any, Union
from urllib.parse import urljoin

# Set up logging
logger = logging.getLogger(__name__)


class FabricClientHTTP:
    """Client for interacting with Hyperledger Fabric networks through HTTP REST API."""
    
    def __init__(
        self,
        api_url: str,
        api_key: Optional[str] = None,
        api_secret: Optional[str] = None,
        organization: str = "org1",
        channel: str = "mychannel",
        timeout: int = 30
    ):
        """
        Initialize the HTTP REST client for Fabric.
        
        Args:
            api_url: Base URL for the API gateway
            api_key: Optional API key for authentication
            api_secret: Optional API secret for authentication
            organization: Organization to use for transactions
            channel: Default channel to use
            timeout: Request timeout in seconds
        """
        self.api_url = api_url.rstrip("/") + "/"
        self.api_key = api_key
        self.api_secret = api_secret
        self.organization = organization
        self.channel = channel
        self.timeout = timeout
        self.client = httpx.AsyncClient(timeout=timeout)
    
    async def _make_request(
        self,
        method: str,
        endpoint: str,
        data: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Make an HTTP request to the API gateway.
        
        Args:
            method: HTTP method (GET, POST, PUT, DELETE)
            endpoint: API endpoint path
            data: Request body data
            params: Query parameters
            headers: Additional headers
            
        Returns:
            Response data as dictionary
        """
        url = urljoin(self.api_url, endpoint)
        
        # Set up headers
        request_headers = {
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
        
        # Add authentication if provided
        if self.api_key:
            request_headers["X-API-Key"] = self.api_key
        
        # Add custom headers
        if headers:
            request_headers.update(headers)
        
        try:
            # Make the request
            if method.upper() == "GET":
                response = await self.client.get(url, params=params, headers=request_headers)
            elif method.upper() == "POST":
                response = await self.client.post(url, json=data, params=params, headers=request_headers)
            elif method.upper() == "PUT":
                response = await self.client.put(url, json=data, params=params, headers=request_headers)
            elif method.upper() == "DELETE":
                response = await self.client.delete(url, params=params, headers=request_headers)
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")
            
            # Check for errors
            response.raise_for_status()
            
            # Parse and return response
            return response.json()
            
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error: {e.response.status_code} - {e.response.text}")
            # Try to parse error response
            try:
                error_data = e.response.json()
                return {
                    "success": False,
                    "status_code": e.response.status_code,
                    "error": error_data.get("error", str(e))
                }
            except Exception:
                return {
                    "success": False,
                    "status_code": e.response.status_code,
                    "error": str(e)
                }
                
        except httpx.RequestError as e:
            logger.error(f"Request error: {str(e)}")
            return {
                "success": False,
                "error": f"Request failed: {str(e)}"
            }
            
        except Exception as e:
            logger.error(f"Unexpected error: {str(e)}")
            return {
                "success": False,
                "error": f"Unexpected error: {str(e)}"
            }
    
    async def connect(self) -> Dict[str, Any]:
        """
        Test connection to the Fabric network through the API gateway.
        
        Returns:
            Dict with connection status
        """
        try:
            # Call health endpoint or another lightweight endpoint
            result = await self._make_request("GET", "health")
            
            # Add connection metadata
            return {
                "success": True,
                "api_url": self.api_url,
                "organization": self.organization,
                "channel": self.channel,
                "status": result
            }
            
        except Exception as e:
            logger.error(f"Connection test failed: {str(e)}")
            return {
                "success": False,
                "error": f"Connection test failed: {str(e)}"
            }
    
    async def query_chaincode(
        self,
        chaincode_id: str,
        function_name: str,
        args: List[str],
        channel_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Query a chaincode function (read-only transaction) through the API gateway.
        
        Args:
            chaincode_id: ID of the chaincode to query
            function_name: Name of the function to call
            args: List of arguments to pass to the function
            channel_name: Optional channel name (uses default if not provided)
            
        Returns:
            Dict containing the query result
        """
        # Use provided channel name or default
        channel = channel_name or self.channel
        
        # Prepare request data
        data = {
            "chaincode": chaincode_id,
            "function": function_name,
            "args": args,
            "channel": channel,
            "organization": self.organization
        }
        
        # Make request to query endpoint
        endpoint = "chaincode/query"
        result = await self._make_request("POST", endpoint, data=data)
        
        return result
    
    async def invoke_chaincode(
        self,
        chaincode_id: str,
        function_name: str,
        args: List[str],
        channel_name: Optional[str] = None,
        transient_data: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """
        Invoke a chaincode function (write transaction) through the API gateway.
        
        Args:
            chaincode_id: ID of the chaincode to invoke
            function_name: Name of the function to call
            args: List of arguments to pass to the function
            channel_name: Optional channel name (uses default if not provided)
            transient_data: Optional transient data (private data)
            
        Returns:
            Dict containing the invoke result
        """
        # Use provided channel name or default
        channel = channel_name or self.channel
        
        # Prepare request data
        data = {
            "chaincode": chaincode_id,
            "function": function_name,
            "args": args,
            "channel": channel,
            "organization": self.organization
        }
        
        # Add transient data if provided
        if transient_data:
            data["transient"] = transient_data
        
        # Make request to invoke endpoint
        endpoint = "chaincode/invoke"
        result = await self._make_request("POST", endpoint, data=data)
        
        return result
    
    async def get_channel_info(self, channel_name: Optional[str] = None) -> Dict[str, Any]:
        """
        Get information about a channel through the API gateway.
        
        Args:
            channel_name: Optional channel name (uses default if not provided)
            
        Returns:
            Dict containing channel information
        """
        # Use provided channel name or default
        channel = channel_name or self.channel
        
        # Make request to channel info endpoint
        endpoint = f"channels/{channel}"
        result = await self._make_request("GET", endpoint)
        
        return result
    
    async def close(self):
        """Close the HTTP client."""
        await self.client.aclose()


# Optional: Create a factory function to get the appropriate client based on configuration
async def get_fabric_client(use_http: bool = False, **kwargs) -> Union['FabricClientHTTP', Any]:
    """
    Factory function to get the appropriate Fabric client.
    
    Args:
        use_http: Whether to use the HTTP REST client
        **kwargs: Additional configuration parameters
        
    Returns:
        A Fabric client instance
    """
    if use_http:
        # Use the HTTP REST client
        from app.clients.fabric_client_http import FabricClientHTTP
        return FabricClientHTTP(**kwargs)
    else:
        # Use the SDK client
        from app.clients.fabric_client import FabricClient
        return FabricClient(**kwargs) 