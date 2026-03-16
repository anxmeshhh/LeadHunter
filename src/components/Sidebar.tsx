import { useState, useEffect } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Search, Users, Kanban, BarChart3,
  Calendar, Settings, ChevronLeft, ChevronRight,
  Target, Mail, FileText, Tags, Flame, CheckCircle2,
  LogOut, Zap,
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const navItems = [
  { to: "/",          icon: LayoutDashboard, label: "Command Center", color: "text-violet-400" },
  { to: "/discover",  icon: Search,          label: "Lead Discovery", color: "text-cyan-400"   },
  { to: "/leads",     icon: Users,           label: "All Leads",      color: "text-blue-400"   },
  { to: "/pipeline",  icon: Kanban,          label: "Pipeline",       color: "text-purple-400" },
  { to: "/outreach",  icon: Mail,            label: "Outreach",       color: "text-emerald-400"},
  { to: "/proposals", icon: FileText,        label: "Proposals",      color: "text-amber-400"  },
  { to: "/analytics", icon: BarChart3,       label: "Analytics",      color: "text-pink-400"   },
  { to: "/calendar",  icon: Calendar,        label: "Calendar",       color: "text-orange-400" },
  { to: "/tags",      icon: Tags,            label: "Tags",           color: "text-teal-400"   },
  { to: "/settings",  icon: Settings,        label: "Settings",       color: "text-slate-400"  },
];

// ── Daily Goal Widget ──────────────────────────────────────────────────────────
function DailyGoalWidget({ collapsed }: { collapsed: boolean }) {
  const [target,    setTarget]    = useState(10);
  const [contacted, setContacted] = useState(0);
  const [newLeads,  setNewLeads]  = useState(0);
  const [streak,    setStreak]    = useState(0);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    (async () => {
      // ✅ FIX: scope all queries to current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayISO = todayStart.toISOString();

      const [
        { data: targetRow },
        { data: outreachRows },
        { data: newLeadRows },
      ] = await Promise.all([
        supabase.from("daily_targets").select("*")
          .eq("user_id", user.id)              // ✅
          .limit(1).maybeSingle(),
        supabase.from("outreach_history").select("id")
          .eq("user_id", user.id)              // ✅
          .gte("contacted_at", todayISO),
        supabase.from("leads").select("id")
          .eq("user_id", user.id)              // ✅
          .gte("created_at", todayISO),
      ]);

      setTarget(targetRow?.daily_contact_target ?? targetRow?.daily_target ?? 10);
      setStreak(targetRow?.streak ?? 0);
      setContacted((outreachRows ?? []).length);
      setNewLeads((newLeadRows ?? []).length);
      setLoading(false);
    })();
  }, []);

  const pct   = Math.min((contacted / Math.max(target, 1)) * 100, 100);
  const done  = contacted >= target;
  const color = done ? "#10B981" : pct >= 60 ? "#f59e0b" : "hsl(72,100%,50%)";

  // ── Collapsed: mini ring ──
  if (collapsed) {
    return (
      <div className="px-3 py-3 border-t border-white/[0.06] flex flex-col items-center gap-1.5 shrink-0">
        {loading ? (
          <div className="w-9 h-9 rounded-full bg-muted/50 animate-pulse" />
        ) : (
          <>
            <div className="relative w-9 h-9">
              <svg className="w-9 h-9 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="3" />
                <circle
                  cx="18" cy="18" r="14"
                  fill="none"
                  stroke={color}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 14}`}
                  strokeDashoffset={`${2 * Math.PI * 14 * (1 - pct / 100)}`}
                  style={{ filter: `drop-shadow(0 0 5px ${color}90)`, transition: "stroke-dashoffset 0.8s ease" }}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[9px] font-stats font-bold"
                style={{ color }}>
                {contacted}
              </span>
            </div>
            {done && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
          </>
        )}
      </div>
    );
  }

  // ── Expanded: full card ──
  if (loading) {
    return (
      <div className="mx-3 mb-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-2 shrink-0">
        {[1, 2, 3].map((i) => <div key={i} className="h-2.5 rounded bg-muted/40 animate-pulse" />)}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-3 mb-3 p-3 rounded-xl shrink-0 relative overflow-hidden"
      style={{
        background:   "rgba(255,255,255,0.03)",
        border:       "1px solid rgba(255,255,255,0.07)",
        boxShadow:    `inset 0 1px 0 rgba(255,255,255,0.04)`,
      }}
    >
      {/* Glow */}
      <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full opacity-20 blur-xl"
        style={{ backgroundColor: color }} />

      <div className="relative space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-stats text-muted-foreground uppercase tracking-widest">
            Today's Goal
          </span>
          {streak > 0 && (
            <span className="flex items-center gap-1 text-[9px] font-stats text-amber-400">
              <Flame className="w-2.5 h-2.5" /> {streak}d
            </span>
          )}
        </div>

        <div className="flex items-end gap-1.5">
          <span className="font-stats text-2xl font-bold leading-none" style={{ color }}>
            {contacted}
          </span>
          <span className="font-stats text-sm text-muted-foreground leading-none mb-0.5">
            / {target}
          </span>
          {done && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mb-0.5 ml-1" />}
        </div>

        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.9, ease: "easeOut" }}
            className="h-full rounded-full"
            style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}70` }}
          />
        </div>

        <p className="text-[9px] font-stats text-muted-foreground">
          {done ? "🎯 Goal smashed!" : `${target - contacted} more to hit target`}
        </p>

        <div className="grid grid-cols-2 gap-1.5">
          {[
            { label: "Contacted", value: contacted },
            { label: "New Leads", value: newLeads  },
          ].map((s) => (
            <div key={s.label} className="rounded-lg px-2 py-1.5 text-center"
              style={{ background: "rgba(255,255,255,0.04)" }}>
              <p className="font-stats text-xs font-bold text-foreground">{s.value}</p>
              <p className="text-[8px] font-stats text-muted-foreground uppercase tracking-widest">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ── Sidebar ────────────────────────────────────────────────────────────────────
export default function Sidebar() {
  const [collapsed,     setCollapsed]     = useState(false);
  const [userEmail,     setUserEmail]     = useState<string | null>(null);
  const [signingOut,    setSigningOut]    = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // ✅ load user email for avatar
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserEmail(user?.email ?? null);
    });
  }, []);

  // ✅ sign out
  async function handleSignOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
    navigate("/login");
  }

  const initials = userEmail
    ? userEmail.charAt(0).toUpperCase()
    : "?";

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 260 }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
      className="fixed left-0 top-0 h-screen z-50 flex flex-col border-r"
      style={{
        background:   "rgba(6,8,14,0.97)",
        borderColor:  "rgba(255,255,255,0.06)",
        backdropFilter: "blur(24px)",
      }}
    >
      {/* ── Logo ── */}
      <div className="flex items-center gap-3 px-4 h-16 shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "var(--gradient-primary)", boxShadow: "0 0 16px hsl(72,100%,50%)40" }}>
          <Target className="w-4.5 h-4.5 text-black" />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col overflow-hidden"
            >
              <span className="font-heading font-bold text-white text-[15px] leading-tight tracking-tight">
                LeadHunter
              </span>
              <span className="text-[9px] font-stats tracking-[0.2em] uppercase"
                style={{ color: "hsl(72,100%,50%)" }}>
                AI Sales Engine
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── AI Status pill ── */}
      <div className="px-3 py-2 shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-all ${
          collapsed ? "justify-center" : ""
        }`}
          style={{ background: "rgba(255,255,255,0.03)" }}>
          <Zap className="w-3 h-3 shrink-0" style={{ color: "hsl(72,100%,50%)" }} />
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="text-[9px] font-stats uppercase tracking-[0.15em]"
                style={{ color: "hsl(72,100%,50%)" }}
              >
                AI Engine Active
              </motion.span>
            )}
          </AnimatePresence>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-auto shrink-0" />
        </div>
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto
        [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:transparent
        [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to ||
            (item.to !== "/" && location.pathname.startsWith(item.to));

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className="block"
            >
              <motion.div
                whileHover={{ x: collapsed ? 0 : 2 }}
                whileTap={{ scale: 0.97 }}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 relative group ${
                  collapsed ? "justify-center" : ""
                }`}
                style={isActive ? {
                  background:  "rgba(255,255,255,0.07)",
                  border:      "1px solid rgba(255,255,255,0.1)",
                  boxShadow:   "inset 0 1px 0 rgba(255,255,255,0.06)",
                } : {
                  background:  "transparent",
                  border:      "1px solid transparent",
                }}
              >
                {/* Active indicator bar */}
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full"
                    style={{ backgroundColor: "hsl(72,100%,50%)" }} />
                )}

                <item.icon className={`w-4.5 h-4.5 shrink-0 transition-colors ${
                  isActive ? item.color : "text-muted-foreground group-hover:text-foreground"
                }`} />

                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className={`text-[13px] font-medium whitespace-nowrap transition-colors ${
                        isActive ? "text-white" : "text-slate-400 group-hover:text-slate-200"
                      }`}
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>

                {/* Tooltip when collapsed */}
                {collapsed && (
                  <div className="absolute left-14 px-2.5 py-1.5 rounded-lg text-xs font-stats text-white
                    pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap"
                    style={{
                      background:  "rgba(10,12,20,0.97)",
                      border:      "1px solid rgba(255,255,255,0.1)",
                      boxShadow:   "0 4px 20px rgba(0,0,0,0.5)",
                    }}>
                    {item.label}
                  </div>
                )}
              </motion.div>
            </NavLink>
          );
        })}
      </nav>

      {/* ── Daily Goal ── */}
      <DailyGoalWidget collapsed={collapsed} />

      {/* ── User + Sign Out ── */}
      <div className="px-2 pb-2 shrink-0 space-y-1"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "8px" }}>

        {/* User row */}
        <div className={`flex items-center gap-2.5 px-3 py-2 rounded-xl ${collapsed ? "justify-center" : ""}`}
          style={{ background: "rgba(255,255,255,0.03)" }}>
          {/* Avatar */}
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-[11px] font-stats font-bold text-black"
            style={{ background: "var(--gradient-primary)" }}>
            {initials}
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex-1 min-w-0"
              >
                <p className="text-[11px] font-stats text-foreground truncate">
                  {userEmail ?? "Loading..."}
                </p>
                <p className="text-[9px] font-stats text-muted-foreground">Free Plan</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Sign out button */}
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all group disabled:opacity-50 ${
            collapsed ? "justify-center" : ""
          }`}
          style={{ background: "transparent" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(248,113,113,0.08)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
        >
          {signingOut
            ? <div className="w-4 h-4 border-2 border-red-400/40 border-t-red-400 rounded-full animate-spin shrink-0" />
            : <LogOut className="w-4 h-4 text-muted-foreground group-hover:text-red-400 transition-colors shrink-0" />
          }
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="text-[12px] font-stats text-muted-foreground group-hover:text-red-400 transition-colors"
              >
                {signingOut ? "Signing out..." : "Sign Out"}
              </motion.span>
            )}
          </AnimatePresence>

          {/* Tooltip when collapsed */}
          {collapsed && (
            <div className="absolute left-14 px-2.5 py-1.5 rounded-lg text-xs font-stats text-red-400
              pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap"
              style={{
                background: "rgba(10,12,20,0.97)",
                border:     "1px solid rgba(248,113,113,0.2)",
              }}>
              Sign Out
            </div>
          )}
        </button>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center p-2 rounded-xl text-muted-foreground hover:text-foreground transition-all"
          style={{ background: "transparent" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
        >
          {collapsed
            ? <ChevronRight className="w-3.5 h-3.5" />
            : <ChevronLeft  className="w-3.5 h-3.5" />}
        </button>
      </div>
    </motion.aside>
  );
}