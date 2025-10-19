import { Link } from "react-router-dom";
import { useAuth } from "../features/auth/AuthProvider";

export default function AuthBanner() {
  const { user, loading, isReady } = useAuth();
  if (!isReady || loading || user) return null;
  return (
    <div className="bg-yellow-50 border-b border-yellow-200 text-yellow-900 px-6 py-3 text-sm">
You are not signed in. Some data is hidden. <Link to="/login" className="underline font-medium">Sign in</Link> or <Link to="/signup" className="underline font-medium">create an account</Link> to view your personalized feed and communities.
    </div>
  );
}