import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export const RequireAuth = ({ children }: { children: JSX.Element }) => {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="flex h-screen items-center justify-center text-muted-foreground font-mono text-xs">…</div>;
  if (!user) return <Navigate to="/auth" replace state={{ from: loc.pathname + loc.search }} />;
  return children;
};
