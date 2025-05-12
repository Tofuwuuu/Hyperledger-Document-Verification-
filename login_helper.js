// Valid login credentials for the mock database
const validCredentials = [
  {
    email: "admin@cvsu.edu.ph",
    password: "secret",
    isAdmin: true
  },
  {
    email: "user@example.com",
    password: "secret",
    isAdmin: false
  }
];

// Helper function to get valid credentials
function getValidCredentials(role = null) {
  if (role === 'admin') {
    return validCredentials.find(user => user.isAdmin);
  } else if (role === 'user') {
    return validCredentials.find(user => !user.isAdmin);
  }
  // Return first user by default
  return validCredentials[0];
}

// Log the valid credentials to console for easy reference
console.log("=== Valid Login Credentials ===");
validCredentials.forEach(cred => {
  console.log(`Email: ${cred.email}`);
  console.log(`Password: ${cred.password}`);
  console.log(`Role: ${cred.isAdmin ? 'Admin' : 'Regular User'}`);
  console.log("-----------------------");
});

// Export the credentials for use in other files
export default {
  validCredentials,
  getValidCredentials
}; 