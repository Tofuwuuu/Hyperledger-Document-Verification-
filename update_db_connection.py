import os

def update_env_file():
    env_content = """MONGODB_URL=mongodb://localhost:27017/cvsu_alumni
MONGODB_DB=cvsu_alumni
SECRET_KEY=development_secret_key
USE_MOCK_DB=false"""

    with open('backend/.env', 'w') as f:
        f.write(env_content)
    
    print("✅ .env file updated to use local MongoDB connection")

if __name__ == "__main__":
    update_env_file() 