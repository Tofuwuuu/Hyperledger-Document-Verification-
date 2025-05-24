import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Suspense, lazy, useEffect } from 'react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Layouts
import MainLayout from './layouts/MainLayout';
import DashboardLayout from './layouts/DashboardLayout';

// Pages - lazy loaded for better performance
const HomePage = lazy(() => import('./pages/HomePage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'));
const EmployerRegisterPage = lazy(() => import('./pages/auth/EmployerRegisterPage'));
const QuestionnairePage = lazy(() => import('./pages/QuestionnairePage'));

// Removing regular dashboard page import and only keeping admin dashboard
// const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage'));
const ProfilePage = lazy(() => import('./pages/dashboard/ProfilePage'));
const DocumentsPage = lazy(() => import('./pages/dashboard/DocumentsPage'));
const DocumentUploadPage = lazy(() => import('./pages/dashboard/DocumentUploadPage'));
const NotificationsPage = lazy(() => import('./pages/dashboard/NotificationsPage'));
const VerifyPage = lazy(() => import('./pages/VerifyPage'));
const AlumniDirectoryPage = lazy(() => import('./pages/AlumniDirectoryPage'));
const AlumniProfilePage = lazy(() => import('./pages/AlumniProfilePage'));
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage'));
const AdminAlumniPage = lazy(() => import('./pages/admin/AdminAlumniPage'));
const AdminVerificationPage = lazy(() => import('./pages/admin/AdminVerificationPage'));
const AdminDocumentsPage = lazy(() => import('./pages/admin/AdminDocumentsPage'));
const AdminDocumentUploadPage = lazy(() => import('./pages/admin/AdminDocumentUploadPage'));
const AdminUserManagementPage = lazy(() => import('./pages/admin/AdminUserManagementPage'));
const AdminRoleManagementPage = lazy(() => import('./pages/admin/AdminRoleManagementPage'));
const AdminProfilePage = lazy(() => import('./pages/admin/AdminProfilePage'));
const DocumentVerificationPage = lazy(() => import('./pages/dashboard/DocumentVerificationPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const QuickRegisterPage = lazy(() => import('./pages/QuickRegisterPage'));
const QuickAttendPage = lazy(() => import('./pages/QuickAttendPage'));
const RecruitmentPage = lazy(() => import('./pages/dashboard/RecruitmentPage'));

// Employer pages
const EmployerDashboardPage = lazy(() => import('./pages/employer/EmployerDashboardPage'));
const EmployerProfilePage = lazy(() => import('./pages/employer/EmployerProfilePage'));
const EmployerVerificationsPage = lazy(() => import('./pages/employer/EmployerVerificationsPage'));
const EmployerRecruitmentPage = lazy(() => import('./pages/employer/EmployerRecruitmentPage'));
const JobApplicationsPage = lazy(() => import('./pages/employer/JobApplicationsPage'));
const ApplicationDetailPage = lazy(() => import('./pages/employer/ApplicationDetailPage'));

// Event pages
const EventsPage = lazy(() => import('./pages/EventsPage'));
const EventDetailPage = lazy(() => import('./pages/EventDetailPage'));
const MyRegistrationsPage = lazy(() => import('./pages/dashboard/MyRegistrationsPage'));
const AdminEventsPage = lazy(() => import('./pages/admin/AdminEventsPage'));
const AdminEventFormPage = lazy(() => import('./pages/admin/AdminEventFormPage'));
const EventRegistrationsPage = lazy(() => import('./pages/admin/EventRegistrationsPage'));
const AdminEventRegistrationsPage = lazy(() => import('./pages/admin/AdminEventRegistrationsPage'));
const EventAttendeesPage = lazy(() => import('./pages/admin/EventAttendeesPage'));
const AdminNewRegistrationsPage = lazy(() => import('./pages/admin/AdminNewRegistrationsPage'));

// Document Request pages
const DocumentRequestPage = lazy(() => import('./pages/dashboard/DocumentRequestPage'));
const AdminDocumentRequestsPage = lazy(() => import('./pages/admin/AdminDocumentRequestsPage'));

// Exit Interviews page
const AdminExitInterviewsPage = lazy(() => import('./pages/admin/AdminExitInterviewsPage'));

// New import for AdminUserVerificationPage
import AdminUserVerificationPage from './pages/admin/AdminUserVerificationPage';

// Loading component
const LoadingSpinner = () => (
  <div className="flex justify-center items-center h-screen">
    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-cvsu-green"></div>
  </div>
);

// Protected route component
const ProtectedRoute = ({ children }) => {
  const { currentUser, loading, isAuthenticated, isAdmin, hasRole } = useAuth();

  // Add debug logs to see what's happening with the user data
  console.log('ProtectedRoute - currentUser:', currentUser);
  
  if (currentUser) {
    // Log the specific field values to help debug
    console.log('hasCompletedQuestionnaire:', currentUser.hasCompletedQuestionnaire);
    console.log('has_completed_questionnaire:', currentUser.has_completed_questionnaire);
    console.log('is_employer:', currentUser.is_employer);
  }

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated || !currentUser) {
    // Save the attempted URL for redirecting after login
    const currentPath = window.location.pathname;
    sessionStorage.setItem('redirectAfterLogin', currentPath);
    
    return <Navigate to="/login" replace />;
  }

  // Check if user needs to complete the questionnaire
  // Skip the questionnaire check for admins and employers
  const userIsAdmin = isAdmin();
  const userIsEmployer = currentUser.is_employer === true || hasRole('employer');
  
  if (!userIsAdmin && !userIsEmployer) {
    // Only regular alumni users need to complete the questionnaire
    const hasCompletedForm = 
      currentUser.hasCompletedQuestionnaire === true || 
      currentUser.has_completed_questionnaire === true;
      
    if (hasCompletedForm === false && !window.location.pathname.includes('/questionnaire')) {
      console.log('Redirecting to questionnaire - form not completed');
      return <Navigate to="/questionnaire" replace />;
    }
  }

  // Support for functional children that need to know if the user is an admin or employer
  if (typeof children === 'function') {
    return children({ isAdmin: userIsAdmin, isEmployer: userIsEmployer });
  }

  return children;
};

// Modified AdminRoute component to handle both admin and regular users
const AdminRoute = ({ children, adminOnly = false }) => {
  const { currentUser, loading, isAuthenticated, isAdmin } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated || !currentUser) {
    // Save the attempted URL for redirecting after login
    const currentPath = window.location.pathname;
    sessionStorage.setItem('redirectAfterLogin', currentPath);
    
    return <Navigate to="/login" replace />;
  }

  // Check if user is an employer - employers shouldn't access admin routes
  const userIsEmployer = currentUser.is_employer === true || currentUser.type === 'employer';
  if (userIsEmployer) {
    return <Navigate to="/employer" replace />;
  }

  // Check if user needs to complete the questionnaire
  // Skip the questionnaire check for admins
  const userIsAdmin = isAdmin();
  
  if (!userIsAdmin) {
    // Only regular users need to complete the questionnaire
    const hasCompletedForm = 
      currentUser.hasCompletedQuestionnaire === true || 
      currentUser.has_completed_questionnaire === true;
      
    if (hasCompletedForm === false && !window.location.pathname.includes('/questionnaire')) {
      console.log('AdminRoute - Redirecting to questionnaire - form not completed');
      return <Navigate to="/questionnaire" replace />;
    }
  }

  // Only check for admin if the route explicitly requires it
  if (adminOnly && !userIsAdmin) {
    return <Navigate to="/alumni" replace />;
  }

  // Support for functional children that need to know if the user is an admin
  if (typeof children === 'function') {
    return children({ isAdmin: isAdmin });
  }

  return children;
};

// Create router with routes configuration
const router = createBrowserRouter([
  {
    path: "/",
    element: <MainLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "about", element: <AboutPage /> },
      { path: "login", element: <LoginPage /> },
      { path: "register", element: <RegisterPage /> },
      { path: "employer/register", element: <EmployerRegisterPage /> },
      { path: "verify", element: <VerifyPage /> },
      { path: "alumni-directory", element: <AlumniDirectoryPage /> },
      { path: "alumni/:id", element: <AlumniProfilePage /> },
      { path: "reset-password", element: <ResetPasswordPage /> },
      { path: "events", element: <EventsPage /> },
      { path: "events/:eventId", element: <EventDetailPage /> },
      { path: "quick-register/:eventId/:token", element: <QuickRegisterPage /> },
      { path: "quick-attend/:attendanceToken", element: <QuickAttendPage /> },
      { path: "quick-attend/:attendanceToken/:secondPart", element: <QuickAttendPage /> }
    ]
  },
  {
    path: "/questionnaire",
    element: <ProtectedRoute><QuestionnairePage /></ProtectedRoute>
  },
  {
    path: "/dashboard",
    element: <ProtectedRoute>
              {({ isAdmin, isEmployer }) => (
                <Navigate to={isAdmin ? "/admin" : isEmployer ? "/employer" : "/alumni"} replace />
              )}
            </ProtectedRoute>
  },
  {
    path: "/dashboard/*",
    element: <ProtectedRoute>
              {({ isAdmin, isEmployer }) => (
                <Navigate to={isAdmin ? "/admin" : isEmployer ? "/employer" : "/alumni"} replace />
              )}
            </ProtectedRoute>
  },
  {
    path: "/employer",
    element: <ProtectedRoute>
              {({ isEmployer }) => (
                isEmployer ? <DashboardLayout /> : <Navigate to="/alumni" replace />
              )}
            </ProtectedRoute>,
    children: [
      { index: true, element: <EmployerDashboardPage /> },
      { path: "profile", element: <EmployerProfilePage /> },
      { path: "verifications", element: <EmployerVerificationsPage /> },
      { path: "recruitment", element: <EmployerRecruitmentPage /> },
      { path: "applications/:jobId", element: <JobApplicationsPage /> },
      { path: "applications/detail/:applicationId", element: <ApplicationDetailPage /> },
      // Don't allow employers to access alumni routes
      { path: "*", element: <Navigate to="/employer" replace /> }
    ]
  },
  {
    path: "/alumni",
    element: <ProtectedRoute>
              {({ isAdmin, isEmployer }) => {
                // Redirect employers to employer dashboard
                if (isEmployer) return <Navigate to="/employer" replace />;
                return <DashboardLayout />;
              }}
            </ProtectedRoute>,
    children: [
      { index: true, element: <AdminDashboardPage /> },
      { path: "profile", element: <ProfilePage /> },
      { path: "documents", element: <DocumentsPage /> },
      { path: "documents/upload", element: <DocumentUploadPage /> },
      { path: "document-requests", element: <DocumentRequestPage /> },
      { path: "notifications", element: <NotificationsPage /> },
      { path: "registrations", element: <MyRegistrationsPage /> },
      { path: "recruitment", element: <RecruitmentPage /> }
    ]
  },
  {
    path: "/admin",
    element: <AdminRoute adminOnly={true}><DashboardLayout /></AdminRoute>,
    children: [
      { index: true, element: <AdminDashboardPage /> },
      { path: "profile", element: <AdminProfilePage /> },
      { path: "alumni", element: <AdminAlumniPage /> },
      { path: "verifications", element: <AdminVerificationPage /> },
      { path: "user-verification", element: <AdminUserVerificationPage /> },
      { path: "user-verification/:userId", element: <AdminUserVerificationPage /> },
      { path: "admin-documents", element: <AdminDocumentsPage /> },
      { path: "documents", element: <AdminDocumentsPage /> },
      { path: "documents/upload", element: <AdminDocumentUploadPage /> },
      { path: "document-requests-admin", element: <AdminDocumentRequestsPage /> },
      { path: "document-requests", element: <AdminDocumentRequestsPage /> },
      { path: "exit-interviews", element: <AdminExitInterviewsPage /> },
      { path: "events", element: <AdminEventsPage /> },
      { path: "events/new", element: <AdminEventFormPage /> },
      { path: "events/edit/:id", element: <AdminEventFormPage /> },
      { path: "events/registrations/:eventId", element: <AdminEventRegistrationsPage /> },
      { path: "events/attendees/:eventId", element: <EventAttendeesPage /> },
      { path: "events/:eventId/registrations", element: <AdminEventRegistrationsPage /> },
      { path: "events/:eventId/attendees", element: <EventAttendeesPage /> },
      { path: "event-registrations", element: <AdminEventRegistrationsPage /> },
      { path: "new-registrations", element: <AdminNewRegistrationsPage /> },
      { path: "users", element: <AdminUserManagementPage /> },
      { path: "roles", element: <AdminRoleManagementPage /> }
    ]
  },
  {
    path: "*",
    element: <NotFoundPage />
  }
], {
  // Add future flags to address the warnings
  future: {
    v7_startTransition: true,
    v7_relativeSplatPath: true
  }
});

function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<LoadingSpinner />}>
        <RouterProvider router={router} />
      </Suspense>
      <ToastContainer position="top-right" autoClose={5000} hideProgressBar={false} />
    </AuthProvider>
  );
}

export default App;
