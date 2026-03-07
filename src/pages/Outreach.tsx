import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail, MessageSquare, Phone, Send, Clock, Eye,
  Reply, MousePointerClick, ChevronRight, Copy,
  Sparkles, Loader2, RefreshCw, Check, Search,
  Filter, X, Plus, AlertCircle, Zap
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import { useNavigate } from "react-router-dom";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ─── Types ────────────────────────────────────────────────────────────────────
type OutreachMode = "Call" | "Email" | "WhatsApp" | "LinkedIn" | "Other";
type OutreachStatus = "Sent" | "Opened" | "Replied" | "Bounced";
type Tone = "Professional" | "Friendly" | "Direct" | "Confident High-Value";
type TemplateType = "Cold Email" | "WhatsApp Pitch" | "Call Script" | "Follow-Up";

interface OutreachRecord {
  id: string;
  lead_id: string;
  contact_mode: OutreachMode;
  subject: string | null;
  message: string | null;
  status: OutreachStatus;
  contacted_at: string;
  lead_name: string;
  lead_city: string;
  lead_category: string;
}

interface Lead {
  id: string;
  business_name: string;
  category: string;
  city: string;
  phone: string;
  website: string;
  rating: number;
  review_count: number;
  ai_opportunities: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────
const MODE_CONFIG: Record<OutreachMode, { icon: any; color: string; bg: string }> = {
  Email:    { icon: Mail,           color: "text-blue-400",    bg: "bg-blue-500/10"    },
  WhatsApp: { icon: MessageSquare,  color: "text-emerald-400", bg: "bg-emerald-500/10" },
  Call:     { icon: Phone,          color: "text-cyan-400",    bg: "bg-cyan-500/10"    },
  LinkedIn: { icon: Send,           color: "text-sky-400",     bg: "bg-sky-500/10"     },
  Other:    { icon: Send,           color: "text-muted-foreground", bg: "bg-muted"      },
};

const STATUS_CONFIG: Record<OutreachStatus, { label: string; color: string; dot: string }> = {
  Sent:    { label: "Sent",    color: "text-muted-foreground bg-muted/80 border-border",           dot: "bg-muted-foreground" },
  Opened:  { label: "Opened",  color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30",           dot: "bg-cyan-400"         },
  Replied: { label: "Replied", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",  dot: "bg-emerald-400"      },
  Bounced: { label: "Bounced", color: "text-red-400 bg-red-500/10 border-red-500/30",              dot: "bg-red-400"          },
};

const TONES: Tone[] = ["Professional", "Friendly", "Direct", "Confident High-Value"];

const TEMPLATE_CONFIG: { type: TemplateType; icon: any; desc: string; mode: OutreachMode }[] = [
  { type: "Cold Email",    icon: Mail,          desc: "First-touch personalized email",   mode: "Email"    },
  { type: "WhatsApp Pitch",icon: MessageSquare, desc: "Short conversational message",     mode: "WhatsApp" },
  { type: "Call Script",   icon: Phone,         desc: "Structured cold call flow",        mode: "Call"     },
  { type: "Follow-Up",     icon: Reply,         desc: "Re-engage after no reply",         mode: "Email"    },
];

function timeAgo(iso: string): string {
  const diff  = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return "just now";
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "yesterday";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

// ─── AI Generator via Groq ────────────────────────────────────────────────────
async function generateOutreach(
  lead: Lead,
  templateType: TemplateType,
  tone: Tone
): Promise<string> {
  const groqKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!groqKey) return "Add VITE_GROQ_API_KEY to .env to enable AI generation.";

  const prompts: Record<TemplateType, string> = {
    "Cold Email": `Write a cold email subject line and body for a freelancer selling web design + CRM services to ${lead.business_name} (${lead.category}, ${lead.city}). Website: ${lead.website || "none"}. Rating: ${lead.rating}★ (${lead.review_count} reviews). Opportunities: ${(lead.ai_opportunities ?? []).join(", ") || "needs digital presence"}. Tone: ${tone}. Format: Subject: [line]\n\n[body]. Keep it under 120 words. No fluff.`,
    "WhatsApp Pitch": `Write a WhatsApp cold message for ${lead.business_name} (${lead.category}, ${lead.city}). Tone: ${tone}. Max 4 lines. Direct, conversational, end with a soft CTA. No formal greetings.`,
    "Call Script": `Write a 30-second cold call script for ${lead.business_name} (${lead.category}, ${lead.city}). Tone: ${tone}. Format: Intro → Pain point → Value prop → CTA. Bullet points. Keep it natural.`,
    "Follow-Up": `Write a follow-up message for ${lead.business_name} who hasn't replied to the first outreach. Tone: ${tone}. Reference that we reached out before. Max 80 words. Add value, not pressure.`,
  };

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${groqKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompts[templateType] }],
        max_tokens: 300,
        temperature: 0.75,
      }),
    });
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? "Could not generate message.";
  } catch {
    return "Generation failed. Check your Groq API key.";
  }
}

// ─── Log Outreach Modal ───────────────────────────────────────────────────────
function LogOutreachModal({
  leads,
  prefillLeadId,
  prefillMode,
  prefillMessage,
  onClose,
  onSaved,
}: {
  leads: Lead[];
  prefillLeadId?: string;
  prefillMode?: OutreachMode;
  prefillMessage?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [leadId, setLeadId]     = useState(prefillLeadId ?? "");
  const [mode, setMode]         = useState<OutreachMode>(prefillMode ?? "Email");
  const [subject, setSubject]   = useState("");
  const [message, setMessage]   = useState(prefillMessage ?? "");
  const [status, setStatus]     = useState<OutreachStatus>("Sent");
  const [saving, setSaving]     = useState(false);
  const [search, setSearch]     = useState("");

  const filteredLeads = leads.filter((l) =>
    l.business_name.toLowerCase().includes(search.toLowerCase())
  );

  async function handleSave() {
    if (!leadId) return;
    setSaving(true);
    await supabase.from("outreach_history").insert({
      lead_id:      leadId,
      contact_mode: mode,
      subject:      subject || null,
      message:      message || null,
      status,
      contacted_at: new Date().toISOString(),
    });

    // Auto-update lead status if it's still New Lead
    await supabase
      .from("leads")
      .update({ status: "Contacted" })
      .eq("id", leadId)
      .eq("status", "New Lead");

    setSaving(false);
    onSaved();
    onClose();
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="glass rounded-2xl p-6 w-full max-w-lg space-y-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-heading font-bold text-foreground">Log Outreach</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Lead search */}
        <div>
          <label className="text-[10px] font-stats text-muted-foreground uppercase tracking-widest mb-1.5 block">Lead</label>
          {prefillLeadId ? (
            <div className="px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground">
              {leads.find((l) => l.id === prefillLeadId)?.business_name ?? "Selected lead"}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  placeholder="Search lead..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              {search && (
                <div className="max-h-32 overflow-y-auto rounded-lg border border-border bg-muted/50">
                  {filteredLeads.slice(0, 6).map((l) => (
                    <button key={l.id} onClick={() => { setLeadId(l.id); setSearch(l.business_name); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors text-foreground">
                      {l.business_name} <span className="text-xs text-muted-foreground">· {l.city}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Mode */}
        <div>
          <label className="text-[10px] font-stats text-muted-foreground uppercase tracking-widest mb-1.5 block">Channel</label>
          <div className="flex gap-2 flex-wrap">
            {(["Email", "WhatsApp", "Call", "LinkedIn", "Other"] as OutreachMode[]).map((m) => {
              const cfg = MODE_CONFIG[m];
              return (
                <button key={m} onClick={() => setMode(m)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-stats border transition-all ${
                    mode === m ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
                  }`}>
                  <cfg.icon className="w-3 h-3" />{m}
                </button>
              );
            })}
          </div>
        </div>

        {/* Subject (email only) */}
        {(mode === "Email" || mode === "LinkedIn") && (
          <div>
            <label className="text-[10px] font-stats text-muted-foreground uppercase tracking-widest mb-1.5 block">Subject</label>
            <input type="text" placeholder="Email subject..."
              value={subject} onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
        )}

        {/* Message */}
        <div>
          <label className="text-[10px] font-stats text-muted-foreground uppercase tracking-widest mb-1.5 block">Message / Notes</label>
          <textarea rows={4} placeholder="Paste message or add notes about this interaction..."
            value={message} onChange={(e) => setMessage(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
        </div>

        {/* Status */}
        <div>
          <label className="text-[10px] font-stats text-muted-foreground uppercase tracking-widest mb-1.5 block">Status</label>
          <div className="flex gap-2">
            {(["Sent", "Opened", "Replied", "Bounced"] as OutreachStatus[]).map((s) => (
              <button key={s} onClick={() => setStatus(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-stats border transition-all ${
                  status === s ? `border ${STATUS_CONFIG[s].color}` : "border-border text-muted-foreground hover:text-foreground"
                }`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || !leadId}
            className="flex-1 py-2.5 rounded-xl text-sm font-heading font-semibold text-primary-foreground disabled:opacity-50 flex items-center justify-center gap-2 transition-all hover:opacity-90"
            style={{ background: "var(--gradient-primary)" }}>
            {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...</> : <><Send className="w-3.5 h-3.5" /> Log Outreach</>}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Outreach Page ───────────────────────────────────────────────────────
export default function Outreach() {
  const navigate = useNavigate();

  // Data
  const [records, setRecords]     = useState<OutreachRecord[]>([]);
  const [leads, setLeads]         = useState<Lead[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  // AI Generator state
  const [selectedTone, setSelectedTone]         = useState<Tone>("Professional");
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType>("Cold Email");
  const [selectedLeadId, setSelectedLeadId]     = useState<string>("");
  const [showLeadDropdown, setShowLeadDropdown] = useState(false);
  const [generatedText, setGeneratedText]       = useState<string>("");
  const [generating, setGenerating]             = useState(false);
  const [copied, setCopied]                     = useState(false);
  const [leadSearch, setLeadSearch]             = useState("");

  // Log modal
  const [showLogModal, setShowLogModal]   = useState(false);
  const [logPrefill, setLogPrefill]       = useState<{ leadId?: string; mode?: OutreachMode; message?: string }>({});

  // Filters
  const [filterMode, setFilterMode]     = useState<OutreachMode | "All">("All");
  const [filterStatus, setFilterStatus] = useState<OutreachStatus | "All">("All");
  const [searchQuery, setSearchQuery]   = useState("");

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [{ data: outreachData, error: outErr }, { data: leadsData, error: leadsErr }] = await Promise.all([
        supabase
          .from("outreach_history")
          .select("id, lead_id, contact_mode, subject, message, status, contacted_at, leads(business_name, city, category)")
          .order("contacted_at", { ascending: false })
          .limit(50),
        supabase
          .from("leads")
          .select("id, business_name, category, city, phone, website, rating, review_count, ai_opportunities")
          .order("score", { ascending: false }),
      ]);

      if (outErr)  throw outErr;
      if (leadsErr) throw leadsErr;

      const mapped: OutreachRecord[] = (outreachData ?? []).map((r: any) => {
        const lead = Array.isArray(r.leads) ? r.leads[0] : r.leads;
        return {
          id:            r.id,
          lead_id:       r.lead_id,
          contact_mode:  r.contact_mode as OutreachMode,
          subject:       r.subject,
          message:       r.message,
          status:        r.status as OutreachStatus,
          contacted_at:  r.contacted_at,
          lead_name:     lead?.business_name ?? "Unknown Lead",
          lead_city:     lead?.city          ?? "—",
          lead_category: lead?.category      ?? "—",
        };
      });

      setRecords(mapped);
      setLeads((leadsData ?? []) as Lead[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load outreach data");
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Real-time ─────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchAll();
    const ch = supabase
      .channel("realtime:outreach-page")
      .on("postgres_changes", { event: "*", schema: "public", table: "outreach_history" }, fetchAll)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchAll]);

  // ── Update status ─────────────────────────────────────────────────────────
  async function handleStatusUpdate(id: string, newStatus: OutreachStatus) {
    setRecords((prev) => prev.map((r) => r.id === id ? { ...r, status: newStatus } : r));
    await supabase.from("outreach_history").update({ status: newStatus }).eq("id", id);
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    setRecords((prev) => prev.filter((r) => r.id !== id));
    await supabase.from("outreach_history").delete().eq("id", id);
  }

  // ── Copy ──────────────────────────────────────────────────────────────────
  async function handleCopy(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── AI generate ───────────────────────────────────────────────────────────
  async function handleGenerate() {
    const lead = leads.find((l) => l.id === selectedLeadId);
    if (!lead) return;
    setGenerating(true);
    setGeneratedText("");
    const text = await generateOutreach(lead, selectedTemplate, selectedTone);
    setGeneratedText(text);
    setGenerating(false);
  }

  // ── Filter records ────────────────────────────────────────────────────────
  const filtered = records.filter((r) => {
    const q = searchQuery.toLowerCase();
    const matchSearch = r.lead_name.toLowerCase().includes(q) ||
      (r.subject ?? "").toLowerCase().includes(q) ||
      r.lead_city.toLowerCase().includes(q);
    const matchMode   = filterMode   === "All" || r.contact_mode === filterMode;
    const matchStatus = filterStatus === "All" || r.status       === filterStatus;
    return matchSearch && matchMode && matchStatus;
  });

  // ── Stats ─────────────────────────────────────────────────────────────────
  const total    = records.length;
  const opened   = records.filter((r) => ["Opened", "Replied"].includes(r.status)).length;
  const replied  = records.filter((r) => r.status === "Replied").length;
  const bounced  = records.filter((r) => r.status === "Bounced").length;
  const openRate  = total > 0 ? Math.round((opened  / total) * 100) : 0;
  const replyRate = total > 0 ? Math.round((replied / total) * 100) : 0;

  const filteredLeadsForSearch = leads.filter((l) =>
    leadSearch.trim() === "" || l.business_name.toLowerCase().includes(leadSearch.toLowerCase())
  ).slice(0, 8);

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Outreach Hub</h1>
          <p className="text-sm text-muted-foreground mt-1">
            AI-powered cold outreach & tracking ·{" "}
            <span className="font-stats text-primary">{total} messages logged</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchAll} disabled={loading}
            className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-primary transition-all">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-success/10 border border-success/20">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            <span className="text-[10px] font-stats text-success">LIVE</span>
          </div>
          <button
            onClick={() => { setLogPrefill({}); setShowLogModal(true); }}
            className="px-4 py-2.5 rounded-lg font-heading font-semibold text-sm text-primary-foreground flex items-center gap-2 hover:opacity-90 transition-all"
            style={{ background: "var(--gradient-primary)" }}>
            <Plus className="w-4 h-4" /> Log Outreach
          </button>
        </div>
      </motion.div>

      {/* Error */}
      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />{error}
          <button onClick={fetchAll} className="ml-auto text-xs underline">Retry</button>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Sent",  value: loading ? "—" : total,              icon: Send,             color: "text-foreground"  },
          { label: "Open Rate",   value: loading ? "—" : `${openRate}%`,     icon: Eye,              color: "text-cyan-400"    },
          { label: "Reply Rate",  value: loading ? "—" : `${replyRate}%`,    icon: Reply,            color: "text-emerald-400" },
          { label: "Bounced",     value: loading ? "—" : bounced,            icon: AlertCircle,      color: "text-red-400"     },
        ].map((s, i) => (
          <motion.div key={s.label}
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            className="glass rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-stats text-muted-foreground uppercase tracking-widest">{s.label}</span>
              <s.icon className={`w-4 h-4 ${s.color}`} />
            </div>
            <span className="font-stats text-2xl font-bold text-foreground">{s.value}</span>
          </motion.div>
        ))}
      </div>

      {/* AI Generator */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="glass rounded-xl p-5 border border-primary/10">
        <div className="flex items-center gap-2 mb-5">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="font-heading text-base font-semibold text-foreground">AI Outreach Generator</h3>
            <p className="text-[10px] font-stats text-muted-foreground">Powered by Groq · Llama 3.3 70B</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/5 border border-primary/20">
            <Zap className="w-3 h-3 text-primary animate-pulse" />
            <span className="text-[10px] font-stats text-primary">AI ACTIVE</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Left: controls — template */}
          <div className="lg:col-span-2 space-y-4">
            {/* Template type */}
            <div>
              <p className="text-[10px] font-stats text-muted-foreground uppercase tracking-widest mb-2">Template</p>
              <div className="grid grid-cols-2 gap-2">
                {TEMPLATE_CONFIG.map((t) => (
                  <button key={t.type} onClick={() => setSelectedTemplate(t.type)}
                    className={`flex items-center gap-2 p-3 rounded-xl border text-left transition-all ${
                      selectedTemplate === t.type
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-muted/30 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                    }`}>
                    <t.icon className="w-4 h-4 shrink-0" />
                    <div>
                      <p className="text-xs font-stats font-medium">{t.type}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{t.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Tone */}
            <div>
              <p className="text-[10px] font-stats text-muted-foreground uppercase tracking-widest mb-2">Tone</p>
              <div className="flex flex-wrap gap-2">
                {TONES.map((tone) => (
                  <button key={tone} onClick={() => setSelectedTone(tone)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-stats border transition-all ${
                      selectedTone === tone
                        ? "bg-primary/20 text-primary border-primary/30"
                        : "bg-muted text-muted-foreground border-border hover:text-foreground"
                    }`}>
                    {tone}
                  </button>
                ))}
              </div>
            </div>

            {/* Lead selector */}
            <div>
              <p className="text-[10px] font-stats text-muted-foreground uppercase tracking-widest mb-2">Target Lead</p>

              {/* Selected lead chip */}
              {selectedLeadId && !showLeadDropdown ? (
                <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-primary/10 border border-primary/30">
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="text-sm text-primary font-medium">
                      {leads.find((l) => l.id === selectedLeadId)?.business_name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      · {leads.find((l) => l.id === selectedLeadId)?.city}
                    </span>
                  </div>
                  <button
                    onClick={() => { setSelectedLeadId(""); setLeadSearch(""); setShowLeadDropdown(true); }}
                    className="text-muted-foreground hover:text-foreground transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input
                    autoFocus={showLeadDropdown}
                    placeholder="Search lead to target..."
                    value={leadSearch}
                    onChange={(e) => { setLeadSearch(e.target.value); setShowLeadDropdown(true); }}
                    onFocus={() => setShowLeadDropdown(true)}
                    className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              )}

              {/* Dropdown list */}
              <AnimatePresence>
                {showLeadDropdown && !selectedLeadId && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="mt-1 rounded-xl border border-border bg-muted/95 backdrop-blur overflow-hidden shadow-xl max-h-48 overflow-y-auto"
                  >
                    {filteredLeadsForSearch.length === 0 && (
                      <p className="px-3 py-3 text-xs text-muted-foreground text-center">No leads found</p>
                    )}
                    {filteredLeadsForSearch.map((l) => (
                      <button key={l.id}
                        onClick={() => {
                          setSelectedLeadId(l.id);
                          setLeadSearch(l.business_name);
                          setShowLeadDropdown(false);
                        }}
                        className="w-full text-left px-3 py-2.5 text-sm transition-colors hover:bg-muted border-b border-border/30 last:border-0 flex items-center justify-between group">
                        <span className="text-foreground group-hover:text-primary transition-colors">{l.business_name}</span>
                        <span className="text-xs text-muted-foreground">{l.city} · {l.category}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button
              onClick={handleGenerate}
              disabled={generating || !selectedLeadId}
              className="w-full py-3 rounded-xl font-heading font-semibold text-sm text-primary-foreground disabled:opacity-50 flex items-center justify-center gap-2 transition-all hover:opacity-90"
              style={{ background: "var(--gradient-primary)" }}>
              {generating
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
                : <><Sparkles className="w-4 h-4" /> Generate Message</>}
            </button>
          </div>

          {/* Right: output */}
          <div className="lg:col-span-3 flex flex-col">
            <p className="text-[10px] font-stats text-muted-foreground uppercase tracking-widest mb-2">Generated Output</p>
            <div className="flex-1 relative">
              {generating ? (
                <div className="h-full min-h-[200px] rounded-xl bg-muted/50 border border-border flex items-center justify-center">
                  <div className="text-center space-y-2">
                    <Loader2 className="w-5 h-5 text-primary animate-spin mx-auto" />
                    <p className="text-xs text-muted-foreground font-stats">AI is crafting your message...</p>
                  </div>
                </div>
              ) : generatedText ? (
                <div className="space-y-2">
                  <pre className="w-full min-h-[180px] p-4 rounded-xl bg-muted/50 border border-primary/20 text-sm text-foreground font-sans leading-relaxed whitespace-pre-wrap overflow-auto max-h-64">
                    {generatedText}
                  </pre>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleCopy(generatedText)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-muted border border-border text-xs font-stats text-muted-foreground hover:text-foreground transition-colors">
                      {copied ? <><Check className="w-3.5 h-3.5 text-emerald-400" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy Message</>}
                    </button>
                    <button
                      onClick={() => {
                        const cfg = TEMPLATE_CONFIG.find((t) => t.type === selectedTemplate);
                        setLogPrefill({ leadId: selectedLeadId, mode: cfg?.mode, message: generatedText });
                        setShowLogModal(true);
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-stats font-semibold text-primary-foreground transition-all hover:opacity-90"
                      style={{ background: "var(--gradient-primary)" }}>
                      <Send className="w-3.5 h-3.5" /> Log It to CRM
                    </button>
                  </div>
                </div>
              ) : (
                <div className="min-h-[200px] rounded-xl bg-muted/30 border border-dashed border-border flex items-center justify-center">
                  <div className="text-center space-y-2 p-6">
                    <Sparkles className="w-6 h-6 text-muted-foreground/40 mx-auto" />
                    <p className="text-sm text-muted-foreground">Select a lead and click generate</p>
                    <p className="text-xs text-muted-foreground/60">AI will craft a personalized message based on their profile</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* History */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-xl p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h3 className="font-heading text-lg text-foreground">Communication History</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{filtered.length} of {records.length} records</p>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input placeholder="Search..." value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-lg bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary w-40" />
            </div>

            <select value={filterMode} onChange={(e) => setFilterMode(e.target.value as any)}
              className="px-3 py-1.5 rounded-lg bg-muted border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
              <option value="All">All Channels</option>
              {(["Email", "WhatsApp", "Call", "LinkedIn", "Other"] as OutreachMode[]).map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>

            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)}
              className="px-3 py-1.5 rounded-lg bg-muted border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
              <option value="All">All Status</option>
              {(["Sent", "Opened", "Replied", "Bounced"] as OutreachStatus[]).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-2">
            {[1,2,3].map((i) => <div key={i} className="h-16 rounded-lg bg-muted/50 animate-pulse" />)}
          </div>
        )}

        {/* Empty */}
        {!loading && filtered.length === 0 && (
          <div className="py-12 text-center space-y-2">
            <Send className="w-7 h-7 text-muted-foreground/30 mx-auto" />
            <p className="text-sm text-muted-foreground">
              {records.length === 0 ? "No outreach logged yet." : "No records match your filters."}
            </p>
            {records.length === 0 && (
              <button onClick={() => { setLogPrefill({}); setShowLogModal(true); }}
                className="mt-2 px-4 py-2 rounded-lg text-sm font-heading font-semibold text-primary-foreground"
                style={{ background: "var(--gradient-primary)" }}>
                Log First Outreach
              </button>
            )}
          </div>
        )}

        {/* Records list */}
        {!loading && filtered.length > 0 && (
          <div className="space-y-2">
            <AnimatePresence>
              {filtered.map((record, i) => {
                const modeCfg   = MODE_CONFIG[record.contact_mode]   ?? MODE_CONFIG["Other"];
                const statusCfg = STATUS_CONFIG[record.status]       ?? STATUS_CONFIG["Sent"];
                const ModeIcon  = modeCfg.icon;
                return (
                  <motion.div key={record.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8 }}
                    transition={{ delay: i * 0.03 }}
                    className="flex items-start gap-3 p-3.5 rounded-xl bg-muted/30 hover:bg-muted/50 transition-all group"
                  >
                    {/* Mode icon */}
                    <div className={`p-2 rounded-lg mt-0.5 shrink-0 ${modeCfg.bg}`}>
                      <ModeIcon className={`w-4 h-4 ${modeCfg.color}`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <button
                          onClick={() => navigate(`/leads/${record.lead_id}`)}
                          className="text-sm font-medium text-foreground hover:text-primary transition-colors">
                          {record.lead_name}
                        </button>
                        {/* Status badge — clickable to cycle */}
                        <button
                          onClick={() => {
                            const cycle: OutreachStatus[] = ["Sent", "Opened", "Replied", "Bounced"];
                            const next = cycle[(cycle.indexOf(record.status) + 1) % cycle.length];
                            handleStatusUpdate(record.id, next);
                          }}
                          className={`text-[10px] font-stats px-2 py-0.5 rounded-full border transition-all hover:opacity-80 ${statusCfg.color}`}>
                          <span className={`inline-block w-1.5 h-1.5 rounded-full ${statusCfg.dot} mr-1`} />
                          {statusCfg.label}
                        </button>
                      </div>
                      {record.subject && (
                        <p className="text-xs text-foreground/80 font-medium mb-0.5">{record.subject}</p>
                      )}
                      {record.message && (
                        <p className="text-xs text-muted-foreground line-clamp-1">{record.message}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-[10px] font-stats text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />{timeAgo(record.contacted_at)}
                        </span>
                        <span className="text-[10px] font-stats text-muted-foreground">
                          {record.lead_city} · {record.lead_category}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      {record.message && (
                        <button onClick={() => handleCopy(record.message!)}
                          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Copy message">
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button onClick={() => handleDelete(record.id)}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-red-400 transition-colors" title="Delete">
                        <X className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => navigate(`/leads/${record.lead_id}`)}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors">
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </motion.div>

      {/* Log modal */}
      <AnimatePresence>
        {showLogModal && (
          <LogOutreachModal
            leads={leads}
            prefillLeadId={logPrefill.leadId}
            prefillMode={logPrefill.mode}
            prefillMessage={logPrefill.message}
            onClose={() => setShowLogModal(false)}
            onSaved={fetchAll}
          />
        )}
      </AnimatePresence>
    </div>
  );
}