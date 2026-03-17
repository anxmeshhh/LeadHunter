import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, Download, Eye, Clock, IndianRupee,
  CheckCircle2, XCircle, Send, Plus, Sparkles,
  Loader2, RefreshCw, X, Search, Trash2,
  Edit3, Save, AlertCircle, Zap, Check,
  ArrowRight, ChevronRight, Receipt, ExternalLink,
  Copy, Shield,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { generateProposalPDF } from "../lib/generateProposalPDF";


// ─── Types ────────────────────────────────────────────────────────────────────
type ProposalStatus = "Draft" | "Sent" | "Viewed" | "Accepted" | "Rejected";

interface ServiceLine {
  name: string;
  price: number;
  description?: string;
}

interface Proposal {
  id: string;
  lead_id: string;
  title: string;
  services: ServiceLine[];
  total_amount: number;
  timeline: string;
  scope_of_work: string;
  deliverables: string[];
  status: ProposalStatus;
  ai_generated: boolean;
  created_at: string;
  updated_at: string;
  lead_name?: string;
  lead_city?: string;
  lead_category?: string;
  // GST fields
  gst_enabled?: boolean;
  gst_number?: string;
  gst_amount?: number;
  total_with_gst?: number;
  // E-sign fields
  signed_by?: string;
  signed_at?: string;
}

interface Lead {
  id: string;
  business_name: string;
  city: string;
  category: string;
  website?: string;
  ai_opportunities?: string[];
  ai_pitch?: string;
  score?: number;
  status?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const GST_RATE = 0.18;

const STATUS_CONFIG: Record<ProposalStatus, {
  label: string; icon: any; color: string; dot: string; next: ProposalStatus;
}> = {
  Draft:    { label: "Draft",    icon: FileText,     color: "text-slate-400 bg-slate-500/10 border-slate-500/30",      dot: "bg-slate-400",   next: "Sent"     },
  Sent:     { label: "Sent",     icon: Send,         color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30",          dot: "bg-cyan-400",    next: "Viewed"   },
  Viewed:   { label: "Viewed",   icon: Eye,          color: "text-violet-400 bg-violet-500/10 border-violet-500/30",    dot: "bg-violet-400",  next: "Accepted" },
  Accepted: { label: "Accepted", icon: CheckCircle2, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30", dot: "bg-emerald-400", next: "Draft"    },
  Rejected: { label: "Rejected", icon: XCircle,      color: "text-red-400 bg-red-500/10 border-red-500/30",             dot: "bg-red-400",     next: "Draft"    },
};

const ALL_STATUSES: ProposalStatus[] = ["Draft", "Sent", "Viewed", "Accepted", "Rejected"];
const LEAD_STATUS_ON_CREATE       = "Proposal Sent";
const LEAD_STATUS_ON_ACCEPT       = "Closed Won";
const LEAD_STAGES_BEFORE_PROPOSAL = ["New Lead", "Contacted", "Replied", "Interested"];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatAmount(n: number): string {
  if (!n || n === 0) return "—";
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000)   return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n.toLocaleString("en-IN")}`;
}

function formatAmountFull(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}

function daysAgo(iso: string): string {
  if (!iso) return "—";
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d === 0) return "today";
  if (d === 1) return "yesterday";
  return `${d}d ago`;
}

// ─── GST Summary Component ────────────────────────────────────────────────────
function GSTSummary({
  subtotal, gstEnabled, gstNumber, onChange,
}: {
  subtotal: number;
  gstEnabled: boolean;
  gstNumber: string;
  onChange: (enabled: boolean, number: string) => void;
}) {
  const gstAmount   = gstEnabled ? Math.round(subtotal * GST_RATE) : 0;
  const totalWithGST = subtotal + gstAmount;

  return (
    <div className="rounded-xl border border-border bg-muted/30 overflow-hidden">
      {/* Toggle header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Receipt className="w-4 h-4 text-primary" />
          <span className="text-sm font-heading font-semibold text-foreground">GST</span>
          <span className="text-[10px] font-stats text-muted-foreground bg-muted px-1.5 py-0.5 rounded">18%</span>
        </div>
        <button
          onClick={() => onChange(!gstEnabled, gstNumber)}
          className={`w-10 h-6 rounded-full relative transition-colors ${
            gstEnabled ? "bg-primary" : "bg-muted border border-border"
          }`}
        >
          <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${
            gstEnabled ? "left-5" : "left-1"
          }`} />
        </button>
      </div>

      {/* Breakdown */}
      <div className="px-4 py-3 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground font-stats">Subtotal</span>
          <span className="text-foreground font-stats font-semibold">{formatAmountFull(subtotal)}</span>
        </div>
        {gstEnabled && (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground font-stats">GST (18%)</span>
              <span className="text-amber-400 font-stats font-semibold">+ {formatAmountFull(gstAmount)}</span>
            </div>
            <div className="h-px bg-border/50" />
            <div className="flex items-center justify-between">
              <span className="text-sm font-heading font-bold text-foreground">Total (incl. GST)</span>
              <span className="text-lg font-stats font-bold text-primary">{formatAmountFull(totalWithGST)}</span>
            </div>
            {/* GST Number field */}
            <div className="pt-1">
              <input
                type="text"
                placeholder="Your GST Number (optional) e.g. 29ABCDE1234F1Z5"
                value={gstNumber}
                onChange={(e) => onChange(gstEnabled, e.target.value.toUpperCase())}
                className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary font-stats"
                maxLength={15}
              />
            </div>
          </>
        )}
        {!gstEnabled && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-heading font-bold text-foreground">Total</span>
            <span className="text-lg font-stats font-bold text-primary">{formatAmountFull(subtotal)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── E-Sign View (shareable page) ────────────────────────────────────────────
function ESignView({ proposal, onSigned }: { proposal: Proposal; onSigned: () => void }) {
  const [checked,  setChecked]  = useState(false);
  const [name,     setName]     = useState("");
  const [signing,  setSigning]  = useState(false);
  const [done,     setDone]     = useState(!!proposal.signed_at);

  const subtotal    = proposal.total_amount ?? 0;
  const gstAmount   = proposal.gst_enabled ? Math.round(subtotal * GST_RATE) : 0;
  const totalFinal  = subtotal + gstAmount;

  async function handleSign() {
    if (!checked || !name.trim()) return;
    setSigning(true);
    await supabase.from("proposals").update({
      signed_by: name.trim(),
      signed_at: new Date().toISOString(),
      status:    "Accepted",
    }).eq("id", proposal.id);

    // Advance lead to Closed Won
    await supabase.from("leads")
      .update({ status: LEAD_STATUS_ON_ACCEPT })
      .eq("id", proposal.lead_id)
      .neq("status", LEAD_STATUS_ON_ACCEPT);

    setDone(true);
    setSigning(false);
    onSigned();
  }

  if (done) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="glass rounded-2xl p-8 text-center space-y-4 border border-emerald-500/20">
        <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-8 h-8 text-emerald-400" />
        </div>
        <h3 className="text-xl font-heading font-bold text-foreground">Proposal Accepted!</h3>
        <p className="text-sm text-muted-foreground">
          Signed by <span className="text-foreground font-medium">{proposal.signed_by}</span>
          {proposal.signed_at && (
            <> on {new Date(proposal.signed_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</>
          )}
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-stats">
          <Shield className="w-3.5 h-3.5" /> Digitally accepted · LeadHunter CRM
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl overflow-hidden border border-primary/10">

      {/* Proposal header */}
      <div className="px-6 py-5 border-b border-border/40"
        style={{ background: "linear-gradient(135deg, hsl(215,30%,8%) 0%, hsl(215,25%,11%) 100%)" }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-stats text-primary uppercase tracking-widest mb-1">Proposal</p>
            <h2 className="text-xl font-heading font-bold text-foreground">{proposal.title}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {proposal.lead_name} · {proposal.lead_city}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-stats font-bold text-primary">{formatAmountFull(totalFinal)}</p>
            {proposal.gst_enabled && (
              <p className="text-[10px] font-stats text-muted-foreground">incl. 18% GST</p>
            )}
            {proposal.timeline && (
              <p className="text-xs font-stats text-muted-foreground mt-1 flex items-center justify-end gap-1">
                <Clock className="w-3 h-3" /> {proposal.timeline}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* Scope */}
        {proposal.scope_of_work && (
          <div>
            <p className="text-[10px] font-stats text-muted-foreground uppercase tracking-widest mb-2">Scope of Work</p>
            <p className="text-sm text-foreground leading-relaxed">{proposal.scope_of_work}</p>
          </div>
        )}

        {/* Services */}
        {proposal.services?.length > 0 && (
          <div>
            <p className="text-[10px] font-stats text-muted-foreground uppercase tracking-widest mb-2">Services</p>
            <div className="space-y-1.5">
              {proposal.services.map((sv, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/40">
                  <div>
                    <p className="text-sm text-foreground">{sv.name}</p>
                    {sv.description && <p className="text-[10px] text-muted-foreground">{sv.description}</p>}
                  </div>
                  <span className="text-sm font-stats font-semibold text-primary shrink-0">{formatAmountFull(sv.price)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Deliverables */}
        {proposal.deliverables?.length > 0 && (
          <div>
            <p className="text-[10px] font-stats text-muted-foreground uppercase tracking-widest mb-2">Deliverables</p>
            <div className="flex flex-wrap gap-1.5">
              {proposal.deliverables.map((d, i) => (
                <span key={i} className="text-[10px] font-stats px-2.5 py-1 rounded-full bg-emerald-500/5 border border-emerald-500/20 text-emerald-400 flex items-center gap-1">
                  <Check className="w-2.5 h-2.5" /> {d}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* GST breakdown */}
        <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground font-stats">Subtotal</span>
            <span className="text-foreground font-stats">{formatAmountFull(subtotal)}</span>
          </div>
          {proposal.gst_enabled && (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground font-stats flex items-center gap-1">
                  <Receipt className="w-3 h-3" /> GST (18%)
                  {proposal.gst_number && <span className="text-[10px] text-muted-foreground/60 ml-1">· {proposal.gst_number}</span>}
                </span>
                <span className="text-amber-400 font-stats">+ {formatAmountFull(gstAmount)}</span>
              </div>
              <div className="h-px bg-border/50" />
            </>
          )}
          <div className="flex items-center justify-between">
            <span className="font-heading font-bold text-foreground">Total Payable</span>
            <span className="text-xl font-stats font-bold text-primary">{formatAmountFull(totalFinal)}</span>
          </div>
        </div>

        {/* E-Sign section */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            <p className="text-sm font-heading font-semibold text-foreground">Digital Acceptance</p>
          </div>
          <input
            type="text"
            placeholder="Your full name to accept this proposal..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <label className="flex items-start gap-3 cursor-pointer group">
            <div
              onClick={() => setChecked(!checked)}
              className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                checked ? "bg-primary border-primary" : "border-border group-hover:border-primary/50"
              }`}
            >
              {checked && <Check className="w-3 h-3 text-primary-foreground" />}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              I, <span className="text-foreground font-medium">{name || "___________"}</span>, confirm that I have read and agree to the terms of this proposal. This constitutes a digital acceptance of the work described above for a total of{" "}
              <span className="text-primary font-stats font-semibold">{formatAmountFull(totalFinal)}</span>
              {proposal.gst_enabled ? " (including 18% GST)." : "."}
            </p>
          </label>
          <button
            onClick={handleSign}
            disabled={!checked || !name.trim() || signing}
            className="w-full py-3 rounded-xl font-heading font-semibold text-sm text-primary-foreground disabled:opacity-40 flex items-center justify-center gap-2 transition-all hover:opacity-90"
            style={{ background: "var(--gradient-primary)" }}
          >
            {signing
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
              : <><CheckCircle2 className="w-4 h-4" /> Accept & Sign Proposal</>}
          </button>
          <p className="text-[10px] font-stats text-muted-foreground text-center">
            Secured by LeadHunter CRM · {new Date().toLocaleDateString("en-IN")}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

// ─── AI Proposal Generator ────────────────────────────────────────────────────
async function generateProposalAI(lead: Lead): Promise<Partial<Proposal>> {
  const groqKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!groqKey) {
    return {
      title: `Digital Growth Package for ${lead.business_name}`,
      services: [
        { name: "Website Design & Development", price: 45000, description: "Modern responsive website" },
        { name: "SEO Optimization",             price: 15000, description: "On-page + technical SEO"   },
        { name: "WhatsApp Integration",         price: 8000,  description: "Lead capture automation"   },
        { name: "3 Months Support",             price: 12000, description: "Bug fixes + updates"       },
      ],
      total_amount: 80000, timeline: "4–6 weeks",
      scope_of_work: `Complete digital transformation for ${lead.business_name} in ${lead.city}.`,
      deliverables: ["Responsive 5-page website", "SEO audit report", "WhatsApp chat integration", "Admin training session", "30-day bug warranty"],
      ai_generated: true,
    };
  }

  const prompt = `You are a freelance web developer creating a business proposal for an Indian client. Respond with ONLY valid JSON — no markdown, no explanation.

Client: ${lead.business_name} | Industry: ${lead.category} | City: ${lead.city}
Website: ${lead.website || "none/outdated"} | Score: ${lead.score ?? 60}/100
Opportunities: ${(lead.ai_opportunities ?? []).join(", ") || "needs digital presence"}

JSON structure:
{
  "title": "specific proposal title",
  "services": [
    {"name": "service", "price": 45000, "description": "one-line"},
    {"name": "service", "price": 15000, "description": "one-line"},
    {"name": "service", "price": 8000,  "description": "one-line"},
    {"name": "service", "price": 12000, "description": "one-line"}
  ],
  "total_amount": 80000,
  "timeline": "4-6 weeks",
  "scope_of_work": "2-3 sentence summary",
  "deliverables": ["item 1", "item 2", "item 3", "item 4", "item 5"]
}

Rules: Prices in INR numbers only. Total ₹20K–₹3L. 3–5 services specific to this industry.`;

  try {
    const res  = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${groqKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "llama-3.3-70b-versatile", messages: [{ role: "user", content: prompt }], max_tokens: 700, temperature: 0.5 }),
    });
    const data  = await res.json();
    const raw   = data.choices?.[0]?.message?.content ?? "";
    const clean = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    const total  = (parsed.services ?? []).reduce((s: number, sv: ServiceLine) => s + (sv.price ?? 0), 0);
    return { ...parsed, total_amount: total || parsed.total_amount, ai_generated: true };
  } catch {
    return { title: `Growth Package for ${lead.business_name}`, services: [{ name: "Web Development & SEO", price: 55000, description: "Full website + SEO" }], total_amount: 55000, timeline: "4–5 weeks", scope_of_work: "Custom web development.", deliverables: ["Responsive website", "SEO setup", "Source code"], ai_generated: true };
  }
}

// ─── Lead Selector ────────────────────────────────────────────────────────────
function LeadSelector({ leads, selectedId, onChange, readOnly = false }: {
  leads: Lead[]; selectedId: string; onChange: (id: string) => void; readOnly?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [open,   setOpen]   = useState(!selectedId);
  const selected            = leads.find((l) => l.id === selectedId);
  const filtered            = leads.filter((l) => search === "" || l.business_name.toLowerCase().includes(search.toLowerCase())).slice(0, 8);

  if (readOnly && selected) {
    return (
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-muted border border-border text-sm text-foreground">
        <span className="font-medium">{selected.business_name}</span>
        <span className="text-muted-foreground">· {selected.city} · {selected.category}</span>
      </div>
    );
  }

  return (
    <div>
      {selectedId && !open ? (
        <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-primary/10 border border-primary/30">
          <div className="flex items-center gap-2">
            <Check className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="text-sm text-primary font-medium">{selected?.business_name}</span>
            <span className="text-xs text-muted-foreground">· {selected?.city}</span>
          </div>
          <button onClick={() => { onChange(""); setSearch(""); setOpen(true); }} className="text-muted-foreground hover:text-foreground">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="space-y-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input autoFocus={open} placeholder="Search leads..." value={search}
              onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
              onFocus={() => setOpen(true)}
              className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <AnimatePresence>
            {open && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                className="rounded-xl border border-border bg-muted/95 backdrop-blur overflow-hidden shadow-xl max-h-48 overflow-y-auto">
                {filtered.length === 0 && <p className="px-3 py-3 text-xs text-muted-foreground text-center">No leads found</p>}
                {filtered.map((l) => (
                  <button key={l.id} onClick={() => { onChange(l.id); setSearch(""); setOpen(false); }}
                    className="w-full text-left px-3 py-2.5 text-sm transition-colors hover:bg-muted border-b border-border/30 last:border-0 flex items-center justify-between group">
                    <span className="text-foreground group-hover:text-primary">{l.business_name}</span>
                    <span className="text-[10px] font-stats text-muted-foreground">{l.city} · {l.category}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

// ─── Proposal Modal ───────────────────────────────────────────────────────────
function ProposalModal({ proposal, leads, onClose, onSaved }: {
  proposal?: Partial<Proposal>; leads: Lead[]; onClose: () => void; onSaved: () => void;
}) {
  const isEdit = !!proposal?.id;

  const [form, setForm] = useState<Partial<Proposal>>(() => ({
    lead_id:       proposal?.lead_id       ?? "",
    title:         proposal?.title         ?? "",
    services:      proposal?.services      ?? [],
    total_amount:  proposal?.total_amount  ?? 0,
    timeline:      proposal?.timeline      ?? "",
    scope_of_work: proposal?.scope_of_work ?? "",
    deliverables:  proposal?.deliverables  ?? [],
    status:        proposal?.status        ?? "Draft",
    ai_generated:  proposal?.ai_generated  ?? false,
    gst_enabled:   proposal?.gst_enabled   ?? false,
    gst_number:    proposal?.gst_number    ?? "",
  }));

  const [generating,   setGenerating]   = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [saveError,    setSaveError]    = useState<string | null>(null);
  const [newSvcName,   setNewSvcName]   = useState("");
  const [newSvcPrice,  setNewSvcPrice]  = useState("");
  const [newSvcDesc,   setNewSvcDesc]   = useState("");
  const [newDel,       setNewDel]       = useState("");

  const selectedLead = leads.find((l) => l.id === form.lead_id);
  const subtotal     = (form.services ?? []).reduce((s, sv) => s + (sv.price || 0), 0);
  const gstAmount    = form.gst_enabled ? Math.round(subtotal * GST_RATE) : 0;
  const totalFinal   = subtotal + gstAmount;

  useEffect(() => {
    setForm((p) => ({ ...p, total_amount: subtotal, gst_amount: gstAmount, total_with_gst: totalFinal }));
  }, [subtotal, gstAmount, totalFinal]);

  async function handleAIGenerate() {
    if (!selectedLead) return;
    setGenerating(true);
    const generated = await generateProposalAI(selectedLead);
    setForm((prev) => ({ ...prev, ...generated, lead_id: prev.lead_id, status: prev.status, gst_enabled: prev.gst_enabled, gst_number: prev.gst_number }));
    setGenerating(false);
  }

  function addService() {
    if (!newSvcName.trim()) return;
    setForm((p) => ({ ...p, services: [...(p.services ?? []), { name: newSvcName.trim(), price: Number(newSvcPrice) || 0, description: newSvcDesc.trim() || undefined }] }));
    setNewSvcName(""); setNewSvcPrice(""); setNewSvcDesc("");
  }

  function addDeliverable() {
    if (!newDel.trim()) return;
    setForm((p) => ({ ...p, deliverables: [...(p.deliverables ?? []), newDel.trim()] }));
    setNewDel("");
  }

  async function handleSave() {
    if (!form.lead_id || !form.title?.trim()) { setSaveError("Please select a lead and enter a title."); return; }
    setSaving(true); setSaveError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const payload = {
        lead_id: form.lead_id, title: form.title!.trim(),
        services: form.services ?? [], total_amount: subtotal,
        timeline: form.timeline ?? "", scope_of_work: form.scope_of_work ?? "",
        deliverables: form.deliverables ?? [], status: form.status ?? "Draft",
        ai_generated: form.ai_generated ?? false, user_id: user.id,
        gst_enabled: form.gst_enabled ?? false, gst_number: form.gst_number ?? "",
        gst_amount: gstAmount, total_with_gst: totalFinal,
      };

      if (isEdit) {
        const { error } = await supabase.from("proposals").update(payload).eq("id", proposal!.id!).eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("proposals").insert(payload);
        if (error) throw error;
        await supabase.from("leads").update({ status: LEAD_STATUS_ON_CREATE }).eq("id", form.lead_id).eq("user_id", user.id).in("status", LEAD_STAGES_BEFORE_PROPOSAL);
      }

      if (form.status === "Accepted") {
        await supabase.from("leads").update({ status: LEAD_STATUS_ON_ACCEPT }).eq("id", form.lead_id).eq("user_id", user.id).neq("status", LEAD_STATUS_ON_ACCEPT);
      }

      onSaved(); onClose();
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      onClick={onClose}>
      <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }}
        className="glass rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><FileText className="w-4 h-4 text-primary" /></div>
            <div>
              <h2 className="font-heading text-base font-bold text-foreground">{isEdit ? "Edit Proposal" : "New Proposal"}</h2>
              {form.ai_generated && <p className="text-[10px] font-stats text-primary flex items-center gap-1 mt-0.5"><Sparkles className="w-2.5 h-2.5" /> AI Generated</p>}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5
          [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:transparent
          [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">

          <div>
            <label className="text-[10px] font-stats text-muted-foreground uppercase tracking-widest mb-1.5 block">Client Lead <span className="text-red-400">*</span></label>
            <LeadSelector leads={leads} selectedId={form.lead_id ?? ""} readOnly={isEdit} onChange={(id) => setForm((p) => ({ ...p, lead_id: id }))} />
          </div>

          {form.lead_id && (
            <motion.button initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              onClick={handleAIGenerate} disabled={generating}
              className="w-full py-3 rounded-xl border border-primary/40 bg-primary/5 text-primary text-sm font-stats flex items-center justify-center gap-2 hover:bg-primary/10 transition-all disabled:opacity-50">
              {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> AI generating...</> : <><Sparkles className="w-4 h-4" /> Auto-fill with AI · {selectedLead?.business_name}</>}
            </motion.button>
          )}

          <div>
            <label className="text-[10px] font-stats text-muted-foreground uppercase tracking-widest mb-1.5 block">Title <span className="text-red-400">*</span></label>
            <input type="text" placeholder="e.g. Complete Website Redesign & SEO Package"
              value={form.title ?? ""} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-stats text-muted-foreground uppercase tracking-widest mb-1.5 block">Timeline</label>
              <input type="text" placeholder="e.g. 4–6 weeks" value={form.timeline ?? ""}
                onChange={(e) => setForm((p) => ({ ...p, timeline: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="text-[10px] font-stats text-muted-foreground uppercase tracking-widest mb-1.5 block">Status</label>
              <select value={form.status ?? "Draft"} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as ProposalStatus }))}
                className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                {ALL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-stats text-muted-foreground uppercase tracking-widest mb-1.5 block">Scope of Work</label>
            <textarea rows={3} placeholder="Overview of what will be delivered..."
              value={form.scope_of_work ?? ""} onChange={(e) => setForm((p) => ({ ...p, scope_of_work: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none leading-relaxed" />
          </div>

          {/* Services */}
          <div>
            <label className="text-[10px] font-stats text-muted-foreground uppercase tracking-widest mb-1.5 block">Services & Pricing</label>
            {(form.services ?? []).length > 0 && (
              <div className="space-y-1.5 mb-3">
                {(form.services ?? []).map((sv, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/60 border border-border group">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">{sv.name}</p>
                      {sv.description && <p className="text-[10px] text-muted-foreground">{sv.description}</p>}
                    </div>
                    <span className="text-sm font-stats font-semibold text-primary shrink-0">{formatAmount(sv.price)}</span>
                    <button onClick={() => setForm((p) => ({ ...p, services: (p.services ?? []).filter((_, j) => j !== i) }))}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 transition-all shrink-0">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input placeholder="Service name" value={newSvcName} onChange={(e) => setNewSvcName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addService()}
                className="flex-1 px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
              <input placeholder="₹ Price" type="number" value={newSvcPrice} onChange={(e) => setNewSvcPrice(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addService()}
                className="w-28 px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
              <button onClick={addService} className="px-3 py-2 rounded-lg bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 transition-colors font-stats text-xs whitespace-nowrap">+ Add</button>
            </div>
          </div>

          {/* Deliverables */}
          <div>
            <label className="text-[10px] font-stats text-muted-foreground uppercase tracking-widest mb-1.5 block">Deliverables</label>
            {(form.deliverables ?? []).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {(form.deliverables ?? []).map((d, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/5 border border-emerald-500/20 text-xs text-emerald-400">
                    <Check className="w-2.5 h-2.5" /> {d}
                    <button onClick={() => setForm((p) => ({ ...p, deliverables: (p.deliverables ?? []).filter((_, j) => j !== i) }))} className="text-emerald-400/50 hover:text-red-400 transition-colors"><X className="w-2.5 h-2.5" /></button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input placeholder="Add deliverable (press Enter)..." value={newDel} onChange={(e) => setNewDel(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addDeliverable()}
                className="flex-1 px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
              <button onClick={addDeliverable} className="px-3 py-2 rounded-lg bg-muted border border-border text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors font-stats text-xs whitespace-nowrap">+ Add</button>
            </div>
          </div>

          {/* ── GST SECTION ── */}
          {subtotal > 0 && (
            <GSTSummary
              subtotal={subtotal}
              gstEnabled={form.gst_enabled ?? false}
              gstNumber={form.gst_number ?? ""}
              onChange={(enabled, number) => setForm((p) => ({ ...p, gst_enabled: enabled, gst_number: number }))}
            />
          )}

          {!isEdit && form.lead_id && (
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs text-muted-foreground">
              <span className="text-primary font-stats font-medium">Pipeline sync: </span>
              Creating this proposal will advance{" "}
              <span className="text-foreground">{selectedLead?.business_name}</span> to{" "}
              <span className="text-primary font-stats">Proposal Sent</span>.
            </div>
          )}

          {saveError && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" /> {saveError}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 flex gap-3 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving || !form.lead_id || !form.title?.trim()}
            className="flex-1 py-2.5 rounded-xl text-sm font-heading font-semibold text-primary-foreground disabled:opacity-40 flex items-center justify-center gap-2 transition-all hover:opacity-90"
            style={{ background: "var(--gradient-primary)" }}>
            {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...</> : <><Save className="w-3.5 h-3.5" /> {isEdit ? "Update" : "Create & Sync"}</>}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Proposals Page ──────────────────────────────────────────────────────
export default function Proposals() {
  const navigate = useNavigate();

  const [proposals,    setProposals]    = useState<Proposal[]>([]);
  const [leads,        setLeads]        = useState<Lead[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [showModal,    setShowModal]    = useState(false);
  const [editTarget,   setEditTarget]   = useState<Partial<Proposal> | undefined>();
  const [deletingId,   setDeletingId]   = useState<string | null>(null);
  const [updatingId,   setUpdatingId]   = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<ProposalStatus | "All">("All");
  const [searchQuery,  setSearchQuery]  = useState("");
  const [eSignTarget,  setESignTarget]  = useState<Proposal | null>(null);
  const [copied,       setCopied]       = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const [{ data: pData, error: pErr }, { data: lData, error: lErr }] = await Promise.all([
        supabase.from("proposals").select("*, leads(business_name, city, category, status)").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("leads").select("id, business_name, city, category, website, ai_opportunities, ai_pitch, score, status").eq("user_id", user.id).order("score", { ascending: false }),
      ]);

      if (pErr) throw pErr;
      if (lErr) throw lErr;

      const mapped: Proposal[] = (pData ?? []).map((p: any) => {
        const lead = Array.isArray(p.leads) ? p.leads[0] : p.leads;
        return { ...p, services: p.services ?? [], deliverables: p.deliverables ?? [], lead_name: lead?.business_name, lead_city: lead?.city, lead_category: lead?.category };
      });

      setProposals(mapped);
      setLeads((lData ?? []) as Lead[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { if (session) fetchAll(); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => { if (session) fetchAll(); });
    return () => subscription.unsubscribe();
  }, [fetchAll]);

  async function handleStatusAdvance(proposal: Proposal) {
    const next = STATUS_CONFIG[proposal.status]?.next ?? "Draft";
    setUpdatingId(proposal.id);
    setProposals((prev) => prev.map((p) => p.id === proposal.id ? { ...p, status: next } : p));
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("proposals").update({ status: next }).eq("id", proposal.id).eq("user_id", user?.id);
    if (next === "Accepted") await supabase.from("leads").update({ status: LEAD_STATUS_ON_ACCEPT }).eq("id", proposal.lead_id).eq("user_id", user?.id).neq("status", LEAD_STATUS_ON_ACCEPT);
    setUpdatingId(null);
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    setProposals((prev) => prev.filter((p) => p.id !== id));
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("proposals").delete().eq("id", id).eq("user_id", user?.id);
    setDeletingId(null);
  }

  async function handleCopy(p: Proposal) {
    const gstAmount  = p.gst_enabled ? Math.round((p.total_amount ?? 0) * GST_RATE) : 0;
    const totalFinal = (p.total_amount ?? 0) + gstAmount;
    const lines = [
      `PROPOSAL: ${p.title}`,
      `Client: ${p.lead_name} | ${p.lead_city}`,
      `Total: ${formatAmountFull(totalFinal)}${p.gst_enabled ? " (incl. 18% GST)" : ""} | Timeline: ${p.timeline}`,
      ``,
      `SCOPE: ${p.scope_of_work}`,
      ``,
      `SERVICES:`,
      ...(p.services ?? []).map((s) => `  • ${s.name}: ${formatAmountFull(s.price)}${s.description ? ` — ${s.description}` : ""}`),
      ``,
      `DELIVERABLES:`,
      ...(p.deliverables ?? []).map((d) => `  ✓ ${d}`),
      ``,
      p.gst_enabled ? `Subtotal: ${formatAmountFull(p.total_amount ?? 0)}\nGST (18%): ${formatAmountFull(gstAmount)}\nTotal Payable: ${formatAmountFull(totalFinal)}` : `Total: ${formatAmountFull(totalFinal)}`,
    ];
    await navigator.clipboard.writeText(lines.join("\n"));
    setCopied(p.id);
    setTimeout(() => setCopied(null), 2000);
  }

  const total      = proposals.length;
  const accepted   = proposals.filter((p) => p.status === "Accepted").length;
  const pending    = proposals.filter((p) => ["Sent", "Viewed"].includes(p.status)).length;
  const totalValue = proposals.filter((p) => p.status !== "Rejected").reduce((s, p) => {
    const gst = p.gst_enabled ? Math.round((p.total_amount ?? 0) * GST_RATE) : 0;
    return s + (p.total_amount ?? 0) + gst;
  }, 0);
  const winRate = total > 0 ? Math.round((accepted / total) * 100) : 0;

  const filtered = proposals.filter((p) => {
    const q = searchQuery.toLowerCase();
    const matchQ = (p.title ?? "").toLowerCase().includes(q) || (p.lead_name ?? "").toLowerCase().includes(q) || (p.lead_city ?? "").toLowerCase().includes(q);
    return matchQ && (filterStatus === "All" || p.status === filterStatus);
  });

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Proposals</h1>
          <p className="text-sm text-muted-foreground mt-1">
            AI-generated · GST-ready · e-sign ·{" "}
            <span className="font-stats text-primary">{total} proposals</span>
            {winRate > 0 && <> · <span className="font-stats text-emerald-400">{winRate}% win rate</span></>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchAll} disabled={loading} className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-primary transition-all">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-success/10 border border-success/20">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            <span className="text-[10px] font-stats text-success">LIVE</span>
          </div>
          <button onClick={() => { setEditTarget(undefined); setShowModal(true); }}
            className="px-5 py-2.5 rounded-lg font-heading font-semibold text-sm text-primary-foreground flex items-center gap-2 hover:opacity-90 transition-all"
            style={{ background: "var(--gradient-primary)" }}>
            <Plus className="w-4 h-4" /> New Proposal
          </button>
        </div>
      </motion.div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          <button onClick={fetchAll} className="ml-auto text-xs underline">Retry</button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Proposals",   value: loading ? "—" : total,                   icon: FileText,     color: "text-foreground"  },
          { label: "Accepted",           value: loading ? "—" : accepted,                icon: CheckCircle2, color: "text-emerald-400" },
          { label: "Awaiting Decision",  value: loading ? "—" : pending,                 icon: Clock,        color: "text-amber-400"   },
          { label: "Pipeline Value",     value: loading ? "—" : formatAmount(totalValue), icon: IndianRupee,  color: "text-primary"     },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="glass rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-stats text-muted-foreground uppercase tracking-widest">{s.label}</span>
              <s.icon className={`w-4 h-4 ${s.color}`} />
            </div>
            <span className="font-stats text-2xl font-bold text-foreground">{s.value}</span>
          </motion.div>
        ))}
      </div>

      {/* AI Banner */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        className="glass rounded-xl p-4 border border-primary/20 flex items-center gap-4 flex-wrap">
        <div className="p-2.5 rounded-lg bg-primary/10 shrink-0"><Sparkles className="w-5 h-5 text-primary" /></div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-heading font-semibold text-foreground">AI · GST-Ready · E-Sign</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            AI builds your proposal → toggle 18% GST → share with client for digital acceptance → deal auto-closes as{" "}
            <span className="text-emerald-400 font-stats">Closed Won</span>.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5">
            <Zap className="w-3 h-3 text-primary animate-pulse" />
            <span className="text-[10px] font-stats text-primary">Groq · Llama 3.3 70B</span>
          </div>
          <button onClick={() => { setEditTarget(undefined); setShowModal(true); }}
            className="px-4 py-2 rounded-lg text-sm font-heading font-semibold text-primary-foreground flex items-center gap-1.5 hover:opacity-90 transition-all"
            style={{ background: "var(--gradient-primary)" }}>
            Generate <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input placeholder="Search by title, client, city..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {(["All", ...ALL_STATUSES] as (ProposalStatus | "All")[]).map((s) => {
            const cfg   = s !== "All" ? STATUS_CONFIG[s] : null;
            const count = s !== "All" ? proposals.filter((p) => p.status === s).length : proposals.length;
            return (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={`px-3 py-2 rounded-lg text-xs font-stats border transition-all flex items-center gap-1.5 ${
                  filterStatus === s ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground bg-muted"
                }`}>
                {cfg && <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />}
                {s} <span className={`text-[10px] ${filterStatus === s ? "text-primary/70" : "text-muted-foreground"}`}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {loading && <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="h-40 rounded-xl bg-muted/50 animate-pulse" />)}</div>}

      {!loading && filtered.length === 0 && (
        <div className="glass rounded-xl p-16 text-center space-y-3">
          <FileText className="w-8 h-8 text-muted-foreground/30 mx-auto" />
          <p className="text-sm text-muted-foreground">{proposals.length === 0 ? "No proposals yet." : "No proposals match your filters."}</p>
          {proposals.length === 0 && (
            <button onClick={() => { setEditTarget(undefined); setShowModal(true); }}
              className="mt-1 px-5 py-2.5 rounded-lg text-sm font-heading font-semibold text-primary-foreground hover:opacity-90"
              style={{ background: "var(--gradient-primary)" }}>
              Create First Proposal
            </button>
          )}
        </div>
      )}

      {/* E-Sign modal */}
      <AnimatePresence>
        {eSignTarget && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
            onClick={() => setESignTarget(null)}>
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }}
              className="w-full max-w-xl max-h-[92vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-stats text-muted-foreground">Client Acceptance View</p>
                <button onClick={() => setESignTarget(null)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <ESignView
                proposal={eSignTarget}
                onSigned={() => { fetchAll(); setESignTarget(null); }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cards */}
      {!loading && filtered.length > 0 && (
        <div className="space-y-3">
          <AnimatePresence>
            {filtered.map((proposal, i) => {
              const st     = STATUS_CONFIG[proposal.status] ?? STATUS_CONFIG["Draft"];
              const StIcon = st.icon;
              const busy   = updatingId === proposal.id;
              const gstAmt = proposal.gst_enabled ? Math.round((proposal.total_amount ?? 0) * GST_RATE) : 0;
              const total  = (proposal.total_amount ?? 0) + gstAmt;
              const isSigned = !!proposal.signed_at;

              return (
                <motion.div key={proposal.id} layout
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }} transition={{ delay: i * 0.03 }}
                  className="glass rounded-xl p-5 hover:border-primary/20 transition-all group">

                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <h3 className="text-base font-heading font-semibold text-foreground">{proposal.title || "Untitled"}</h3>
                        {proposal.ai_generated && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-stats px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 shrink-0">
                            <Sparkles className="w-2.5 h-2.5" /> AI
                          </span>
                        )}
                        {proposal.gst_enabled && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-stats px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                            <Receipt className="w-2.5 h-2.5" /> GST
                          </span>
                        )}
                        {isSigned && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-stats px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                            <Shield className="w-2.5 h-2.5" /> Signed
                          </span>
                        )}
                        <button disabled={busy} onClick={() => handleStatusAdvance(proposal)}
                          className={`inline-flex items-center gap-1.5 text-[10px] font-stats px-2.5 py-1 rounded-full border transition-all hover:opacity-80 shrink-0 disabled:opacity-50 ${st.color}`}>
                          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <StIcon className="w-3 h-3" />}
                          {st.label}
                          {!busy && <span className="opacity-30">→ {st.next}</span>}
                        </button>
                      </div>
                      <button onClick={() => navigate(`/leads/${proposal.lead_id}`)}
                        className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
                        {proposal.lead_name}{proposal.lead_city && ` · ${proposal.lead_city}`}{proposal.lead_category && ` · ${proposal.lead_category}`}
                        <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                      {isSigned && (
                        <p className="text-[10px] font-stats text-emerald-400 mt-1 flex items-center gap-1">
                          <Shield className="w-3 h-3" /> Signed by {proposal.signed_by} · {daysAgo(proposal.signed_at!)}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-stats text-xl font-bold text-primary">{formatAmount(total)}</p>
                      {proposal.gst_enabled && (
                        <p className="text-[10px] font-stats text-amber-400">incl. GST</p>
                      )}
                      {proposal.timeline && (
                        <p className="text-[10px] font-stats text-muted-foreground mt-0.5 flex items-center justify-end gap-1">
                          <Clock className="w-2.5 h-2.5" /> {proposal.timeline}
                        </p>
                      )}
                    </div>
                  </div>

                  {proposal.services.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {proposal.services.map((sv, j) => (
                        <span key={j} className="inline-flex items-center gap-1.5 text-[10px] font-stats px-2 py-1 rounded-md bg-muted border border-border text-muted-foreground">
                          {sv.name} <span className="text-primary/70 font-semibold">{formatAmount(sv.price)}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  {proposal.scope_of_work && (
                    <p className="text-xs text-muted-foreground mb-3 line-clamp-2 leading-relaxed border-l-2 border-border/50 pl-3">{proposal.scope_of_work}</p>
                  )}

                  {proposal.deliverables.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {proposal.deliverables.map((d, j) => (
                        <span key={j} className="text-[10px] font-stats px-2 py-0.5 rounded-full bg-emerald-500/5 border border-emerald-500/20 text-emerald-400 flex items-center gap-1">
                          <Check className="w-2.5 h-2.5" /> {d}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-3 border-t border-border/30">
                    <span className="text-[10px] font-stats text-muted-foreground">
                      Created {daysAgo(proposal.created_at)}
                    </span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {/* E-Sign button */}
                      <button title="Open e-sign view" onClick={() => setESignTarget(proposal)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-stats bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-colors">
                        <Shield className="w-3 h-3" />
                        {isSigned ? "View Signed" : "E-Sign"}
                      </button>
                      <button title="Copy proposal text" onClick={() => handleCopy(proposal)}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors">
                        {copied === proposal.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                      <button
  title="Download PDF"
  onClick={() => generateProposalPDF(proposal)}
  className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
>
  <Download className="w-3.5 h-3.5" />
</button>
                      <button title="Open lead" onClick={() => navigate(`/leads/${proposal.lead_id}`)}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button title="Edit" onClick={() => { setEditTarget(proposal); setShowModal(true); }}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors">
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button title="Delete" disabled={deletingId === proposal.id} onClick={() => handleDelete(proposal.id)}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-red-400 transition-colors disabled:opacity-50">
                        {deletingId === proposal.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>
        {showModal && (
          <ProposalModal proposal={editTarget} leads={leads} onClose={() => { setShowModal(false); setEditTarget(undefined); }} onSaved={fetchAll} />
        )}
      </AnimatePresence>
    </div>
  );
}