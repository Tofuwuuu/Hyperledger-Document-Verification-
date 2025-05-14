import React from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { verifySelf } from './utils/verifyUser'

// Expose verification helper for development
if (import.meta.env.MODE === 'development') {
  window.__cvsuVerifyUser = verifySelf;
  console.log('Developer tools loaded. Use window.__cvsuVerifyUser() in console to verify your account for testing.');
}

// Delay rendering to ensure all dependencies are fully initialized
setTimeout(() => {
  const root = createRoot(document.getElementById('root'));
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}, 0);
