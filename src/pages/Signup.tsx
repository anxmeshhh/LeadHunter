import { useState } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, Zap, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useNavigate, Link } from "react-router-dom";

export default function Signup() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [company,  setCompany]  = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPwd,  setShowPwd]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [done,     setDone]     = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setLoading(true);
    setError(null);

    const { data, error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, company }
      }
    });

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    // If email confirmation is disabled in Supabase → go straight in
    if (data.session) {
      navigate("/");
    } else {
      setDone(true);
    }
    setLoading(false);
  }

  // Success state
  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{ background: "hsl(215,30%,6%)" }}>
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-sm px-4">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.3)" }}>
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Check your email</h2>
          <p className="text-sm mb-6" style={{ color: "hsl(215,20%,55%)" }}>
            We sent a confirmation link to <span className="text-white">{email}</span>.
            Click it to activate your account.
          </p>
          <Link to="/login"
            className="text-sm font-semibold"
            style={{ color: "hsl(72,100%,50%)" }}>
            Back to login →
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: "hsl(215,30%,6%)" }}>

      {/* Ambient glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full opacity-[0.07] blur-[120px] pointer-events-none"
        style={{ background: "hsl(72,100%,50%)" }} />

      {/* Grid */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: "linear-gradient(hsl(72,100%,50%) 1px, transparent 1px), linear-gradient(90deg, hsl(72,100%,50%) 1px, transparent 1px)",
          backgroundSize: "48px 48px"
        }} />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md px-4 py-8"
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
          <h1 className="text-2xl font-bold text-white">Create your account</h1>
          <p className="text-sm mt-1" style={{ color: "hsl(215,20%,55%)" }}>
            Start closing more deals today
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-6 space-y-4"
          style={{
            background: "hsl(215,30%,9%)",
            border: "1px solid hsl(215,20%,16%)",
            boxShadow: "0 0 0 1px hsl(215,20%,10%), 0 24px 48px rgba(0,0,0,0.4)"
          }}>

          {error && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 p-3 rounded-lg text-sm"
              style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171" }}>
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSignup} className="space-y-4">

            {/* Name + Company row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-widest mb-2"
                  style={{ color: "hsl(215,20%,55%)" }}>Full Name</label>
                <input type="text" value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="Rahul Sharma" required
                  className="w-full px-3 py-3 rounded-xl text-sm text-white placeholder:text-slate-600 outline-none transition-all"
                  style={{ background: "hsl(215,30%,7%)", border: "1px solid hsl(215,20%,16%)" }}
                  onFocus={e => e.currentTarget.style.borderColor = "hsl(72,100%,50%)"}
                  onBlur={e => e.currentTarget.style.borderColor = "hsl(215,20%,16%)"}
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-widest mb-2"
                  style={{ color: "hsl(215,20%,55%)" }}>Company</label>
                <input type="text" value={company}
                  onChange={e => setCompany(e.target.value)}
                  placeholder="Freelancer"
                  className="w-full px-3 py-3 rounded-xl text-sm text-white placeholder:text-slate-600 outline-none transition-all"
                  style={{ background: "hsl(215,30%,7%)", border: "1px solid hsl(215,20%,16%)" }}
                  onFocus={e => e.currentTarget.style.borderColor = "hsl(72,100%,50%)"}
                  onBlur={e => e.currentTarget.style.borderColor = "hsl(215,20%,16%)"}
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-[11px] font-medium uppercase tracking-widest mb-2"
                style={{ color: "hsl(215,20%,55%)" }}>Email</label>
              <input type="email" value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@company.com" required
                className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-slate-600 outline-none transition-all"
                style={{ background: "hsl(215,30%,7%)", border: "1px solid hsl(215,20%,16%)" }}
                onFocus={e => e.currentTarget.style.borderColor = "hsl(72,100%,50%)"}
                onBlur={e => e.currentTarget.style.borderColor = "hsl(215,20%,16%)"}
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-[11px] font-medium uppercase tracking-widest mb-2"
                style={{ color: "hsl(215,20%,55%)" }}>Password</label>
              <div className="relative">
                <input type={showPwd ? "text" : "password"} value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 6 characters" required
                  className="w-full px-4 py-3 pr-11 rounded-xl text-sm text-white placeholder:text-slate-600 outline-none transition-all"
                  style={{ background: "hsl(215,30%,7%)", border: "1px solid hsl(215,20%,16%)" }}
                  onFocus={e => e.currentTarget.style.borderColor = "hsl(72,100%,50%)"}
                  onBlur={e => e.currentTarget.style.borderColor = "hsl(215,20%,16%)"}
                />
                <button type="button" onClick={() => setShowPwd(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: "hsl(215,20%,45%)" }}>
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Password strength */}
              {password.length > 0 && (
                <div className="flex gap-1 mt-2">
                  {[1,2,3,4].map(i => (
                    <div key={i} className="flex-1 h-1 rounded-full transition-all"
                      style={{
                        background: password.length >= i * 3
                          ? i <= 1 ? "#ef4444" : i <= 2 ? "#f59e0b" : i <= 3 ? "#3b82f6" : "hsl(72,100%,50%)"
                          : "hsl(215,20%,16%)"
                      }} />
                  ))}
                </div>
              )}
            </div>

            {/* Submit */}
            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl font-bold text-sm text-black flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-50 mt-2"
              style={{ background: "hsl(72,100%,50%)" }}>
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating account...</>
                : <><Zap className="w-4 h-4" /> Create Account</>
              }
            </button>
          </form>

          <p className="text-center text-sm pt-1" style={{ color: "hsl(215,20%,50%)" }}>
            Already have an account?{" "}
            <Link to="/login" className="font-semibold transition-colors"
              style={{ color: "hsl(72,100%,50%)" }}>
              Sign in
            </Link>
          </p>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: "hsl(215,20%,30%)" }}>
          LeadHunter · AI Sales Command Center · India
        </p>
      </motion.div>
    </div>
  );
}