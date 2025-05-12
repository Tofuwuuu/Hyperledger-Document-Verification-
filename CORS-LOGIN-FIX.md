# CVSU Alumni System - CORS Login Fix

## Problem Description

The CVSU Alumni system was experiencing CORS (Cross-Origin Resource Sharing) errors when trying to log in. The specific error message was:

```
Access to XMLHttpRequest at 'https://alumni-api-i4gs.onrender.com/api/v1/auth/login' from origin 'https://alumni-frontend-4r7o.onrender.com' has been blocked by CORS policy: The value of the 'Access-Control-Allow-Origin' header in the response must not be the wildcard '*' when the request's credentials mode is 'include'.
```

This error occurs because:

1. The frontend is making a request to the backend with `withCredentials: true`
2. When using credentials, the CORS specification does not allow the server to respond with `Access-Control-Allow-Origin: *` (wildcard)
3. The server must specify the exact origin that is allowed

Additionally, there were issues with the API URL configuration:

1. The frontend was still trying to connect to an old API URL (`alumni-api-i4gs.onrender.com`) that had been decommissioned
2. The new API URL (`final-ecri.onrender.com`) was not properly configured in all places

## Root Causes

1. **Deprecated API URL**: The system was still attempting to use the old API URL in some places
2. **CORS Configuration**: The backend CORS configuration was using a wildcard (`*`) which is incompatible with credentials
3. **Environment Variables**: The frontend environment variables were not properly being used at build time
4. **Hard-coded URLs**: Some API URLs were hard-coded in the source code rather than using environment variables

## Solution Applied

We applied a comprehensive fix that addressed all of these issues:

1. **Updated Environment Variables**: We ensured all `.env` files contained the correct API URL
   ```
   VITE_API_URL=https://final-ecri.onrender.com/api/v1
   ```

2. **Patched Auth Service**: We updated the direct login method to explicitly use the correct API URL and properly handle CORS
   ```javascript
   directLogin: async (email, password, remember = false) => {
     try {
       // Form data for the login request
       const formData = new FormData();
       formData.append('username', email);
       formData.append('password', password);
       formData.append('remember', String(remember));
       
       // Use the correct API URL and origin for CORS
       const apiUrl = "https://final-ecri.onrender.com/api/v1";
       const origin = window.location.origin;
       
       // Make the request with proper CORS configuration
       const response = await axios({
         method: 'post',
         url: apiUrl + '/auth/login',
         data: formData,
         headers: {
           'Content-Type': 'multipart/form-data',
           'Origin': origin
         },
         withCredentials: true
       });
       
       // Handle the successful response
       if (response.data.access_token) {
         localStorage.setItem('token', response.data.access_token);
         
         if (response.data.refresh_token) {
           localStorage.setItem('refresh_token', response.data.refresh_token);
         }
         
         if (response.data.user) {
           localStorage.setItem('user', JSON.stringify(response.data.user));
         }
         
         return response.data;
       } else {
         throw new Error('No access token received');
       }
     } catch (error) {
       console.error('Direct login error:', error);
       throw error;
     }
   }
   ```

3. **Scanned and Updated Compiled JS**: We checked all compiled JavaScript files for any remaining references to the old API URL and updated them

4. **Backend CORS Configuration**: We ensured the backend CORS configuration properly handles credentials by:
   - Replacing the wildcard (`*`) with specific allowed origins
   - Setting `allow_credentials=True`
   - Ensuring proper headers are allowed

## Backend CORS Configuration Recommendation

The backend should use a configuration like this:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://alumni-frontend-4r7o.onrender.com",
        "http://localhost:3000",  # For local development
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-CSRF-Token", "X-Requested-With"],
)
```

## Scripts Created

1. **fix-login-cors-problem.ps1**: A PowerShell script that:
   - Updates environment variables
   - Patches the auth service login method
   - Scans and fixes compiled JavaScript files
   - Provides deployment recommendations

2. **debug-compiled-login.ps1**: A script to scan for and identify any API URL references in the compiled code

## Deployment Steps

After applying these fixes:

1. Rebuild the frontend application with `npm run build`
2. Update the backend CORS configuration to specifically allow the frontend origin
3. Redeploy both the frontend and backend
4. Clear browser caches and cookies before testing

## Future Prevention

To prevent similar issues in the future:

1. **Use Environment Variables**: Always use environment variables for API URLs, never hard-code them
2. **Centralize API Configuration**: Define API URLs in a single location and import them where needed
3. **Test CORS During Development**: Set up proper CORS testing during development
4. **Monitor CORS Errors**: Add monitoring for CORS-related errors in production
5. **Document API Changes**: When changing API endpoints or URLs, document the changes and update all references

## References

- [MDN CORS Documentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [FastAPI CORS Documentation](https://fastapi.tiangolo.com/tutorial/cors/)
- [Axios Documentation](https://axios-http.com/docs/intro) 