// Run this in browser console to force verification status
function fixVerificationStatus() {
  try {
    // Get current user from localStorage
    const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
    console.log('Current user data:', storedUser);
    
    if (!storedUser || !storedUser.email) {
      console.error('No user data found in localStorage or user has no email');
      return;
    }
    
    console.log('Updating verification status for user:', storedUser.email);
    
    // Update verification status
    storedUser.is_verified = true;
    
    // Save back to localStorage
    localStorage.setItem('user', JSON.stringify(storedUser));
    console.log('User verification status updated in localStorage');
    
    // Also set session storage flag
    sessionStorage.setItem('user_verified', 'true');
    console.log('Session storage verification flag set');
    
    // Reload the page to apply changes
    console.log('Reloading page to apply changes...');
    window.location.reload();
  } catch (e) {
    console.error('Error updating verification status:', e);
  }
}

// Function to check current verification status without changing anything
function checkVerificationStatus() {
  try {
    // Get current user from localStorage
    const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
    
    // Check all verification sources
    const isVerifiedInStorage = storedUser.is_verified === true;
    const sessionVerified = sessionStorage.getItem('user_verified') === 'true';
    const isAdmin = storedUser.is_admin === true;
    
    console.log('Verification status check:');
    console.log('- User email:', storedUser.email || 'No email found');
    console.log('- localStorage is_verified:', isVerifiedInStorage);
    console.log('- sessionStorage verified flag:', sessionVerified);
    console.log('- User is admin:', isAdmin);
    console.log('- Overall verification status:', isVerifiedInStorage || sessionVerified || isAdmin);
    
    return {
      email: storedUser.email,
      isVerifiedInStorage,
      sessionVerified,
      isAdmin,
      isVerified: isVerifiedInStorage || sessionVerified || isAdmin
    };
  } catch (e) {
    console.error('Error checking verification status:', e);
    return { error: e.message };
  }
}

// Just call these functions in your console
console.log('This script is loaded. Run one of these functions:');
console.log('1. checkVerificationStatus() - Check current verification status');
console.log('2. fixVerificationStatus() - Fix verification status for current user'); 