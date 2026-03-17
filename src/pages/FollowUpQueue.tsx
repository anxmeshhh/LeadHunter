import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Phone, MessageSquare, Mail, CheckCircle2,
  Clock, AlertTriangle, Zap, RefreshCw,
  ChevronRight, Star, Globe, MapPin,
  Loader2, Target, Flame, Calendar,
  ArrowRight, X,
} from "lucide-react";
import { supabase } from "../lib/supabase";

// ── Types ──────────────────────────────────────────────────────────────────────
interface FollowUpLead {
  id: string;
  business_name: string;
  category: string;
  city: string;
  phone: string;
  email: string;
  website: string;
  status: string;
  rating: number;
  review_count: number;
  score: number;
  score_label: string;
  ai_pitch: string;
  deal_value: number;
  last_contacted: string | null;  // latest outreach contacted_at
  days_since_contact: number;
  outreach_count: number;
  health: "red" | "amber" | "green";
  health_reason: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function daysSince(iso: string | null): number {
  if (!iso) return 999;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function formatRevenue(n: number): string {
  if (!n || n === 0) return "—";
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000)   return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n}`;
}

function getHealth(
  daysSince: number,
  outreachCount: number,
  status: string,
): { health: "red" | "amber" | "green"; reason: string } {
  if (["Closed Won", "Closed Lost"].includes(status)) {
    return { health: "green", reason: "Deal closed" };
  }
  if (daysSince >= 7) {
    return { health: "red", reason: `No contact in ${daysSince}d — going cold` };
  }
  if (daysSince >= 3) {
    return { health: "amber", reason: `${daysSince}d since last contact` };
  }
  if (outreachCount === 0) {
    return { health: "red", reason: "Never contacted" };
  }
  return { health: "green", reason: `Contacted ${daysSince}d ago` };
}

const HEALTH_STYLES = {
  red:   { dot: "bg-red-400",   badge: "text-red-400 bg-red-400/10 border-red-400/30",     label: "🔴 Cold"    },
  amber: { dot: "bg-amber-400", badge: "text-amber-400 bg-amber-400/10 border-amber-400/30", label: "🟡 Warm"  },
  green: { dot: "bg-emerald-400", badge: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30", label: "🟢 Active" },
};

const STATUS_COLORS: Record<string, string> = {
  "New Lead":      "text-slate-400",
  "Contacted":     "text-cyan-400",
  "Replied":       "text-blue-400",
  "Interested":    "text-violet-400",
  "Proposal Sent": "text-purple-400",
  "Negotiation":   "text-amber-400",
  "Closed Won":    "text-emerald-400",
  "Closed Lost":   "text-red-400",
};

// ── WhatsApp deep link ─────────────────────────────────────────────────────────
function buildWhatsAppLink(phone: string, pitch: string): string {
  const clean = phone.replace(/\D/g, "");
  const number = clean.startsWith("91") ? clean : `91${clean}`;
  const msg = pitch
    ? encodeURIComponent(pitch)
    : encodeURIComponent("Hi, I wanted to connect regarding your business's digital presence.");
  return `https://wa.me/${number}?text=${msg}`;
}

// ── Lead Card ──────────────────────────────────────────────────────────────────
function FollowUpCard({
  lead, index, onDone,
}: {
  lead: FollowUpLead;
  index: number;
  onDone: (id: string) => void;
}) {
  const navigate = useNavigate();
  const [logging, setLogging] = useState(false);
  const [done,    setDone]    = useState(false);
  const hs = HEALTH_STYLES[lead.health];

  async function handleLogContact() {
    setLogging(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLogging(false); return; }

    await supabase.from("outreach_history").insert({
      lead_id:      lead.id,
      user_id:      user.id,
      contact_mode: "Call",
      message:      "Follow-up contact logged from Follow-up Queue",
      status:       "Sent",
      contacted_at: new Date().toISOString(),
    });

    // Advance status if still New Lead
    if (lead.status === "New Lead") {
      await supabase.from("leads")
        .update({ status: "Contacted" })
        .eq("id", lead.id)
        .eq("user_id", user.id);
    }

    setDone(true);
    setLogging(false);
    setTimeout(() => onDone(lead.id), 600);
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: done ? 0 : 1, y: 0, scale: done ? 0.96 : 1 }}
      exit={{ opacity: 0, x: 40, scale: 0.96 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      className={`glass rounded-2xl overflow-hidden group transition-all ${
        lead.health === "red" ? "border-l-[3px] border-l-red-500/60" :
        lead.health === "amber" ? "border-l-[3px] border-l-amber-400/60" :
        "border-l-[3px] border-l-emerald-500/40"
      }`}
    >
      <div className="p-4 space-y-3">

        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              {/* Health dot */}
              <span className={`w-2 h-2 rounded-full shrink-0 ${hs.dot} animate-pulse`} />
              <button
                onClick={() => navigate(`/leads/${lead.id}`)}
                className="text-base font-heading font-bold text-foreground hover:text-primary transition-colors truncate"
              >
                {lead.business_name}
              </button>
              <span className={`text-[10px] font-stats px-2 py-0.5 rounded-full border ${hs.badge}`}>
                {hs.label}
              </span>
              {lead.deal_value > 0 && (
                <span className="text-[10px] font-stats text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
                  {formatRevenue(lead.deal_value)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="w-3 h-3" />{lead.city} · {lead.category}
              </span>
              <span className={`text-[10px] font-stats ${STATUS_COLORS[lead.status] ?? "text-muted-foreground"}`}>
                {lead.status}
              </span>
              {lead.rating > 0 && (
                <span className="flex items-center gap-1 text-xs text-amber-400">
                  <Star className="w-3 h-3 fill-amber-400" />{lead.rating}
                </span>
              )}
            </div>
          </div>

          {/* Score */}
          <div className="text-right shrink-0">
            <p className="font-stats text-lg font-bold text-primary">{lead.score}</p>
            <p className="text-[9px] font-stats text-muted-foreground">score</p>
          </div>
        </div>

        {/* Health reason */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40">
          <Clock className="w-3 h-3 text-muted-foreground shrink-0" />
          <p className="text-xs text-muted-foreground">{lead.health_reason}</p>
          {lead.outreach_count > 0 && (
            <span className="ml-auto text-[10px] font-stats text-muted-foreground">
              {lead.outreach_count} outreach logged
            </span>
          )}
        </div>

        {/* AI Pitch preview */}
        {lead.ai_pitch && (
          <div className="px-3 py-2 rounded-lg bg-primary/5 border border-primary/15">
            <p className="text-[10px] font-stats text-primary mb-1 flex items-center gap-1">
              <Zap className="w-2.5 h-2.5" /> AI PITCH READY
            </p>
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {lead.ai_pitch}
            </p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* WhatsApp — primary CTA */}
          {lead.phone && (
            <a
              href={buildWhatsAppLink(lead.phone, lead.ai_pitch)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-heading font-semibold text-white transition-all hover:opacity-90 hover:scale-[1.02]"
              style={{ background: "linear-gradient(135deg, #25D366, #128C7E)" }}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              WhatsApp
              {lead.ai_pitch && <span className="text-[9px] opacity-70">· pitch ready</span>}
            </a>
          )}

          {/* Call */}
          {lead.phone && (
            <a href={`tel:${lead.phone}`}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-stats border border-border text-muted-foreground hover:text-cyan-400 hover:border-cyan-400/40 transition-all">
              <Phone className="w-3.5 h-3.5" /> Call
            </a>
          )}

          {/* Email */}
          {lead.email && (
            <a href={`mailto:${lead.email}`}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-stats border border-border text-muted-foreground hover:text-blue-400 hover:border-blue-400/40 transition-all">
              <Mail className="w-3.5 h-3.5" /> Email
            </a>
          )}

          {/* View lead */}
          <button onClick={() => navigate(`/leads/${lead.id}`)}
            className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-stats border border-border text-muted-foreground hover:text-primary hover:border-primary/40 transition-all ml-auto">
            View <ChevronRight className="w-3 h-3" />
          </button>

          {/* Mark contacted */}
          <button
            onClick={handleLogContact}
            disabled={logging || done}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-heading font-semibold text-primary-foreground disabled:opacity-50 transition-all hover:opacity-90"
            style={{ background: "var(--gradient-primary)" }}
          >
            {logging
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : done
              ? <><CheckCircle2 className="w-3.5 h-3.5" /> Done!</>
              : <><CheckCircle2 className="w-3.5 h-3.5" /> Mark Contacted</>}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function FollowUpQueue() {
  const [leads,         setLeads]         = useState<FollowUpLead[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState<string | null>(null);
  const [reminderDays,  setReminderDays]  = useState(3);
  const [filterHealth,  setFilterHealth]  = useState<"all" | "red" | "amber">("all");
  const [dismissed,     setDismissed]     = useState<Set<string>>(new Set());

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get followup_reminder_days from settings
      const { data: targetRow } = await supabase
        .from("daily_targets")
        .select("followup_reminder_days")
        .eq("user_id", user.id)
        .maybeSingle();

      const days = targetRow?.followup_reminder_days ?? 3;
      setReminderDays(days);

      // Fetch all active leads (not closed)
      const { data: leadsData, error: leadsErr } = await supabase
        .from("leads")
        .select("id, business_name, category, city, phone, email, website, status, rating, review_count, score, score_label, ai_pitch, deal_value")
        .eq("user_id", user.id)
        .not("status", "in", '("Closed Won","Closed Lost")')
        .order("score", { ascending: false });

      if (leadsErr) throw leadsErr;

      // Fetch latest outreach per lead
      const { data: outreachData } = await supabase
        .from("outreach_history")
        .select("lead_id, contacted_at")
        .eq("user_id", user.id)
        .order("contacted_at", { ascending: false });

      // Build outreach map: lead_id → { last_contacted, count }
      const outreachMap: Record<string, { last: string; count: number }> = {};
      (outreachData ?? []).forEach((o) => {
        if (!outreachMap[o.lead_id]) {
          outreachMap[o.lead_id] = { last: o.contacted_at, count: 0 };
        }
        outreachMap[o.lead_id].count++;
      });

      // Build follow-up leads — only those needing contact
      const queue: FollowUpLead[] = [];

      (leadsData ?? []).forEach((lead) => {
        const info = outreachMap[lead.id];
        const lastContacted = info?.last ?? null;
        const days_since = daysSince(lastContacted);
        const outreach_count = info?.count ?? 0;
        const { health, reason } = getHealth(days_since, outreach_count, lead.status);

        // Include if: never contacted OR last contact >= reminderDays ago
        if (outreach_count === 0 || days_since >= days) {
          queue.push({
            ...lead,
            last_contacted:     lastContacted,
            days_since_contact: days_since,
            outreach_count,
            health,
            health_reason: reason,
          });
        }
      });

      // Sort: red first → amber → green, then by score desc
      queue.sort((a, b) => {
        const order = { red: 0, amber: 1, green: 2 };
        if (order[a.health] !== order[b.health]) return order[a.health] - order[b.health];
        return b.score - a.score;
      });

      setLeads(queue);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load queue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);

  function handleDone(id: string) {
    setDismissed((prev) => new Set([...prev, id]));
    setLeads((prev) => prev.filter((l) => l.id !== id));
  }

  const filtered = leads.filter((l) => {
    if (dismissed.has(l.id)) return false;
    if (filterHealth === "red")   return l.health === "red";
    if (filterHealth === "amber") return l.health === "amber";
    return true;
  });

  const redCount   = leads.filter((l) => l.health === "red").length;
  const amberCount = leads.filter((l) => l.health === "amber").length;
  const totalCount = leads.length;

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-heading font-bold text-foreground">Follow-up Queue</h1>
            {redCount > 0 && (
              <motion.span
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-stats"
              >
                <AlertTriangle className="w-3 h-3" />
                {redCount} cold
              </motion.span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Leads needing contact today ·{" "}
            <span className="font-stats text-primary">{totalCount} in queue</span>
            {" · "}
            <span className="font-stats text-muted-foreground">
              reminder every {reminderDays}d
            </span>
          </p>
        </div>
        <button onClick={fetchQueue} disabled={loading}
          className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-primary transition-all">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </motion.div>

      {/* Error */}
      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
          <button onClick={fetchQueue} className="ml-auto text-xs underline">Retry</button>
        </div>
      )}

      {/* Stats bar */}
      {!loading && totalCount > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-3 gap-3">
          {[
            { label: "Cold Leads",    value: redCount,                color: "text-red-400",     bg: "bg-red-500/10",     border: "border-red-500/20"     },
            { label: "Warm Leads",    value: amberCount,              color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/20"   },
            { label: "Total in Queue",value: totalCount,              color: "text-primary",     bg: "bg-primary/10",     border: "border-primary/20"     },
          ].map((s) => (
            <div key={s.label} className={`glass rounded-xl p-4 border ${s.border}`}>
              <p className={`font-stats text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[10px] font-stats text-muted-foreground uppercase tracking-widest mt-1">{s.label}</p>
            </div>
          ))}
        </motion.div>
      )}

      {/* Filter tabs */}
      {!loading && totalCount > 0 && (
        <div className="flex gap-2">
          {([
            { key: "all",   label: `All (${totalCount})` },
            { key: "red",   label: `🔴 Cold (${redCount})` },
            { key: "amber", label: `🟡 Warm (${amberCount})` },
          ] as const).map((f) => (
            <button key={f.key} onClick={() => setFilterHealth(f.key)}
              className={`px-4 py-2 rounded-xl text-xs font-stats border transition-all ${
                filterHealth === f.key
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}>
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 rounded-2xl bg-muted/50 animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="glass rounded-2xl p-16 text-center space-y-4">
          {totalCount === 0 ? (
            <>
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>
              <p className="text-lg font-heading font-bold text-foreground">You're all caught up!</p>
              <p className="text-sm text-muted-foreground">
                No leads need follow-up right now. Check back tomorrow or
                adjust your reminder interval in Settings.
              </p>
              <div className="flex items-center justify-center gap-2 text-xs font-stats text-muted-foreground">
                <Calendar className="w-3.5 h-3.5" />
                Reminder interval: every {reminderDays} days
              </div>
            </>
          ) : (
            <>
              <Target className="w-8 h-8 text-muted-foreground/30 mx-auto" />
              <p className="text-sm text-muted-foreground">No leads match this filter.</p>
            </>
          )}
        </motion.div>
      )}

      {/* Queue */}
      {!loading && filtered.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-stats text-muted-foreground">
              Sorted by urgency · red leads first
            </p>
            <div className="flex items-center gap-1.5 text-xs font-stats text-muted-foreground">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              Click WhatsApp to open with pitch pre-filled
            </div>
          </div>
          <AnimatePresence mode="popLayout">
            {filtered.map((lead, i) => (
              <FollowUpCard
                key={lead.id}
                lead={lead}
                index={i}
                onDone={handleDone}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}