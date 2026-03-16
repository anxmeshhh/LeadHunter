import { useState } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, Zap, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useNavigate, Link } from "react-router-dom";

export default function Login() {
  const navigate = useNavigate();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPwd,  setShowPwd]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) {
      setError(err.message);
      setLoading(false);
    } else {
      navigate("/");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: "hsl(215,30%,6%)" }}>

      {/* Ambient glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full opacity-[0.07] blur-[120px] pointer-events-none"
        style={{ background: "hsl(72,100%,50%)" }} />

      {/* Grid pattern */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: "linear-gradient(hsl(72,100%,50%) 1px, transparent 1px), linear-gradient(90deg, hsl(72,100%,50%) 1px, transparent 1px)",
          backgroundSize: "48px 48px"
        }} />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md px-4"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "hsl(72,100%,50%)" }}>
              <Zap className="w-5 h-5 text-black" />
            </div>
            <div className="text-left">
              <p className="font-bold text-white text-lg leading-none tracking-tight">LeadHunter</p>
              <p className="text-[10px] tracking-widest uppercase"
                style={{ color: "hsl(72,100%,50%)" }}>AI Sales Engine</p>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white">Welcome back</h1>
          <p className="text-sm mt-1" style={{ color: "hsl(215,20%,55%)" }}>
            Sign in to your command center
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-6 space-y-5"
          style={{
            background: "hsl(215,30%,9%)",
            border: "1px solid hsl(215,20%,16%)",
            boxShadow: "0 0 0 1px hsl(215,20%,10%), 0 24px 48px rgba(0,0,0,0.4)"
          }}>

          {/* Error */}
          {error && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 p-3 rounded-lg text-sm"
              style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171" }}>
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </motion.div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-[11px] font-medium uppercase tracking-widest mb-2"
                style={{ color: "hsl(215,20%,55%)" }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-slate-600 outline-none transition-all"
                style={{
                  background: "hsl(215,30%,7%)",
                  border: "1px solid hsl(215,20%,16%)",
                }}
                onFocus={e => e.currentTarget.style.borderColor = "hsl(72,100%,50%)"}
                onBlur={e => e.currentTarget.style.borderColor = "hsl(215,20%,16%)"}
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-[11px] font-medium uppercase tracking-widest mb-2"
                style={{ color: "hsl(215,20%,55%)" }}>
                Password
              </label>
              <div className="relative">
                <input
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-3 pr-11 rounded-xl text-sm text-white placeholder:text-slate-600 outline-none transition-all"
                  style={{
                    background: "hsl(215,30%,7%)",
                    border: "1px solid hsl(215,20%,16%)",
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = "hsl(72,100%,50%)"}
                  onBlur={e => e.currentTarget.style.borderColor = "hsl(215,20%,16%)"}
                />
                <button type="button" onClick={() => setShowPwd(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: "hsl(215,20%,45%)" }}>
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Forgot */}
            <div className="flex justify-end">
              <button type="button"
                onClick={async () => {
                  if (!email) { setError("Enter your email first"); return; }
                  await supabase.auth.resetPasswordForEmail(email);
                  setError(null);
                  alert("Password reset email sent!");
                }}
                className="text-xs transition-colors"
                style={{ color: "hsl(72,100%,50%)" }}>
                Forgot password?
              </button>
            </div>

            {/* Submit */}
            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl font-bold text-sm text-black flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-50"
              style={{ background: "hsl(72,100%,50%)" }}>
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in...</>
                : <><Zap className="w-4 h-4" /> Sign In</>
              }
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px" style={{ background: "hsl(215,20%,14%)" }} />
            <span className="text-xs" style={{ color: "hsl(215,20%,40%)" }}>or</span>
            <div className="flex-1 h-px" style={{ background: "hsl(215,20%,14%)" }} />
          </div>

          {/* Sign up link */}
          <p className="text-center text-sm" style={{ color: "hsl(215,20%,50%)" }}>
            Don't have an account?{" "}
            <Link to="/signup"
              className="font-semibold transition-colors"
              style={{ color: "hsl(72,100%,50%)" }}>
              Create one free
            </Link>
          </p>
        </div>

        {/* Footer */}
        <p className="text-center text-xs mt-6" style={{ color: "hsl(215,20%,30%)" }}>
          LeadHunter · AI Sales Command Center · India
        </p>
      </motion.div>
    </div>
  );
}