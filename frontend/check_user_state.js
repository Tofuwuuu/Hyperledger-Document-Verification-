// Utility script to check user state and force verification if needed

function checkAndFixUserVerification() {
  console.log('Checking user verification status...');
  
  try {
    // Get user data from localStorage
    const userData = JSON.parse(localStorage.getItem('user') || '{}');
    
    console.log('Current user data:', userData);
    console.log('Email:', userData.email);
    console.log('is_verified:', userData.is_verified);
    
    // Check for rodericksalise812@gmail.com specifically
    if (userData.email === 'rodericksalise812@gmail.com') {
      console.log('Found target account - ensuring verification is set');
      
      // Set verification status to true
      if (!userData.is_verified) {
        userData.is_verified = true;
        localStorage.setItem('user', JSON.stringify(userData));
        console.log('Updated is_verified to true');
      } else {
        console.log('Already verified in localStorage');
      }
      
      // Return the updated user
      return {
        success: true,
        message: 'Account verification status updated',
        verified: true,
        user: userData
      };
    } else {
      console.log('Not the target account');
      return {
        success: false,
        message: 'Not the target account',
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
    alert('Verification status updated successfully! Please refresh the page.');
  } else {
    alert('Unable to update verification status: ' + result.message);
  }
}

// Export for module usage
if (typeof module !== 'undefined') {
  module.exports = { checkAndFixUserVerification };
} 