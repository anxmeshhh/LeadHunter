import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Brain, X, Send, Loader2, RefreshCw,
  ChevronRight, Zap, User, Sparkles,
  AlertTriangle, Clock, Target, BarChart2,
  TrendingUp, MessageSquare, Plus,
} from "lucide-react";
import { supabase } from "../lib/supabase";

// ── Types ──────────────────────────────────────────────────────────────────────
interface Message {
  id:       string;
  role:     "user" | "assistant";
  content:  string;
  time:     Date;
  actions?: { label: string; route: string }[];
}

interface CRMContext {
  totalLeads:       number;
  activeLeads:      number;
  stuckLeads:       { name: string; status: string; days: number }[];
  coldDeals:        { name: string; status: string; value: number }[];
  outreachToday:    number;
  outreachWeek:     number;
  closedWonValue:   number;
  topCategory:      string;
  topCategoryCount: number;
  followUpCount:    number;
  replyRate:        number;
  pipeline:         { stage: string; count: number; value: number }[];
}

// ── Quick prompts ──────────────────────────────────────────────────────────────
const QUICK_PROMPTS = [
  { label: "What should I do today?",      icon: Target       },
  { label: "Which deals are at risk?",      icon: AlertTriangle},
  { label: "How's my pipeline looking?",   icon: BarChart2    },
  { label: "Who should I follow up with?", icon: MessageSquare},
  { label: "Give me my weekly summary",    icon: TrendingUp   },
  { label: "How can I close more deals?",  icon: Zap          },
];

// ── Fetch CRM context ──────────────────────────────────────────────────────────
async function fetchCRMContext(userId: string): Promise<CRMContext> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayISO    = todayStart.toISOString();
  const weekAgo     = new Date(Date.now() - 7  * 86400000).toISOString();
  const lastWeekAgo = new Date(Date.now() - 14 * 86400000).toISOString();

  const [
    { data: leads },
    { data: outreachToday },
    { data: outreachWeek },
    { data: allOutreach },
    { data: closedWon },
  ] = await Promise.all([
    supabase.from("leads").select("id, business_name, status, updated_at, category, deal_value, score").eq("user_id", userId),
    supabase.from("outreach_history").select("id").eq("user_id", userId).gte("contacted_at", todayISO),
    supabase.from("outreach_history").select("id, status").eq("user_id", userId).gte("contacted_at", weekAgo),
    supabase.from("outreach_history").select("lead_id, contacted_at, status").eq("user_id", userId).order("contacted_at", { ascending: false }),
    supabase.from("leads").select("deal_value").eq("user_id", userId).eq("status", "Closed Won"),
  ]);

  const outreachMap: Record<string, { last: string; count: number }> = {};
  (allOutreach ?? []).forEach((o: any) => {
    if (!outreachMap[o.lead_id]) outreachMap[o.lead_id] = { last: o.contacted_at, count: 0 };
    outreachMap[o.lead_id].count++;
  });

  const activeLeads = (leads ?? []).filter((l: any) => !["Closed Won", "Closed Lost"].includes(l.status));

  const stuckLeads = activeLeads
    .filter((l: any) => {
      const days = Math.floor((Date.now() - new Date(l.updated_at).getTime()) / 86400000);
      return days >= 7 && l.status !== "New Lead";
    })
    .map((l: any) => ({
      name:   l.business_name,
      status: l.status,
      days:   Math.floor((Date.now() - new Date(l.updated_at).getTime()) / 86400000),
    }))
    .sort((a: any, b: any) => b.days - a.days)
    .slice(0, 5);

  const coldDeals = activeLeads
    .filter((l: any) => {
      const info = outreachMap[l.id];
      const days = info ? Math.floor((Date.now() - new Date(info.last).getTime()) / 86400000) : 999;
      return days >= 7 && ["Interested", "Proposal Sent", "Negotiation"].includes(l.status);
    })
    .map((l: any) => ({ name: l.business_name, status: l.status, value: l.deal_value ?? 0 }))
    .slice(0, 5);

  const stageMap: Record<string, { count: number; value: number }> = {};
  (leads ?? []).forEach((l: any) => {
    if (!stageMap[l.status]) stageMap[l.status] = { count: 0, value: 0 };
    stageMap[l.status].count++;
    stageMap[l.status].value += l.deal_value ?? 0;
  });
  const pipeline = Object.entries(stageMap).map(([stage, data]) => ({ stage, ...data }));

  const catMap: Record<string, number> = {};
  (leads ?? []).forEach((l: any) => { if (l.category) catMap[l.category] = (catMap[l.category] ?? 0) + 1; });
  const topCat = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0] ?? ["General", 0];

  const followUpCount = activeLeads.filter((l: any) => {
    const info = outreachMap[l.id];
    if (!info) return true;
    return Math.floor((Date.now() - new Date(info.last).getTime()) / 86400000) >= 3;
  }).length;

  const replied     = (allOutreach ?? []).filter((o: any) => o.status === "Replied").length;
  const replyRate   = (allOutreach ?? []).length > 0 ? Math.round((replied / (allOutreach ?? []).length) * 100) : 0;
  const closedValue = (closedWon ?? []).reduce((s: number, l: any) => s + (l.deal_value ?? 0), 0);

  return {
    totalLeads:       (leads ?? []).length,
    activeLeads:      activeLeads.length,
    stuckLeads:       stuckLeads as any,
    coldDeals:        coldDeals as any,
    outreachToday:    (outreachToday ?? []).length,
    outreachWeek:     (outreachWeek ?? []).length,
    closedWonValue:   closedValue,
    topCategory:      topCat[0],
    topCategoryCount: topCat[1] as number,
    followUpCount,
    replyRate,
    pipeline,
  };
}

// ── System prompt ──────────────────────────────────────────────────────────────
function buildSystemPrompt(ctx: CRMContext): string {
  const pipelineText = ctx.pipeline
    .map((p) => `  ${p.stage}: ${p.count} leads${p.value > 0 ? ` (Rs. ${(p.value / 1000).toFixed(0)}K)` : ""}`)
    .join("\n");

  const stuckText = ctx.stuckLeads.length > 0
    ? ctx.stuckLeads.map((l) => `  - ${l.name} (${l.status}, ${l.days} days stuck)`).join("\n")
    : "  None";

  const coldText = ctx.coldDeals.length > 0
    ? ctx.coldDeals.map((l) => `  - ${l.name} (${l.status}${l.value > 0 ? `, Rs. ${(l.value / 1000).toFixed(0)}K` : ""})`).join("\n")
    : "  None";

  return `You are an elite AI sales coach inside LeadHunter CRM, built for Indian freelancers who sell web design, SEO, and digital services to local businesses.

You have LIVE access to the user's CRM data right now:

PIPELINE:
${pipelineText}

KEY METRICS:
- Total leads: ${ctx.totalLeads}
- Active leads: ${ctx.activeLeads}
- Outreach today: ${ctx.outreachToday}
- Outreach this week: ${ctx.outreachWeek}
- Reply rate: ${ctx.replyRate}%
- Revenue closed: Rs. ${(ctx.closedWonValue / 1000).toFixed(0)}K
- Follow-ups needed: ${ctx.followUpCount} leads
- Top category: ${ctx.topCategory} (${ctx.topCategoryCount} leads)

STUCK DEALS (7+ days no movement):
${stuckText}

COLD HOT DEALS (Interested/Proposal/Negotiation, no contact 7d+):
${coldText}

YOUR PERSONALITY:
- Sharp, direct, motivating — like a no-nonsense Indian sales mentor
- Always reference SPECIFIC data from above — lead names, numbers, percentages
- Actionable steps, not generic advice
- Concise — 2-4 sentences max unless the user asks for more detail
- Plain English only — no markdown, no bullet points, no asterisks, no symbols
- You understand Indian B2B market — WhatsApp outreach, local business owners, price sensitivity
- Currency is Indian Rupees written as Rs.
- You always know the data — never say you don't have access to it`;
}

// ── Call Groq ──────────────────────────────────────────────────────────────────
async function callCoach(messages: { role: string; content: string }[], systemPrompt: string): Promise<string> {
  const groqKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!groqKey) return "Please add VITE_GROQ_API_KEY to your .env to enable the AI Coach.";
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method:  "POST",
      headers: { "Authorization": `Bearer ${groqKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model:       "llama-3.3-70b-versatile",
        messages:    [{ role: "system", content: systemPrompt }, ...messages],
        max_tokens:  400,
        temperature: 0.75,
      }),
    });
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() ?? "Could not generate a response.";
  } catch {
    return "Connection error. Please check your Groq API key.";
  }
}

// ── Smart action buttons ───────────────────────────────────────────────────────
function extractActions(content: string): { label: string; route: string }[] {
  const actions: { label: string; route: string }[] = [];
  if (/follow.?up|contact|reach out|call|whatsapp/i.test(content)) actions.push({ label: "Open Follow-up Queue", route: "/followup" });
  if (/pipeline|stuck|stage|move|kanban/i.test(content))            actions.push({ label: "View Pipeline", route: "/pipeline" });
  if (/proposal/i.test(content))                                     actions.push({ label: "Go to Proposals", route: "/proposals" });
  if (/analytics|performance|week|stats/i.test(content))            actions.push({ label: "View Analytics", route: "/analytics" });
  if (/discover|find.*lead|new.*lead|search/i.test(content))        actions.push({ label: "Discover Leads", route: "/discover" });
  return actions.slice(0, 2);
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function AICoach() {
  const navigate  = useNavigate();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  const [open,       setOpen]       = useState(false);
  const [messages,   setMessages]   = useState<Message[]>([]);
  const [input,      setInput]      = useState("");
  const [sending,    setSending]    = useState(false);
  const [ctx,        setCtx]        = useState<CRMContext | null>(null);
  const [loadingCtx, setLoadingCtx] = useState(false);
  const [userId,     setUserId]     = useState<string | null>(null);
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => { if (user) setUserId(user.id); });
  }, []);

  const loadContext = useCallback(async (uid: string) => {
    setLoadingCtx(true);
    try {
      const data = await fetchCRMContext(uid);
      setCtx(data);
      const critical = (data.stuckLeads.length > 0 ? 1 : 0)
        + (data.outreachToday === 0 ? 1 : 0)
        + (data.coldDeals.length > 0 ? 1 : 0);
      setAlertCount(critical);
      return data;
    } catch (e) {
      console.error("AICoach error:", e);
      return null;
    } finally {
      setLoadingCtx(false);
    }
  }, []);

  useEffect(() => {
    if (userId) loadContext(userId);
  }, [userId]);

  // When panel opens — greet if first time
  useEffect(() => {
    if (open && ctx && messages.length === 0) {
      sendGreeting(ctx);
    }
    if (open) setTimeout(() => inputRef.current?.focus(), 250);
  }, [open, ctx]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  function sendGreeting(context: CRMContext) {
    const criticals: string[] = [];
    if (context.outreachToday === 0)   criticals.push("no outreach yet today");
    if (context.coldDeals.length > 0)  criticals.push(`${context.coldDeals.length} hot deal${context.coldDeals.length > 1 ? "s" : ""} going cold`);
    if (context.stuckLeads.length > 0) criticals.push(`${context.stuckLeads.length} deal${context.stuckLeads.length > 1 ? "s" : ""} stuck`);

    const urgency = criticals.length > 0
      ? `I'm seeing ${criticals.join(" and ")}. `
      : "Your pipeline is looking solid. ";

    setMessages([{
      id:      "greeting",
      role:    "assistant",
      content: `Hey! I'm your AI Sales Coach and I have full access to your CRM right now. ${urgency}You have ${context.activeLeads} active leads and ${context.followUpCount} need follow-up. What do you want to work on?`,
      time:    new Date(),
      actions: criticals.length > 0
        ? [{ label: "Show urgent items", route: "/followup" }]
        : [],
    }]);
  }

  async function handleSend(overrideText?: string) {
    const text = (overrideText ?? input).trim();
    if (!text || sending || !ctx) return;

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text, time: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);

    const history = [...messages, userMsg]
      .slice(-12)
      .map((m) => ({ role: m.role, content: m.content }));

    const response = await callCoach(history, buildSystemPrompt(ctx));
    const actions  = extractActions(response);

    setMessages((prev) => [...prev, {
      id:      (Date.now() + 1).toString(),
      role:    "assistant",
      content: response,
      time:    new Date(),
      actions,
    }]);
    setSending(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  async function handleRefresh() {
    if (!userId) return;
    const newCtx = await loadContext(userId);
    setMessages([]);
    if (newCtx) sendGreeting(newCtx);
  }

  const showQuickPrompts = messages.length <= 1;

  return (
    <>
      {/* ── Floating Button ── */}
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 1.2, type: "spring", stiffness: 200 }}
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all hover:scale-110 active:scale-95"
        style={{
          background: open ? "rgba(10,12,18,0.97)" : "var(--gradient-primary)",
          border:     open ? "1px solid rgba(255,255,255,0.1)" : "none",
          boxShadow:  open
            ? "0 8px 32px rgba(0,0,0,0.4)"
            : "0 0 30px hsl(72,100%,50%)50, 0 8px 32px rgba(0,0,0,0.4)",
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
              {alertCount > 0 && (
                <motion.span
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-[9px] font-stats font-bold flex items-center justify-center border-2 border-background">
                  {alertCount > 9 ? "9+" : alertCount}
                </motion.span>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* ── Chat Panel ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="fixed bottom-24 right-6 z-50 w-[380px] rounded-2xl overflow-hidden flex flex-col"
            style={{
              height:         "580px",
              background:     "rgba(8,10,16,0.98)",
              border:         "1px solid rgba(255,255,255,0.08)",
              backdropFilter: "blur(24px)",
              boxShadow:      "0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)",
            }}
          >
            {/* Header */}
            <div className="shrink-0 flex items-center justify-between px-4 py-3.5"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{ background: "var(--gradient-primary)" }}>
                    <Brain className="w-4 h-4 text-black" />
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-background animate-pulse" />
                </div>
                <div>
                  <p className="text-sm font-heading font-bold text-foreground">AI Sales Coach</p>
                  <p className="text-[9px] font-stats text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    {loadingCtx ? "Reading your CRM..." : "Live CRM data · Groq Llama 3.3"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={handleRefresh} disabled={loadingCtx} title="Refresh data & restart"
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                  style={{ background: "rgba(255,255,255,0.04)" }}>
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingCtx ? "animate-spin" : ""}`} />
                </button>
                <button onClick={() => { setMessages([]); if (ctx) sendGreeting(ctx); }} title="New chat"
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                  style={{ background: "rgba(255,255,255,0.04)" }}>
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
              style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.06) transparent" }}>

              {/* Loading */}
              {loadingCtx && messages.length === 0 && (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center space-y-3">
                    <motion.div
                      animate={{ scale: [1, 1.05, 1] }}
                      transition={{ repeat: Infinity, duration: 1.5 }}
                      className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto"
                      style={{ background: "var(--gradient-primary)" }}>
                      <Brain className="w-7 h-7 text-black" />
                    </motion.div>
                    <p className="text-sm font-heading font-semibold text-foreground">Reading your CRM data...</p>
                    <p className="text-xs text-muted-foreground">Pipeline, leads, outreach history</p>
                  </div>
                </div>
              )}

              {/* Chat messages */}
              <AnimatePresence initial={false}>
                {messages.map((msg) => (
                  <motion.div key={msg.id}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                  >
                    {/* Avatar */}
                    <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                      msg.role === "assistant"
                        ? "bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20"
                        : "bg-gradient-to-br from-slate-700 to-slate-600"
                    }`}>
                      {msg.role === "assistant"
                        ? <Sparkles className="w-3.5 h-3.5 text-primary" />
                        : <User className="w-3.5 h-3.5 text-slate-300" />}
                    </div>

                    <div className={`flex flex-col gap-1.5 max-w-[82%] ${msg.role === "user" ? "items-end" : "items-start"}`}>
                      {/* Bubble */}
                      <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                        msg.role === "user" ? "rounded-tr-sm text-white" : "rounded-tl-sm text-foreground"
                      }`}
                        style={msg.role === "user"
                          ? { background: "var(--gradient-primary)" }
                          : { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.07)" }
                        }>
                        {msg.content}
                      </div>

                      {/* Action buttons */}
                      {msg.actions && msg.actions.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {msg.actions.map((action) => (
                            <button key={action.route}
                              onClick={() => { setOpen(false); navigate(action.route); }}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-stats font-medium text-primary border border-primary/30 bg-primary/5 hover:bg-primary/15 transition-colors">
                              {action.label} <ChevronRight className="w-3 h-3" />
                            </button>
                          ))}
                        </div>
                      )}

                      <span className="text-[9px] font-stats text-muted-foreground px-1">
                        {formatTime(msg.time)}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Typing indicator */}
              {sending && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="flex gap-2.5">
                  <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="px-3.5 py-3 rounded-2xl rounded-tl-sm flex items-center gap-1.5"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    {[0, 1, 2].map((i) => (
                      <motion.span key={i}
                        animate={{ y: [0, -5, 0] }}
                        transition={{ duration: 0.5, delay: i * 0.12, repeat: Infinity }}
                        className="w-1.5 h-1.5 rounded-full bg-primary block"
                      />
                    ))}
                  </div>
                </motion.div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Quick prompts */}
            <AnimatePresence>
              {showQuickPrompts && !loadingCtx && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="shrink-0 px-3 pb-2 overflow-hidden"
                  style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                  <p className="text-[9px] font-stats text-muted-foreground uppercase tracking-widest px-1 py-2">
                    Ask me anything
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_PROMPTS.map((p) => (
                      <button key={p.label} onClick={() => handleSend(p.label)} disabled={sending}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-stats text-muted-foreground hover:text-foreground transition-all disabled:opacity-40"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                        <p.icon className="w-3 h-3 shrink-0" />
                        {p.label}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Input */}
            <div className="shrink-0 px-3 pb-3 pt-2"
              style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <input ref={inputRef} type="text"
                  placeholder={loadingCtx ? "Loading your CRM data..." : "Ask about your pipeline, deals, strategy..."}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={sending || loadingCtx}
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none disabled:opacity-50"
                />
                <button onClick={() => handleSend()}
                  disabled={!input.trim() || sending || loadingCtx}
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-all disabled:opacity-30 hover:opacity-90 active:scale-95 shrink-0"
                  style={{ background: "var(--gradient-primary)" }}>
                  {sending
                    ? <Loader2 className="w-3.5 h-3.5 text-black animate-spin" />
                    : <Send className="w-3.5 h-3.5 text-black" />}
                </button>
              </div>
              <p className="text-[9px] font-stats text-muted-foreground/40 text-center mt-1.5">
                Powered by Groq · Llama 3.3 70B · Live CRM context
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}