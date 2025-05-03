import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Suspense, lazy } from 'react';
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

  // Support for functional children that need to know if the user is an admin
  if (typeof children === 'function') {
    return children({ isAdmin: isAdmin() });
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

function App() {
  return (
    <AuthProvider>
      <Router>
        <Suspense fallback={<LoadingSpinner />}>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<MainLayout />}>
              <Route index element={<HomePage />} />
              <Route path="about" element={<AboutPage />} />
              <Route path="login" element={<LoginPage />} />
              <Route path="register" element={<RegisterPage />} />
              <Route path="verify" element={<VerifyPage />} />
              <Route path="alumni-directory" element={<AlumniDirectoryPage />} />
              <Route path="alumni/:id" element={<AlumniProfilePage />} />
              <Route path="reset-password" element={<ResetPasswordPage />} />
              <Route path="events" element={<EventsPage />} />
              <Route path="events/:eventId" element={<EventDetailPage />} />
              <Route path="quick-register/:eventId/:token" element={<QuickRegisterPage />} />
            </Route>

            {/* Redirect /dashboard to /alumni or /admin based on user role */}
            <Route path="/dashboard" element={
              <ProtectedRoute>
                {({ isAdmin }) => (
                  <Navigate to={isAdmin ? "/admin" : "/alumni"} replace />
                )}
              </ProtectedRoute>
            } />
            <Route path="/dashboard/*" element={
              <ProtectedRoute>
                {({ isAdmin }) => (
                  <Navigate to={isAdmin ? "/admin" : "/alumni"} replace />
                )}
              </ProtectedRoute>
            } />

            {/* Alumni routes - for regular authenticated users */}
            <Route 
              path="/alumni" 
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<AdminDashboardPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="documents" element={<DocumentsPage />} />
              <Route path="documents/upload" element={<DocumentUploadPage />} />
              <Route path="document-requests" element={<DocumentRequestPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="registrations" element={<MyRegistrationsPage />} />
            </Route>

            {/* Admin routes - only for administrators */}
            <Route 
              path="/admin" 
              element={
                <AdminRoute adminOnly={true}>
                  <DashboardLayout />
                </AdminRoute>
              }
            >
              <Route index element={<AdminDashboardPage />} />
              <Route path="profile" element={<AdminProfilePage />} />
              <Route path="documents" element={<DocumentsPage />} />
              <Route path="documents/upload" element={<DocumentUploadPage />} />
              <Route path="document-requests" element={<DocumentRequestPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="registrations" element={<MyRegistrationsPage />} />
              
              {/* Admin-only routes */}
              <Route path="verifications" element={
                <AdminRoute adminOnly={true}>
                  <AdminVerificationPage />
                </AdminRoute>
              } />
              <Route path="admin-documents" element={
                <AdminRoute adminOnly={true}>
                  <AdminDocumentsPage />
                </AdminRoute>
              } />
              <Route path="document-requests-admin" element={
                <AdminRoute adminOnly={true}>
                  <AdminDocumentRequestsPage />
                </AdminRoute>
              } />
              <Route path="documents/admin-upload" element={
                <AdminRoute adminOnly={true}>
                  <AdminDocumentUploadPage />
                </AdminRoute>
              } />
              <Route path="events" element={
                <AdminRoute adminOnly={true}>
                  <AdminEventsPage />
                </AdminRoute>
              } />
              <Route path="events/new" element={
                <AdminRoute adminOnly={true}>
                  <AdminEventFormPage />
                </AdminRoute>
              } />
              <Route path="events/edit/:eventId" element={
                <AdminRoute adminOnly={true}>
                  <AdminEventFormPage />
                </AdminRoute>
              } />
              <Route path="events/registrations/:eventId" element={
                <AdminRoute adminOnly={true}>
                  <EventRegistrationsPage />
                </AdminRoute>
              } />
              <Route path="events/attendees/:eventId" element={
                <AdminRoute adminOnly={true}>
                  <EventAttendeesPage />
                </AdminRoute>
              } />
              <Route path="event-registrations" element={
                <AdminRoute adminOnly={true}>
                  <AdminEventRegistrationsPage />
                </AdminRoute>
              } />
              <Route path="alumni" element={
                <AdminRoute adminOnly={true}>
                  <AdminAlumniPage />
                </AdminRoute>
              } />
              <Route path="alumni/add" element={
                <AdminRoute adminOnly={true}>
                  <AlumniProfilePage isAdmin={true} isNew={true} />
                </AdminRoute>
              } />
              <Route path="alumni/edit/:alumniId" element={
                <AdminRoute adminOnly={true}>
                  <AlumniProfilePage isAdmin={true} />
                </AdminRoute>
              } />
              <Route path="user-verification" element={
                <AdminRoute adminOnly={true}>
                  <AdminUserVerificationPage />
                </AdminRoute>
              } />
              <Route path="new-registrations" element={
                <AdminRoute adminOnly={true}>
                  <AdminNewRegistrationsPage />
                </AdminRoute>
              } />
              <Route path="users" element={
                <AdminRoute adminOnly={true}>
                  <AdminUserManagementPage />
                </AdminRoute>
              } />
              <Route path="roles" element={
                <AdminRoute adminOnly={true}>
                  <AdminRoleManagementPage />
                </AdminRoute>
              } />
            </Route>

            {/* Catch-all route */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
        <ToastContainer position="top-right" autoClose={5000} hideProgressBar={false} />
      </Router>
    </AuthProvider>
  );
}

export default App;
