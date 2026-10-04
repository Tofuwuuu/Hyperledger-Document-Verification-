import { createContext } from 'react';

// Kept in its own module so AuthContext.jsx only exports components
// (react-refresh/only-export-components).
export const AuthContext = createContext();
