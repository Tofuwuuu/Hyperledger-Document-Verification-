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