// import { createContext, useContext, useEffect, useMemo, useState } from "react";
// import { onAuthStateChanged, signOut, type User } from "firebase/auth";
// import { auth } from "../../lib/firebase";
// import { connectSocket, hasSocketConfig, connectSocketWithToken } from "../../lib/socket";

// interface AuthContextValue {
//   user: User | null;
//   loading: boolean;
//   signOut: () => Promise<void>;
//   isReady: boolean; // whether Firebase was initialized
//   error: string | null;
//   retryInitialization: () => void;
// }

// const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// export function AuthProvider({ children }: { children: React.ReactNode }) {
//   const [user, setUser] = useState<User | null>(null);
//   const [loading, setLoading] = useState(true);
//   const [initError, setInitError] = useState<string | null>(null);
//   const [retryCount, setRetryCount] = useState(0);
//   const isReady = Boolean(auth);

//   useEffect(() => {
//     console.log('🔍 AuthProvider: Checking Firebase Auth...', { auth: !!auth, retry: retryCount });
    
//     if (!auth) {
//       console.error('❌ AuthProvider: Firebase Auth is not initialized!');
//       setInitError('Firebase Authentication is not properly configured. Please check your Firebase setup.');
//       setLoading(false);
//       return;
//     }
    
//     console.log('✅ AuthProvider: Setting up auth state listener');
//     setInitError(null); // Clear any previous errors
    
//     const unsub = onAuthStateChanged(
//       auth,
//       (user) => {
//         console.log('🔄 AuthProvider: Auth state changed', { 
//           user: user?.email || 'none', 
//           uid: user?.uid?.substring(0, 8) || 'none' 
//         });
        
//         setUser(user);
//         setLoading(false);
//         setInitError(null);
        
//         // Connect socket after successful login
//         if (user && hasSocketConfig()) {
//           user.getIdToken()
//             .then((token) => connectSocketWithToken(token))
//             .catch((error) => {
//               console.warn('⚠️ AuthProvider: Failed to connect socket with token, falling back to basic connection:', error);
//               connectSocket();
//             });
//         }
//       },
//       (error) => {
//         console.error('❌ AuthProvider: Auth state change error:', error);
//         const errorMessage = error.code === 'auth/network-request-failed' 
//           ? 'Network error. Please check your internet connection and try again.'
//           : error.code === 'auth/too-many-requests'
//           ? 'Too many requests. Please wait a moment and try again.'
//           : `Authentication error: ${error.message}`;
        
//         setInitError(errorMessage);
//         setLoading(false);
//       }
//     );
    
//     return () => {
//       console.log('🧹 AuthProvider: Cleaning up auth listener');
//       unsub();
//     };
//   }, [retryCount]);

//   const retryInitialization = () => {
//     console.log('🔄 AuthProvider: Retrying initialization...');
//     setRetryCount(prev => prev + 1);
//     setLoading(true);
//   };

//   const value = useMemo<AuthContextValue>(() => ({
//     user,
//     loading,
//     isReady,
//     error: initError,
//     retryInitialization,
//     signOut: async () => {
//       if (!auth) {
//         console.warn('⚠️ AuthProvider: Cannot sign out - auth not initialized');
//         throw new Error('Authentication not initialized');
//       }
//       try {
//         console.log('🚺 AuthProvider: Signing out...');
//         setLoading(true);
//         await signOut(auth);
//         console.log('✅ AuthProvider: Signed out successfully');
//       } catch (error) {
//         console.error('❌ AuthProvider: Sign out failed:', error);
//         throw error;
//       } finally {
//         setLoading(false);
//       }
//     },
//   }), [user, loading, isReady, initError]);

//   // Show initialization error if Firebase failed to initialize
//   if (initError && !loading) {
//     return (
//       <div className="min-h-screen bg-red-50 flex items-center justify-center p-6">
//         <div className="bg-white rounded-lg shadow-lg p-6 max-w-md mx-auto text-center">
//           <div className="text-red-500 text-4xl mb-4">❌</div>
//           <h2 className="text-xl font-semibold text-gray-900 mb-2">
//             Authentication Error
//           </h2>
//           <p className="text-gray-600 mb-4">{initError}</p>
//           <div className="space-y-2">
//             <button
//               onClick={retryInitialization}
//               disabled={loading}
//               className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
//             >
//               {loading ? 'Retrying...' : 'Retry Connection'}
//             </button>
//             <button
//               onClick={() => window.location.reload()}
//               className="w-full bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600"
//             >
//               Reload Page
//             </button>
//           </div>
//           {retryCount > 0 && (
//             <p className="text-xs text-gray-500 mt-2">
//               Retry attempts: {retryCount}
//             </p>
//           )}
//         </div>
//       </div>
//     );
//   }

//   return (
//     <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
//   );
// }

// export function useAuth() {
//   const ctx = useContext(AuthContext);
//   if (!ctx) throw new Error("useAuth must be used within AuthProvider");
//   return ctx;
// }


















import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { connectSocket, hasSocketConfig, connectSocketWithToken } from "../../lib/socket";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  isReady: boolean;
  error: string | null;
  retryInitialization: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const isReady = Boolean(auth);

  useEffect(() => {
    console.log("🔍 AuthProvider: Checking Firebase Auth...", { auth: !!auth, retry: retryCount });

    if (!auth) {
      console.error("❌ AuthProvider: Firebase Auth is not initialized!");
      setInitError("Firebase Authentication is not properly configured. Please check your Firebase setup.");
      setLoading(false);
      return;
    }

    console.log("✅ AuthProvider: Setting up auth state listener");
    setInitError(null);

    const unsub = onAuthStateChanged(
      auth,
      (user) => {
        console.log("🔄 AuthProvider: Auth state changed", {
          user: user?.email || "none",
          uid: user?.uid?.substring(0, 8) || "none",
        });

        setUser(user);
        setLoading(false);
        setInitError(null);

        if (user && hasSocketConfig()) {
          user
            .getIdToken()
            .then((token) => connectSocketWithToken(token))
            .catch((error) => {
              console.warn("⚠️ AuthProvider: Failed to connect socket with token, falling back to basic connection:", error);
              connectSocket();
            });
        }
      },
      (error) => {
        console.error("❌ AuthProvider: Auth state change error:", error);

        // ✅ Safely handle Firebase or generic errors
        const firebaseError = error as { code?: string; message: string };

        const errorMessage =
          firebaseError.code === "auth/network-request-failed"
            ? "Network error. Please check your internet connection and try again."
            : firebaseError.code === "auth/too-many-requests"
            ? "Too many requests. Please wait a moment and try again."
            : `Authentication error: ${firebaseError.message}`;

        setInitError(errorMessage);
        setLoading(false);
      }
    );

    return () => {
      console.log("🧹 AuthProvider: Cleaning up auth listener");
      unsub();
    };
  }, [retryCount]);

  const retryInitialization = () => {
    console.log("🔄 AuthProvider: Retrying initialization...");
    setRetryCount((prev) => prev + 1);
    setLoading(true);
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isReady,
      error: initError,
      retryInitialization,
      signOut: async () => {
        if (!auth) {
          console.warn("⚠️ AuthProvider: Cannot sign out - auth not initialized");
          throw new Error("Authentication not initialized");
        }
        try {
          console.log("🚺 AuthProvider: Signing out...");
          setLoading(true);
          await signOut(auth);
          console.log("✅ AuthProvider: Signed out successfully");
        } catch (error) {
          console.error("❌ AuthProvider: Sign out failed:", error);
          throw error;
        } finally {
          setLoading(false);
        }
      },
    }),
    [user, loading, isReady, initError]
  );

  if (initError && !loading) {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-md mx-auto text-center">
          <div className="text-red-500 text-4xl mb-4">❌</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Authentication Error</h2>
          <p className="text-gray-600 mb-4">{initError}</p>
          <div className="space-y-2">
            <button
              onClick={retryInitialization}
              disabled={loading}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Retrying..." : "Retry Connection"}
            </button>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600"
            >
              Reload Page
            </button>
          </div>
          {retryCount > 0 && (
            <p className="text-xs text-gray-500 mt-2">Retry attempts: {retryCount}</p>
          )}
        </div>
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
