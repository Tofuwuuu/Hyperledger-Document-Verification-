// Utility script to check user state and force verification if needed

function checkAndFixUserVerification() {
  console.log('Checking user verification status...');
  
  try {
    // Get user data from localStorage
    const userData = JSON.parse(localStorage.getItem('user') || '{}');
    
    console.log('Current user data:', userData);
    console.log('Email:', userData.email);
    console.log('is_verified:', userData.is_verified);
    
    if (!userData.email) {
      return {
        success: false,
        message: 'No user data found or user not logged in',
        user: null
      };
    }
    
    // Set verification status to true for any account
    if (!userData.is_verified) {
      userData.is_verified = true;
      localStorage.setItem('user', JSON.stringify(userData));
      console.log('Updated is_verified to true for ' + userData.email);
      
      // Return the updated user
      return {
        success: true,
        message: 'Account verification status updated for ' + userData.email,
        verified: true,
        user: userData
      };
    } else {
      console.log('User already verified in localStorage');
      return {
        success: true,
        message: 'User already verified',
        verified: true,
        user: userData
      };
    }
  } catch (error) {
    console.error('Error checking/fixing user verification:', error);
    return {
      success: false,
      message: 'Error: ' + error.message,
      error: error
    };
  }
}

// Execute the check
const result = checkAndFixUserVerification();
console.log('Check result:', result);

// If in browser environment, show alert
if (typeof window !== 'undefined') {
  if (result.success) {
    alert('Verification status updated successfully for ' + (result.user?.email || 'unknown user') + '! Please refresh the page.');
  } else {
    alert('Unable to update verification status: ' + result.message);
  }
}

// Export for module usage
if (typeof module !== 'undefined') {
  module.exports = { checkAndFixUserVerification };
} 