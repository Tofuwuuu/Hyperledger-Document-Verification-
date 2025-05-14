// DEV ONLY: Utility to enable self-verification through browser console
// This is intended for development and testing purposes only
// Not for production use

/**
 * Manually sets the user as verified in all storage locations
 * This allows bypassing backend verification for development/testing
 * 
 * @returns {boolean} - True if verification was successful
 */
export const verifySelf = () => {
  try {
    // 1. Update localStorage
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    user.is_verified = true;
    localStorage.setItem('user', JSON.stringify(user));
    
    // 2. Set sessionStorage flag
    sessionStorage.setItem('user_verified', 'true');
    
    console.log('✅ User verification status updated successfully');
    console.log('⚠️ NOTE: This is a development utility ONLY');
    console.log('⚠️ Verification status will reset if you clear browser storage or log out');
    
    return true;
  } catch (error) {
    console.error('Failed to set verification:', error);
    return false;
  }
};

// For easy console access
if (window) {
  // @ts-ignore
  window.__cvsuVerifyUser = verifySelf;
}

// Export a message with instructions
export const getVerificationInstructions = () => {
  return `
    To verify your account for testing:
    
    1. Open browser console (F12 or right-click -> Inspect -> Console)
    2. Type: window.__cvsuVerifyUser()
    3. Refresh the page
  `;
};

export default { verifySelf, getVerificationInstructions }; 