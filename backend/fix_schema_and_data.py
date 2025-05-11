import asyncio
import logging
import importlib
import sys
import os

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('schema_migration.log')
    ]
)
logger = logging.getLogger(__name__)

async def run_migration_process():
    """Run the complete migration process in the correct order:
    1. First migrate user data to standardize is_verified field
    2. Then apply schema validation
    """
    try:
        # Import the migration modules
        logger.info("Starting data and schema migration process")
        
        # Step 1: Import and run the data migration
        logger.info("Step 1: Migrating user verification data")
        migrate_module = importlib.import_module("migrate_user_verification")
        await migrate_module.migrate_verification_field()
        logger.info("Data migration completed")
        
        # Step 2: Import and run the schema validation
        logger.info("Step 2: Applying schema validation")
        schema_module = importlib.import_module("add_schema_validation")
        await schema_module.add_schema_validation()
        logger.info("Schema validation applied")
        
        logger.info("Migration process completed successfully")
        
    except Exception as e:
        logger.error(f"Error during migration process: {e}")
        raise

if __name__ == "__main__":
    # Check if we're in the correct directory
    if not os.path.exists("migrate_user_verification.py") or not os.path.exists("add_schema_validation.py"):
        print("Error: Migration scripts not found in current directory.")
        print("Please run this script from the backend directory where the migration scripts are located.")
        sys.exit(1)
        
    print("Starting data migration and schema validation process...")
    asyncio.run(run_migration_process())
    print("Process complete. See schema_migration.log for details.") 