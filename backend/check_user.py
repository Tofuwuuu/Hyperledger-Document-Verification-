from pymongo import MongoClient
import sys

# Connect to MongoDB
client = MongoClient('mongodb://localhost:27017/')
db = client['cvsu_alumni']

# Check if user exists
email = 'rodericksalise801@gmail.com'
user = db.users.find_one({'email': email})

print(f'Checking if {email} exists in database...')
print(f'User found: {user is not None}')

# List all users
print('\nAll users in database:')
users = list(db.users.find({}, {'email': 1, '_id': 0}))
print(f'Total users: {len(users)}')
for user in users[:5]:  # Show first 5 users
    print(f"- {user.get('email', 'No email')}")

# Check MongoDB connection
try:
    # The ismaster command is cheap and does not require auth.
    client.admin.command('ismaster')
    print("\nMongoDB connection successful!")
except Exception as e:
    print(f"\nMongoDB connection failed: {e}") 