import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { auth, db } from "../../lib/firebase";
import { collection, onSnapshot, orderBy, query, where, Timestamp, doc } from "firebase/firestore";
import PostComposer from "../posts/PostComposer";
import { onPostNew, onPostDeleted, offPostDeleted } from "../../lib/socket";
import { useCommunityRoom } from "../../hooks/useCommunityRoom";
import { useToast } from "../../components/ToastProvider";
import CommentsThread from "../comments/CommentsThread";
import ReactionButtons from "../reactions/ReactionButtons";

interface PostDoc { id: string; title: string; content?: string; authorId: string; createdAt?: Timestamp | null; communityId: string }

export default function CommunityPage() {
  const { communityId = "" } = useParams();
  const [posts, setPosts] = useState<PostDoc[]>([]);
  const { joinError } = useCommunityRoom(communityId);
  const { showToast } = useToast();
  const [communityAdmins, setCommunityAdmins] = useState<string[]>([]);
  const [communityModerators, setCommunityModerators] = useState<string[]>([]);

  useEffect(() => {
    if (!db || !communityId) return;
    const q = query(
      collection(db, "posts"),
      where("communityId", "==", communityId),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      const rows: PostDoc[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      setPosts(rows);
    });
    return () => unsub();
  }, [communityId]);

  useEffect(() => {
    if (!communityId || !db) return;

    // Load community admins for UI permissions
    const unsubCommunity = onSnapshot(doc(db, 'communities', communityId), (snap) => {
      const data = (snap.data() as any) || {};
      const admins = data.admins || [];
      const moderators = data.moderators || [];
      setCommunityAdmins(Array.isArray(admins) ? admins : []);
      setCommunityModerators(Array.isArray(moderators) ? moderators : []);
    }, () => { setCommunityAdmins([]); setCommunityModerators([]); });

    const postHandler = (post: any) => {
      if (post?.communityId !== communityId) return;
      setPosts((prev) => {
        if (prev.some((p) => p.id === post.id)) return prev;
        return [{ ...post }, ...prev];
      });
    };

    onPostNew(postHandler);

    const deletedHandler = (evt: { postId: string; communityId: string }) => {
      if (evt.communityId !== communityId) return;
      setPosts((prev) => prev.filter(p => p.id !== evt.postId));
    };
    onPostDeleted(deletedHandler);

    return () => {
      try { unsubCommunity(); } catch {}
      try { offPostDeleted(deletedHandler as any) } catch {}
      // Note: we don't remove the post handler explicitly here (simple demo)
    };
  }, [communityId]);

  const userId = useMemo(() => auth?.currentUser?.uid ?? null, [auth?.currentUser]);

  // Surface join errors as toast too
  useEffect(() => {
    if (joinError) showToast(joinError, 'warning');
  }, [joinError]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Community {communityId}</h2>
        <p className="text-gray-600 text-sm">Posts update live via Firestore snapshots and Socket.io events.</p>
      </div>


      {userId ? (
        <PostComposer communityId={communityId} />
      ) : (
        <div className="text-sm text-gray-600">Sign in to create a post.</div>
      )}

      <div className="space-y-3">
        {posts.map((p) => (
          <div
            key={p.id}
            className="border rounded p-4"
            onClick={(e) => {
              const target = e.target as HTMLElement;
              if (target && target.closest('[data-no-nav]')) {
                e.preventDefault();
                e.stopPropagation();
              }
            }}
          >
            <div className="font-medium">{p.title}</div>
            {p.content && <div className="prose max-w-none mt-1" dangerouslySetInnerHTML={{ __html: p.content }} />}
            {Array.isArray((p as any).media) && (p as any).media.length > 0 && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(p as any).media.map((m: any, i: number) => (
                  <div key={i} className="border rounded overflow-hidden">
                    {m.type === 'video' ? (
                      <video src={m.url} controls className="w-full" />
                    ) : (
                      <img src={m.url} alt="media" className="w-full" />
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="text-xs text-gray-500 mt-2 flex items-center justify-between">
              <span>by {p.authorId} • {p.createdAt ? new Date((p.createdAt as any).toDate?.() ?? Date.now()).toLocaleString() : "pending"}</span>
              {(userId === p.authorId || communityAdmins.includes(userId || '') || communityModerators.includes(userId || '')) && (
                <button
                  type="button"
                  className="text-xs text-red-600 hover:text-red-800 underline"
onClick={async () => {
                    if (!confirm('Delete this post? This will broadcast deletion and remove it from the emulator.')) return;
                    const res = await import('../../lib/socket').then(m => m.emitPostDelete({ postId: p.id, communityId }));
                    if (res.ok) showToast('Post deletion broadcasted', 'success');
                    else showToast(`Delete denied: ${res.error}`, 'error');
                  }}
                >
                  Delete
                </button>
              )}
            </div>
            {/* Reactions */}
            <div className="mt-2">
              <ReactionButtons
                targetId={p.id}
                targetType="post"
                reactions={(p as any).reactions}
                communityId={communityId}
                canModerate={communityAdmins.includes(userId || '') || communityModerators.includes(userId || '')}
              />
            </div>
            {/* Threaded comments */}
            <div className="mt-4">
              <CommentsThread postId={p.id} communityId={communityId} />
            </div>
          </div>
        ))}
        {posts.length === 0 && (
          <div className="text-gray-600">No posts yet. Be the first to post!</div>
        )}
      </div>
    </div>
  );
}