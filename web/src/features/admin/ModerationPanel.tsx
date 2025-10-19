import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { collection, getDocs, limit, orderBy, query, doc, getDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useToast } from "../../components/ToastProvider";
import { emitPostDelete, emitCommentDelete } from "../../lib/socket";

interface PostLite { id: string; title?: string; communityId: string; authorId?: string; createdAt?: any }
interface CommentLite { id: string; postId: string; communityId: string; authorId?: string; createdAt?: any }

export default function ModerationPanel() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [posts, setPosts] = useState<PostLite[]>([]);
  const [comments, setComments] = useState<CommentLite[]>([]);
  const [roleByCommunity, setRoleByCommunity] = useState<Record<string, { admin: boolean; moderator: boolean }>>({});
  const [communityFilter, setCommunityFilter] = useState<string>("");
  const [postsLimit, setPostsLimit] = useState(20);
  const [commentsLimit, setCommentsLimit] = useState(20);

  const canModerate = (communityId: string) => {
    const r = roleByCommunity[communityId];
    return !!(r?.admin || r?.moderator);
  };

  useEffect(() => {
    const load = async () => {
      try {
        if (!db) return;
        const postsQ = communityFilter
          ? query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(postsLimit))
          : query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(postsLimit));
        const commentsQ = communityFilter
          ? query(collection(db, "comments"), orderBy("createdAt", "desc"), limit(commentsLimit))
          : query(collection(db, "comments"), orderBy("createdAt", "desc"), limit(commentsLimit));
        const [postsSnap, commentsSnap] = await Promise.all([getDocs(postsQ), getDocs(commentsQ)]);
        setPosts(postsSnap.docs.map(d => ({ id: d.id, communityId: (d.data() as any).communityId, title: (d.data() as any).title, authorId: (d.data() as any).authorId, createdAt: (d.data() as any).createdAt })));
        setComments(commentsSnap.docs.map(d => ({ id: d.id, communityId: (d.data() as any).communityId, postId: (d.data() as any).postId, authorId: (d.data() as any).authorId, createdAt: (d.data() as any).createdAt })));

        // Gather distinct communities and fetch role info for current user
        const cids = Array.from(new Set([...postsSnap.docs, ...commentsSnap.docs].map(d => (d.data() as any).communityId).filter(Boolean)));
        if (communityFilter) {
          // Filter client-side for now
          setPosts(prev => prev.filter(p => p.communityId === communityFilter));
          setComments(prev => prev.filter(c => c.communityId === communityFilter));
        }
        const roles: Record<string, { admin: boolean; moderator: boolean }> = {};
        for (const cid of cids) {
          try {
            const c = await getDoc(doc(db, "communities", cid));
            const data = (c.data() as any) || {};
            roles[cid] = {
              admin: Array.isArray(data.admins) && data.admins.includes(user?.uid || ""),
              moderator: Array.isArray(data.moderators) && data.moderators.includes(user?.uid || ""),
            };
          } catch {}
        }
        setRoleByCommunity(roles);
      } catch (e) {
        showToast("Failed to load moderation data", "error");
      }
    };
    load();
  }, [user?.uid, communityFilter, postsLimit, commentsLimit]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-6 space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Moderation Panel</h1>
          <p className="text-gray-600 text-sm">Quick tools to moderate recent posts and comments</p>
          <div className="mt-3 flex items-center gap-3">
            <select
              value={communityFilter}
              onChange={(e) => setCommunityFilter(e.target.value)}
              className="border rounded px-2 py-1 text-sm"
            >
              <option value="">All communities</option>
              {Array.from(new Set([...posts.map(p => p.communityId), ...comments.map(c => c.communityId)])).map(cid => (
                <option key={cid} value={cid}>{cid}</option>
              ))}
            </select>
            <button className="text-sm px-2 py-1 border rounded" onClick={() => { setPostsLimit(l => l + 20); setCommentsLimit(l => l + 20); }}>Load more</button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg border">
            <div className="p-4 border-b font-semibold">Recent Posts</div>
            <div className="divide-y">
              {posts.map(p => (
                <div key={p.id} className="p-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900 line-clamp-1">{p.title || "(no title)"}</div>
                    <div className="text-xs text-gray-500">c/{p.communityId} • by {p.authorId}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {canModerate(p.communityId) && (
                      <button
                        className="text-sm text-red-600 hover:text-red-800 underline"
onClick={async () => {
                          if (!confirm('Delete this post? This will broadcast deletion and remove it from the emulator.')) return;
                          const res = await emitPostDelete({ postId: p.id, communityId: p.communityId });
                          if (res.ok) showToast("Post deletion broadcasted", "success");
                          else showToast(`Delete denied: ${res.error}`, "error");
                        }}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {posts.length === 0 && <div className="p-4 text-sm text-gray-500">No recent posts.</div>}
            </div>
          </div>

          <div className="bg-white rounded-lg border">
            <div className="p-4 border-b font-semibold">Recent Comments</div>
            <div className="divide-y">
              {comments.map(c => (
                <div key={c.id} className="p-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900 text-sm">Comment {c.id}</div>
                    <div className="text-xs text-gray-500">c/{c.communityId} • by {c.authorId} • on post {c.postId}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {canModerate(c.communityId) && (
                      <button
                        className="text-sm text-red-600 hover:text-red-800 underline"
onClick={async () => {
                          if (!confirm('Delete this comment? This will broadcast deletion and remove it from the emulator.')) return;
                          const res = await emitCommentDelete({ commentId: c.id, communityId: c.communityId });
                          if (res.ok) showToast("Comment deletion broadcasted", "success");
                          else showToast(`Delete denied: ${res.error}`, "error");
                        }}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {comments.length === 0 && <div className="p-4 text-sm text-gray-500">No recent comments.</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
