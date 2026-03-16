import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Users, Phone, MessageSquare, TrendingUp, Zap, RefreshCw,
  Plus, FileText, Send, ArrowRight, Clock, Activity
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import StatCard from "../components/StatCard";
import MotivationPanel from "../components/MotivationPanel";
import PipelineMini from "../components/PipelineMini";
import { CheckCircle } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface DashboardStats {
  total_leads:    number;
  contacted:      number;
  replies:        number;
  revenue_closed: number;
}

interface MotivationData {
  streak:       number;
  daily_target: number;
  daily_done:   number;
}

type ActivityType =
  | "lead_added"
  | "note_added"
  | "outreach_sent"
  | "task_done"
  | "status_changed";

interface ActivityItem {
  id:       string;
  type:     ActivityType;
  title:    string;
  subtitle: string;
  time:     string;
  lead_id?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatRevenue(amount: number): string {
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000)   return `₹${(amount / 1000).toFixed(1)}K`;
  return `₹${amount}`;
}

function getTodayDate(): string {
  return new Date().toLocaleDateString("en-IN", {
    weekday: "long", month: "long", day: "numeric",
  });
}

function timeAgo(iso: string): string {
  const diff  = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 1)  return "just now";
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

const ACTIVITY_CONFIG: Record<ActivityType, { icon: React.ReactNode; color: string; bg: string }> = {
  lead_added:     { icon: <Plus className="w-3.5 h-3.5" />,         color: "text-emerald-400", bg: "bg-emerald-500/10" },
  note_added:     { icon: <FileText className="w-3.5 h-3.5" />,     color: "text-violet-400",  bg: "bg-violet-500/10"  },
  outreach_sent:  { icon: <Send className="w-3.5 h-3.5" />,         color: "text-cyan-400",    bg: "bg-cyan-500/10"    },
  task_done:      { icon: <CheckCircle className="w-3.5 h-3.5" />,  color: "text-emerald-400", bg: "bg-emerald-500/10" },
  status_changed: { icon: <ArrowRight className="w-3.5 h-3.5" />,   color: "text-amber-400",   bg: "bg-amber-500/10"   },
};

// ─── Recent Activity ──────────────────────────────────────────────────────────
function RecentActivity() {
  const navigate          = useNavigate();
  const { user }          = useAuth();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading,    setLoading]    = useState(true);

  const fetchActivity = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const since    = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const sinceDay = since.split("T")[0];

      const [
        { data: newLeads },
        { data: notes },
        { data: outreach },
        { data: doneTasks },
        { data: statusChanges },
      ] = await Promise.all([
        supabase
          .from("leads")
          .select("id, business_name, city, category, created_at")
          .eq("user_id", user.id)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(10),

        supabase
          .from("lead_notes")
          .select("id, note, created_at, lead_id, leads(business_name)")
          .eq("user_id", user.id)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(10),

        supabase
          .from("outreach_history")
          .select("id, contact_mode, subject, contacted_at, lead_id, leads(business_name)")
          .eq("user_id", user.id)
          .gte("contacted_at", since)
          .order("contacted_at", { ascending: false })
          .limit(10),

        supabase
          .from("tasks")
          .select("id, title, due_date, lead_id, leads(business_name)")
          .eq("user_id", user.id)
          .eq("is_done", true)
          .gte("due_date", sinceDay)
          .order("due_date", { ascending: false })
          .limit(5),

        supabase
          .from("leads")
          .select("id, business_name, status, updated_at")
          .eq("user_id", user.id)
          .gte("updated_at", since)
          .neq("status", "New Lead")
          .order("updated_at", { ascending: false })
          .limit(10),
      ]);

      const items: ActivityItem[] = [];
      const getBiz = (joined: any) =>
        Array.isArray(joined) ? joined[0]?.business_name : joined?.business_name;

      (newLeads ?? []).forEach((l: any) => {
        items.push({
          id:       `lead-${l.id}`,
          type:     "lead_added",
          title:    "New lead added",
          subtitle: `${l.business_name}${l.city ? ` · ${l.city}` : ""}${l.category ? ` · ${l.category}` : ""}`,
          time:     l.created_at,
          lead_id:  l.id,
        });
      });

      (notes ?? []).forEach((n: any) => {
        items.push({
          id:       `note-${n.id}`,
          type:     "note_added",
          title:    "Note added",
          subtitle: `${getBiz(n.leads) ?? "Unknown"} — "${n.note.slice(0, 55)}${n.note.length > 55 ? "…" : ""}"`,
          time:     n.created_at,
          lead_id:  n.lead_id,
        });
      });

      (outreach ?? []).forEach((o: any) => {
        items.push({
          id:       `outreach-${o.id}`,
          type:     "outreach_sent",
          title:    `${o.contact_mode} logged`,
          subtitle: `${getBiz(o.leads) ?? "Unknown"}${o.subject ? ` — ${o.subject}` : ""}`,
          time:     o.contacted_at,
          lead_id:  o.lead_id,
        });
      });

      (doneTasks ?? []).forEach((t: any) => {
        items.push({
          id:       `task-${t.id}`,
          type:     "task_done",
          title:    "Task completed",
          subtitle: `${t.title} · ${getBiz(t.leads) ?? "Unknown"}`,
          time:     t.due_date,
          lead_id:  t.lead_id,
        });
      });

      (statusChanges ?? []).forEach((l: any) => {
        items.push({
          id:       `status-${l.id}`,
          type:     "status_changed",
          title:    `Status → ${l.status}`,
          subtitle: l.business_name,
          time:     l.updated_at,
          lead_id:  l.id,
        });
      });

      items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
      setActivities(items.slice(0, 15));
    } catch (err) {
      console.error("Activity fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchActivity();
    const ch = supabase
      .channel(`activity-feed-${user?.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" },            fetchActivity)
      .on("postgres_changes", { event: "*", schema: "public", table: "lead_notes" },       fetchActivity)
      .on("postgres_changes", { event: "*", schema: "public", table: "outreach_history" }, fetchActivity)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" },            fetchActivity)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchActivity, user?.id]);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-xl p-5">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <Activity className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="font-heading text-base font-semibold text-foreground">Recent Activity</h3>
            <p className="text-[10px] font-stats text-muted-foreground">Last 7 days · pick up where you left off</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/5 border border-primary/20">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <span className="text-[10px] font-stats text-primary">LIVE</span>
        </div>
      </div>

      {loading && (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3 p-2">
              <div className="w-7 h-7 rounded-lg bg-muted/50 animate-pulse shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-2.5 w-20 rounded bg-muted/50 animate-pulse" />
                <div className="h-3 w-52 rounded bg-muted/50 animate-pulse" />
              </div>
              <div className="h-2.5 w-12 rounded bg-muted/50 animate-pulse" />
            </div>
          ))}
        </div>
      )}

      {!loading && activities.length === 0 && (
        <div className="py-12 text-center space-y-3">
          <Clock className="w-8 h-8 text-muted-foreground mx-auto opacity-25" />
          <p className="text-sm text-muted-foreground">No activity in the last 7 days.</p>
          <p className="text-xs text-muted-foreground">
            Start by{" "}
            <span className="text-primary cursor-pointer hover:underline"
              onClick={() => navigate("/discover")}>
              discovering leads
            </span>{" "}
            or adding your first one.
          </p>
        </div>
      )}

      {!loading && activities.length > 0 && (
        <div className="space-y-0.5">
          {activities.map((item, i) => {
            const cfg = ACTIVITY_CONFIG[item.type];
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => item.lead_id && navigate(`/leads/${item.lead_id}`)}
                className={`flex items-center gap-3 px-2.5 py-2 rounded-lg transition-all group ${
                  item.lead_id ? "hover:bg-muted/50 cursor-pointer" : ""
                }`}
              >
                <div className={`p-1.5 rounded-lg shrink-0 ${cfg.bg}`}>
                  <span className={cfg.color}>{cfg.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-stats text-muted-foreground">{item.title} </span>
                  <span className="text-sm text-foreground truncate block leading-tight">{item.subtitle}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[10px] font-stats text-muted-foreground whitespace-nowrap">
                    {timeAgo(item.time)}
                  </span>
                  {item.lead_id && (
                    <ArrowRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-60 transition-opacity" />
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate    = useNavigate();
  const { user }    = useAuth();

  const [stats, setStats] = useState<DashboardStats>({
    total_leads: 0, contacted: 0, replies: 0, revenue_closed: 0,
  });
  const [motivation, setMotivation] = useState<MotivationData>({
    streak: 0, daily_target: 10, daily_done: 0,
  });
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  const fetchDashboardStats = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const today = new Date().toISOString().split("T")[0];

      const [
        { count: totalLeads,  error: leadsError },
        { count: contacted,   error: contactedError },
        { count: replies,     error: repliesError },
        { data:  revenueData, error: revenueError },
        { data:  streakData },
      ] = await Promise.all([
        supabase
          .from("leads")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id),

        supabase
          .from("leads")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .neq("status", "New Lead"),

        supabase
          .from("leads")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .in("status", ["Replied", "Interested", "Proposal Sent", "Negotiation", "Closed Won"]),

        supabase
          .from("leads")
          .select("deal_value")
          .eq("user_id", user.id)
          .eq("status", "Closed Won"),

        // ── maybeSingle() instead of single() — no 406 when row missing ──
        supabase
          .from("daily_targets")
          .select("*")
          .eq("user_id", user.id)
          .eq("date", today)
          .maybeSingle(),
      ]);

      if (leadsError)     throw leadsError;
      if (contactedError) throw contactedError;
      if (repliesError)   throw repliesError;
      if (revenueError)   throw revenueError;

      const totalRevenue = revenueData?.reduce((s, l) => s + (l.deal_value || 0), 0) ?? 0;

      setStats({
        total_leads:    totalLeads   ?? 0,
        contacted:      contacted    ?? 0,
        replies:        replies      ?? 0,
        revenue_closed: totalRevenue,
      });

      if (streakData) {
        setMotivation({
          streak:       streakData.streak       ?? 0,
          daily_target: streakData.daily_target ?? 10,
          daily_done:   streakData.daily_done   ?? 0,
        });
      } else {
        // No daily target row yet — create one for today
        await supabase.from("daily_targets").insert({
          user_id:      user.id,
          date:         today,
          daily_target: 10,
          daily_done:   0,
          streak:       0,
        });
      }

      setLastUpdated(new Date().toLocaleTimeString("en-IN"));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to fetch stats");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchDashboardStats();

    const leadsChannel = supabase
      .channel(`dashboard-leads-${user?.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, fetchDashboardStats)
      .subscribe();

    const targetsChannel = supabase
      .channel(`dashboard-targets-${user?.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "daily_targets" }, (payload) => {
        if (payload.new && typeof payload.new === "object") {
          const row = payload.new as { streak?: number; daily_target?: number; daily_done?: number };
          setMotivation((prev) => ({
            streak:       row.streak       ?? prev.streak,
            daily_target: row.daily_target ?? prev.daily_target,
            daily_done:   row.daily_done   ?? prev.daily_done,
          }));
        }
      })
      .subscribe();

    const outreachChannel = supabase
      .channel(`dashboard-outreach-${user?.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "outreach_history" }, fetchDashboardStats)
      .subscribe();

    return () => {
      supabase.removeChannel(leadsChannel);
      supabase.removeChannel(targetsChannel);
      supabase.removeChannel(outreachChannel);
    };
  }, [fetchDashboardStats, user?.id]);

  const replyRate   = stats.contacted   > 0 ? Math.round((stats.replies   / stats.contacted)   * 100) : 0;
  const contactRate = stats.total_leads > 0 ? Math.round((stats.contacted / stats.total_leads) * 100) : 0;

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Command Center</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {getTodayDate()} ·{" "}
            <span className="text-primary font-stats">AI Engine Active</span>
            {lastUpdated && (
              <span className="ml-2 text-xs text-muted-foreground">· Updated {lastUpdated}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchDashboardStats} disabled={loading}
            className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-primary transition-all"
            title="Refresh stats">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-success/10 border border-success/20">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            <span className="text-[10px] font-stats text-success">LIVE</span>
          </div>
          <button
            onClick={() => navigate("/discover")}
            className="px-5 py-2.5 rounded-lg font-heading font-semibold text-sm text-primary-foreground transition-all hover:opacity-90 glow-primary"
            style={{ background: "var(--gradient-primary)" }}>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4" /> Discover Leads
            </div>
          </button>
        </div>
      </motion.div>

      {/* Error */}
      {error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center justify-between">
          <span>⚠️ {error}</span>
          <button onClick={fetchDashboardStats} className="text-xs underline hover:no-underline">Retry</button>
        </motion.div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Leads"
          value={loading ? "—" : stats.total_leads.toLocaleString("en-IN")}
          change={loading ? "Loading..." : `${contactRate}% contacted`}
          changeType="positive" icon={<Users className="w-5 h-5" />} glowColor="primary" />
        <StatCard title="Contacted"
          value={loading ? "—" : stats.contacted.toLocaleString("en-IN")}
          change={loading ? "Loading..." : `${contactRate}% of total`}
          changeType="neutral" icon={<Phone className="w-5 h-5" />} glowColor="secondary" />
        <StatCard title="Replies"
          value={loading ? "—" : stats.replies.toLocaleString("en-IN")}
          change={loading ? "Loading..." : `${replyRate}% reply rate`}
          changeType={replyRate >= 20 ? "positive" : "neutral"}
          icon={<MessageSquare className="w-5 h-5" />} glowColor="accent" />
        <StatCard title="Revenue Closed"
          value={loading ? "—" : formatRevenue(stats.revenue_closed)}
          change={loading ? "Loading..." : "Closed Won deals"}
          changeType="positive" icon={<TrendingUp className="w-5 h-5" />} glowColor="primary" />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <RecentActivity />
          <PipelineMini />
        </div>
        <div>
          <MotivationPanel
            streak={motivation.streak}
            dailyTarget={motivation.daily_target}
            dailyDone={motivation.daily_done}
          />
        </div>
      </div>
    </div>
  );
}