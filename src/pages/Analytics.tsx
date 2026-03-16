import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp, Users, Phone, MessageSquare,
  IndianRupee, Target, ArrowUpRight, ArrowDownRight,
  Loader2, RefreshCw, AlertCircle
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell,
} from "recharts";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ── Types ──────────────────────────────────────────────────────────────────────
interface Lead {
  id: string;
  status: string;
  category: string;
  deal_value: number;
  created_at: string;
  city: string;
}

interface OutreachEntry {
  id: string;
  contact_mode: string;
  contacted_at: string;
  lead_id: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function formatRevenue(n: number): string {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000)   return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n}`;
}

const CHART_COLORS = [
  "hsl(72, 100%, 50%)",
  "hsl(217, 91%, 60%)",
  "hsl(187, 92%, 53%)",
  "hsl(160, 84%, 39%)",
  "hsl(280, 91%, 65%)",
  "hsl(30, 100%, 60%)",
  "hsl(0, 84%, 60%)",
  "hsl(340, 82%, 60%)",
];

const STATUS_FUNNEL_ORDER = [
  "New Lead", "Contacted", "Replied",
  "Interested", "Proposal Sent", "Negotiation", "Closed Won",
];

// ── Custom Tooltip ─────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-lg p-3 border border-border text-xs shadow-xl">
      <p className="font-stats text-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} className="font-stats" style={{ color: p.color ?? p.fill }}>
          {p.name}: {typeof p.value === "number" && p.name?.toLowerCase().includes("revenue")
            ? formatRevenue(p.value)
            : p.value?.toLocaleString()}
        </p>
      ))}
    </div>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────────
export default function Analytics() {
  const [leads,    setLeads]    = useState<Lead[]>([]);
  const [outreach, setOutreach] = useState<OutreachEntry[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  // ✅ FIX: scope both queries to current user
  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser(); // ✅
      if (!user) throw new Error("Not authenticated");

      const [
        { data: leadsData,    error: lErr },
        { data: outreachData, error: oErr },
      ] = await Promise.all([
        supabase
          .from("leads")
          .select("id, status, category, deal_value, created_at, city")
          .eq("user_id", user.id)                  // ✅
          .order("created_at", { ascending: true }),
        supabase
          .from("outreach_history")
          .select("id, contact_mode, contacted_at, lead_id")
          .eq("user_id", user.id)                  // ✅
          .order("contacted_at", { ascending: true }),
      ]);

      if (lErr) throw lErr;
      if (oErr) throw oErr;

      setLeads((leadsData    ?? []) as Lead[]);
      setOutreach((outreachData ?? []) as OutreachEntry[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    const ch = supabase
      .channel("realtime:analytics")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" },           fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "outreach_history" }, fetchAll)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchAll]);

  // ── Derived KPIs ───────────────────────────────────────────────────────────
  const total        = leads.length;
  const contacted    = leads.filter((l) => l.status !== "New Lead").length;
  const replied      = leads.filter((l) =>
    ["Replied","Interested","Proposal Sent","Negotiation","Closed Won"].includes(l.status)
  ).length;
  const closedWon    = leads.filter((l) => l.status === "Closed Won").length;
  const totalRevenue = leads
    .filter((l) => l.status === "Closed Won")
    .reduce((s, l) => s + (l.deal_value ?? 0), 0);
  const avgDeal      = closedWon > 0 ? Math.round(totalRevenue / closedWon) : 0;

  const contactRate = total     > 0 ? ((contacted / total)     * 100).toFixed(1) : "0.0";
  const replyRate   = contacted > 0 ? ((replied   / contacted) * 100).toFixed(1) : "0.0";
  const convRate    = total     > 0 ? ((closedWon / total)     * 100).toFixed(1) : "0.0";

  const kpis = [
    { label: "Total Leads",   value: total.toLocaleString(),    icon: Users,         color: "text-primary"    },
    { label: "Contact Rate",  value: `${contactRate}%`,         icon: Phone,         color: "text-cyan-400"   },
    { label: "Reply Rate",    value: `${replyRate}%`,           icon: MessageSquare, color: "text-violet-400" },
    { label: "Conversion",    value: `${convRate}%`,            icon: Target,        color: "text-success"    },
    { label: "Avg Deal Size", value: formatRevenue(avgDeal),    icon: IndianRupee,   color: "text-amber-400"  },
    { label: "Total Revenue", value: formatRevenue(totalRevenue), icon: TrendingUp,  color: "text-primary"    },
  ];

  // ── Weekly Activity (last 7 days) ──────────────────────────────────────────
  const weeklyData = (() => {
    const days: Record<string, { day: string; leads: number; outreach: number }> = {};
    const now = Date.now();
    for (let i = 6; i >= 0; i--) {
      const d     = new Date(now - i * 86400000);
      const label = d.toLocaleDateString("en-IN", { weekday: "short" });
      const key   = d.toISOString().split("T")[0];
      days[key]   = { day: label, leads: 0, outreach: 0 };
    }
    leads.forEach((l) => {
      const key = l.created_at?.split("T")[0];
      if (days[key]) days[key].leads++;
    });
    outreach.forEach((o) => {
      const key = o.contacted_at?.split("T")[0];
      if (days[key]) days[key].outreach++;
    });
    return Object.values(days);
  })();

  // ── Monthly Revenue (last 6 months) ───────────────────────────────────────
  const monthlyRevenue = (() => {
    const months: Record<string, { month: string; revenue: number; leads: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const d     = new Date();
      d.setMonth(d.getMonth() - i);
      const key   = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("en-IN", { month: "short" });
      months[key] = { month: label, revenue: 0, leads: 0 };
    }
    leads.forEach((l) => {
      const key = l.created_at?.slice(0, 7);
      if (months[key]) {
        months[key].leads++;
        if (l.status === "Closed Won") months[key].revenue += l.deal_value ?? 0;
      }
    });
    return Object.values(months);
  })();

  // ── Category Breakdown ─────────────────────────────────────────────────────
  const categoryBreakdown = (() => {
    const counts: Record<string, number> = {};
    leads.forEach((l) => {
      const cat = l.category || "Other";
      counts[cat] = (counts[cat] ?? 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, value], i) => ({
        name,
        value: Math.round((value / total) * 100),
        count: value,
        color: CHART_COLORS[i % CHART_COLORS.length],
      }));
  })();

  // ── Conversion Funnel ──────────────────────────────────────────────────────
  const funnelData = STATUS_FUNNEL_ORDER.map((status, i) => {
    const count = leads.filter((l) => {
      const idx = STATUS_FUNNEL_ORDER.indexOf(l.status);
      return idx >= i;
    }).length;
    return { name: status, value: count, fill: CHART_COLORS[i] };
  }).filter((s) => s.value > 0);

  // ── City Leaderboard ───────────────────────────────────────────────────────
  const cityLeaderboard = (() => {
    const counts: Record<string, number> = {};
    leads.forEach((l) => {
      if (l.city) counts[l.city] = (counts[l.city] ?? 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([city, count]) => ({ city, count }));
  })();

  // ── Outreach by Mode ───────────────────────────────────────────────────────
  const outreachByMode = (() => {
    const counts: Record<string, number> = {};
    outreach.forEach((o) => {
      counts[o.contact_mode] = (counts[o.contact_mode] ?? 0) + 1;
    });
    return Object.entries(counts).map(([mode, count], i) => ({
      mode, count, color: CHART_COLORS[i % CHART_COLORS.length],
    }));
  })();

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Performance intelligence ·{" "}
            <span className="font-stats text-primary">
              {new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchAll} disabled={loading}
            className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-all">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-success/10 border border-success/20">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            <span className="text-[10px] font-stats text-success">LIVE</span>
          </div>
        </div>
      </motion.div>

      {/* Error */}
      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          <button onClick={fetchAll} className="ml-auto text-xs underline">Retry</button>
        </div>
      )}

      {/* Loading skeleton */}
      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[1,2,3,4,5,6].map((i) => <div key={i} className="h-20 rounded-xl bg-muted/50 animate-pulse" />)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[1,2,3,4].map((i) => <div key={i} className="h-64 rounded-xl bg-muted/50 animate-pulse" />)}
          </div>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {kpis.map((kpi, i) => (
              <motion.div key={kpi.label}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="glass rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[9px] font-stats text-muted-foreground uppercase tracking-widest leading-tight">
                    {kpi.label}
                  </span>
                  <kpi.icon className={`w-3.5 h-3.5 ${kpi.color}`} />
                </div>
                <p className="font-stats text-xl font-bold text-foreground">{kpi.value}</p>
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Weekly Activity */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="glass rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-heading text-base text-foreground">Weekly Activity</h3>
                <span className="text-[10px] font-stats text-muted-foreground">Last 7 days</span>
              </div>
              {weeklyData.every((d) => d.leads === 0 && d.outreach === 0) ? (
                <div className="h-[250px] flex items-center justify-center">
                  <p className="text-sm text-muted-foreground">No activity in last 7 days</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={weeklyData}>
                    <XAxis dataKey="day" tick={{ fill: "hsl(215,20%,65%)", fontSize: 11, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "hsl(215,20%,65%)", fontSize: 11, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="leads"    fill="hsl(72,100%,50%)"  radius={[4,4,0,0]} name="Leads"    />
                    <Bar dataKey="outreach" fill="hsl(217,91%,60%)"  radius={[4,4,0,0]} name="Outreach" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </motion.div>

            {/* Monthly Revenue + Leads */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="glass rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-heading text-base text-foreground">Monthly Overview</h3>
                <span className="text-[10px] font-stats text-muted-foreground">Last 6 months</span>
              </div>
              {monthlyRevenue.every((m) => m.leads === 0) ? (
                <div className="h-[250px] flex items-center justify-center">
                  <p className="text-sm text-muted-foreground">No data yet</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={monthlyRevenue}>
                    <defs>
                      <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor="hsl(72,100%,50%)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="hsl(72,100%,50%)" stopOpacity={0}   />
                      </linearGradient>
                      <linearGradient id="leadsGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor="hsl(217,91%,60%)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="hsl(217,91%,60%)" stopOpacity={0}   />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="month" tick={{ fill: "hsl(215,20%,65%)", fontSize: 11, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "hsl(215,20%,65%)", fontSize: 11, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} tickFormatter={(v) => formatRevenue(v)} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="revenue" stroke="hsl(72,100%,50%)"  fill="url(#revenueGrad)" strokeWidth={2} name="Revenue" />
                    <Area type="monotone" dataKey="leads"   stroke="hsl(217,91%,60%)"  fill="url(#leadsGrad)"   strokeWidth={2} name="Leads"   />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </motion.div>

            {/* Category Breakdown */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="glass rounded-xl p-5">
              <h3 className="font-heading text-base text-foreground mb-4">Lead Categories</h3>
              {categoryBreakdown.length === 0 ? (
                <div className="h-[200px] flex items-center justify-center">
                  <p className="text-sm text-muted-foreground">No leads yet</p>
                </div>
              ) : (
                <div className="flex items-center gap-6">
                  <ResponsiveContainer width={160} height={160}>
                    <PieChart>
                      <Pie data={categoryBreakdown} cx="50%" cy="50%"
                        innerRadius={45} outerRadius={70} dataKey="value" strokeWidth={0}>
                        {categoryBreakdown.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2.5 flex-1">
                    {categoryBreakdown.map((cat) => (
                      <div key={cat.name} className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                        <span className="text-xs text-foreground flex-1 truncate">{cat.name}</span>
                        <span className="font-stats text-xs text-muted-foreground">{cat.count}</span>
                        <span className="font-stats text-xs text-primary">{cat.value}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>

            {/* Conversion Funnel */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="glass rounded-xl p-5">
              <h3 className="font-heading text-base text-foreground mb-4">Conversion Funnel</h3>
              {funnelData.length === 0 ? (
                <div className="h-[200px] flex items-center justify-center">
                  <p className="text-sm text-muted-foreground">No leads yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {funnelData.map((stage, i) => {
                    const maxVal   = funnelData[0].value;
                    const pct      = (stage.value / maxVal) * 100;
                    const convRate = i > 0
                      ? `${((stage.value / funnelData[i - 1].value) * 100).toFixed(0)}%`
                      : "100%";
                    return (
                      <div key={stage.name} className="flex items-center gap-3">
                        <span className="text-[10px] font-stats text-muted-foreground w-24 text-right truncate">
                          {stage.name}
                        </span>
                        <div className="flex-1 h-7 bg-muted rounded-md overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.8, delay: i * 0.1 }}
                            className="h-full rounded-md flex items-center justify-end pr-2"
                            style={{ backgroundColor: stage.fill }}
                          >
                            <span className="text-[10px] font-stats font-bold text-background">
                              {stage.value.toLocaleString()}
                            </span>
                          </motion.div>
                        </div>
                        <span className="text-[10px] font-stats text-muted-foreground w-10 text-right">
                          {convRate}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          </div>

          {/* Bottom Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Top Cities */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="glass rounded-xl p-5">
              <h3 className="font-heading text-base text-foreground mb-4">Top Cities</h3>
              {cityLeaderboard.length === 0 ? (
                <p className="text-sm text-muted-foreground">No city data yet</p>
              ) : (
                <div className="space-y-3">
                  {cityLeaderboard.map((c, i) => {
                    const max = cityLeaderboard[0].count;
                    const pct = (c.count / max) * 100;
                    return (
                      <div key={c.city} className="flex items-center gap-3">
                        <span className="text-[10px] font-stats text-primary w-5">#{i + 1}</span>
                        <span className="text-sm text-foreground w-24 truncate">{c.city}</span>
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.8, delay: i * 0.1 }}
                            className="h-full rounded-full"
                            style={{ background: "var(--gradient-primary)" }}
                          />
                        </div>
                        <span className="text-xs font-stats text-muted-foreground w-8 text-right">
                          {c.count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>

            {/* Outreach by Mode */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="glass rounded-xl p-5">
              <h3 className="font-heading text-base text-foreground mb-4">Outreach by Mode</h3>
              {outreachByMode.length === 0 ? (
                <p className="text-sm text-muted-foreground">No outreach logged yet</p>
              ) : (
                <div className="space-y-3">
                  {outreachByMode.map((m, i) => {
                    const max = Math.max(...outreachByMode.map((x) => x.count));
                    const pct = (m.count / max) * 100;
                    return (
                      <div key={m.mode} className="flex items-center gap-3">
                        <span className="text-sm text-foreground w-20">{m.mode}</span>
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.8, delay: i * 0.1 }}
                            className="h-full rounded-full"
                            style={{ backgroundColor: m.color }}
                          />
                        </div>
                        <span className="text-xs font-stats text-muted-foreground w-8 text-right">
                          {m.count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          </div>
        </>
      )}
    </div>
  );
}