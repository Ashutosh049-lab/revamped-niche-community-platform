import { auth, db, provider } from './firebase';
import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  type UserCredential,
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

export async function ensureUserDoc(uid: string, displayName?: string | null, email?: string | null) {
  if (!db) return;
  const ref = doc(db, 'users', uid);
  await setDoc(
    ref,
    {
      displayName: displayName || email || 'User',
      email: email || null,
      createdAt: serverTimestamp(),
      stats: { totalPosts: 0, totalComments: 0, totalVotes: 0 },
      followedCommunities: [],
    },
    { merge: true }
  );
}

export async function googleSignIn({ preferPopup = true }: { preferPopup?: boolean } = {}) {
  if (!auth) throw new Error('Firebase not initialized');

  // Try popup first unless caller prefers redirect
  if (preferPopup) {
    try {
      const cred = (await signInWithPopup(auth, provider)) as UserCredential;
      await ensureUserDoc(cred.user.uid, cred.user.displayName, cred.user.email);
      return { method: 'popup', credential: cred } as const;
    } catch (e: any) {
      // Known popup issues -> fall back to redirect
      const fallbackCodes = new Set([
        'auth/popup-blocked',
        'auth/popup-closed-by-user',
        'auth/cancelled-popup-request',
        'auth/operation-not-supported-in-this-environment',
      ]);
      if (!fallbackCodes.has(e?.code)) throw e;
    }
  }

  await signInWithRedirect(auth, provider);
  return { method: 'redirect', credential: null } as const;
}

export async function handleAuthRedirect() {
  if (!auth) return null;
  const res = await getRedirectResult(auth);
  if (res?.user) {
    await ensureUserDoc(res.user.uid, res.user.displayName, res.user.email);
  }
  return res;
}