import { useState } from 'react';
import { auth, provider } from '../lib/firebase';
import { signInWithRedirect, getRedirectResult } from 'firebase/auth';

export default function AuthTest() {
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const testFirebaseConnection = () => {
    console.log('🔥 Firebase Auth Object:', auth);
    console.log('🔥 Firebase Provider:', provider);
    
    if (!auth) {
      setStatus('❌ Firebase Auth not initialized');
      return;
    }
    
    if (!provider) {
      setStatus('❌ Google Provider not configured');
      return;
    }
    
    setStatus('✅ Firebase Auth is ready');
  };

  const testGoogleSignIn = async () => {
    try {
      setStatus('🔄 Starting Google sign-in...');
      setError('');
      
      if (!auth || !provider) {
        throw new Error('Firebase not initialized');
      }
      
      console.log('🚀 Calling signInWithRedirect...');
      await signInWithRedirect(auth, provider);
      setStatus('🔄 Redirecting to Google...');
      
    } catch (err: any) {
      console.error('❌ Google sign-in error:', err);
      setError(`Error: ${err.message || err.code || 'Unknown error'}`);
      setStatus('❌ Google sign-in failed');
    }
  };

  const checkRedirectResult = async () => {
    try {
      setStatus('🔄 Checking redirect result...');
      if (!auth) throw new Error('Firebase not initialized');
      
      const result = await getRedirectResult(auth);
      console.log('📥 Redirect result:', result);
      
      if (result?.user) {
        setStatus(`✅ Signed in as: ${result.user.email}`);
      } else {
        setStatus('ℹ️ No redirect result (normal if no recent redirect)');
      }
      
    } catch (err: any) {
      console.error('❌ Redirect result error:', err);
      setError(`Error: ${err.message || err.code || 'Unknown error'}`);
      setStatus('❌ Redirect result failed');
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-xl font-bold mb-4">🧪 Firebase Auth Test</h2>
      
      <div className="space-y-4">
        <button
          onClick={testFirebaseConnection}
          className="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600"
        >
          Test Firebase Connection
        </button>
        
        <button
          onClick={checkRedirectResult}
          className="w-full bg-green-500 text-white py-2 px-4 rounded hover:bg-green-600"
        >
          Check Redirect Result
        </button>
        
        <button
          onClick={testGoogleSignIn}
          className="w-full bg-red-500 text-white py-2 px-4 rounded hover:bg-red-600"
        >
          Test Google Sign-In
        </button>
      </div>
      
      {status && (
        <div className="mt-4 p-3 bg-gray-100 rounded">
          <strong>Status:</strong> {status}
        </div>
      )}
      
      {error && (
        <div className="mt-4 p-3 bg-red-100 text-red-700 rounded">
          <strong>Error:</strong> {error}
        </div>
      )}
      
      <div className="mt-4 text-sm text-gray-600">
        <p><strong>Current User:</strong> {auth?.currentUser?.email || 'Not signed in'}</p>
        <p><strong>Project:</strong> {auth?.app?.options?.projectId}</p>
      </div>
    </div>
  );
}