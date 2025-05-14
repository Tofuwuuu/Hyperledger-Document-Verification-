/**
 * Fix Verification Status
 * 
 * This utility script helps fix issues where a user's verification status
 * is out of sync between the server and client.
 * 
 * Run in browser console to:
 * 1. Clear cached verification status
 * 2. Force reload user data from server
 * 3. Fix inconsistent is_verified flags
 */

function fixVerificationStatus() {
  console.log('📋 Starting verification status fix...');
  
  try {
    // Get the current user from localStorage
    let userData = {};
    try {
      userData = JSON.parse(localStorage.getItem('user') || '{}');
      console.log('Current userData:', userData);
    } catch (e) {
      console.error('Error parsing user data:', e);
      userData = {};
    }
    
    // Set verification flag to true
    if (userData && Object.keys(userData).length > 0) {
      userData.is_verified = true;
      console.log('Updated is_verified to true');
      
      // Save back to localStorage
      localStorage.setItem('user', JSON.stringify(userData));
      console.log('Saved updated user data to localStorage');
      
      // Also set sessionStorage flag
      sessionStorage.setItem('user_verified', 'true');
      console.log('Set user_verified=true in sessionStorage');
    } else {
      console.error('No user data found in localStorage');
    }
    
    console.log('✅ Verification status fix completed. Please refresh the page.');
    
    // Offer to reload the page
    if (confirm('Verification status has been updated. Reload page now?')) {
      window.location.reload();
    }
  } catch (e) {
    console.error('Error fixing verification status:', e);
  }
}

function checkVerificationStatus() {
  console.log('📋 Checking verification status...');
  
  try {
    // Get user data from all storage locations
    let localUser = {};
    try {
      localUser = JSON.parse(localStorage.getItem('user') || '{}');
    } catch (e) {
      console.error('Error parsing localStorage user:', e);
    }
    
    // Check token
    const token = localStorage.getItem('token');
    const refreshToken = localStorage.getItem('refreshToken');
    
    // Check session storage
    const sessionVerified = sessionStorage.getItem('user_verified');
    
    console.log('VERIFICATION STATUS CHECK:');
    console.log('- localStorage user:', localUser);
    console.log('- localStorage user.is_verified:', localUser.is_verified);
    console.log('- localStorage user.is_admin:', localUser.is_admin);
    console.log('- token exists:', !!token);
    console.log('- refreshToken exists:', !!refreshToken);
    console.log('- sessionStorage user_verified:', sessionVerified);
    
    if (localUser.is_verified) {
      console.log('✅ User is verified in localStorage');
    } else {
      console.log('❌ User is NOT verified in localStorage');
    }
    
    if (sessionVerified === 'true') {
      console.log('✅ User is verified in sessionStorage');
    } else {
      console.log('❌ User is NOT verified in sessionStorage');
    }
  } catch (e) {
    console.error('Error checking verification status:', e);
  }
}

console.log('Verification utility loaded. Available commands:');
console.log('1. checkVerificationStatus() - Check current verification status');
console.log('2. fixVerificationStatus() - Fix verification status for current user'); 