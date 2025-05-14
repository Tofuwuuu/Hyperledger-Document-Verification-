// Update user verification status in MongoDB
// Run this script on your server

const { MongoClient } = require('mongodb');

// Connection URL and database name
const url = process.env.MONGODB_URL || 'mongodb://localhost:27017';
const dbName = process.env.MONGODB_DB || 'cvsu_alumni';

// User ID to update
const userId = '6804c06543846509ed9ba2ed';

async function updateUserVerification() {
  const client = new MongoClient(url);
  
  try {
    // Connect to the MongoDB server
    await client.connect();
    console.log('Connected to MongoDB server');
    
    // Get the database and collections
    const db = client.db(dbName);
    const usersCollection = db.collection('users');
    const alumniCollection = db.collection('alumni');
    
    // Update the user record
    const userResult = await usersCollection.updateOne(
      { _id: userId },
      {
        $set: {
          is_verified: true,
          verification_date: new Date(),
          verification_notes: 'Verified manually',
          updated_at: new Date()
        }
      }
    );
    
    console.log(`User update result: ${userResult.modifiedCount} document(s) modified`);
    
    // Update the alumni record
    const alumniResult = await alumniCollection.updateOne(
      { user_id: userId },
      {
        $set: {
          is_verified: true,
          verification_date: new Date(),
          updated_at: new Date()
        }
      }
    );
    
    console.log(`Alumni update result: ${alumniResult.modifiedCount} document(s) modified`);
    
    // Verify the changes
    const updatedUser = await usersCollection.findOne({ _id: userId });
    console.log('Updated user verification status:', updatedUser.is_verified);
    
    const updatedAlumni = await alumniCollection.findOne({ user_id: userId });
    if (updatedAlumni) {
      console.log('Updated alumni verification status:', updatedAlumni.is_verified);
    }
    
    return {
      success: true,
      userUpdated: userResult.modifiedCount > 0,
      alumniUpdated: alumniResult.modifiedCount > 0
    };
  } catch (error) {
    console.error('Error updating verification status:', error);
    return {
      success: false,
      error: error.message
    };
  } finally {
    await client.close();
    console.log('MongoDB connection closed');
  }
}

// Run the function
updateUserVerification()
  .then(result => console.log('Update completed:', result))
  .catch(error => console.error('Update failed:', error)); 