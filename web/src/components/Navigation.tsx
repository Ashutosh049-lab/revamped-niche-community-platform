import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthProvider';
import { doc, getDoc, collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import NotificationCenter from '../features/notifications/NotificationCenter';

interface NavigationProps {
  className?: string;
}

interface UserProfile {
  displayName: string;
  avatar?: string;
  unreadNotifications?: number;
}

export default function Navigation({ className = '' }: NavigationProps) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [connected, setConnected] = useState(false);
  const [canModerate, setCanModerate] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  // Fetch user profile data
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user?.uid || !db) return;

      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setUserProfile({
            displayName: userData.displayName || user.displayName || user.email || 'User',
            avatar: userData.avatar,
            unreadNotifications: userData.unreadNotifications || 0
          });
        } else {
          // User document doesn't exist, create a basic profile
          setUserProfile({
            displayName: user.displayName || user.email || 'User',
            avatar: undefined,
            unreadNotifications: 0
          });
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
        // Fallback to basic user info from auth
        setUserProfile({
          displayName: user.displayName || user.email || 'User',
          avatar: undefined,
          unreadNotifications: 0
        });
      }
    };

    fetchUserProfile();
  }, [user]);

  // Check Socket.IO connection status
  useEffect(() => {
    const setupSocket = async () => {
      // Only try to connect if user is authenticated
      if (!user) {
        setConnected(false);
        return;
      }

      try {
        console.log('Setting up socket connection for user:', user.uid);
        
        // Get Firebase ID token
        const token = await user.getIdToken();
        console.log('Got Firebase token, connecting socket...');
        
        const { onConnect, onDisconnect, connectSocketWithToken, getSocket } = await import('../lib/socket');
        
        // Connect with Firebase token
        connectSocketWithToken(token);
        
        const socket = getSocket();
        
        // Listen for connection events
        onConnect(() => {
          console.log('✅ Socket connected successfully');
          setConnected(true);
        });
        
        onDisconnect((reason) => {
          console.log('❌ Socket disconnected:', reason);
          setConnected(false);
        });
        
        // Listen for connection errors
        socket.on('connect_error', (error) => {
          console.error('❌ Socket connection error:', error);
          setConnected(false);
        });
        
        socket.on('reconnect_attempt', (attemptNumber) => {
          console.log(`🔄 Reconnection attempt ${attemptNumber}`);
        });
        
        socket.on('reconnect_failed', () => {
          console.error('❌ Reconnection failed');
          setConnected(false);
        });
        
        // Check current connection state
        console.log('Socket connected:', socket.connected);
        
        if (socket.connected) {
          setConnected(true);
        }
        
        // Cleanup function
        return () => {
          socket.off('connect_error');
          socket.off('reconnect_attempt');
          socket.off('reconnect_failed');
        };
        
      } catch (error) {
        console.error('❌ Failed to setup socket connection:', error);
        setConnected(false);
      }
    };

    setupSocket();
  }, [user]); // Depend on user so it reconnects when auth state changes

  // Determine if user is moderator/admin of any community to gate Moderation link
  useEffect(() => {
    const checkRoles = async () => {
      try {
        if (!db || !user?.uid) { setCanModerate(false); return; }
        const cacheKey = `modRole:${user.uid}`;
        const cached = sessionStorage.getItem(cacheKey);
        const ROLE_CACHE_MS = Number((import.meta as any).env?.VITE_MOD_ROLE_CACHE_MS ?? 5 * 60 * 1000);
        if (cached) {
          try {
            const parsed = JSON.parse(cached) as { canModerate: boolean; ts: number };
            if (Date.now() - parsed.ts < ROLE_CACHE_MS) {
              setCanModerate(!!parsed.canModerate);
              return;
            }
          } catch {}
        }
        const communities = collection(db, 'communities');
        const qAdmins = query(communities, where('admins', 'array-contains', user.uid), limit(1));
        const qMods = query(communities, where('moderators', 'array-contains', user.uid), limit(1));
        const [aSnap, mSnap] = await Promise.all([getDocs(qAdmins), getDocs(qMods)]);
        const can = !aSnap.empty || !mSnap.empty;
        setCanModerate(can);
        sessionStorage.setItem(cacheKey, JSON.stringify({ canModerate: can, ts: Date.now() }));
      } catch {
        setCanModerate(false);
      }
    };
    checkRoles();
  }, [user?.uid]);

  const mainNavItems = [
    { id: 'home', label: '🏠 Home', path: '/', description: 'Dashboard & recommendations' },
    { id: 'communities', label: '👥 Communities', path: '/communities', description: 'Discover & join communities' },
    { id: 'feed', label: '📰 Feed', path: '/feed', description: 'Latest posts from your communities', authRequired: true },
    { id: 'notifications', label: '🔔 Notifications', path: '/notifications', description: 'Your activity updates', authRequired: true },
    { id: 'moderation', label: '🛡️ Moderation', path: '/moderation', description: 'Moderate recent posts & comments', authRequired: true }
  ];

  const userNavItems = user ? [
    { id: 'profile', label: '👤 Profile', path: `/profile`, description: 'Your profile & stats' },
    { id: 'settings', label: '⚙️ Settings', path: '/settings', description: 'Account & preferences' }
  ] : [];

  const isActivePath = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setIsProfileOpen(false);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <nav className={`bg-white border-b border-gray-200 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo and Main Navigation */}
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Link to="/" className="flex items-center">
                <div className="h-8 w-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">NC</span>
                </div>
                <span className="ml-2 text-xl font-bold text-gray-900 hidden sm:block">
                  Niche Communities
                </span>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:ml-10 md:flex md:space-x-8">
              {mainNavItems.map((item) => {
                if (item.authRequired && !user) return null;
                if (item.id === 'moderation' && !canModerate) return null;
                
                return (
                  <Link
                    key={item.id}
                    to={item.path}
                    className={`inline-flex items-center px-1 pt-1 text-sm font-medium transition-colors ${
                      isActivePath(item.path)
                        ? 'text-blue-600 border-b-2 border-blue-500'
                        : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                    title={item.description}
                  >
                    {item.label}
                    {item.id === 'notifications' && userProfile?.unreadNotifications && userProfile.unreadNotifications > 0 && (
                      <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-2 py-0.5">
                        {userProfile.unreadNotifications > 9 ? '9+' : userProfile.unreadNotifications}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Right side - User menu and status */}
          <div className="flex items-center space-x-4">
            {/* Connection Status */}
            <div className={`hidden sm:flex items-center text-xs ${connected ? 'text-green-600' : 'text-gray-500'}`}>
              <div className={`w-2 h-2 rounded-full mr-1 ${connected ? 'bg-green-500' : 'bg-gray-400'}`}></div>
              {connected ? 'Live' : 'Connecting...'}
            </div>

            {/* Notifications bell */}
            {user && (
              <div className="relative">
                <button
                  onClick={() => setIsNotifOpen((v) => !v)}
                  title="Open notifications"
                  className="relative p-2 rounded-full hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <span className="text-xl">🔔</span>
                  {userProfile?.unreadNotifications && userProfile.unreadNotifications > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full px-1.5 py-0.5">
                      {userProfile.unreadNotifications > 9 ? '9+' : userProfile.unreadNotifications}
                    </span>
                  )}
                </button>
                <NotificationCenter isOpen={isNotifOpen} onClose={() => setIsNotifOpen(false)} />
              </div>
            )}

            {/* Moderation badge */}
            {user && canModerate && (
              <Link
                to="/moderation"
                title="Open Moderation Panel"
                className="flex items-center text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded px-2 py-0.5 hover:bg-blue-100"
              >
                🛡️ Mod
              </Link>
            )}

            {user ? (
              <div className="relative">
                <button
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  className="flex items-center space-x-3 text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                    {userProfile?.avatar ? (
                      <img 
                        src={userProfile.avatar} 
                        alt={userProfile.displayName}
                        className="h-8 w-8 rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-white font-medium text-sm">
                        {(userProfile?.displayName || user.email || 'U').charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <span className="hidden md:block text-gray-700 font-medium">
                    {userProfile?.displayName || user.email}
                  </span>
                  <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Profile Dropdown */}
                {isProfileOpen && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                    <div className="p-4 border-b border-gray-200">
                      <div className="flex items-center space-x-3">
                        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                          {userProfile?.avatar ? (
                            <img 
                              src={userProfile.avatar} 
                              alt={userProfile.displayName}
                              className="h-12 w-12 rounded-full object-cover"
                            />
                          ) : (
                            <span className="text-white font-medium">
                              {(userProfile?.displayName || user.email || 'U').charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">
                            {userProfile?.displayName || user.email}
                          </div>
                          <div className="text-sm text-gray-500">{user.email}</div>
                        </div>
                      </div>
                    </div>

                    <div className="py-2">
                      {canModerate && (
                        <Link
                          to="/moderation"
                          onClick={() => setIsProfileOpen(false)}
                          className="block px-4 py-2 text-sm text-blue-700 hover:bg-blue-50 transition-colors"
                        >
                          🛡️ Moderation
                        </Link>
                      )}
                      {userNavItems.map((item) => (
                        <Link
                          key={item.id}
                          to={item.path}
                          onClick={() => setIsProfileOpen(false)}
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex items-center">
                            <span className="mr-3">{item.label}</span>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">{item.description}</div>
                        </Link>
                      ))}
                      
                      <div className="border-t border-gray-200 mt-2 pt-2">
                        <button
                          onClick={handleSignOut}
                          className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                        >
                          🚪 Sign Out
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center space-x-3">
                <Link
                  to="/login"
                  className="text-gray-500 hover:text-gray-700 text-sm font-medium transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/signup"
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Sign Up
                </Link>
              </div>
            )}

            {/* Mobile menu button */}
            <div className="md:hidden">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="text-gray-500 hover:text-gray-700 focus:outline-none focus:text-gray-700"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {isMobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200">
            <div className="pt-2 pb-3 space-y-1">
              {mainNavItems.map((item) => {
                if (item.authRequired && !user) return null;
                
                return (
                  <Link
                    key={item.id}
                    to={item.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`block pl-3 pr-4 py-2 text-base font-medium transition-colors ${
                      isActivePath(item.path)
                        ? 'text-blue-600 bg-blue-50 border-r-4 border-blue-500'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{item.label}</span>
                      {item.id === 'notifications' && userProfile?.unreadNotifications && userProfile.unreadNotifications > 0 && (
                        <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5">
                          {userProfile.unreadNotifications > 9 ? '9+' : userProfile.unreadNotifications}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">{item.description}</div>
                  </Link>
                );
              })}
            </div>

            {!user && (
              <div className="px-4 py-3 border-t border-gray-200 flex items-center gap-3">
                <Link
                  to="/login"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex-1 text-center text-gray-700 border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50"
                >
                  Sign In
                </Link>
                <Link
                  to="/signup"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex-1 text-center bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Sign Up
                </Link>
              </div>
            )}

            {user && (
              <div className="pt-4 pb-3 border-t border-gray-200">
                <div className="flex items-center px-4 mb-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                    {userProfile?.avatar ? (
                      <img 
                        src={userProfile.avatar} 
                        alt={userProfile.displayName}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-white font-medium">
                        {(userProfile?.displayName || user.email || 'U').charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="ml-3">
                    <div className="text-base font-medium text-gray-800">
                      {userProfile?.displayName || user.email}
                    </div>
                    <div className="text-sm text-gray-500">{user.email}</div>
                  </div>
                </div>
                <div className="space-y-1">
                  {userNavItems.map((item) => (
                    <Link
                      key={item.id}
                      to={item.path}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="block px-4 py-2 text-base font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      {item.label}
                    </Link>
                  ))}
                  <button
                    onClick={handleSignOut}
                    className="block w-full text-left px-4 py-2 text-base font-medium text-red-600 hover:bg-red-50 transition-colors"
                  >
                    🚪 Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Click outside to close dropdowns */}
      {(isProfileOpen || isMobileMenuOpen) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setIsProfileOpen(false);
            setIsMobileMenuOpen(false);
          }}
        />
      )}
    </nav>
  );
}