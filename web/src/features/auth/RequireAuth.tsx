import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";

import type { ReactNode } from 'react';

export default function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading, isReady } = useAuth();
  const location = useLocation();

  if (!isReady) {
    // Firebase not configured yet
    return <div className="p-6 text-red-600">Firebase is not configured. Add your keys to web/.env.</div>;
  }

  if (loading) return <div className="p-6">Loading...</div>;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}