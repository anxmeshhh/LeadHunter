import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Brain, X, Zap, AlertTriangle, Clock,
  TrendingUp, Target, BarChart2, ChevronRight,
  Loader2, RefreshCw, CheckCircle2,
} from "lucide-react";
import { supabase } from "../lib/supabase";

// ── Types ──────────────────────────────────────────────────────────────────────
type AlertSeverity = "critical" | "warning" | "info";

interface CoachAlert {
  id:          string;
  severity:    AlertSeverity;
  icon:        any;
  title:       string;
  detail:      string;
  action:      string;
  actionRoute: string;
  value?:      string | number;
}

// ── Severity styles ────────────────────────────────────────────────────────────
const SEVERITY = {
  critical: {
    dot:    "bg-red-400",
    badge:  "bg-red-500/10 border-red-500/30 text-red-400",
    icon:   "text-red-400",
    bar:    "bg-red-500",
    glow:   "rgba(239,68,68,0.2)",
  },
  warning: {
    dot:    "bg-amber-400",
    badge:  "bg-amber-500/10 border-amber-500/30 text-amber-400",
    icon:   "text-amber-400",
    bar:    "bg-amber-400",
    glow:   "rgba(251,191,36,0.15)",
  },
  info: {
    dot:    "bg-primary",
    badge:  "bg-primary/10 border-primary/20 text-primary",
    icon:   "text-primary",
    bar:    "bg-primary",
    glow:   "rgba(var(--primary),0.1)",
  },
};

// ── AI Insight generator ───────────────────────────────────────────────────────
async function generateAIInsight(alerts: CoachAlert[]): Promise<string> {
  const groqKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!groqKey) return "Add VITE_GROQ_API_KEY to enable AI insights.";

  const summary = alerts.map((a) => `- ${a.title}: ${a.detail}`).join("\n");

  const prompt = `You are a sharp sales coach for an Indian freelancer. Based on these CRM alerts, give ONE punchy sentence of advice. Be direct, specific, motivating. No fluff. Max 20 words.

Alerts:
${summary}

One-sentence coaching tip:`;

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${groqKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 60,
        temperature: 0.8,
      }),
    });
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() ?? "";
  } catch {
    return "";
  }
}

// ── Data fetcher ───────────────────────────────────────────────────────────────
async function fetchCoachAlerts(userId: string): Promise<CoachAlert[]> {
  const alerts: CoachAlert[] = [];

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayISO   = todayStart.toISOString();
  const weekAgo    = new Date(Date.now() - 7  * 86400000).toISOString();
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const lastWeekStart = new Date(Date.now() - 14 * 86400000).toISOString();

  const [
    { data: allLeads },
    { data: outreachToday },
    { data: outreachThisWeek },
    { data: outreachLastWeek },
    { data: allOutreach },
  ] = await Promise.all([
    supabase.from("leads")
      .select("id, business_name, status, updated_at, category, deal_value")
      .eq("user_id", userId)
      .not("status", "in", '("Closed Won","Closed Lost")'),
    supabase.from("outreach_history")
      .select("id")
      .eq("user_id", userId)
      .gte("contacted_at", todayISO),
    supabase.from("outreach_history")
      .select("id")
      .eq("user_id", userId)
      .gte("contacted_at", weekAgo),
    supabase.from("outreach_history")
      .select("id")
      .eq("user_id", userId)
      .gte("contacted_at", lastWeekStart)
      .lt("contacted_at", weekAgo),
    supabase.from("outreach_history")
      .select("lead_id, contacted_at")
      .eq("user_id", userId)
      .order("contacted_at", { ascending: false }),
  ]);

  // ── 1. Leads stuck in stage 7+ days ───────────────────────────────────────
  const stuckLeads = (allLeads ?? []).filter((l) => {
    const days = Math.floor((Date.now() - new Date(l.updated_at).getTime()) / 86400000);
    return days >= 7 && !["New Lead"].includes(l.status);
  });

  if (stuckLeads.length > 0) {
    const topStuck = stuckLeads.sort((a, b) =>
      new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
    )[0];
    const days = Math.floor((Date.now() - new Date(topStuck.updated_at).getTime()) / 86400000);
    alerts.push({
      id:          "stuck-leads",
      severity:    stuckLeads.length >= 3 ? "critical" : "warning",
      icon:        Clock,
      title:       `${stuckLeads.length} deal${stuckLeads.length > 1 ? "s" : ""} stuck`,
      detail:      `${topStuck.business_name} hasn't moved in ${days} days`,
      action:      "View Pipeline",
      actionRoute: "/pipeline",
      value:       stuckLeads.length,
    });
  }

  // ── 2. No outreach logged today ────────────────────────────────────────────
  const todayCount = (outreachToday ?? []).length;
  if (todayCount === 0) {
    alerts.push({
      id:          "no-outreach-today",
      severity:    "critical",
      icon:        AlertTriangle,
      title:       "No outreach today",
      detail:      "You haven't contacted anyone yet today",
      action:      "Open Queue",
      actionRoute: "/followup",
      value:       0,
    });
  }

  // ── 3. Cold deals going silent ─────────────────────────────────────────────
  const outreachMap: Record<string, string> = {};
  (allOutreach ?? []).forEach((o) => {
    if (!outreachMap[o.lead_id]) outreachMap[o.lead_id] = o.contacted_at;
  });

  const coldDeals = (allLeads ?? []).filter((l) => {
    const lastContact = outreachMap[l.id];
    if (!lastContact) return true;
    const days = Math.floor((Date.now() - new Date(lastContact).getTime()) / 86400000);
    return days >= 7;
  }).filter((l) => ["Interested", "Proposal Sent", "Negotiation"].includes(l.status));

  if (coldDeals.length > 0) {
    const totalValue = coldDeals.reduce((s, l) => s + (l.deal_value ?? 0), 0);
    alerts.push({
      id:          "cold-deals",
      severity:    "critical",
      icon:        AlertTriangle,
      title:       `${coldDeals.length} hot deal${coldDeals.length > 1 ? "s" : ""} going cold`,
      detail:      `${coldDeals[0].business_name}${coldDeals.length > 1 ? ` + ${coldDeals.length - 1} more` : ""} — no contact in 7d+`,
      action:      "Follow Up Now",
      actionRoute: "/followup",
      value:       totalValue > 0 ? `₹${(totalValue / 1000).toFixed(0)}K at risk` : coldDeals.length,
    });
  }

  // ── 4. Best category to focus on ──────────────────────────────────────────
  const categoryMap: Record<string, number> = {};
  (allLeads ?? []).forEach((l) => {
    if (l.category) categoryMap[l.category] = (categoryMap[l.category] ?? 0) + 1;
  });
  const topCategory = Object.entries(categoryMap).sort((a, b) => b[1] - a[1])[0];

  if (topCategory && topCategory[1] >= 2) {
    alerts.push({
      id:          "best-category",
      severity:    "info",
      icon:        Target,
      title:       `Focus on ${topCategory[0]}`,
      detail:      `You have ${topCategory[1]} ${topCategory[0]} leads — highest concentration`,
      action:      "View Leads",
      actionRoute: "/leads",
      value:       `${topCategory[1]} leads`,
    });
  }

  // ── 5. Weekly performance vs last week ────────────────────────────────────
  const thisWeekCount = (outreachThisWeek ?? []).length;
  const lastWeekCount = (outreachLastWeek ?? []).length;

  if (thisWeekCount > 0 || lastWeekCount > 0) {
    const diff    = thisWeekCount - lastWeekCount;
    const pctDiff = lastWeekCount > 0 ? Math.round((diff / lastWeekCount) * 100) : 100;
    const isUp    = diff >= 0;

    alerts.push({
      id:          "weekly-perf",
      severity:    isUp ? "info" : "warning",
      icon:        BarChart2,
      title:       isUp ? `Up ${pctDiff}% this week` : `Down ${Math.abs(pctDiff)}% this week`,
      detail:      `${thisWeekCount} outreach this week vs ${lastWeekCount} last week`,
      action:      "View Analytics",
      actionRoute: "/analytics",
      value:       `${thisWeekCount} this week`,
    });
  }

  // Sort: critical first → warning → info
  const order = { critical: 0, warning: 1, info: 2 };
  return alerts.sort((a, b) => order[a.severity] - order[b.severity]);
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function AICoach() {
  const navigate = useNavigate();

  const [open,      setOpen]      = useState(false);
  const [alerts,    setAlerts]    = useState<CoachAlert[]>([]);
  const [insight,   setInsight]   = useState("");
  const [loading,   setLoading]   = useState(false);
  const [loadingAI, setLoadingAI] = useState(false);
  const [userId,    setUserId]    = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState(0);

  // Get user on mount
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);

  const fetchAlerts = useCallback(async (uid: string) => {
    // Debounce — don't refetch more than once per 60s
    if (Date.now() - lastFetch < 60000 && alerts.length > 0) return;
    setLoading(true);
    try {
      const data = await fetchCoachAlerts(uid);
      setAlerts(data);
      setLastFetch(Date.now());
    } catch (e) {
      console.error("AICoach fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, [lastFetch, alerts.length]);

  // Fetch on mount when userId is ready
  useEffect(() => {
    if (userId) fetchAlerts(userId);
  }, [userId]);

  // Fetch when panel opens
  useEffect(() => {
    if (open && userId) {
      fetchAlerts(userId);
    }
  }, [open, userId]);

  async function handleGenerateInsight() {
    if (!alerts.length || loadingAI) return;
    setLoadingAI(true);
    const text = await generateAIInsight(alerts);
    setInsight(text);
    setLoadingAI(false);
  }

  function handleAction(route: string) {
    setOpen(false);
    navigate(route);
  }

  const criticalCount = alerts.filter((a) => a.severity === "critical").length;
  const hasAlerts     = alerts.length > 0;

  return (
    <>
      {/* ── Floating Button ── */}
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 1, type: "spring", stiffness: 200 }}
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all hover:scale-110 active:scale-95"
        style={{
          background:  open ? "rgba(10,12,18,0.97)" : "var(--gradient-primary)",
          border:      open ? "1px solid rgba(255,255,255,0.1)" : "none",
          boxShadow:   open ? "none" : "0 0 30px hsl(72,100%,50%)50, 0 8px 32px rgba(0,0,0,0.4)",
        }}
      >
        <AnimatePresence mode="wait">
          {open ? (
            <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
              <X className="w-5 h-5 text-foreground" />
            </motion.div>
          ) : (
            <motion.div key="brain" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }} className="relative">
              <Brain className="w-6 h-6 text-black" />
              {/* Alert badge */}
              {criticalCount > 0 && (
                <motion.span
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-[9px] font-stats font-bold flex items-center justify-center border-2 border-background"
                >
                  {criticalCount > 9 ? "9+" : criticalCount}
                </motion.span>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* ── Panel ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed bottom-24 right-6 z-50 w-[360px] rounded-2xl overflow-hidden shadow-2xl"
            style={{
              background:     "rgba(8,10,16,0.98)",
              border:         "1px solid rgba(255,255,255,0.08)",
              backdropFilter: "blur(24px)",
              boxShadow:      "0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)",
            }}
          >
            {/* Panel header */}
            <div className="px-4 py-3.5 flex items-center justify-between"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg" style={{ background: "var(--gradient-primary)" }}>
                  <Brain className="w-3.5 h-3.5 text-black" />
                </div>
                <div>
                  <p className="text-sm font-heading font-bold text-foreground">AI Coach</p>
                  <p className="text-[9px] font-stats text-muted-foreground uppercase tracking-widest">
                    {loading ? "Scanning your CRM..." : `${alerts.length} insight${alerts.length !== 1 ? "s" : ""} · live data`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => userId && fetchAlerts(userId)}
                  disabled={loading}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                  style={{ background: "rgba(255,255,255,0.04)" }}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>

            {/* Loading state */}
            {loading && (
              <div className="px-4 py-8 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="text-xs font-stats text-muted-foreground">Analyzing your pipeline...</span>
              </div>
            )}

            {/* Alerts list */}
            {!loading && (
              <div className="max-h-[420px] overflow-y-auto"
                style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.08) transparent" }}>

                {alerts.length === 0 && (
                  <div className="px-4 py-10 text-center space-y-2">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto opacity-60" />
                    <p className="text-sm font-heading font-semibold text-foreground">All clear!</p>
                    <p className="text-xs text-muted-foreground">No alerts right now. Keep up the momentum.</p>
                  </div>
                )}

                {alerts.map((alert, i) => {
                  const sev     = SEVERITY[alert.severity];
                  const Icon    = alert.icon;
                  return (
                    <motion.div
                      key={alert.id}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="px-4 py-3.5 group"
                      style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                    >
                      <div className="flex items-start gap-3">
                        {/* Severity dot + icon */}
                        <div className="relative shrink-0 mt-0.5">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                            alert.severity === "critical" ? "bg-red-500/10" :
                            alert.severity === "warning"  ? "bg-amber-500/10" :
                            "bg-primary/10"
                          }`}>
                            <Icon className={`w-3.5 h-3.5 ${sev.icon}`} />
                          </div>
                          <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${sev.dot} ${
                            alert.severity === "critical" ? "animate-pulse" : ""
                          }`} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-0.5">
                            <p className="text-[13px] font-heading font-semibold text-foreground leading-tight">
                              {alert.title}
                            </p>
                            {alert.value && (
                              <span className={`text-[9px] font-stats px-1.5 py-0.5 rounded border shrink-0 ${sev.badge}`}>
                                {alert.value}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground leading-relaxed mb-2">
                            {alert.detail}
                          </p>
                          <button
                            onClick={() => handleAction(alert.actionRoute)}
                            className={`flex items-center gap-1 text-[11px] font-stats font-semibold transition-colors ${sev.icon} hover:opacity-80`}
                          >
                            {alert.action} <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* AI Insight section */}
            {!loading && alerts.length > 0 && (
              <div className="px-4 py-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.01)" }}>
                {insight ? (
                  <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Zap className="w-3 h-3 text-primary" />
                      <span className="text-[9px] font-stats text-primary uppercase tracking-widest">AI Coaching Tip</span>
                    </div>
                    <p className="text-xs text-foreground leading-relaxed italic">"{insight}"</p>
                    <button onClick={handleGenerateInsight} disabled={loadingAI}
                      className="text-[10px] font-stats text-muted-foreground hover:text-primary transition-colors">
                      Refresh tip →
                    </button>
                  </motion.div>
                ) : (
                  <button
                    onClick={handleGenerateInsight}
                    disabled={loadingAI}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-stats transition-all hover:opacity-90 disabled:opacity-50"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
                  >
                    {loadingAI
                      ? <><Loader2 className="w-3.5 h-3.5 animate-spin text-primary" /> Generating tip...</>
                      : <><Zap className="w-3.5 h-3.5 text-primary" /> <span className="text-muted-foreground">Get AI coaching tip</span></>}
                  </button>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}