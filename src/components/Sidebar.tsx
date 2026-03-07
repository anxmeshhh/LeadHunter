import { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Search, Users, Kanban, BarChart3,
  Calendar, Settings, ChevronLeft, ChevronRight,
  Target, Mail, FileText, Tags, Flame, CheckCircle2,
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const navItems = [
  { to: "/",          icon: LayoutDashboard, label: "Command Center" },
  { to: "/discover",  icon: Search,          label: "Lead Discovery" },
  { to: "/leads",     icon: Users,           label: "All Leads"      },
  { to: "/pipeline",  icon: Kanban,          label: "Pipeline"       },
  { to: "/outreach",  icon: Mail,            label: "Outreach"       },
  { to: "/proposals", icon: FileText,        label: "Proposals"      },
  { to: "/analytics", icon: BarChart3,       label: "Analytics"      },
  { to: "/calendar",  icon: Calendar,        label: "Calendar"       },
  { to: "/tags",      icon: Tags,            label: "Tags"           },
  { to: "/settings",  icon: Settings,        label: "Settings"       },
];

// ── Daily Goal Widget ──────────────────────────────────────────────────────────
function DailyGoalWidget({ collapsed }) {
  const [target,    setTarget]    = useState(10);
  const [contacted, setContacted] = useState(0);
  const [newLeads,  setNewLeads]  = useState(0);
  const [streak,    setStreak]    = useState(0);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    (async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayISO = todayStart.toISOString();

      const [
        { data: targetRow },
        { data: outreachRows },
        { data: newLeadRows },
      ] = await Promise.all([
        supabase.from("daily_targets").select("*").limit(1).maybeSingle(),
        supabase.from("outreach_history").select("id").gte("contacted_at", todayISO),
        supabase.from("leads").select("id").gte("created_at", todayISO),
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

  // ── Collapsed: mini SVG ring ──
  if (collapsed) {
    return (
      <div className="px-3 py-3 border-t border-border/50 flex flex-col items-center gap-1.5 shrink-0">
        {loading ? (
          <div className="w-8 h-8 rounded-full bg-muted/50 animate-pulse" />
        ) : (
          <>
            <div className="relative w-8 h-8">
              <svg className="w-8 h-8 -rotate-90" viewBox="0 0 32 32">
                <circle cx="16" cy="16" r="12" fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
                <circle
                  cx="16" cy="16" r="12"
                  fill="none"
                  stroke={color}
                  strokeWidth="3"
                  strokeDasharray={`${2 * Math.PI * 12}`}
                  strokeDashoffset={`${2 * Math.PI * 12 * (1 - pct / 100)}`}
                  strokeLinecap="round"
                  style={{
                    filter: `drop-shadow(0 0 4px ${color}80)`,
                    transition: "stroke-dashoffset 0.8s ease",
                  }}
                />
              </svg>
              <span
                className="absolute inset-0 flex items-center justify-center text-[9px] font-stats font-bold"
                style={{ color }}
              >
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
      <div className="mx-3 mb-3 p-3 rounded-xl bg-muted/30 border border-border/50 space-y-2 shrink-0">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-2.5 rounded bg-muted/50 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mx-3 mb-3 p-3 rounded-xl bg-muted/30 border border-border/50 space-y-2.5 shrink-0"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-stats text-muted-foreground uppercase tracking-widest">
          Today's Goal
        </span>
        {streak > 0 && (
          <span className="flex items-center gap-1 text-[9px] font-stats text-amber-400">
            <Flame className="w-2.5 h-2.5" />
            {streak}d streak
          </span>
        )}
      </div>

      {/* Count */}
      <div className="flex items-end gap-1">
        <span className="font-stats text-xl font-bold leading-none" style={{ color }}>
          {contacted}
        </span>
        <span className="font-stats text-xs text-muted-foreground leading-none mb-0.5">
          / {target}
        </span>
        {done && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mb-0.5 ml-1" />}
      </div>

      {/* Bar */}
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}60` }}
        />
      </div>

      {/* Label */}
      <p className="text-[9px] font-stats text-muted-foreground">
        {done
          ? "🎯 Goal smashed!"
          : `${target - contacted} more to hit target`}
      </p>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-1.5">
        <div className="rounded-lg bg-muted/50 px-2 py-1.5 text-center">
          <p className="font-stats text-xs font-bold text-foreground">{contacted}</p>
          <p className="text-[8px] font-stats text-muted-foreground uppercase tracking-widest">Contacted</p>
        </div>
        <div className="rounded-lg bg-muted/50 px-2 py-1.5 text-center">
          <p className="font-stats text-xs font-bold text-foreground">{newLeads}</p>
          <p className="text-[8px] font-stats text-muted-foreground uppercase tracking-widest">New Leads</p>
        </div>
      </div>
    </motion.div>
  );
}

// ── Sidebar ────────────────────────────────────────────────────────────────────
export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 260 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="fixed left-0 top-0 h-screen z-50 flex flex-col glass-strong border-r border-border"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-border shrink-0">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
          <Target className="w-5 h-5 text-primary-foreground" />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col overflow-hidden"
            >
              <span className="font-heading font-bold text-foreground text-lg leading-tight">
                LeadHunter
              </span>
              <span className="text-[10px] font-stats text-primary tracking-widest">
                AI SALES ENGINE
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* AI Status */}
      <div className="px-4 py-2.5 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse-glow shrink-0" />
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-[10px] font-stats text-primary"
              >
                AI ENGINE ACTIVE
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Nav */}
      <nav
        className="flex-1 py-2 px-2 space-y-0.5 overflow-y-auto
          [&::-webkit-scrollbar]:w-1
          [&::-webkit-scrollbar-track]:transparent
          [&::-webkit-scrollbar-thumb]:rounded-full
          [&::-webkit-scrollbar-thumb]:bg-border"
      >
        {navItems.map((item) => {
          const isActive = location.pathname === item.to;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
                isActive
                  ? "bg-primary/10 text-primary glow-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <item.icon
                className={`w-5 h-5 shrink-0 ${isActive ? "text-primary" : ""}`}
              />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-sm font-medium whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </NavLink>
          );
        })}
      </nav>

      {/* Daily Goal Widget */}
      <DailyGoalWidget collapsed={collapsed} />

      {/* Collapse Button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="mx-2 mb-4 p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center justify-center shrink-0"
      >
        {collapsed
          ? <ChevronRight className="w-4 h-4" />
          : <ChevronLeft  className="w-4 h-4" />
        }
      </button>
    </motion.aside>
  );
}