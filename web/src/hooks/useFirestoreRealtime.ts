import { useEffect, useState, useCallback, useRef } from 'react';
import {
  collection,
  query,
  onSnapshot,
  where,
  orderBy,
  limit,
  QuerySnapshot,
  DocumentSnapshot,
  doc
} from 'firebase/firestore';

// Define DocumentData type for compatibility
type DocumentData = Record<string, any>;
import { db } from '../lib/firebase';
import { useRealTimeUpdates } from './useRealTimeUpdates';
import { emitNewPost, emitNewComment } from '../lib/socket';

export interface FirestoreRealtimeOptions {
  collection: string;
  constraints?: any[];
  enableRealTimeUpdates?: boolean;
  emitSocketEvents?: boolean;
  communityId?: string;
}

export interface FirestoreRealtimeResult<T> {
  data: T[];
  loading: boolean;
  error: Error | null;
  refresh: () => void;
}

export function useFirestoreRealtime<T extends DocumentData>(
  options: FirestoreRealtimeOptions
): FirestoreRealtimeResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const lastSnapshotRef = useRef<QuerySnapshot | null>(null);
  const initialLoadedRef = useRef(false);

  const { addRealtimeItem, updateRealtimeItem } = useRealTimeUpdates(options.communityId);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
  }, []);

  useEffect(() => {
    if (!db || !options.collection) {
      setError(new Error('Invalid collection or database not initialized'));
      setLoading(false);
      return;
    }

    // Don't proceed if constraints are empty (which might cause permission issues)
    if (options.constraints && options.constraints.length === 0) {
      setData([]);
      setLoading(false);
      return;
    }

    let q = collection(db, options.collection);
    
    // Apply constraints if provided
    if (options.constraints && options.constraints.length > 0) {
      // Create query with constraints
      const constraints = options.constraints.filter(Boolean);
      if (constraints.length > 0) {
        q = query(q as any, ...constraints) as any;
      }
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot: QuerySnapshot) => {
        try {
          const newData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as unknown as T[];

          // Detect changes for real-time animations
          if (initialLoadedRef.current && options.enableRealTimeUpdates) {
            const changes = snapshot.docChanges();
            
            changes.forEach(change => {
              const docData = {
                id: change.doc.id,
                ...change.doc.data()
              };

              switch (change.type) {
                case 'added':
                  // Only animate if this is a new document added after initial load
                  addRealtimeItem({
                    id: change.doc.id,
                    type: getDocumentType(options.collection),
                    data: docData
                  }, 'slideIn');

                  // Emit socket events for new content
                  if (options.emitSocketEvents) {
                    if (options.collection === 'posts') {
                      emitNewPost({ ...docData, communityId: options.communityId });
                    } else if (options.collection === 'comments') {
                      emitNewComment({ ...docData, communityId: options.communityId });
                    }
                  }
                  break;

                case 'modified':
                  updateRealtimeItem(change.doc.id, docData, 'pulse');
                  break;

                case 'removed':
                  // Handle removal if needed
                  break;
              }
            });
          }

          setData(newData);
          lastSnapshotRef.current = snapshot;
          initialLoadedRef.current = true;
          setLoading(false);
          setError(null);
        } catch (err) {
          setError(err as Error);
          setLoading(false);
        }
      },
      (err) => {
        console.error('Firestore snapshot error:', err);
        
        // Check if this is a permission error
        if (err.code === 'permission-denied') {
          setError(new Error('Access denied. Please sign in or check your permissions.'));
        } else {
          setError(err as Error);
        }
        
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [
    options.collection,
    options.constraints,
    options.enableRealTimeUpdates,
    options.emitSocketEvents,
    options.communityId,
    addRealtimeItem,
    updateRealtimeItem
  ]);

  return {
    data,
    loading,
    error,
    refresh
  };
}

// Hook for single document real-time updates
export function useDocumentRealtime<T extends DocumentData>(
  collectionName: string,
  documentId: string
): { data: T | null; loading: boolean; error: Error | null } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!db || !collectionName || !documentId) {
      setError(new Error('Invalid parameters'));
      setLoading(false);
      return;
    }

    const docRef = doc(db, collectionName, documentId);
    
    const unsubscribe = onSnapshot(
      docRef,
      (snapshot: DocumentSnapshot) => {
        try {
          if (snapshot.exists()) {
            const newData = {
              id: snapshot.id,
              ...snapshot.data()
            } as unknown as T;
            setData(newData);
          } else {
            setData(null);
          }
          setLoading(false);
          setError(null);
        } catch (err) {
          setError(err as Error);
          setLoading(false);
        }
      },
      (err) => {
        setError(err as Error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [collectionName, documentId]);

  return { data, loading, error };
}

// Helper function to determine document type from collection name
function getDocumentType(collectionName: string): 'post' | 'comment' | 'poll' | 'vote' | 'reaction' {
  switch (collectionName) {
    case 'posts':
      return 'post';
    case 'comments':
      return 'comment';
    case 'polls':
      return 'poll';
    case 'votes':
      return 'vote';
    case 'reactions':
      return 'reaction';
    default:
      return 'post';
  }
}

// Predefined query builders for common use cases
export const queryBuilders = {
  // Get posts for a community
  communityPosts: (communityId: string, sortBy: 'newest' | 'top' = 'newest') => ({
    collection: 'posts',
    constraints: [
      where('communityId', '==', communityId),
      orderBy(sortBy === 'top' ? 'voteScore' : 'createdAt', 'desc'),
      limit(20)
    ],
    enableRealTimeUpdates: true,
    emitSocketEvents: true,
    communityId
  }),

  // Get comments for a post
  postComments: (postId: string, communityId?: string) => ({
    collection: 'comments',
    constraints: [
      where('postId', '==', postId),
      where('parentId', '==', null),
      orderBy('createdAt', 'desc')
    ],
    enableRealTimeUpdates: true,
    emitSocketEvents: true,
    communityId
  }),

  // Get user's feed
  userFeed: (followedCommunities: string[], sortBy: 'newest' | 'top' | 'relevance' | 'activity' | 'popularity' = 'newest') => {
    // Map sort options to Firestore fields
    let orderField = 'createdAt';
    if (sortBy === 'top' || sortBy === 'popularity') orderField = 'voteScore';
    else if (sortBy === 'activity') orderField = 'commentCount';
    // For relevance, we'll use createdAt as fallback since relevance requires AI scoring
    
    return {
      collection: 'posts',
      constraints: followedCommunities.length > 0 ? [
        where('communityId', 'in', followedCommunities.slice(0, 10)), // Firestore limit
        orderBy(orderField, 'desc'),
        limit(30)
      ] : [
        orderBy(orderField, 'desc'),
        limit(30)
      ],
      enableRealTimeUpdates: true,
      emitSocketEvents: false
    };
  },

  // Get trending posts
  trendingPosts: (timeFrame: '24h' | '7d' | '30d' = '24h') => {
    const timeMap = {
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000
    };
    
    const cutoffTime = new Date(Date.now() - timeMap[timeFrame]);
    
    return {
      collection: 'posts',
      constraints: [
        where('createdAt', '>=', cutoffTime),
        orderBy('createdAt', 'desc'),
        orderBy('voteScore', 'desc'),
        limit(20)
      ],
      enableRealTimeUpdates: true,
      emitSocketEvents: false
    };
  },

  // Get active polls
  activePolls: (communityId?: string) => ({
    collection: 'polls',
    constraints: [
      ...(communityId ? [where('communityId', '==', communityId)] : []),
      where('isActive', '==', true),
      where('expiresAt', '>', new Date()),
      orderBy('expiresAt', 'asc')
    ],
    enableRealTimeUpdates: true,
    emitSocketEvents: true,
    communityId
  })
};