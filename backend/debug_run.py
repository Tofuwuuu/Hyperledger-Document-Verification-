import os
import sys
import logging

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)

# Log environment and system information
logger.info("Starting application debug script")
logger.info(f"Python version: {sys.version}")
logger.info(f"Current directory: {os.getcwd()}")
logger.info(f"Directory contents: {os.listdir('.')}")

# Check environment variables (redact sensitive info)
env_vars = {}
for key, value in os.environ.items():
    if key in ['MONGODB_URI', 'SECRET_KEY', 'PASSWORD']:
        env_vars[key] = f"{value[:10]}...REDACTED"
    else:
        env_vars[key] = value
logger.info(f"Environment variables: {env_vars}")

try:
    # Try to import key modules
    import fastapi
    import uvicorn
    import pymongo
    from dotenv import load_dotenv
    
    logger.info("Successfully imported required modules")
    
    # Load environment variables from .env file if it exists
    if os.path.exists('.env'):
        load_dotenv()
        logger.info("Loaded .env file")
    
    # Try to run the application
    logger.info("Attempting to run the application...")
    
    # Run the application with uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "10000")),
        log_level="info"
    )
    
except Exception as e:
    logger.error(f"Error starting application: {str(e)}", exc_info=True)
    sys.exit(1) 