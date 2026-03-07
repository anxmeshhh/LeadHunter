import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, ChevronRight, Phone, Mail, MessageSquare,
  FileText, Clock, CheckCircle2, AlertTriangle, Plus,
  Loader2, Trash2, X, Sparkles, Brain, RefreshCw,
  AlertCircle, Calendar, Target,
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import { useNavigate } from "react-router-dom";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ── Types ──────────────────────────────────────────────────────────────────────
interface Task {
  id: string;
  lead_id: string;
  title: string;
  due_date: string;
  is_done: boolean;
  priority: "High" | "Medium" | "Low";
  created_at: string;
  // joined
  leads?: { business_name: string; city: string; status: string; phone: string } | null;
}

// ── Constants ──────────────────────────────────────────────────────────────────
const TYPE_ICONS: Record<string, any> = {
  call: Phone, email: Mail, whatsapp: MessageSquare,
  proposal: FileText, "follow-up": Clock, default: Target,
};

const PRIORITY_BORDER: Record<string, string> = {
  High:   "border-l-red-400",
  Medium: "border-l-primary",
  Low:    "border-l-muted-foreground",
};

const PRIORITY_DOT: Record<string, string> = {
  High: "bg-red-400", Medium: "bg-primary", Low: "bg-muted-foreground",
};

const DAYS_OF_WEEK   = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES    = ["January","February","March","April","May","June","July","August","September","October","November","December"];

// ── Helpers ────────────────────────────────────────────────────────────────────
function formatDateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function todayKey() {
  const d = new Date();
  return formatDateKey(d.getFullYear(), d.getMonth(), d.getDate());
}

function detectTaskType(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("call") || t.includes("phone"))     return "call";
  if (t.includes("email") || t.includes("mail"))     return "email";
  if (t.includes("whatsapp") || t.includes("wp"))    return "whatsapp";
  if (t.includes("proposal") || t.includes("quote")) return "proposal";
  if (t.includes("follow"))                          return "follow-up";
  return "default";
}

// ── AI Daily Briefing ──────────────────────────────────────────────────────────
async function generateDailyBriefing(tasks: Task[], dateStr: string): Promise<string> {
  const groqKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!groqKey) return "Add VITE_GROQ_API_KEY to enable AI briefings.";
  if (tasks.length === 0) return "No tasks scheduled for this day. Great time to hunt for new leads on the Discover page!";

  const taskList = tasks
    .map((t) => `- ${t.title} | Lead: ${t.leads?.business_name ?? "Unknown"} | Priority: ${t.priority} | Done: ${t.is_done}`)
    .join("\n");

  const prompt = `You are a sharp productivity coach for a freelance web developer in India.
Today's date: ${dateStr}
Tasks:
${taskList}

Write a focused 3-4 sentence daily briefing. Mention the highest priority tasks first, give a quick strategy tip for the day, and end with one motivational line. Be direct, energetic, no fluff. Talk like a business coach, not a chatbot.`;

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${groqKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 180,
        temperature: 0.8,
      }),
    });
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? "Could not generate briefing.";
  } catch {
    return "Could not generate AI briefing. Check your Groq API key.";
  }
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function CalendarPage() {
  const navigate = useNavigate();
  const today    = new Date();

  const [currentYear, setCurrentYear]   = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(todayKey());

  const [tasks, setTasks]               = useState<Task[]>([]);
  const [leads, setLeads]               = useState<{ id: string; business_name: string }[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);

  // Add task form
  const [showAdd, setShowAdd]           = useState(false);
  const [newTask, setNewTask]           = useState({ title: "", lead_id: "", priority: "Medium", due_date: selectedDate });
  const [saving, setSaving]             = useState(false);

  // AI briefing
  const [briefing, setBriefing]         = useState("");
  const [loadingBriefing, setLoadingBriefing] = useState(false);
  const [briefingDate, setBriefingDate] = useState("");

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [{ data: tasksData, error: tErr }, { data: leadsData, error: lErr }] = await Promise.all([
        supabase
          .from("tasks")
          .select("*, leads(business_name, city, status, phone)")
          .order("due_date", { ascending: true }),
        supabase
          .from("leads")
          .select("id, business_name")
          .order("business_name"),
      ]);
      if (tErr) throw tErr;
      if (lErr) throw lErr;
      setTasks((tasksData ?? []) as Task[]);
      setLeads(leadsData ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel("realtime:calendar")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, fetchAll)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchAll]);

  // Sync add-form date when selectedDate changes
  useEffect(() => {
    setNewTask((p) => ({ ...p, due_date: selectedDate }));
  }, [selectedDate]);

  // ── Calendar grid ──────────────────────────────────────────────────────────
  const daysInMonth  = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDay     = new Date(currentYear, currentMonth, 1).getDay();
  const days: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const tasksByDate  = tasks.reduce<Record<string, Task[]>>((acc, t) => {
    const key = t.due_date?.split("T")[0] ?? "";
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {});

  const today_key     = todayKey();
  const selectedTasks = tasksByDate[selectedDate] ?? [];

  // ── Stats ──────────────────────────────────────────────────────────────────
  const todayTasks    = tasksByDate[today_key] ?? [];
  const doneToday     = todayTasks.filter((t) => t.is_done).length;
  const overdueCount  = Object.entries(tasksByDate)
    .filter(([date]) => date < today_key)
    .reduce((sum, [, ts]) => sum + ts.filter((t) => !t.is_done).length, 0);
  const upcomingCount = Object.entries(tasksByDate)
    .filter(([date]) => date > today_key)
    .reduce((sum, [, ts]) => sum + ts.filter((t) => !t.is_done).length, 0);

  // ── Add Task ───────────────────────────────────────────────────────────────
  async function handleAddTask() {
    if (!newTask.title.trim() || !newTask.due_date) return;
    setSaving(true);
    const { error: err } = await supabase.from("tasks").insert({
      title:    newTask.title.trim(),
      lead_id:  newTask.lead_id || null,
      priority: newTask.priority,
      due_date: newTask.due_date,
      is_done:  false,
    });
    if (!err) {
      setNewTask({ title: "", lead_id: "", priority: "Medium", due_date: selectedDate });
      setShowAdd(false);
      fetchAll();
    }
    setSaving(false);
  }

  // ── Toggle done ────────────────────────────────────────────────────────────
  async function handleToggle(task: Task) {
    // Optimistic
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, is_done: !t.is_done } : t));
    await supabase.from("tasks").update({ is_done: !task.is_done }).eq("id", task.id);
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    await supabase.from("tasks").delete().eq("id", id);
  }

  // ── AI Briefing ────────────────────────────────────────────────────────────
  async function handleGenerateBriefing() {
    if (loadingBriefing) return;
    setLoadingBriefing(true);
    setBriefing("");
    const result = await generateDailyBriefing(selectedTasks, selectedDate);
    setBriefing(result);
    setBriefingDate(selectedDate);
    setLoadingBriefing(false);
  }

  // ── Nav ────────────────────────────────────────────────────────────────────
  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear((y) => y - 1); }
    else setCurrentMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear((y) => y + 1); }
    else setCurrentMonth((m) => m + 1);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Calendar</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Follow-ups & tasks ·{" "}
            <span className="font-stats text-primary">{todayTasks.length} actions today</span>
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
          <button
            onClick={() => { setShowAdd(true); setNewTask((p) => ({ ...p, due_date: selectedDate })); }}
            className="px-4 py-2.5 rounded-lg font-heading font-semibold text-sm text-primary-foreground transition-all hover:opacity-90 flex items-center gap-2"
            style={{ background: "var(--gradient-primary)" }}
          >
            <Plus className="w-4 h-4" /> Add Task
          </button>
        </div>
      </motion.div>

      {/* Error */}
      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          <button onClick={fetchAll} className="ml-auto text-xs underline">Retry</button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: CheckCircle2, label: "Done Today",  value: `${doneToday}/${todayTasks.length}`, color: "text-success"     },
          { icon: Clock,        label: "Upcoming",    value: upcomingCount,                        color: "text-primary"     },
          { icon: AlertTriangle,label: "Overdue",     value: overdueCount,                         color: overdueCount > 0 ? "text-red-400" : "text-muted-foreground" },
        ].map((s, i) => (
          <motion.div key={s.label}
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="glass rounded-xl p-4 flex items-center gap-3">
            <s.icon className={`w-5 h-5 ${s.color}`} />
            <div>
              <p className="font-stats text-xl font-bold text-foreground">{s.value}</p>
              <p className="text-[10px] font-stats text-muted-foreground uppercase tracking-widest">{s.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* AI Briefing Banner */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        className="glass rounded-xl p-4 border border-primary/20">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="p-2.5 rounded-lg bg-primary/10 shrink-0">
            <Brain className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-sm font-heading font-semibold text-foreground">AI Daily Briefing</p>
              {briefingDate === selectedDate && briefing && (
                <span className="text-[10px] font-stats text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">
                  {selectedDate === today_key ? "Today" : selectedDate}
                </span>
              )}
            </div>
            {briefing && briefingDate === selectedDate ? (
              <p className="text-sm text-muted-foreground leading-relaxed">{briefing}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Get an AI-powered briefing for {selectedDate === today_key ? "today" : selectedDate} —
                priorities, strategy, and motivation.
              </p>
            )}
          </div>
          <button
            onClick={handleGenerateBriefing}
            disabled={loadingBriefing}
            className="px-4 py-2 rounded-lg text-sm font-heading font-semibold text-primary-foreground flex items-center gap-2 hover:opacity-90 disabled:opacity-50 transition-all shrink-0"
            style={{ background: "var(--gradient-primary)" }}
          >
            {loadingBriefing
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Thinking...</>
              : <><Sparkles className="w-3.5 h-3.5" /> {briefing && briefingDate === selectedDate ? "Refresh" : "Brief Me"}</>
            }
          </button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Calendar Grid ── */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="lg:col-span-2 glass rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-muted transition-colors">
              <ChevronLeft className="w-4 h-4 text-muted-foreground" />
            </button>
            <h3 className="font-heading text-lg text-foreground">
              {MONTH_NAMES[currentMonth]} {currentYear}
            </h3>
            <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-muted transition-colors">
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2">
            {DAYS_OF_WEEK.map((d) => (
              <div key={d} className="text-center text-[10px] font-stats text-muted-foreground uppercase tracking-widest py-2">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {days.map((day, idx) => {
              if (day === null) return <div key={`e-${idx}`} />;
              const dateKey    = formatDateKey(currentYear, currentMonth, day);
              const dayTasks   = tasksByDate[dateKey] ?? [];
              const hasOpen    = dayTasks.some((t) => !t.is_done);
              const allDone    = dayTasks.length > 0 && dayTasks.every((t) => t.is_done);
              const isSelected = dateKey === selectedDate;
              const isToday    = dateKey === today_key;
              const isOverdue  = dateKey < today_key && hasOpen;

              return (
                <button
                  key={dateKey}
                  onClick={() => setSelectedDate(dateKey)}
                  className={`relative p-2 sm:p-3 rounded-lg text-sm font-stats transition-all ${
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : isToday
                      ? "bg-primary/10 text-primary border border-primary/30"
                      : "text-foreground hover:bg-muted"
                  }`}
                >
                  {day}
                  {/* Dot indicators */}
                  {dayTasks.length > 0 && !isSelected && (
                    <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${
                        isOverdue ? "bg-red-400" :
                        allDone   ? "bg-success"  :
                        "bg-primary"
                      }`} />
                      {dayTasks.length > 1 && (
                        <div className={`w-1.5 h-1.5 rounded-full opacity-50 ${
                          isOverdue ? "bg-red-400" : "bg-primary"
                        }`} />
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex gap-4 mt-4 pt-4 border-t border-border/30">
            {[
              { color: "bg-primary",           label: "Open tasks" },
              { color: "bg-success",            label: "All done"   },
              { color: "bg-red-400",            label: "Overdue"    },
            ].map((l) => (
              <div key={l.label} className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${l.color}`} />
                <span className="text-[10px] font-stats text-muted-foreground">{l.label}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── Tasks Panel ── */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
          className="glass rounded-xl p-5 flex flex-col">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-heading text-base text-foreground">
              {selectedDate === today_key ? "Today" : selectedDate}
            </h3>
            <button
              onClick={() => setShowAdd(!showAdd)}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground mb-4 font-stats">
            {selectedTasks.length} task{selectedTasks.length !== 1 ? "s" : ""}
            {selectedTasks.filter((t) => t.is_done).length > 0 && (
              <span className="text-success ml-1">
                · {selectedTasks.filter((t) => t.is_done).length} done
              </span>
            )}
          </p>

          {/* Add Task Form */}
          <AnimatePresence>
            {showAdd && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden mb-4"
              >
                <div className="space-y-2 p-3 rounded-xl bg-muted/50 border border-primary/20">
                  <p className="text-[10px] font-stats text-primary uppercase tracking-widest">New Task</p>
                  <input
                    autoFocus
                    type="text"
                    placeholder="Task title e.g. Call Excel IIT Academy..."
                    value={newTask.title}
                    onChange={(e) => setNewTask((p) => ({ ...p, title: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
                    className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  {/* Lead selector */}
                  <select
                    value={newTask.lead_id}
                    onChange={(e) => setNewTask((p) => ({ ...p, lead_id: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">No lead (general task)</option>
                    {leads.map((l) => (
                      <option key={l.id} value={l.id}>{l.business_name}</option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={newTask.due_date}
                      onChange={(e) => setNewTask((p) => ({ ...p, due_date: e.target.value }))}
                      className="flex-1 px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <select
                      value={newTask.priority}
                      onChange={(e) => setNewTask((p) => ({ ...p, priority: e.target.value }))}
                      className="px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option>High</option>
                      <option>Medium</option>
                      <option>Low</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setShowAdd(false)}
                      className="flex-1 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground transition-colors">
                      Cancel
                    </button>
                    <button
                      onClick={handleAddTask}
                      disabled={saving || !newTask.title.trim() || !newTask.due_date}
                      className="flex-1 py-2 rounded-lg text-xs font-heading font-semibold text-primary-foreground disabled:opacity-40 flex items-center justify-center gap-1.5 transition-all hover:opacity-90"
                      style={{ background: "var(--gradient-primary)" }}
                    >
                      {saving ? <><Loader2 className="w-3 h-3 animate-spin" /> Saving...</> : <><Calendar className="w-3 h-3" /> Add Task</>}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Task List */}
          {loading ? (
            <div className="space-y-2">
              {[1,2,3].map((i) => <div key={i} className="h-16 rounded-lg bg-muted/50 animate-pulse" />)}
            </div>
          ) : selectedTasks.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-10 gap-2">
              <Calendar className="w-7 h-7 text-muted-foreground opacity-30" />
              <p className="text-sm text-muted-foreground">No tasks for this day</p>
              <button
                onClick={() => setShowAdd(true)}
                className="text-xs text-primary hover:underline"
              >
                + Add a task
              </button>
            </div>
          ) : (
            <div className="space-y-2 flex-1 overflow-y-auto">
              <AnimatePresence>
                {/* Sort: undone first, then by priority */}
                {[...selectedTasks]
                  .sort((a, b) => {
                    if (a.is_done !== b.is_done) return a.is_done ? 1 : -1;
                    const order = { High: 0, Medium: 1, Low: 2 };
                    return (order[a.priority] ?? 1) - (order[b.priority] ?? 1);
                  })
                  .map((task) => {
                    const typeKey = detectTaskType(task.title);
                    const Icon    = TYPE_ICONS[typeKey] ?? TYPE_ICONS.default;
                    const lead    = task.leads;

                    return (
                      <motion.div
                        key={task.id}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.97 }}
                        className={`p-3 rounded-lg border-l-2 transition-all group ${
                          PRIORITY_BORDER[task.priority]
                        } ${task.is_done ? "opacity-50 bg-muted/20" : "bg-muted/30 hover:bg-muted/50"}`}
                      >
                        <div className="flex items-start gap-2">
                          {/* Checkbox */}
                          <button
                            onClick={() => handleToggle(task)}
                            className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                              task.is_done
                                ? "bg-success border-success"
                                : "border-border hover:border-primary"
                            }`}
                          >
                            {task.is_done && <CheckCircle2 className="w-3 h-3 text-background" />}
                          </button>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <Icon className="w-3 h-3 text-primary shrink-0" />
                              <p className={`text-sm font-medium leading-tight ${task.is_done ? "line-through text-muted-foreground" : "text-foreground"}`}>
                                {task.title}
                              </p>
                            </div>

                            {/* Lead link */}
                            {lead && (
                              <button
                                onClick={() => navigate(`/leads/${task.lead_id}`)}
                                className="text-[10px] font-stats text-primary hover:underline"
                              >
                                {lead.business_name}
                                {lead.city ? ` · ${lead.city}` : ""}
                              </button>
                            )}

                            <div className="flex items-center gap-2 mt-1">
                              <div className={`w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[task.priority]}`} />
                              <span className="text-[10px] font-stats text-muted-foreground">{task.priority}</span>
                              {lead?.phone && (
                                <a href={`tel:${lead.phone}`}
                                  className="text-[10px] font-stats text-muted-foreground hover:text-primary transition-colors ml-1"
                                  onClick={(e) => e.stopPropagation()}>
                                  📞 {lead.phone}
                                </a>
                              )}
                            </div>
                          </div>

                          {/* Delete */}
                          <button
                            onClick={() => handleDelete(task.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-red-400 transition-all shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
              </AnimatePresence>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}