import { useState, useEffect } from 'react';
import { auth, provider, db } from '../lib/firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  type User
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

export default function AuthTestPage() {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  // Listen to auth state changes
  useEffect(() => {
    if (!auth) {
      setError('Firebase Auth not initialized');
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log('Auth state changed:', user);
      setUser(user);
      if (user) {
        setStatus(`Signed in as: ${user.email}`);
      } else {
        setStatus('Not signed in');
      }
    });

    // Check for redirect result on page load
    getRedirectResult(auth).then((result) => {
      if (result?.user) {
        console.log('Redirect result:', result);
        createUserDocument(result.user);
      }
    }).catch((error) => {
      console.error('Redirect result error:', error);
      setError(`Redirect error: ${error.message}`);
    });

    return unsubscribe;
  }, []);

  const createUserDocument = async (user: User) => {
    if (!db) return;
    try {
      await setDoc(doc(db, 'users', user.uid), {
        displayName: user.displayName || user.email || 'User',
        email: user.email,
        createdAt: serverTimestamp(),
        stats: { totalPosts: 0, totalComments: 0, totalVotes: 0 },
        followedCommunities: [],
      }, { merge: true });
      console.log('User document created/updated');
    } catch (error) {
      console.error('Error creating user document:', error);
    }
  };

  const handleEmailSignup = async () => {
    if (!auth) {
      setError('Firebase Auth is not initialized');
      return;
    }
    
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setError('');
    setStatus('Creating account...');
    
    try {
      console.log('📝 Creating user with email:', email);
      const result = await createUserWithEmailAndPassword(auth, email, password);
      console.log('✅ User created:', result.user);
      
      await createUserDocument(result.user);
      setStatus('✅ Account created successfully!');
      
      // Clear form
      setEmail('');
      setPassword('');
      setDisplayName('');
      
    } catch (error: any) {
      console.error('❌ Signup error:', error);
      let errorMessage = 'Signup failed: ';
      
      switch (error.code) {
        case 'auth/email-already-in-use':
          errorMessage += 'Email is already in use';
          break;
        case 'auth/invalid-email':
          errorMessage += 'Invalid email address';
          break;
        case 'auth/weak-password':
          errorMessage += 'Password is too weak';
          break;
        case 'auth/network-request-failed':
          errorMessage += 'Network error - check your connection';
          break;
        default:
          errorMessage += error.message;
      }
      
      setError(errorMessage);
      setStatus('❌ Signup failed');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignin = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      console.log('Signing in with email:', email);
      const result = await signInWithEmailAndPassword(auth!, email, password);
      console.log('User signed in:', result.user);
      setStatus('Signed in successfully!');
      
    } catch (error: any) {
      console.error('Signin error:', error);
      setError(`Signin failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleGooglePopup = async () => {
    if (!auth || !provider) {
      setError('Firebase Auth or Google Provider not initialized');
      return;
    }
    
    setLoading(true);
    setError('');
    setStatus('Opening Google popup...');
    
    try {
      console.log('🔄 Trying Google popup...');
      const result = await signInWithPopup(auth, provider);
      console.log('✅ Google popup success:', result.user);
      
      await createUserDocument(result.user);
      setStatus('✅ Google sign-in successful!');
      
    } catch (error: any) {
      console.error('❌ Google popup error:', error);
      let errorMessage = 'Google popup failed: ';
      
      switch (error.code) {
        case 'auth/popup-closed-by-user':
          errorMessage += 'Popup was closed before completing sign-in';
          break;
        case 'auth/popup-blocked':
          errorMessage += 'Popup was blocked by browser';
          break;
        case 'auth/network-request-failed':
          errorMessage += 'Network error - check your connection';
          break;
        default:
          errorMessage += error.message;
      }
      
      setError(errorMessage);
      setStatus('❌ Google popup failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRedirect = async () => {
    setLoading(true);
    setError('');
    
    try {
      console.log('Starting Google redirect...');
      await signInWithRedirect(auth!, provider);
      // This will redirect away from the page
      
    } catch (error: any) {
      console.error('Google redirect error:', error);
      setError(`Google redirect failed: ${error.message}`);
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth!);
      setStatus('Signed out');
      setEmail('');
      setPassword('');
      setDisplayName('');
    } catch (error: any) {
      setError(`Sign out failed: ${error.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-bold mb-6 text-center">🔐 Auth Test</h1>
        
        {/* Status Display */}
        <div className="mb-4 p-3 bg-gray-100 rounded">
          <strong>Status:</strong> {status}
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Current User */}
        {user ? (
          <div className="mb-6 p-4 bg-green-100 rounded">
            <h3 className="font-semibold text-green-800">✅ Signed In</h3>
            <p><strong>Email:</strong> {user.email}</p>
            <p><strong>Name:</strong> {user.displayName || 'Not set'}</p>
            <p><strong>UID:</strong> {user.uid}</p>
            <button
              onClick={handleSignOut}
              className="mt-3 w-full bg-red-500 text-white py-2 rounded hover:bg-red-600"
            >
              Sign Out
            </button>
          </div>
        ) : (
          /* Sign In/Up Form */
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Your name (optional)"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="your@email.com"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Password (min 6 chars)"
                minLength={6}
              />
            </div>

            {/* Email Auth Buttons */}
            <div className="space-y-2">
              <button
                onClick={handleEmailSignup}
                disabled={loading}
                className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Sign Up with Email'}
              </button>
              
              <button
                onClick={handleEmailSignin}
                disabled={loading}
                className="w-full bg-gray-600 text-white py-2 rounded hover:bg-gray-700 disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Sign In with Email'}
              </button>
            </div>

            {/* Google Auth Buttons */}
            <div className="border-t pt-4 space-y-2">
              <button
                onClick={handleGooglePopup}
                disabled={loading}
                className="w-full bg-red-600 text-white py-2 rounded hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Google Sign-In (Popup)'}
              </button>
              
              <button
                onClick={handleGoogleRedirect}
                disabled={loading}
                className="w-full bg-red-500 text-white py-2 rounded hover:bg-red-600 disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Google Sign-In (Redirect)'}
              </button>
            </div>
          </div>
        )}

        {/* Debug Info */}
        <div className="mt-6 text-xs text-gray-500 space-y-1">
          <p><strong>Firebase Auth:</strong> {auth ? '✅ Ready' : '❌ Not initialized'}</p>
          <p><strong>Project ID:</strong> {auth?.app?.options?.projectId || 'Unknown'}</p>
          <p><strong>Auth Domain:</strong> {auth?.app?.options?.authDomain || 'Unknown'}</p>
        </div>
      </div>
    </div>
  );
}