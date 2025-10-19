import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../../lib/firebase";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { useAuth } from "../auth/AuthProvider";

interface Community { id: string; name: string; description?: string; category?: string }

export default function CommunitiesPage() {
  const [communities, setCommunities] = useState<Community[]>([]);
  const { user, isReady } = useAuth();

  useEffect(() => {
    if (!db || !isReady || !user) return;
    const q = query(collection(db, "communities"), orderBy("name"));
    const unsub = onSnapshot(q, (snap) => {
      const rows: Community[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      setCommunities(rows);
    }, (err) => {
      console.error("Communities query failed:", err);
    });
    return () => unsub();
  }, [isReady, user]);

  const signedOut = isReady && !user;
  return (
    <div className="p-6 space-y-4">
      <h2 className="text-xl font-semibold">Communities</h2>
      {signedOut ? (
        <div className="text-gray-700">Please sign in to view communities.</div>
      ) : communities.length === 0 ? (
        <div className="text-gray-600">No communities yet. Seed some in Firestore.</div>
      ) : (
        <ul className="space-y-2">
          {communities.map((c) => (
            <li key={c.id} className="border rounded p-3">
              <div className="font-medium">{c.name}</div>
              <div className="text-sm text-gray-600">{c.description}</div>
              <Link className="text-blue-600 text-sm underline" to={`/c/${c.id}`}>Open</Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}