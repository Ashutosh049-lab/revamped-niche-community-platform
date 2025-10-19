import { Route, Routes } from 'react-router-dom'
import { useEffect } from 'react'
import { AuthProvider } from './features/auth/AuthProvider'
import RequireAuth from './features/auth/RequireAuth'
import Navigation from './components/Navigation'
import ErrorBoundary from './components/ErrorBoundary'
import AuthPage from './pages/AuthPage'
import HomePage from './pages/HomePage'
import ProfilePage from './pages/ProfilePage'
import NotificationsPage from './pages/NotificationsPage'
import SettingsPage from './pages/SettingsPage'
import CommunitiesPage from './features/community/CommunitiesPage'
import CommunityPage from './features/community/CommunityPage'
import FeedPage from './features/feed/FeedPage'
import AuthBanner from './components/AuthBanner'
import RealTimeNotifications from './components/RealTimeNotifications'
import { REALTIME_ANIMATION_STYLES } from './hooks/useRealTimeUpdates'
import ModerationPanel from './features/admin/ModerationPanel'
import SeederPage from './pages/SeederPage'
import AuthTestPage from './pages/AuthTestPage'

export default function App() {
  useEffect(() => {
    // Add animation styles to document head
    const styleElement = document.createElement('style');
    styleElement.textContent = REALTIME_ANIMATION_STYLES;
    document.head.appendChild(styleElement);
    
    return () => {
      // Cleanup styles on unmount
      if (document.head.contains(styleElement)) {
        document.head.removeChild(styleElement);
      }
    };
  }, []);

  return (
    <ErrorBoundary>
      <AuthProvider>
        <div className="min-h-screen bg-gray-50">
          <Navigation />
          <AuthBanner />
          
          <main>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<HomePage />} />
              <Route path="/communities" element={<CommunitiesPage />} />
              <Route path="/c/:communityId" element={<CommunityPage />} />
              <Route path="/c/:communityId/post/:postId" element={<CommunityPage />} />
              <Route path="/signin" element={<AuthPage />} />
              <Route path="/login" element={<AuthPage />} />
              <Route path="/signup" element={<AuthPage />} />
              <Route path="/auth" element={<AuthPage />} />
              
              {/* Protected Routes */}
              <Route path="/feed" element={<RequireAuth><ErrorBoundary><FeedPage /></ErrorBoundary></RequireAuth>} />
              <Route path="/notifications" element={<RequireAuth><ErrorBoundary><NotificationsPage /></ErrorBoundary></RequireAuth>} />
              <Route path="/profile/:userId?" element={<RequireAuth><ErrorBoundary><ProfilePage /></ErrorBoundary></RequireAuth>} />
              <Route path="/profile" element={<RequireAuth><ErrorBoundary><ProfilePage /></ErrorBoundary></RequireAuth>} />
              <Route path="/settings" element={<RequireAuth><ErrorBoundary><SettingsPage /></ErrorBoundary></RequireAuth>} />

              {/* Moderation */}
              <Route path="/moderation" element={<RequireAuth><ErrorBoundary><ModerationPanel /></ErrorBoundary></RequireAuth>} />
              
              {/* Database Seeder */}
              <Route path="/seed" element={<RequireAuth><ErrorBoundary><SeederPage /></ErrorBoundary></RequireAuth>} />
              
              {/* Auth Test - REMOVE AFTER TESTING */}
              <Route path="/auth-test" element={<AuthTestPage />} />
              
              {/* Catch all route - redirect to home */}
              <Route path="*" element={<HomePage />} />
            </Routes>
          </main>
          
          {/* Real-time notifications */}
          <ErrorBoundary>
            <RealTimeNotifications />
          </ErrorBoundary>
        </div>
      </AuthProvider>
    </ErrorBoundary>
  )
}
