import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult 
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, provider, db } from '../lib/firebase';
import { useToast } from '../components/ToastProvider';

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  
  const redirectTo = (location.state as any)?.from?.pathname || '/feed';

  // Handle Google redirect result
  useEffect(() => {
    const handleRedirectResult = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result?.user) {
          await createUserDocument(result.user.uid, result.user.displayName, result.user.email);
          showToast('Signed in successfully!', 'success');
          navigate(redirectTo, { replace: true });
        }
      } catch (error: any) {
        console.error('Redirect result error:', error);
        setError(getErrorMessage(error));
      }
    };
    handleRedirectResult();
  }, [navigate, redirectTo, showToast]);

  // Create user document in Firestore
  const createUserDocument = async (uid: string, displayName?: string | null, email?: string | null) => {
    try {
      const userRef = doc(db, 'users', uid);
      await setDoc(userRef, {
        displayName: displayName || email?.split('@')[0] || 'User',
        email: email || null,
        createdAt: serverTimestamp(),
        stats: { totalPosts: 0, totalComments: 0, totalVotes: 0 },
        followedCommunities: [],
      }, { merge: true });
    } catch (error) {
      console.error('Error creating user document:', error);
    }
  };

  // Get friendly error message
  const getErrorMessage = (error: any): string => {
    switch (error.code) {
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'Invalid email or password';
      case 'auth/email-already-in-use':
        return 'Email is already registered';
      case 'auth/weak-password':
        return 'Password should be at least 6 characters';
      case 'auth/invalid-email':
        return 'Invalid email address';
      case 'auth/popup-blocked':
        return 'Popup blocked. Please allow popups or try redirect method';
      case 'auth/popup-closed-by-user':
        return 'Sign-in popup was closed';
      case 'auth/operation-not-allowed':
        return 'Google Sign-In is not enabled. Please contact support';
      default:
        return error.message || 'Authentication failed';
    }
  };

  // Handle email authentication
  const handleEmailAuth = async () => {
    if (!email.trim() || !password) {
      setError('Please enter both email and password');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let result;
      if (mode === 'signup') {
        result = await createUserWithEmailAndPassword(auth, email.trim(), password);
        showToast('Account created successfully!', 'success');
      } else {
        result = await signInWithEmailAndPassword(auth, email.trim(), password);
        showToast('Welcome back!', 'success');
      }

      await createUserDocument(result.user.uid, result.user.displayName, result.user.email);
      navigate(redirectTo, { replace: true });
    } catch (error: any) {
      console.error('Email auth error:', error);
      setError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  // Handle Google authentication (popup first, fallback to redirect)
  const handleGoogleAuth = async () => {
    setLoading(true);
    setError(null);

    try {
      // Try popup first
      const result = await signInWithPopup(auth, provider);
      await createUserDocument(result.user.uid, result.user.displayName, result.user.email);
      showToast('Signed in with Google successfully!', 'success');
      navigate(redirectTo, { replace: true });
    } catch (error: any) {
      console.error('Google popup error:', error);
      
      // If popup fails, try redirect
      if (error.code === 'auth/popup-blocked' || error.code === 'auth/popup-closed-by-user') {
        try {
          await signInWithRedirect(auth, provider);
          // Redirect will happen, no need to handle result here
        } catch (redirectError: any) {
          console.error('Google redirect error:', redirectError);
          setError(getErrorMessage(redirectError));
          setLoading(false);
        }
      } else {
        setError(getErrorMessage(error));
        setLoading(false);
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      handleEmailAuth();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-xl shadow-sm border p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {mode === 'login' ? 'Welcome back' : 'Create account'}
          </h1>
          <p className="text-gray-600">
            {mode === 'login' 
              ? 'Sign in to continue to your communities' 
              : 'Join our community platform'
            }
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Google Sign-In Button */}
        <button
          onClick={handleGoogleAuth}
          disabled={loading}
          className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed mb-4"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          )}
          <span className="ml-3 font-medium">Continue with Google</span>
        </button>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">or</span>
          </div>
        </div>

        {/* Email/Password Form */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="you@example.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter your password"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {mode === 'signup' && (
              <p className="text-xs text-gray-500 mt-1">Must be at least 6 characters</p>
            )}
          </div>

          <button
            onClick={handleEmailAuth}
            disabled={loading || !email.trim() || !password}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                Processing...
              </div>
            ) : (
              mode === 'login' ? 'Sign In' : 'Create Account'
            )}
          </button>
        </div>

        {/* Toggle Mode */}
        <div className="text-center mt-6">
          <p className="text-gray-600">
            {mode === 'login' ? "Don't have an account? " : "Already have an account? "}
            <button
              onClick={() => {
                setMode(mode === 'login' ? 'signup' : 'login');
                setError(null);
              }}
              className="text-blue-600 hover:text-blue-700 font-medium hover:underline"
            >
              {mode === 'login' ? 'Create one' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}