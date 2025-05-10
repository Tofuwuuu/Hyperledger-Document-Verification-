# CVSU Carmona Alumni Profile with Blockchain Document Verification - Backend

This is the backend for the CVSU Carmona Alumni Profile Management System with Blockchain Document Verification. It's built with Python, FastAPI, MongoDB, and Hyperledger Fabric for blockchain integration.

## Features

- Alumni profile management
- Document upload and management
- Document verification using blockchain technology
- Secure authentication and authorization
- Admin dashboard for managing verifications

## Prerequisites

- Python 3.9+
- MongoDB
- Hyperledger Fabric (or access to a Hyperledger Fabric network)

## Setup and Installation

1. Clone the repository
2. Create a virtual environment:
   ```
   python -m venv venv
   ```
3. Activate the virtual environment:
   - Windows: `venv\Scripts\activate`
   - Unix/MacOS: `source venv/bin/activate`
4. Install dependencies:
   ```
   pip install -r requirements.txt
   ```
5. Configure the environment variables in `.env` file:
   ```
   # Update the MongoDB and Hyperledger Fabric settings
   ```
6. Set up Hyperledger Fabric:
   - Update the network configuration in `app/blockchain/network-config.yaml`
   - Ensure you have access to a running Hyperledger Fabric network

## Running the Application

To start the development server:

```
python run.py
```

The API will be available at `http://localhost:8000`

## API Documentation

Once the application is running, you can access the interactive API documentation:

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Project Structure

- `app/`: Main application package
  - `main.py`: Application entry point
  - `models/`: Pydantic models
  - `routes/`: API routes
  - `blockchain/`: Hyperledger Fabric integration
  - `utils/`: Utility functions
  - `config/`: Configuration files
- `run.py`: Script to run the application 

## CORS Configuration

The API uses explicit CORS (Cross-Origin Resource Sharing) settings to ensure security while allowing access from authorized frontend applications. The CORS settings are configured in:

- `app/core/config.py`: Defines the list of allowed origins
- `app/main.py`: Configures the CORS middleware with specific allowed methods and headers

You can modify the allowed origins by:
1. Updating the `CORS_ORIGINS` list in `app/core/config.py`
2. Or by setting the `CORS_ORIGINS` environment variable as a comma-separated list of domains

For security reasons, wildcard origins (*) should not be used in production environments.

Example environment variable setting:
```
CORS_ORIGINS=https://alumni-frontend-zzr2.onrender.com,http://localhost:3000,http://localhost:5173
``` 