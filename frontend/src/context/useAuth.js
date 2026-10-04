import { useContext } from 'react';
import { AuthContext } from './authContextInstance';

// Hook to use the auth context
export const useAuth = () => {
  return useContext(AuthContext);
};
