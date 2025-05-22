import React, { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';

// Protected route component
const ProtectedRoute = ({ children }) => {
  const { currentUser, loading, isAuthenticated } = useAuth();

  // Debug info to help diagnose the issue
  console.log('ProtectedRoute check - currentUser:', currentUser);
  console.log('hasCompletedQuestionnaire value:', currentUser?.hasCompletedQuestionnaire);

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated || !currentUser) {
    // Save the attempted URL for redirecting after login
    const currentPath = window.location.pathname;
    sessionStorage.setItem('redirectAfterLogin', currentPath);
    
    return <Navigate to="/login" replace />;
  }

  // Only redirect if hasCompletedQuestionnaire is EXPLICITLY false 
  // (not undefined, not null, not missing - only if it's actually false)
  // This ensures if the flag is true, missing, or any other value, we don't redirect
  if (currentUser.hasCompletedQuestionnaire === false && !window.location.pathname.includes('/questionnaire')) {
    console.log('Redirecting to questionnaire - hasCompletedQuestionnaire is explicitly false');
    return <Navigate to="/questionnaire" replace />;
  }

  // Support for functional children that need to know if the user is an admin
  if (typeof children === 'function') {
    return children({ isAdmin: isAdmin() });
  }

  return children;
};

// Modified AdminRoute component to handle both admin and regular users
const AdminRoute = ({ children, adminOnly = false }) => {
  const { currentUser, loading, isAuthenticated, isAdmin } = useAuth();
  
  // Debug info
  console.log('AdminRoute check - currentUser:', currentUser);
  console.log('hasCompletedQuestionnaire value:', currentUser?.hasCompletedQuestionnaire);

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated || !currentUser) {
    // Save the attempted URL for redirecting after login
    const currentPath = window.location.pathname;
    sessionStorage.setItem('redirectAfterLogin', currentPath);
    
    return <Navigate to="/login" replace />;
  }

  // Only redirect if hasCompletedQuestionnaire is EXPLICITLY false
  if (currentUser.hasCompletedQuestionnaire === false && !window.location.pathname.includes('/questionnaire')) {
    console.log('Redirecting to questionnaire - hasCompletedQuestionnaire is explicitly false');
    return <Navigate to="/questionnaire" replace />;
  }

  // Only check for admin if the route explicitly requires it
  if (adminOnly && !isAdmin()) {
    return <Navigate to="/alumni" replace />;
  }

  // Support for functional children that need to know if the user is an admin
  if (typeof children === 'function') {
    return children({ isAdmin: isAdmin() });
  }

  return children;
}; 