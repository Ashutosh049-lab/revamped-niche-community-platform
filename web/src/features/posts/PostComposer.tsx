import { useState } from "react";
import { auth, db } from "../../lib/firebase";
import { addDoc, collection, serverTimestamp, updateDoc, doc, increment } from "firebase/firestore";
import { emit } from "../../lib/socket";
import RichTextEditor from "../editor/RichTextEditor";
import MediaUploader, { type MediaItem } from "../uploads/MediaUploader";

interface Props {
  communityId: string;
}

export default function PostComposer({ communityId }: Props) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    try {
      setSubmitting(true);
      setError(null);
      if (!db) throw new Error("Firebase not configured");
      const user = auth?.currentUser;
      if (!user) throw new Error("You must be signed in to post");
      const post = {
        communityId,
        authorId: user.uid,
        title: title.trim(),
        content: content, // HTML from RichTextEditor
        media,
        createdAt: serverTimestamp(),
        voteScore: 0,
        reactions: {},
      };
      const ref = await addDoc(collection(db, "posts"), post);
      // Update user stats
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          'stats.totalPosts': increment(1),
          lastActiveAt: serverTimestamp(),
        });
      } catch {}
      // Emit socket event for live update
      emit("post:new", { id: ref.id, ...post });
      setTitle("");
      setContent("");
      setMedia([]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="border rounded p-4 space-y-3">
      <h3 className="font-semibold">Create a post</h3>
      {error && <div className="text-red-600 text-sm">{error}</div>}
      <input
        className="w-full border rounded px-3 py-2"
        placeholder="Post title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <div>
        <RichTextEditor value={content} onChange={setContent} onSubmit={submit} communityId={communityId} />
      </div>
      <div>
        <MediaUploader onAdd={(items) => setMedia((prev) => [...prev, ...items])} />
        {media.length > 0 && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            {media.map((m, i) => (
              <div key={i} className="border rounded p-2 text-xs break-all">
                <div className="font-medium">{m.type}</div>
                <a className="text-blue-600 underline" href={m.url} target="_blank" rel="noreferrer">{m.url}</a>
              </div>
            ))}
          </div>
        )}
      </div>
      <button
        type="button"
        className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
        disabled={submitting || !title.trim()}
        onClick={(e) => { e.preventDefault(); submit(); }}
      >
        {submitting ? "Posting..." : "Post"}
      </button>
    </div>
  );
}
