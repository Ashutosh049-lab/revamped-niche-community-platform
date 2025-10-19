import { useEffect, useMemo, useState } from "react";
import { db } from "../../lib/firebase";
import { collection, onSnapshot, orderBy, query, where, Timestamp, doc, getDoc } from "firebase/firestore";
import CommentComposer from "./CommentComposer";
import { onCommentNew, onVoteUpdate, onReactionUpdate, emitCommentDelete, onCommentDeleted } from "../../lib/socket";
import ReactionButtons from "../reactions/ReactionButtons";
import VotingButtons from "../voting/VotingButtons";
import { useAuth } from '../auth/AuthProvider';
import { useToast } from '../../components/ToastProvider';

interface Props {
  postId: string;
  communityId: string;
}

interface CommentDoc { 
  id: string; 
  postId: string; 
  communityId: string; 
  parentId?: string | null; 
  authorId: string; 
  content: string; 
  createdAt?: Timestamp | null;
  reactions?: Record<string, { count: number; users: string[] }>;
  voteScore?: number;
  upvotes?: string[];
  downvotes?: string[];
  replyCount?: number;
  depth?: number;
  isDeleted?: boolean;
}

interface Author {
  displayName?: string;
  email?: string;
  photoURL?: string;
}

export default function CommentsThread({ postId, communityId }: Props) {
  const [comments, setComments] = useState<CommentDoc[]>([]);
  const [authors, setAuthors] = useState<Record<string, Author>>({});
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'top'>('newest');

  useEffect(() => {
    if (!db) return;
    
    const orderByField = sortBy === 'top' ? 'voteScore' : 'createdAt';
    const orderDirection = sortBy === 'oldest' ? 'asc' : 'desc';
    
    const q = query(
      collection(db, "comments"),
      where("postId", "==", postId),
      orderBy(orderByField, orderDirection)
    );
    const unsub = onSnapshot(q, async (snap) => {
      const rows: CommentDoc[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      setComments(rows);
      
      // Fetch authors
      const authorIds = [...new Set(rows.map(c => c.authorId))];
      const authorsData: Record<string, Author> = {};
      
      for (const authorId of authorIds) {
        try {
          const authorDoc = await getDoc(doc(db, 'users', authorId));
          if (authorDoc.exists()) {
            authorsData[authorId] = authorDoc.data() as Author;
          }
        } catch (error) {
          console.error(`Error fetching author ${authorId}:`, error);
        }
      }
      
      setAuthors(authorsData);
      setLoading(false);
    });
    return () => { try { unsub(); } catch {} };
  }, [postId, sortBy]);

  // Socket quick updates to feel instant
  useEffect(() => {
    const handler = (c: any) => {
      if (c?.postId !== postId) return;
      setComments((prev) => (prev.some((x) => x.id === c.id) ? prev : [...prev, c]));
    };
    onCommentNew(handler);
  }, [postId]);

  // Remove comments when deleted via moderation
  useEffect(() => {
    const handler = (d: { commentId: string; communityId: string }) => {
      if (d.communityId !== communityId) return;
      setComments(prev => prev.map(c => c.id === d.commentId ? { ...c, isDeleted: true, content: '' } : c));
    };
    onCommentDeleted(handler as any);
  }, [communityId]);

  const tree = useMemo(() => buildTree(comments), [comments]);
  
  if (loading) {
    return (
      <div className="p-6 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="text-gray-500 mt-2">Loading comments...</p>
      </div>
    );
  }

  return (
    <div className="mt-6" data-no-nav onClick={(e) => { e.stopPropagation(); }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Comments ({comments.length})
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="top">Top Voted</option>
          </select>
        </div>
      </div>
      
      <div className="mb-4">
        <CommentComposer postId={postId} communityId={communityId} />
      </div>
      
      <div className="space-y-3">
        {tree.roots.map((c) => (
          <CommentNode key={c.id} node={c} authors={authors} postId={postId} communityId={communityId} depth={0} />)
        )}
        {tree.roots.length === 0 && (
          <div className="p-8 text-center">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} 
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-gray-500 text-lg">No comments yet.</p>
            <p className="text-gray-400 text-sm mt-1">Be the first to start the discussion!</p>
          </div>
        )}
      </div>
    </div>
  );
}

function buildTree(items: CommentDoc[]) {
  const byId = new Map<string, CommentDoc & { children: CommentDoc[] }>();
  const roots: (CommentDoc & { children: CommentDoc[] })[] = [];
  for (const it of items) byId.set(it.id, { ...it, children: [] });
  for (const it of items) {
    const parentId = it.parentId ?? null;
    if (!parentId) {
      roots.push(byId.get(it.id)!);
    } else {
      const parent = byId.get(parentId);
      if (parent) parent.children.push(byId.get(it.id)!);
      else roots.push(byId.get(it.id)!); // orphan fallback
    }
  }
  return { roots };
}

function CommentNode({ node, authors, postId, communityId, depth }: { node: any; authors: Record<string, Author>; postId: string; communityId: string; depth: number }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [admins, setAdmins] = useState<string[]>([]);
  const [moderators, setModerators] = useState<string[]>([]);

  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(doc(db, 'communities', communityId), (snap) => {
      const data = (snap.data() as any) || {};
      setAdmins(Array.isArray(data.admins) ? data.admins : []);
      setModerators(Array.isArray(data.moderators) ? data.moderators : []);
    });
    return () => { try { unsub(); } catch {} };
  }, [communityId]);
  const [showReply, setShowReply] = useState(false);
  const [currentNode, setCurrentNode] = useState(node);
  const [showReplies, setShowReplies] = useState(true);
  
  const author = authors[node.authorId] || {};
  const marginLeft = Math.min(depth * 24, 120);
  
  useEffect(() => {
    setCurrentNode(node);
  }, [node]);
  
  // Real-time updates for this comment
  useEffect(() => {
    const handleVoteUpdate = (voteData: any) => {
      if (voteData.targetId === node.id && voteData.targetType === 'comment') {
        setCurrentNode((prev: any) => ({
          ...prev,
          voteScore: voteData.newScore
        }));
      }
    };

    const handleReactionUpdate = (reactionData: any) => {
      if (reactionData.targetId === node.id && reactionData.targetType === 'comment') {
        setCurrentNode((prev: any) => {
          const newReactions = { ...prev.reactions };
          if (reactionData.action === 'add') {
            newReactions[reactionData.emoji] = {
              count: (newReactions[reactionData.emoji]?.count || 0) + 1,
              users: [...(newReactions[reactionData.emoji]?.users || []), reactionData.userId]
            };
          } else {
            if (newReactions[reactionData.emoji]) {
              newReactions[reactionData.emoji] = {
                count: Math.max(0, newReactions[reactionData.emoji].count - 1),
                users: newReactions[reactionData.emoji].users.filter((id: string) => id !== reactionData.userId)
              };
            }
          }
          return { ...prev, reactions: newReactions };
        });
      }
    };

    onVoteUpdate(handleVoteUpdate);
    onReactionUpdate(handleReactionUpdate);
  }, [node.id]);
  
  if (currentNode.isDeleted) {
    return (
      <div className="border-l-2 border-gray-200 pl-4" style={{ marginLeft: `${marginLeft}px` }}>
        <div className="p-3 text-gray-500 italic bg-gray-50 rounded">
          [Comment deleted]
        </div>
      </div>
    );
  }
  
  return (
    <div className="border-l-2 border-gray-200 hover:border-blue-300 transition-colors" style={{ marginLeft: `${marginLeft}px` }}>
      <div className="p-4 bg-white hover:bg-gray-50 transition-colors">
        <div className="flex items-start gap-3 mb-3">
          {author.photoURL ? (
            <img
              src={author.photoURL}
              alt="Avatar"
              className="w-8 h-8 rounded-full flex-shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
              {(author.displayName || author.email || 'A')[0].toUpperCase()}
            </div>
          )}
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-gray-900 text-sm">
                {author.displayName || author.email || 'Anonymous'}
              </span>
              <span className="text-xs text-gray-500">
                {currentNode.createdAt ? new Date((currentNode.createdAt as any).toDate?.() ?? Date.now()).toLocaleDateString() : "pending"} at{' '}
                {currentNode.createdAt ? new Date((currentNode.createdAt as any).toDate?.() ?? Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}
              </span>
              {depth > 0 && (
                <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                  Reply
                </span>
              )}
            </div>
            
            <div className="prose prose-sm max-w-none mb-3 text-gray-800 whitespace-pre-wrap">
              {currentNode.content}
            </div>
            
            <div className="flex items-center gap-3 flex-wrap">
              <VotingButtons
                targetId={currentNode.id}
                targetType="comment"
                voteScore={currentNode.voteScore || 0}
                upvotes={currentNode.upvotes || []}
                downvotes={currentNode.downvotes || []}
                communityId={communityId}
                className="flex-shrink-0"
              />
              
              <ReactionButtons
                targetId={currentNode.id}
                targetType="comment"
                reactions={currentNode.reactions}
                communityId={communityId}
                className="flex-shrink-0"
              />
              
              {user && (
                <button
                  type="button"
                  className="text-sm text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowReply(!showReply); }}
                >
                  Reply
                </button>
              )}

              {(user?.uid === currentNode.authorId || admins.includes(user?.uid || '') || moderators.includes(user?.uid || '')) && (
                <button
                  type="button"
                  className="text-sm text-red-600 hover:text-red-800 hover:underline transition-colors"
onClick={async () => {
                    if (!confirm('Delete this comment? This will broadcast deletion and remove it from the emulator.')) return;
                    const res = await emitCommentDelete({ commentId: currentNode.id, communityId });
                    if (res.ok) showToast('Comment deletion broadcasted', 'success');
                    else showToast(`Delete denied: ${res.error}`, 'error');
                  }}
                >
                  Delete
                </button>
              )}
              
              {currentNode.children?.length > 0 && (
                <button
                  type="button"
                  className="text-sm text-gray-600 hover:text-gray-800 hover:underline transition-colors flex items-center gap-1"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowReplies(!showReplies); }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d={showReplies ? "M19 9l-7 7-7-7" : "M9 5l7 7-7 7"} />
                  </svg>
                  {showReplies ? 'Hide' : 'Show'} {currentNode.children.length} {currentNode.children.length === 1 ? 'reply' : 'replies'}
                </button>
              )}
            </div>

            {showReply && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg" onClick={(e) => e.stopPropagation()}>
                <CommentComposer
                  postId={postId}
                  parentId={currentNode.id}
                  communityId={communityId}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {showReplies && currentNode.children?.length > 0 && (
        <div className="space-y-2">
          {currentNode.children.map((child: any) => (
            <CommentNode key={child.id} node={child} authors={authors} postId={postId} communityId={communityId} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
