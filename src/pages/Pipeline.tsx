import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MoreHorizontal, IndianRupee, Loader2, RefreshCw,
  MapPin, ChevronRight, TrendingUp, Zap, ArrowRight,
  CheckCircle2, XCircle, Circle, AlertCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

// ─── Stage config ─────────────────────────────────────────────────────────────
const STAGE_CONFIG = [
  { name: "New Lead",      short: "NEW",         color: "#94a3b8", bg: "rgba(148,163,184,0.08)", border: "rgba(148,163,184,0.2)",  glow: "rgba(148,163,184,0.15)", icon: Circle      },
  { name: "Contacted",     short: "CONTACTED",   color: "#22d3ee", bg: "rgba(34,211,238,0.06)",  border: "rgba(34,211,238,0.2)",   glow: "rgba(34,211,238,0.12)",  icon: Zap         },
  { name: "Replied",       short: "REPLIED",     color: "#60a5fa", bg: "rgba(96,165,250,0.06)",  border: "rgba(96,165,250,0.2)",   glow: "rgba(96,165,250,0.12)",  icon: ChevronRight},
  { name: "Interested",    short: "INTERESTED",  color: "#a78bfa", bg: "rgba(167,139,250,0.06)", border: "rgba(167,139,250,0.2)",  glow: "rgba(167,139,250,0.12)", icon: TrendingUp  },
  { name: "Proposal Sent", short: "PROPOSAL",    color: "#c084fc", bg: "rgba(192,132,252,0.06)", border: "rgba(192,132,252,0.2)",  glow: "rgba(192,132,252,0.12)", icon: ArrowRight  },
  { name: "Negotiation",   short: "NEGOTIATION", color: "#fbbf24", bg: "rgba(251,191,36,0.06)",  border: "rgba(251,191,36,0.2)",   glow: "rgba(251,191,36,0.15)",  icon: AlertCircle },
  { name: "Closed Won",    short: "WON",         color: "#34d399", bg: "rgba(52,211,153,0.06)",  border: "rgba(52,211,153,0.25)",  glow: "rgba(52,211,153,0.2)",   icon: CheckCircle2},
  { name: "Closed Lost",   short: "LOST",        color: "#f87171", bg: "rgba(248,113,113,0.05)", border: "rgba(248,113,113,0.15)", glow: "rgba(248,113,113,0.08)", icon: XCircle     },
];

const SCORE_CONFIG = {
  High:   { bg: "rgba(52,211,153,0.12)",  text: "#34d399", border: "rgba(52,211,153,0.3)"  },
  Medium: { bg: "rgba(167,139,250,0.12)", text: "#a78bfa", border: "rgba(167,139,250,0.3)" },
  Low:    { bg: "rgba(100,116,139,0.15)", text: "#94a3b8", border: "rgba(100,116,139,0.3)" },
};

// ─── Deal Health ──────────────────────────────────────────────────────────────
function getDealHealth(daysSinceContact: number, outreachCount: number) {
  if (outreachCount === 0)   return { color: "#f87171", label: "Never contacted",                     glow: "rgba(248,113,113,0.5)" };
  if (daysSinceContact >= 7) return { color: "#f87171", label: `Cold — ${daysSinceContact}d no contact`, glow: "rgba(248,113,113,0.5)" };
  if (daysSinceContact >= 3) return { color: "#fbbf24", label: `Warm — ${daysSinceContact}d since contact`, glow: "rgba(251,191,36,0.5)"  };
  return                            { color: "#34d399", label: `Active — ${daysSinceContact}d ago`,    glow: "rgba(52,211,153,0.5)"  };
}

function HealthDot({ daysSince, outreachCount }: { daysSince: number; outreachCount: number }) {
  const [show, setShow] = useState(false);
  const health = getDealHealth(daysSince, outreachCount);
  return (
    <div className="relative shrink-0" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      <div className="w-2 h-2 rounded-full"
        style={{ backgroundColor: health.color, boxShadow: `0 0 6px ${health.glow}` }} />
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.1 }}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 px-2 py-1 rounded-lg text-[10px] font-stats whitespace-nowrap pointer-events-none"
            style={{ background: "rgba(10,12,18,0.97)", border: `1px solid ${health.color}40`, color: health.color, boxShadow: "0 4px 16px rgba(0,0,0,0.4)" }}>
            {health.label}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function formatValue(v: any) {
  if (v >= 10000000) return `₹${(v / 10000000).toFixed(1)}Cr`;
  if (v >= 100000)   return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000)     return `₹${(v / 1000).toFixed(0)}K`;
  if (v === 0)       return "—";
  return `₹${v}`;
}

function daysAgo(iso: any) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function getStageConfig(name: string) {
  return STAGE_CONFIG.find((s) => s.name === name) ?? STAGE_CONFIG[0];
}

// ─── Move Menu ────────────────────────────────────────────────────────────────
function MoveMenu({ currentStatus, onMove, onClose }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: -4 }} transition={{ duration: 0.15 }}
      className="absolute top-7 right-0 z-50 rounded-xl border p-1.5 w-48 shadow-2xl"
      style={{ background: "rgba(10,12,18,0.97)", borderColor: "rgba(255,255,255,0.08)", backdropFilter: "blur(20px)" }}
      onClick={(e) => e.stopPropagation()}>
      <p className="text-[9px] font-stats text-slate-500 px-2 py-1 uppercase tracking-widest">Move to stage</p>
      {STAGE_CONFIG.map((s) => {
        if (s.name === currentStatus) return null;
        const currentIdx = STAGE_CONFIG.findIndex((x) => x.name === currentStatus);
        const targetIdx  = STAGE_CONFIG.findIndex((x) => x.name === s.name);
        const forward    = targetIdx > currentIdx;
        return (
          <button key={s.name} onClick={() => { onMove(s.name); onClose(); }}
            className="w-full text-left px-2 py-1.5 text-xs rounded-lg transition-all flex items-center gap-2"
            style={{ color: "rgba(148,163,184,0.8)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = s.bg; e.currentTarget.style.color = s.color; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(148,163,184,0.8)"; }}>
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
            <span className="flex-1 truncate font-stats">{s.name}</span>
            <span className="text-[9px] opacity-40">{forward ? "→" : "←"}</span>
          </button>
        );
      })}
      <div className="border-t my-1" style={{ borderColor: "rgba(255,255,255,0.06)" }} />
      <button onClick={onClose} className="w-full text-left px-2 py-1.5 text-[11px] rounded-lg text-slate-500 hover:text-slate-300 transition-colors font-stats">Cancel</button>
    </motion.div>
  );
}

// ─── Kanban Card ──────────────────────────────────────────────────────────────
function KanbanCard({ card, stageCfg, onMove, onClick }: any) {
  const [showMenu, setShowMenu] = useState(false);
  const scoreStyle = SCORE_CONFIG[card.score_label] ?? SCORE_CONFIG.Low;
  const isStale    = card.daysInStage > 7;

  return (
    <motion.div layout
      initial={{ opacity: 0, y: 12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }} whileHover={{ y: -2, transition: { duration: 0.15 } }}
      onClick={onClick} className="rounded-xl p-3 cursor-pointer relative group transition-shadow"
      style={{ background: "rgba(15,18,28,0.7)", border: "1px solid rgba(255,255,255,0.06)", backdropFilter: "blur(8px)" }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = stageCfg.border; e.currentTarget.style.boxShadow = `0 4px 24px ${stageCfg.glow}, inset 0 1px 0 rgba(255,255,255,0.04)`; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.boxShadow = "none"; }}>

      <div className="absolute top-0 left-3 right-3 h-px rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: `linear-gradient(90deg, transparent, ${stageCfg.color}60, transparent)` }} />

      {/* Header — health dot + name */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <HealthDot daysSince={card.daysSinceContact} outreachCount={card.outreachCount} />
          <p className="text-[13px] font-heading font-semibold text-white leading-tight line-clamp-1 flex-1">
            {card.name}
          </p>
        </div>
        <button onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
          className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5 rounded p-0.5 hover:bg-white/10"
          style={{ color: "rgba(148,163,184,0.7)" }}>
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex items-center gap-1.5 mb-3">
        <MapPin className="w-2.5 h-2.5 shrink-0" style={{ color: stageCfg.color, opacity: 0.7 }} />
        <span className="text-[11px] font-stats truncate" style={{ color: "rgba(148,163,184,0.7)" }}>
          {card.category} · {card.city}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-0.5">
          <IndianRupee className="w-2.5 h-2.5" style={{ color: stageCfg.color }} />
          <span className="text-[12px] font-stats font-bold" style={{ color: stageCfg.color }}>{formatValue(card.deal_value)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-stats px-1.5 py-0.5 rounded-md border"
            style={{ background: scoreStyle.bg, color: scoreStyle.text, borderColor: scoreStyle.border }}>
            {card.score_label}
          </span>
          <span className="text-[9px] font-stats px-1.5 py-0.5 rounded-md"
            style={{ background: isStale ? "rgba(251,191,36,0.1)" : "rgba(255,255,255,0.04)", color: isStale ? "#fbbf24" : "rgba(100,116,139,0.8)" }}>
            {card.daysInStage}d
          </span>
        </div>
      </div>

      <AnimatePresence>
        {showMenu && <MoveMenu currentStatus={card.status} onMove={(s: any) => onMove(card.id, s)} onClose={() => setShowMenu(false)} />}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Stage Column ─────────────────────────────────────────────────────────────
function StageColumn({ stage, stageCfg, onMove, onCardClick, index }: any) {
  const totalValue = stage.cards.reduce((s: number, c: any) => s + c.deal_value, 0);
  const Icon       = stageCfg.icon;
  const redCount   = stage.cards.filter((c: any) => getDealHealth(c.daysSinceContact, c.outreachCount).color === "#f87171").length;
  const amberCount = stage.cards.filter((c: any) => getDealHealth(c.daysSinceContact, c.outreachCount).color === "#fbbf24").length;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      className="flex flex-col min-w-[220px] w-[220px] shrink-0 min-h-0">
      <div className="rounded-xl p-3 mb-2 shrink-0"
        style={{ background: stageCfg.bg, border: `1px solid ${stageCfg.border}`, boxShadow: `0 2px 12px ${stageCfg.glow}` }}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Icon className="w-3 h-3 shrink-0" style={{ color: stageCfg.color }} />
            <span className="text-[10px] font-stats font-bold uppercase tracking-widest" style={{ color: stageCfg.color }}>{stageCfg.short}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {redCount > 0 && (
              <span className="flex items-center gap-0.5 text-[9px] font-stats text-red-400">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400" />{redCount}
              </span>
            )}
            {amberCount > 0 && (
              <span className="flex items-center gap-0.5 text-[9px] font-stats text-amber-400">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />{amberCount}
              </span>
            )}
            <span className="text-[10px] font-stats font-bold w-5 h-5 rounded-full flex items-center justify-center"
              style={{ background: `${stageCfg.color}20`, color: stageCfg.color }}>
              {stage.cards.length}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-stats font-semibold" style={{ color: "rgba(255,255,255,0.5)" }}>{formatValue(totalValue)}</span>
          {stage.cards.length > 0 && (
            <div className="flex-1 mx-2 h-0.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
              <div className="h-full rounded-full"
                style={{ background: stageCfg.color, width: `${Math.min((stage.cards.length / 10) * 100, 100)}%`, opacity: 0.6, transition: "width 0.5s ease" }} />
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-0.5 min-h-0"
        style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.08) transparent" }}>
        <AnimatePresence>
          {stage.cards.map((card: any) => (
            <KanbanCard key={card.id} card={card} stageCfg={stageCfg} onMove={onMove} onClick={() => onCardClick(card.id)} />
          ))}
        </AnimatePresence>
        {stage.cards.length === 0 && (
          <div className="rounded-xl p-4 text-center mt-1"
            style={{ border: `1px dashed ${stageCfg.border}`, background: stageCfg.bg }}>
            <p className="text-[10px] font-stats" style={{ color: `${stageCfg.color}40` }}>Empty</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Main Pipeline Page ───────────────────────────────────────────────────────
export default function Pipeline() {
  const navigate = useNavigate();
  const [stages,  setStages]  = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const buildStages = useCallback((leads: any[], outreachMap: Record<string, { last: string; count: number }>) => {
    return STAGE_CONFIG.map((cfg) => ({
      id:    cfg.name.toLowerCase().replace(/\s+/g, "-"),
      name:  cfg.name,
      cards: leads
        .filter((l) => l.status === cfg.name)
        .map((l) => {
          const info             = outreachMap[l.id];
          const lastContacted    = info?.last ?? null;
          const daysSinceContact = lastContacted
            ? Math.floor((Date.now() - new Date(lastContacted).getTime()) / 86400000)
            : 999;
          return {
            id: l.id, name: l.business_name,
            category: l.category ?? "—", city: l.city ?? "—",
            deal_value: l.deal_value ?? 0, daysInStage: daysAgo(l.updated_at),
            score: l.score ?? 0, score_label: l.score_label ?? "Low",
            status: l.status, daysSinceContact, outreachCount: info?.count ?? 0,
          };
        }),
    }));
  }, []);

  const fetchPipeline = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const [{ data: leadsData, error: leadsErr }, { data: outreachData }] = await Promise.all([
        supabase.from("leads")
          .select("id, business_name, category, city, deal_value, status, score, score_label, updated_at")
          .eq("user_id", user.id).order("updated_at", { ascending: false }),
        supabase.from("outreach_history")
          .select("lead_id, contacted_at")
          .eq("user_id", user.id).order("contacted_at", { ascending: false }),
      ]);

      if (leadsErr) throw leadsErr;

      const outreachMap: Record<string, { last: string; count: number }> = {};
      (outreachData ?? []).forEach((o: any) => {
        if (!outreachMap[o.lead_id]) outreachMap[o.lead_id] = { last: o.contacted_at, count: 0 };
        outreachMap[o.lead_id].count++;
      });

      setStages(buildStages(leadsData ?? [], outreachMap));
    } catch (e: any) {
      setError(e.message ?? "Failed to load pipeline");
    } finally {
      setLoading(false);
    }
  }, [buildStages]);

  useEffect(() => {
    fetchPipeline();
    const ch = supabase.channel("pipeline-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" },            fetchPipeline)
      .on("postgres_changes", { event: "*", schema: "public", table: "outreach_history" }, fetchPipeline)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchPipeline]);

  async function handleMove(leadId: string, newStatus: string) {
    setStages((prev: any[]) => {
      let moving: any = null;
      const next = prev.map((stage) => {
        const card = stage.cards.find((c: any) => c.id === leadId);
        if (card) moving = { ...card, status: newStatus, daysInStage: 0 };
        return { ...stage, cards: stage.cards.filter((c: any) => c.id !== leadId) };
      });
      return next.map((stage) =>
        stage.name === newStatus && moving ? { ...stage, cards: [moving, ...stage.cards] } : stage
      );
    });
    const { data: { user } } = await supabase.auth.getUser();
    const { error: e } = await supabase.from("leads").update({ status: newStatus }).eq("id", leadId).eq("user_id", user?.id);
    if (e) fetchPipeline();
  }

  const allCards    = stages.flatMap((s: any) => s.cards);
  const totalValue  = allCards.reduce((s: number, c: any) => s + c.deal_value, 0);
  const wonValue    = (stages.find((s: any) => s.name === "Closed Won")?.cards ?? []).reduce((s: number, c: any) => s + c.deal_value, 0);
  const activeLeads = allCards.filter((c: any) => !["Closed Won", "Closed Lost"].includes(c.status)).length;
  const convRate    = allCards.length ? Math.round(((stages.find((s: any) => s.name === "Closed Won")?.cards.length ?? 0) / allCards.length) * 100) : 0;
  const coldCount   = allCards.filter((c: any) => getDealHealth(c.daysSinceContact, c.outreachCount).color === "#f87171").length;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden" style={{ padding: "20px 24px 16px" }}>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="shrink-0 mb-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-heading font-bold text-white tracking-tight">Deal Pipeline</h1>
              {coldCount > 0 && (
                <motion.span animate={{ scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 2.5 }}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-stats text-red-400"
                  style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)" }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                  {coldCount} cold deal{coldCount !== 1 ? "s" : ""}
                </motion.span>
              )}
            </div>
            <div className="flex items-center gap-4 mt-1.5 mb-1">
              {[{ color: "#34d399", label: "Active (<3d)" }, { color: "#fbbf24", label: "Warm (3–7d)" }, { color: "#f87171", label: "Cold (7d+)" }].map((h) => (
                <div key={h.label} className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: h.color, boxShadow: `0 0 5px ${h.color}80` }} />
                  <span className="text-[10px] font-stats" style={{ color: "rgba(148,163,184,0.5)" }}>{h.label}</span>
                </div>
              ))}
            </div>
            <p className="text-[11px] font-stats" style={{ color: "rgba(148,163,184,0.5)" }}>
              Hover the dot on any card to see contact status
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchPipeline} disabled={loading} className="p-2 rounded-lg transition-all"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(148,163,184,0.7)" }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "white"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(148,163,184,0.7)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}>
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
              style={{ background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-stats text-emerald-400">LIVE</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3 mt-3">
          {[
            { label: "Pipeline Value", value: formatValue(totalValue), color: "hsl(72,100%,50%)" },
            { label: "Closed Won",     value: formatValue(wonValue),   color: "#34d399"           },
            { label: "Active Leads",   value: activeLeads,             color: "#60a5fa"           },
            { label: "Conversion",     value: `${convRate}%`,          color: "#c084fc"           },
          ].map((stat, i) => (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }} className="rounded-xl px-4 py-3"
              style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="text-[9px] font-stats uppercase tracking-widest mb-1" style={{ color: "rgba(148,163,184,0.5)" }}>{stat.label}</p>
              <p className="text-lg font-stats font-bold leading-none" style={{ color: stat.color }}>{stat.value}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {error && (
        <div className="shrink-0 mb-3 p-3 rounded-xl text-sm flex items-center justify-between font-stats"
          style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", color: "#f87171" }}>
          <span>⚠ {error}</span>
          <button onClick={fetchPipeline} className="text-xs underline opacity-70 hover:opacity-100">Retry</button>
        </div>
      )}

      {loading && stages.length === 0 && (
        <div className="flex items-center justify-center flex-1 gap-2" style={{ color: "rgba(148,163,184,0.5)" }}>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm font-stats">Loading pipeline...</span>
        </div>
      )}

      {!loading && (
        <div className="flex gap-3 flex-1 overflow-x-auto min-h-0 pb-2"
          style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.06) transparent" }}>
          {stages.map((stage: any, i: number) => {
            const cfg = getStageConfig(stage.name);
            return <StageColumn key={stage.id} stage={stage} stageCfg={cfg} onMove={handleMove} onCardClick={(id: string) => navigate(`/leads/${id}`)} index={i} />;
          })}
        </div>
      )}
    </div>
  );
}