// src/hooks/useAuth.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Auth context — wraps your whole app, provides useAuth() hook everywhere.
// Also exports ProtectedRoute for wrapping private pages.
//
// USAGE in main.tsx / App.tsx:
//   <AuthProvider>
//     <App />
//   </AuthProvider>
//
// USAGE in router:
//   <Route element={<ProtectedRoute />}>
//     <Route path="/" element={<Dashboard />} />
//     ... all private routes
//   </Route>
// ─────────────────────────────────────────────────────────────────────────────

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { supabase } from "../lib/supabase";
import type { User, Session } from "@supabase/supabase-js";

// ── Context ───────────────────────────────────────────────────────────────────
interface AuthContextType {
  user:    User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user:    null,
  session: null,
  loading: true,
  signOut: async () => {},
});

// ── Provider ──────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useAuth() {
  return useContext(AuthContext);
}

// ── Protected Route ───────────────────────────────────────────────────────────
// Wrap all private routes with this. Shows nothing while loading session,
// redirects to /login if not authenticated.
export function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{ background: "hsl(215,30%,6%)" }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center animate-pulse"
            style={{ background: "hsl(72,100%,50%)" }}>
            <svg className="w-4 h-4 text-black" fill="currentColor" viewBox="0 0 24 24">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
            </svg>
          </div>
          <p className="text-xs tracking-widest uppercase"
            style={{ color: "hsl(72,100%,50%)" }}>
            Loading...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}