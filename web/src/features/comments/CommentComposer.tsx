import { useState } from "react";
import { auth, db } from "../../lib/firebase";
import { addDoc, collection, serverTimestamp, updateDoc, doc, increment } from "firebase/firestore";
import { emit } from "../../lib/socket";

interface Props {
  postId: string;
  communityId: string;
  parentId?: string;
}

export default function CommentComposer({ postId, communityId, parentId }: Props) {
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    try {
      setSubmitting(true);
      setError(null);
      if (!db) throw new Error("Firebase not configured");
      const user = auth?.currentUser;
      if (!user) throw new Error("You must be signed in to comment");
      const comment = {
        postId,
        communityId,
        parentId: parentId ?? null,
        authorId: user.uid,
        content: content.trim(),
        createdAt: serverTimestamp(),
      };
      const ref = await addDoc(collection(db, "comments"), comment);
      // Update user stats
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          'stats.totalComments': increment(1),
          lastActiveAt: serverTimestamp(),
        });
      } catch {}
      emit("comment:new", { id: ref.id, ...comment });
      setContent("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-2" data-no-nav onClick={(e) => { e.stopPropagation(); }}>
      {error && <div className="text-red-600 text-sm">{error}</div>}
      <textarea
        className="w-full border rounded px-3 py-2 min-h-20"
        placeholder={parentId ? "Write a reply..." : "Write a comment..."}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={(e) => { if ((e as any).key === 'Enter' && (e as any).ctrlKey) { e.preventDefault(); e.stopPropagation(); submit(); } }}
      />
      <div className="flex gap-2">
        <button
          type="button"
          className="bg-blue-600 text-white px-3 py-1.5 rounded disabled:opacity-50"
          disabled={submitting || !content.trim()}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); (e as any).nativeEvent?.stopImmediatePropagation?.(); submit(); }}
        >
          {submitting ? "Posting..." : parentId ? "Reply" : "Comment"}
        </button>
      </div>
    </div>
  );
}