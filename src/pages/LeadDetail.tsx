import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Phone, Mail, Globe, MapPin, Star, MessageSquare,
  Sparkles, Brain, Zap, Target, Clock, CheckCircle2,
  Plus, Trash2, Edit3, X, Loader2, ExternalLink,
  Tag, FileText, Activity, ChevronRight, RefreshCw,
  AlertCircle, Copy, Check, Flame, Shield,
  BarChart2, Users, IndianRupee, Send, Calendar,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";

// ── Types ──────────────────────────────────────────────────────────────────────
interface Lead {
  id: string;
  business_name: string;
  category: string;
  city: string;
  state: string;
  phone: string;
  email: string;
  website: string;
  rating: number;
  review_count: number;
  score: number;
  score_label: string;
  status: string;
  deal_value: number;
  has_website: boolean;
  notes: string;
  source: string;
  google_place_id: string;
  created_at: string;
  updated_at: string;
}
interface Note     { id: string; note: string; created_at: string; }
interface Task     { id: string; title: string; priority: string; is_done: boolean; due_date: string; }
interface Outreach { id: string; contact_mode: string; subject: string; message: string; status: string; contacted_at: string; }
interface TagData  { id: string; name: string; color: string; }

// ── Status config ──────────────────────────────────────────────────────────────
const STATUS_OPTIONS = [
  "New Lead","Contacted","Replied","Interested",
  "Proposal Sent","Negotiation","Closed Won","Closed Lost",
];
const STATUS_COLORS: Record<string, string> = {
  "New Lead":      "bg-slate-500/20 text-slate-300 border-slate-500/30",
  "Contacted":     "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  "Replied":       "bg-blue-500/20 text-blue-300 border-blue-500/30",
  "Interested":    "bg-violet-500/20 text-violet-300 border-violet-500/30",
  "Proposal Sent": "bg-purple-500/20 text-purple-300 border-purple-500/30",
  "Negotiation":   "bg-amber-500/20 text-amber-300 border-amber-500/30",
  "Closed Won":    "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  "Closed Lost":   "bg-red-500/20 text-red-400 border-red-500/30",
};
const PRIORITY_COLORS: Record<string, string> = {
  High:   "text-red-400 bg-red-400/10 border-red-400/30",
  Medium: "text-amber-400 bg-amber-400/10 border-amber-400/30",
  Low:    "text-slate-400 bg-slate-400/10 border-slate-400/30",
};

// ── AI Engine ──────────────────────────────────────────────────────────────────
async function callGroq(prompt: string, maxTokens = 400): Promise<string> {
  const key = import.meta.env.VITE_GROQ_API_KEY;
  if (!key) return "Add VITE_GROQ_API_KEY to .env to enable AI features.";
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      max_tokens: maxTokens,
      temperature: 0.85,
    }),
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "Could not generate response.";
}

// ── Score Ring ─────────────────────────────────────────────────────────────────
function ScoreRing({ score }: { score: number }) {
  const r     = 36;
  const c     = 2 * Math.PI * r;
  const pct   = Math.min(score, 100) / 100;
  const color = score >= 70 ? "#ef4444" : score >= 45 ? "#f59e0b" : "#64748b";
  return (
    <div className="relative w-24 h-24 flex items-center justify-center">
      <svg className="absolute inset-0 -rotate-90" width="96" height="96">
        <circle cx="48" cy="48" r={r} fill="none" stroke="hsl(215,20%,20%)" strokeWidth="6" />
        <motion.circle cx="48" cy="48" r={r} fill="none"
          stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - pct * c }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          style={{ filter: `drop-shadow(0 0 6px ${color})` }}
        />
      </svg>
      <div className="text-center z-10">
        <p className="font-stats text-xl font-bold text-foreground leading-none">{score}</p>
        <p className="text-[9px] font-stats text-muted-foreground uppercase tracking-widest">score</p>
      </div>
    </div>
  );
}

// ── Copy Button ────────────────────────────────────────────────────────────────
function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="p-1 rounded text-muted-foreground hover:text-primary transition-colors">
      {copied ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

// ── Section Card ───────────────────────────────────────────────────────────────
function SectionCard({ title, icon: Icon, children, action }: {
  title: string; icon: any; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <Icon className="w-3.5 h-3.5 text-primary" />
          </div>
          <h3 className="font-heading text-sm font-semibold text-foreground">{title}</h3>
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function LeadDetail() {
  const { id }     = useParams<{ id: string }>();
  const navigate   = useNavigate();
  const { user }   = useAuth(); // ← AUTH

  const [lead,     setLead]     = useState<Lead | null>(null);
  const [notes,    setNotes]    = useState<Note[]>([]);
  const [tasks,    setTasks]    = useState<Task[]>([]);
  const [outreach, setOutreach] = useState<Outreach[]>([]);
  const [allTags,  setAllTags]  = useState<TagData[]>([]);
  const [leadTags, setLeadTags] = useState<TagData[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  const [editStatus,    setEditStatus]    = useState(false);
  const [editDealValue, setEditDealValue] = useState(false);
  const [dealInput,     setDealInput]     = useState("");
  const [noteInput,     setNoteInput]     = useState("");
  const [savingNote,    setSavingNote]    = useState(false);
  const [showTaskForm,  setShowTaskForm]  = useState(false);
  const [taskInput,     setTaskInput]     = useState({ title: "", priority: "Medium", due_date: "" });
  const [savingTask,    setSavingTask]    = useState(false);
  const [showOutreachForm, setShowOutreachForm] = useState(false);
  const [outreachInput,    setOutreachInput]    = useState({ contact_mode: "Call", subject: "", message: "" });
  const [savingOutreach,   setSavingOutreach]   = useState(false);
  const [aiPitch,     setAiPitch]     = useState("");
  const [aiAnalysis,  setAiAnalysis]  = useState("");
  const [aiStrategy,  setAiStrategy]  = useState("");
  const [aiObjHandle, setAiObjHandle] = useState("");
  const [loadingAI,   setLoadingAI]   = useState<Record<string, boolean>>({});
  const [activeTab,   setActiveTab]   = useState<"overview"|"tasks"|"outreach"|"notes">("overview");

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [
        { data: l  }, { data: n  }, { data: t  },
        { data: o  }, { data: at }, { data: lt },
      ] = await Promise.all([
        supabase.from("leads").select("*").eq("id", id).single(),
        supabase.from("lead_notes").select("*").eq("lead_id", id).order("created_at", { ascending: false }),
        supabase.from("tasks").select("*").eq("lead_id", id).order("due_date"),
        supabase.from("outreach_history").select("*").eq("lead_id", id).order("contacted_at", { ascending: false }),
        supabase.from("tags").select("*").order("name"),
        supabase.from("lead_tags").select("tag_id, tags(id,name,color)").eq("lead_id", id),
      ]);
      setLead(l as Lead);
      setNotes((n ?? []) as Note[]);
      setTasks((t ?? []) as Task[]);
      setOutreach((o ?? []) as Outreach[]);
      setAllTags((at ?? []) as TagData[]);
      const tagList = (lt ?? []).map((r: any) => r.tags).filter(Boolean) as TagData[];
      setLeadTags(tagList);
      setDealInput(String(l?.deal_value ?? ""));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (!id) return;
    const ch = supabase.channel(`lead-detail-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "lead_notes",       filter: `lead_id=eq.${id}` }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks",            filter: `lead_id=eq.${id}` }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "outreach_history", filter: `lead_id=eq.${id}` }, fetchAll)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, fetchAll]);

  // ── Actions ────────────────────────────────────────────────────────────────
  async function updateStatus(status: string) {
    if (!id) return;
    await supabase.from("leads").update({ status }).eq("id", id);
    setLead((p) => p ? { ...p, status } : p);
    setEditStatus(false);
  }

  async function updateDealValue() {
    if (!id) return;
    const val = parseFloat(dealInput) || 0;
    await supabase.from("leads").update({ deal_value: val }).eq("id", id);
    setLead((p) => p ? { ...p, deal_value: val } : p);
    setEditDealValue(false);
  }

  async function addNote() {
    if (!noteInput.trim() || !id || !user?.id) return;
    setSavingNote(true);
    await supabase.from("lead_notes").insert({
      lead_id: id,
      note:    noteInput.trim(),
      user_id: user.id, // ← AUTH
    });
    setNoteInput("");
    setSavingNote(false);
    fetchAll();
  }

  async function deleteNote(nid: string) {
    await supabase.from("lead_notes").delete().eq("id", nid);
    setNotes((p) => p.filter((n) => n.id !== nid));
  }

  async function addTask() {
    if (!taskInput.title.trim() || !id || !user?.id) return;
    setSavingTask(true);
    await supabase.from("tasks").insert({
      lead_id: id,
      user_id: user.id, // ← AUTH
      ...taskInput,
      is_done: false,
    });
    setTaskInput({ title: "", priority: "Medium", due_date: "" });
    setShowTaskForm(false);
    setSavingTask(false);
    fetchAll();
  }

  async function toggleTask(t: Task) {
    await supabase.from("tasks").update({ is_done: !t.is_done }).eq("id", t.id);
    setTasks((p) => p.map((x) => x.id === t.id ? { ...x, is_done: !x.is_done } : x));
  }

  async function deleteTask(tid: string) {
    await supabase.from("tasks").delete().eq("id", tid);
    setTasks((p) => p.filter((t) => t.id !== tid));
  }

  async function addOutreach() {
    if (!outreachInput.message.trim() || !id || !user?.id) return;
    setSavingOutreach(true);
    await supabase.from("outreach_history").insert({
      lead_id:      id,
      user_id:      user.id, // ← AUTH
      contact_mode: outreachInput.contact_mode,
      subject:      outreachInput.subject,
      message:      outreachInput.message,
      status:       "Sent",
      contacted_at: new Date().toISOString(),
    });
    setOutreachInput({ contact_mode: "Call", subject: "", message: "" });
    setShowOutreachForm(false);
    setSavingOutreach(false);
    fetchAll();
  }

  async function toggleTag(tag: TagData) {
    if (!id) return;
    const has = leadTags.some((t) => t.id === tag.id);
    if (has) {
      await supabase.from("lead_tags").delete().eq("lead_id", id).eq("tag_id", tag.id);
      setLeadTags((p) => p.filter((t) => t.id !== tag.id));
    } else {
      await supabase.from("lead_tags").insert({ lead_id: id, tag_id: tag.id });
      setLeadTags((p) => [...p, tag]);
    }
  }

  // ── AI Functions ───────────────────────────────────────────────────────────
  async function genPitch() {
    if (!lead) return;
    setLoadingAI((p) => ({ ...p, pitch: true }));
    const txt = await callGroq(
      `You are a persuasive sales consultant for a freelance web developer in India.
Lead: ${lead.business_name} | Category: ${lead.category} | City: ${lead.city}
Website: ${lead.has_website ? lead.website : "NO WEBSITE"} | Rating: ${lead.rating} (${lead.review_count} reviews)
Score: ${lead.score} | Status: ${lead.status}

Write a killer cold outreach pitch (WhatsApp/Email) under 120 words. Be specific to their business type.
Open with a hook about their specific pain point. Mention one concrete benefit. End with a soft CTA.
Sound human, not robotic. No generic fluff.`, 200
    );
    setAiPitch(txt);
    setLoadingAI((p) => ({ ...p, pitch: false }));
  }

  async function genAnalysis() {
    if (!lead) return;
    setLoadingAI((p) => ({ ...p, analysis: true }));
    const txt = await callGroq(
      `You are a sharp business analyst. Analyze this lead for a freelance web developer in India.
Business: ${lead.business_name} | Type: ${lead.category} | City: ${lead.city}
Website: ${lead.has_website ? lead.website : "NONE"} | Rating: ${lead.rating}/5 | Reviews: ${lead.review_count}
Opportunity Score: ${lead.score}/100

Give a 4-point analysis:
1. 🎯 Opportunity: Why this is a good/bad lead
2. 💰 Revenue Potential: Estimated deal size and upsell potential
3. ⚡ Pain Points: What problems they likely have (website/digital)
4. 🚀 Approach: Best way to approach this specific business

Be specific. Use numbers. Max 180 words total.`, 280
    );
    setAiAnalysis(txt);
    setLoadingAI((p) => ({ ...p, analysis: false }));
  }

  async function genStrategy() {
    if (!lead) return;
    setLoadingAI((p) => ({ ...p, strategy: true }));
    const recentOutreach = outreach.slice(0, 3).map((o) => `${o.contact_mode}: ${o.message.slice(0, 60)}...`).join(" | ");
    const txt = await callGroq(
      `Sales coach for Indian freelancer. Create a closing strategy.
Lead: ${lead.business_name} | Status: ${lead.status} | Score: ${lead.score}
Deal Value: ₹${lead.deal_value || "Unknown"} | Past Outreach: ${recentOutreach || "None yet"}
Open Tasks: ${tasks.filter((t) => !t.is_done).length}

Give a 3-step closing action plan for THIS WEEK. Be tactical.
Step 1: Immediate action (today)
Step 2: Follow-up (day 2-3)
Step 3: Close move (day 5-7)
Max 150 words. Be direct and specific.`, 250
    );
    setAiStrategy(txt);
    setLoadingAI((p) => ({ ...p, strategy: false }));
  }

  async function genObjectionHandler() {
    if (!lead) return;
    setLoadingAI((p) => ({ ...p, objection: true }));
    const txt = await callGroq(
      `Sales expert for Indian freelancer targeting ${lead.category} businesses in ${lead.city}.
Business: ${lead.business_name}

Give the TOP 3 objections this ${lead.category} owner will say and exactly how to handle each.
Format:
❌ Objection: [what they say]
✅ Response: [what you say back]

Be realistic to Indian business owners. Keep responses under 2 sentences each. Max 200 words total.`, 320
    );
    setAiObjHandle(txt);
    setLoadingAI((p) => ({ ...p, objection: false }));
  }

  // ── Loading / Error ────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center space-y-3">
        <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
        <p className="text-sm text-muted-foreground font-stats">Loading lead...</p>
      </div>
    </div>
  );

  if (error || !lead) return (
    <div className="p-6 text-center">
      <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
      <p className="text-red-400 text-sm">{error ?? "Lead not found"}</p>
      <button onClick={() => navigate("/leads")} className="mt-3 text-primary text-sm hover:underline">← Back to Leads</button>
    </div>
  );

  const doneTasks  = tasks.filter((t) => t.is_done).length;
  const scoreColor = lead.score >= 70 ? "text-red-400" : lead.score >= 45 ? "text-amber-400" : "text-slate-400";

  return (
    <div className="min-h-screen">

      {/* ── HERO BANNER ── */}
      <div className="relative overflow-hidden border-b border-border/40"
        style={{ background: "linear-gradient(135deg, hsl(215,30%,8%) 0%, hsl(215,25%,11%) 100%)" }}>

        <div className="absolute right-32 top-1/2 -translate-y-1/2 w-48 h-48 rounded-full opacity-10 blur-3xl"
          style={{ backgroundColor: lead.score >= 70 ? "#ef4444" : lead.score >= 45 ? "#f59e0b" : "#64748b" }} />

        <div className="relative px-6 py-6">
          <button onClick={() => navigate("/leads")}
            className="flex items-center gap-1.5 text-xs font-stats text-muted-foreground hover:text-foreground mb-5 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Leads
          </button>

          <div className="flex items-start justify-between gap-6 flex-wrap">
            {/* Identity */}
            <div className="flex items-start gap-5 flex-1 min-w-0">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-heading font-bold text-primary-foreground shrink-0"
                style={{ background: "var(--gradient-primary)" }}>
                {lead.business_name.charAt(0)}
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl font-heading font-bold text-foreground leading-tight truncate">
                  {lead.business_name}
                </h1>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-xs font-stats text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                    {lead.category}
                  </span>
                  {lead.city && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="w-3 h-3" />{lead.city}{lead.state ? `, ${lead.state}` : ""}
                    </span>
                  )}
                  {lead.rating > 0 && (
                    <span className="flex items-center gap-1 text-xs text-amber-400">
                      <Star className="w-3 h-3 fill-amber-400" />{lead.rating}
                      <span className="text-muted-foreground">({lead.review_count})</span>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-3 flex-wrap">
                  {lead.phone && (
                    <a href={`tel:${lead.phone}`}
                      className="flex items-center gap-1.5 text-xs font-stats text-muted-foreground hover:text-primary transition-colors group">
                      <Phone className="w-3.5 h-3.5 group-hover:text-primary" />{lead.phone}
                      <CopyBtn text={lead.phone} />
                    </a>
                  )}
                  {lead.email && (
                    <a href={`mailto:${lead.email}`}
                      className="flex items-center gap-1.5 text-xs font-stats text-muted-foreground hover:text-primary transition-colors">
                      <Mail className="w-3.5 h-3.5" />{lead.email}
                    </a>
                  )}
                  {lead.website && (
                    <a href={lead.website} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1.5 text-xs font-stats text-cyan-400 hover:text-cyan-300 transition-colors">
                      <Globe className="w-3.5 h-3.5" />
                      {lead.website.replace(/^https?:\/\//, "").split("/")[0]}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {!lead.has_website && (
                    <span className="flex items-center gap-1.5 text-xs font-stats text-red-400 bg-red-400/10 px-2 py-0.5 rounded border border-red-400/20">
                      <X className="w-3 h-3" /> No Website
                    </span>
                  )}
                  {lead.phone && (
                    <a href={`https://wa.me/${lead.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1.5 text-xs font-stats text-emerald-400 hover:text-emerald-300 transition-colors">
                      <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Score + Status */}
            <div className="flex items-center gap-6 shrink-0">
              <ScoreRing score={lead.score} />
              <div className="space-y-2">
                <div className="relative">
                  {editStatus ? (
                    <div className="flex flex-col gap-1 bg-popover border border-border rounded-xl p-2 shadow-xl z-20 absolute right-0 top-0 w-44">
                      {STATUS_OPTIONS.map((s) => (
                        <button key={s} onClick={() => updateStatus(s)}
                          className={`text-xs text-left px-2 py-1.5 rounded-lg transition-colors hover:bg-muted ${lead.status === s ? "text-primary font-semibold" : "text-muted-foreground"}`}>
                          {s}
                        </button>
                      ))}
                      <button onClick={() => setEditStatus(false)} className="text-xs text-muted-foreground px-2 py-1 hover:text-foreground">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => setEditStatus(true)}
                      className={`text-xs font-stats px-3 py-1.5 rounded-lg border transition-all hover:opacity-80 flex items-center gap-1.5 ${STATUS_COLORS[lead.status] ?? "bg-muted text-muted-foreground border-border"}`}>
                      {lead.status} <Edit3 className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {editDealValue ? (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">₹</span>
                      <input autoFocus type="number" value={dealInput}
                        onChange={(e) => setDealInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && updateDealValue()}
                        className="w-24 px-2 py-1 rounded-lg bg-muted border border-primary text-xs text-foreground font-stats focus:outline-none" />
                      <button onClick={updateDealValue} className="text-primary"><Check className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setEditDealValue(false)} className="text-muted-foreground"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ) : (
                    <button onClick={() => setEditDealValue(true)}
                      className="flex items-center gap-1.5 text-xs font-stats text-amber-400 hover:text-amber-300 transition-colors">
                      <IndianRupee className="w-3.5 h-3.5" />
                      {lead.deal_value > 0 ? lead.deal_value.toLocaleString("en-IN") : "Set value"}
                      <Edit3 className="w-3 h-3 opacity-50" />
                    </button>
                  )}
                </div>
                <button onClick={fetchAll}
                  className="flex items-center gap-1 text-[10px] font-stats text-muted-foreground hover:text-foreground transition-colors">
                  <RefreshCw className="w-3 h-3" /> Refresh
                </button>
              </div>
            </div>
          </div>

          {/* Tags */}
          <div className="flex items-center gap-2 mt-4 flex-wrap">
            {leadTags.map((tag) => (
              <button key={tag.id} onClick={() => toggleTag(tag)}
                className="inline-flex items-center gap-1 text-[10px] font-stats px-2 py-1 rounded-full border transition-all hover:opacity-70"
                style={{ color: tag.color, backgroundColor: `${tag.color}15`, borderColor: `${tag.color}40` }}>
                <Tag className="w-2.5 h-2.5" /> {tag.name} <X className="w-2.5 h-2.5" />
              </button>
            ))}
            {allTags.filter((t) => !leadTags.some((lt) => lt.id === t.id)).map((tag) => (
              <button key={tag.id} onClick={() => toggleTag(tag)}
                className="inline-flex items-center gap-1 text-[10px] font-stats px-2 py-1 rounded-full border border-dashed border-border text-muted-foreground hover:border-primary/50 transition-all">
                <Plus className="w-2.5 h-2.5" /> {tag.name}
              </button>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pb-0">
          {(["overview","tasks","outreach","notes"] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-xs font-stats capitalize transition-all relative ${
                activeTab === tab ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}>
              {tab}
              {tab === "tasks"    && tasks.filter((t) => !t.is_done).length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-primary/20 text-primary text-[9px]">
                  {tasks.filter((t) => !t.is_done).length}
                </span>
              )}
              {tab === "notes"    && notes.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground text-[9px]">{notes.length}</span>
              )}
              {tab === "outreach" && outreach.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground text-[9px]">{outreach.length}</span>
              )}
              {activeTab === tab && (
                <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── BODY ── */}
      <div className="p-6">
        <AnimatePresence mode="wait">

          {/* OVERVIEW */}
          {activeTab === "overview" && (
            <motion.div key="overview" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="grid grid-cols-1 xl:grid-cols-3 gap-5">

              <div className="xl:col-span-2 space-y-5">
                {/* Quick Stats */}
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: "Tasks",    value: `${doneTasks}/${tasks.length}`, icon: CheckCircle2, color: "text-success"     },
                    { label: "Outreach", value: outreach.length,                icon: Send,         color: "text-cyan-400"   },
                    { label: "Notes",    value: notes.length,                   icon: FileText,     color: "text-violet-400" },
                    { label: "Score",    value: lead.score,                     icon: BarChart2,    color: scoreColor        },
                  ].map((s) => (
                    <div key={s.label} className="glass rounded-xl p-3 text-center">
                      <s.icon className={`w-4 h-4 mx-auto mb-1 ${s.color}`} />
                      <p className="font-stats text-lg font-bold text-foreground">{s.value}</p>
                      <p className="text-[9px] font-stats text-muted-foreground uppercase tracking-wider">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* AI Pitch */}
                <SectionCard title="AI Outreach Pitch" icon={Sparkles}
                  action={
                    <button onClick={genPitch} disabled={loadingAI.pitch}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-heading font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-all"
                      style={{ background: "var(--gradient-primary)" }}>
                      {loadingAI.pitch ? <><Loader2 className="w-3 h-3 animate-spin" /> Writing...</> : <><Zap className="w-3 h-3" /> Generate</>}
                    </button>
                  }>
                  {aiPitch ? (
                    <div className="relative">
                      <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{aiPitch}</p>
                      <button onClick={() => navigator.clipboard.writeText(aiPitch)}
                        className="absolute top-0 right-0 flex items-center gap-1 text-[10px] font-stats text-muted-foreground hover:text-primary px-2 py-1 rounded bg-muted/50">
                        <Copy className="w-3 h-3" /> Copy
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 py-4">
                      <div className="p-3 rounded-xl bg-primary/5 border border-primary/10">
                        <Sparkles className="w-5 h-5 text-primary opacity-50" />
                      </div>
                      <div>
                        <p className="text-sm text-foreground">Generate a personalized pitch</p>
                        <p className="text-xs text-muted-foreground">AI writes a cold outreach message specific to {lead.business_name}</p>
                      </div>
                    </div>
                  )}
                </SectionCard>

                {/* Business Intelligence */}
                <SectionCard title="Business Intelligence" icon={Brain}
                  action={
                    <button onClick={genAnalysis} disabled={loadingAI.analysis}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-heading font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-all"
                      style={{ background: "var(--gradient-primary)" }}>
                      {loadingAI.analysis ? <><Loader2 className="w-3 h-3 animate-spin" /> Analyzing...</> : <><Brain className="w-3 h-3" /> Analyze</>}
                    </button>
                  }>
                  {aiAnalysis ? (
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{aiAnalysis}</p>
                  ) : (
                    <div className="flex items-center gap-3 py-4">
                      <div className="p-3 rounded-xl bg-primary/5 border border-primary/10"><Brain className="w-5 h-5 text-primary opacity-50" /></div>
                      <div>
                        <p className="text-sm text-foreground">Deep business analysis</p>
                        <p className="text-xs text-muted-foreground">Opportunity, revenue potential, pain points & approach</p>
                      </div>
                    </div>
                  )}
                </SectionCard>

                {/* Closing Strategy */}
                <SectionCard title="Closing Strategy" icon={Target}
                  action={
                    <button onClick={genStrategy} disabled={loadingAI.strategy}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-heading font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-all"
                      style={{ background: "var(--gradient-primary)" }}>
                      {loadingAI.strategy ? <><Loader2 className="w-3 h-3 animate-spin" /> Planning...</> : <><Target className="w-3 h-3" /> Get Strategy</>}
                    </button>
                  }>
                  {aiStrategy ? (
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{aiStrategy}</p>
                  ) : (
                    <div className="flex items-center gap-3 py-4">
                      <div className="p-3 rounded-xl bg-primary/5 border border-primary/10"><Target className="w-5 h-5 text-primary opacity-50" /></div>
                      <div>
                        <p className="text-sm text-foreground">3-step weekly closing plan</p>
                        <p className="text-xs text-muted-foreground">Tactical action plan based on current status & outreach history</p>
                      </div>
                    </div>
                  )}
                </SectionCard>

                {/* Objection Handler */}
                <SectionCard title="Objection Handler" icon={Shield}
                  action={
                    <button onClick={genObjectionHandler} disabled={loadingAI.objection}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-heading font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-all"
                      style={{ background: "var(--gradient-primary)" }}>
                      {loadingAI.objection ? <><Loader2 className="w-3 h-3 animate-spin" /> Thinking...</> : <><Shield className="w-3 h-3" /> Prep Me</>}
                    </button>
                  }>
                  {aiObjHandle ? (
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{aiObjHandle}</p>
                  ) : (
                    <div className="flex items-center gap-3 py-4">
                      <div className="p-3 rounded-xl bg-primary/5 border border-primary/10"><Shield className="w-5 h-5 text-primary opacity-50" /></div>
                      <div>
                        <p className="text-sm text-foreground">Handle their objections</p>
                        <p className="text-xs text-muted-foreground">Top 3 objections from {lead.category} owners + exact responses</p>
                      </div>
                    </div>
                  )}
                </SectionCard>
              </div>

              {/* RIGHT SIDEBAR */}
              <div className="space-y-5">
                <SectionCard title="Lead Details" icon={Users}>
                  <dl className="space-y-3">
                    {[
                      { label: "Source",  value: lead.source || "Manual" },
                      { label: "Added",   value: new Date(lead.created_at).toLocaleDateString("en-IN") },
                      { label: "Website", value: lead.has_website ? "Yes ✓" : "No ✗" },
                      { label: "Rating",  value: lead.rating > 0 ? `${lead.rating} ⭐ (${lead.review_count})` : "—" },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between">
                        <dt className="text-[10px] font-stats text-muted-foreground uppercase tracking-widest">{item.label}</dt>
                        <dd className="text-xs font-stats text-foreground">{item.value}</dd>
                      </div>
                    ))}
                  </dl>
                </SectionCard>

                <SectionCard title="Opportunity Signals" icon={Flame}>
                  <div className="space-y-2.5">
                    {[
                      { label: "No website",       active: !lead.has_website,          color: "text-red-400"     },
                      { label: "Low review count", active: lead.review_count < 20,     color: "text-amber-400"   },
                      { label: "High rating",      active: lead.rating >= 4.0,         color: "text-emerald-400" },
                      { label: "Large city",       active: ["Delhi","Mumbai","Bangalore","Hyderabad","Chennai","Pune"].includes(lead.city || ""), color: "text-cyan-400" },
                      { label: "High score lead",  active: lead.score >= 65,           color: "text-primary"     },
                    ].map((sig) => (
                      <div key={sig.label} className={`flex items-center gap-2 text-xs ${sig.active ? sig.color : "text-muted-foreground opacity-40"}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${sig.active ? "bg-current" : "bg-muted"}`} />
                        {sig.label}
                        {sig.active && <Check className="w-3 h-3 ml-auto" />}
                      </div>
                    ))}
                  </div>
                </SectionCard>

                <SectionCard title="Open Tasks" icon={CheckCircle2}
                  action={<button onClick={() => setActiveTab("tasks")} className="text-[10px] font-stats text-primary hover:underline flex items-center gap-0.5">View all <ChevronRight className="w-3 h-3" /></button>}>
                  {tasks.filter((t) => !t.is_done).length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-3">No open tasks</p>
                  ) : (
                    <div className="space-y-2">
                      {tasks.filter((t) => !t.is_done).slice(0, 3).map((t) => (
                        <div key={t.id} className="flex items-center gap-2">
                          <button onClick={() => toggleTask(t)} className="w-3.5 h-3.5 rounded-full border border-border hover:border-primary transition-colors shrink-0" />
                          <span className="text-xs text-foreground truncate flex-1">{t.title}</span>
                          <span className={`text-[9px] font-stats px-1.5 py-0.5 rounded border ${PRIORITY_COLORS[t.priority] ?? ""}`}>{t.priority}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </SectionCard>

                <SectionCard title="Outreach History" icon={Activity}
                  action={<button onClick={() => setActiveTab("outreach")} className="text-[10px] font-stats text-primary hover:underline flex items-center gap-0.5">View all <ChevronRight className="w-3 h-3" /></button>}>
                  {outreach.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-3">No outreach logged</p>
                  ) : (
                    <div className="space-y-2">
                      {outreach.slice(0, 3).map((o) => (
                        <div key={o.id} className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[10px] font-stats text-primary">{o.contact_mode}</p>
                            <p className="text-xs text-muted-foreground truncate">{o.subject || o.message}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </SectionCard>
              </div>
            </motion.div>
          )}

          {/* TASKS TAB */}
          {activeTab === "tasks" && (
            <motion.div key="tasks" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="max-w-2xl space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground font-stats">{doneTasks}/{tasks.length} tasks complete</p>
                <button onClick={() => setShowTaskForm(!showTaskForm)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-heading font-semibold text-primary-foreground hover:opacity-90 transition-all"
                  style={{ background: "var(--gradient-primary)" }}>
                  <Plus className="w-3.5 h-3.5" /> Add Task
                </button>
              </div>

              <AnimatePresence>
                {showTaskForm && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <div className="glass rounded-xl p-4 space-y-3 border border-primary/20">
                      <input autoFocus type="text" placeholder="Task title..."
                        value={taskInput.title}
                        onChange={(e) => setTaskInput((p) => ({ ...p, title: e.target.value }))}
                        onKeyDown={(e) => e.key === "Enter" && addTask()}
                        className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                      <div className="flex gap-2">
                        <input type="date" value={taskInput.due_date}
                          onChange={(e) => setTaskInput((p) => ({ ...p, due_date: e.target.value }))}
                          className="flex-1 px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                        <select value={taskInput.priority}
                          onChange={(e) => setTaskInput((p) => ({ ...p, priority: e.target.value }))}
                          className="px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                          <option>High</option><option>Medium</option><option>Low</option>
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setShowTaskForm(false)} className="flex-1 py-2 rounded-lg border border-border text-xs text-muted-foreground">Cancel</button>
                        <button onClick={addTask} disabled={savingTask}
                          className="flex-1 py-2 rounded-lg text-xs font-heading font-semibold text-primary-foreground disabled:opacity-40 flex items-center justify-center gap-1.5"
                          style={{ background: "var(--gradient-primary)" }}>
                          {savingTask ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Check className="w-3 h-3" /> Add Task</>}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-2">
                {tasks.length === 0 ? (
                  <div className="glass rounded-xl p-8 text-center">
                    <CheckCircle2 className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-30" />
                    <p className="text-sm text-muted-foreground">No tasks yet</p>
                  </div>
                ) : (
                  [...tasks].sort((a, b) => Number(a.is_done) - Number(b.is_done)).map((task) => (
                    <motion.div key={task.id} layout
                      className={`glass rounded-xl p-4 flex items-center gap-3 group transition-all ${task.is_done ? "opacity-50" : ""}`}>
                      <button onClick={() => toggleTask(task)}
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${task.is_done ? "bg-success border-success" : "border-border hover:border-primary"}`}>
                        {task.is_done && <Check className="w-3 h-3 text-background" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${task.is_done ? "line-through text-muted-foreground" : "text-foreground"}`}>{task.title}</p>
                        {task.due_date && (
                          <p className="text-[10px] font-stats text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Calendar className="w-3 h-3" />{new Date(task.due_date).toLocaleDateString("en-IN")}
                          </p>
                        )}
                      </div>
                      <span className={`text-[10px] font-stats px-2 py-0.5 rounded border ${PRIORITY_COLORS[task.priority] ?? ""}`}>{task.priority}</span>
                      <button onClick={() => deleteTask(task.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 transition-all">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {/* OUTREACH TAB */}
          {activeTab === "outreach" && (
            <motion.div key="outreach" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="max-w-2xl space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground font-stats">{outreach.length} interactions logged</p>
                <button onClick={() => setShowOutreachForm(!showOutreachForm)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-heading font-semibold text-primary-foreground hover:opacity-90 transition-all"
                  style={{ background: "var(--gradient-primary)" }}>
                  <Plus className="w-3.5 h-3.5" /> Log Outreach
                </button>
              </div>

              <AnimatePresence>
                {showOutreachForm && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <div className="glass rounded-xl p-4 space-y-3 border border-primary/20">
                      <select value={outreachInput.contact_mode}
                        onChange={(e) => setOutreachInput((p) => ({ ...p, contact_mode: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                        {["Call","Email","WhatsApp","LinkedIn","Other"].map((m) => <option key={m}>{m}</option>)}
                      </select>
                      <input type="text" placeholder="Subject / what happened..."
                        value={outreachInput.subject}
                        onChange={(e) => setOutreachInput((p) => ({ ...p, subject: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                      <textarea placeholder="Message or notes from this interaction..." rows={3}
                        value={outreachInput.message}
                        onChange={(e) => setOutreachInput((p) => ({ ...p, message: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
                      <div className="flex gap-2">
                        <button onClick={() => setShowOutreachForm(false)} className="flex-1 py-2 rounded-lg border border-border text-xs text-muted-foreground">Cancel</button>
                        <button onClick={addOutreach} disabled={savingOutreach}
                          className="flex-1 py-2 rounded-lg text-xs font-heading font-semibold text-primary-foreground disabled:opacity-40 flex items-center justify-center gap-1.5"
                          style={{ background: "var(--gradient-primary)" }}>
                          {savingOutreach ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Send className="w-3 h-3" /> Log It</>}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {outreach.length === 0 ? (
                <div className="glass rounded-xl p-8 text-center">
                  <Activity className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-30" />
                  <p className="text-sm text-muted-foreground">No outreach logged yet</p>
                </div>
              ) : (
                <div className="relative space-y-3 pl-4">
                  <div className="absolute left-0 top-2 bottom-2 w-px bg-border/50" />
                  {outreach.map((o, i) => (
                    <motion.div key={o.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                      className="relative glass rounded-xl p-4">
                      <div className="absolute -left-[17px] top-4 w-3 h-3 rounded-full bg-primary border-2 border-background" />
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-stats text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">{o.contact_mode}</span>
                        <span className="text-[10px] font-stats text-muted-foreground">
                          {new Date(o.contacted_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-foreground">{o.subject}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">{o.message}</p>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* NOTES TAB */}
          {activeTab === "notes" && (
            <motion.div key="notes" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="max-w-2xl space-y-4">
              <div className="glass rounded-xl p-4 space-y-3">
                <textarea placeholder={`Add a note about ${lead.business_name}...`}
                  rows={3} value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
                <button onClick={addNote} disabled={savingNote || !noteInput.trim()}
                  className="px-4 py-2 rounded-lg text-xs font-heading font-semibold text-primary-foreground disabled:opacity-40 flex items-center gap-1.5 hover:opacity-90 transition-all"
                  style={{ background: "var(--gradient-primary)" }}>
                  {savingNote ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Plus className="w-3 h-3" /> Add Note</>}
                </button>
              </div>

              {notes.length === 0 ? (
                <div className="glass rounded-xl p-8 text-center">
                  <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-30" />
                  <p className="text-sm text-muted-foreground">No notes yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {notes.map((note, i) => (
                    <motion.div key={note.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                      className="glass rounded-xl p-4 group">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm text-foreground leading-relaxed flex-1">{note.note}</p>
                        <button onClick={() => deleteNote(note.id)}
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 transition-all shrink-0">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-[10px] font-stats text-muted-foreground mt-2">
                        {new Date(note.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}