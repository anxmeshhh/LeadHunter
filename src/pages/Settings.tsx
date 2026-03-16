import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  User, Bell, Palette, Database, Key, Globe,
  Zap, Upload, Download, Moon, Target, Mail,
  Loader2, CheckCircle2, AlertCircle, Save,
  RefreshCw, Shield, X, Check, Flame,
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ── Types ──────────────────────────────────────────────────────────────────────
type SettingsTab = "profile" | "notifications" | "targets" | "integrations" | "import" | "appearance";

interface DailyTarget {
  id?: string;
  daily_contact_target:   number;
  weekly_lead_target:     number;
  monthly_revenue_target: number;
  followup_reminder_days: number;
  focus_mode:             boolean;
}

interface ProfileData {
  full_name:  string;
  email:      string;
  company:    string;
  phone:      string;
  role:       string;
  location:   string;
  pitch_bio:  string;
}

// ── Tabs ───────────────────────────────────────────────────────────────────────
const TABS: { id: SettingsTab; label: string; icon: any }[] = [
  { id: "profile",       label: "Profile",         icon: User     },
  { id: "targets",       label: "Daily Targets",   icon: Target   },
  { id: "notifications", label: "Notifications",   icon: Bell     },
  { id: "integrations",  label: "Integrations",    icon: Key      },
  { id: "import",        label: "Import / Export", icon: Database },
  { id: "appearance",    label: "Appearance",      icon: Palette  },
];

// ── Toast ──────────────────────────────────────────────────────────────────────
function Toast({ msg, type }: { msg: string; type: "success" | "error" }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl text-sm font-stats ${
        type === "success"
          ? "bg-success/10 border-success/30 text-success"
          : "bg-red-500/10 border-red-500/30 text-red-400"
      }`}
    >
      {type === "success"
        ? <CheckCircle2 className="w-4 h-4 shrink-0" />
        : <AlertCircle  className="w-4 h-4 shrink-0" />}
      {msg}
    </motion.div>
  );
}

// ── Toggle ─────────────────────────────────────────────────────────────────────
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`w-10 h-6 rounded-full relative transition-colors ${on ? "bg-primary" : "bg-muted border border-border"}`}
    >
      <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${on ? "left-5" : "left-1"}`} />
    </button>
  );
}

// ── Daily Goal Widget ──────────────────────────────────────────────────────────
function DailyGoalWidget() {
  const [target,    setTarget]    = useState(10);
  const [contacted, setContacted] = useState(0);
  const [newLeads,  setNewLeads]  = useState(0);
  const [streak,    setStreak]    = useState(0);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    (async () => {
      // ✅ get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayISO = todayStart.toISOString();

      const [
        { data: targetRow },
        { data: outreachRows },
        { data: newLeadRows },
      ] = await Promise.all([
        supabase.from("daily_targets").select("*")
          .eq("user_id", user.id)                    // ✅
          .limit(1).maybeSingle(),
        supabase.from("outreach_history").select("id")
          .eq("user_id", user.id)                    // ✅
          .gte("contacted_at", todayISO),
        supabase.from("leads").select("id")
          .eq("user_id", user.id)                    // ✅
          .gte("created_at", todayISO),
      ]);

      setTarget(targetRow?.daily_target ?? targetRow?.daily_contact_target ?? 10);
      setStreak(targetRow?.streak ?? 0);
      setContacted((outreachRows ?? []).length);
      setNewLeads((newLeadRows ?? []).length);
      setLoading(false);
    })();
  }, []);

  const pct   = Math.min((contacted / Math.max(target, 1)) * 100, 100);
  const done  = contacted >= target;
  const color = done ? "#10B981" : pct >= 60 ? "#f59e0b" : "hsl(72,100%,50%)";

  if (loading) return (
    <div className="mt-4 pt-4 border-t border-border/50 space-y-2">
      {[1, 2, 3].map((i) => <div key={i} className="h-3 rounded bg-muted/50 animate-pulse" />)}
    </div>
  );

  return (
    <div className="mt-4 pt-4 border-t border-border/50 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-stats text-muted-foreground uppercase tracking-widest">Today's Goal</span>
        {streak > 0 && (
          <span className="flex items-center gap-1 text-[10px] font-stats text-amber-400">
            <Flame className="w-3 h-3" /> {streak}d
          </span>
        )}
      </div>
      <div className="flex items-end gap-1.5">
        <span className="font-stats text-2xl font-bold leading-none" style={{ color }}>{contacted}</span>
        <span className="font-stats text-sm text-muted-foreground leading-none mb-0.5">/ {target}</span>
        {done && <CheckCircle2 className="w-4 h-4 text-success mb-0.5 ml-1" />}
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}60` }}
        />
      </div>
      <p className="text-[10px] font-stats text-muted-foreground">
        {done
          ? "🎯 Daily goal smashed!"
          : `${target - contacted} more contact${target - contacted !== 1 ? "s" : ""} to hit target`}
      </p>
      <div className="grid grid-cols-2 gap-2 pt-1">
        <div className="rounded-lg bg-muted/40 px-2.5 py-2 text-center">
          <p className="font-stats text-sm font-bold text-foreground">{contacted}</p>
          <p className="text-[9px] font-stats text-muted-foreground uppercase tracking-widest">Contacted</p>
        </div>
        <div className="rounded-lg bg-muted/40 px-2.5 py-2 text-center">
          <p className="font-stats text-sm font-bold text-foreground">{newLeads}</p>
          <p className="text-[9px] font-stats text-muted-foreground uppercase tracking-widest">New Leads</p>
        </div>
      </div>
    </div>
  );
}

// ── Main Settings Page ─────────────────────────────────────────────────────────
export default function Settings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [toast,     setToast]     = useState<{ msg: string; type: "success" | "error" } | null>(null);

  function showToast(msg: string, type: "success" | "error" = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  return (
    <div className="p-6 space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-heading font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure your Sales Command Center</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar nav */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-xl p-3 h-fit">
          <nav className="space-y-1">
            {TABS.map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}>
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>
          <DailyGoalWidget />
        </motion.div>

        {/* Content panel */}
        <div className="lg:col-span-3">
          {activeTab === "profile"       && <ProfileSettings      showToast={showToast} />}
          {activeTab === "targets"       && <TargetSettings       showToast={showToast} />}
          {activeTab === "notifications" && <NotificationSettings />}
          {activeTab === "integrations"  && <IntegrationSettings  />}
          {activeTab === "import"        && <ImportExportSettings showToast={showToast} />}
          {activeTab === "appearance"    && <AppearanceSettings   />}
        </div>
      </div>

      <AnimatePresence>
        {toast && <Toast msg={toast.msg} type={toast.type} />}
      </AnimatePresence>
    </div>
  );
}

// ── Profile Settings ───────────────────────────────────────────────────────────
function ProfileSettings({ showToast }: { showToast: (m: string, t?: "success" | "error") => void }) {
  const [form,    setForm]    = useState<ProfileData>({
    full_name: "", email: "", company: "", phone: "", role: "", location: "", pitch_bio: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    (async () => {
      // ✅ pre-fill email from auth user
      const { data: { user } } = await supabase.auth.getUser();
      const saved = localStorage.getItem(`crm_profile_${user?.id ?? "local"}`);
      if (saved) {
        setForm(JSON.parse(saved));
      } else if (user?.email) {
        setForm((p) => ({ ...p, email: user.email ?? "" }));
      }
      setLoading(false);
    })();
  }, []);

  async function handleSave() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser(); // ✅
    // Scope localStorage key to user so different users don't share profile
    localStorage.setItem(`crm_profile_${user?.id ?? "local"}`, JSON.stringify(form));
    await new Promise((r) => setTimeout(r, 400));
    setSaving(false);
    showToast("Profile saved successfully!");
  }

  const FIELDS: { key: keyof ProfileData; label: string; type: string }[] = [
    { key: "full_name", label: "Full Name", type: "text"  },
    { key: "email",     label: "Email",     type: "email" },
    { key: "company",   label: "Company",   type: "text"  },
    { key: "phone",     label: "Phone",     type: "tel"   },
    { key: "role",      label: "Role",      type: "text"  },
    { key: "location",  label: "Location",  type: "text"  },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="glass rounded-xl p-6 space-y-6">
      <h3 className="font-heading text-lg text-foreground">Profile Settings</h3>
      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {FIELDS.map((f) => (
              <div key={f.key}>
                <label className="text-xs font-stats text-muted-foreground uppercase tracking-widest mb-1.5 block">
                  {f.label}
                </label>
                <input type={f.type} value={form[f.key]}
                  onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
            ))}
          </div>
          <div>
            <label className="text-xs font-stats text-muted-foreground uppercase tracking-widest mb-1.5 block">
              Pitch Bio
            </label>
            <textarea value={form.pitch_bio}
              onChange={(e) => setForm((p) => ({ ...p, pitch_bio: e.target.value }))}
              rows={3}
              placeholder="I help local businesses grow with modern websites and CRM solutions..."
              className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
            <p className="text-[10px] text-muted-foreground mt-1">Used in AI-generated pitches and proposals</p>
          </div>
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2.5 rounded-lg font-heading font-semibold text-sm text-primary-foreground flex items-center gap-2 hover:opacity-90 disabled:opacity-50 transition-all"
            style={{ background: "var(--gradient-primary)" }}>
            {saving
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...</>
              : <><Save className="w-3.5 h-3.5" /> Save Changes</>}
          </button>
        </>
      )}
    </motion.div>
  );
}

// ── Target Settings ────────────────────────────────────────────────────────────
function TargetSettings({ showToast }: { showToast: (m: string, t?: "success" | "error") => void }) {
  const [form, setForm] = useState<DailyTarget>({
    daily_contact_target:   10,
    weekly_lead_target:     50,
    monthly_revenue_target: 500000,
    followup_reminder_days: 3,
    focus_mode:             false,
  });
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [rowId,   setRowId]   = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      // ✅ scope to current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data } = await supabase
        .from("daily_targets")
        .select("*")
        .eq("user_id", user.id)                      // ✅
        .limit(1)
        .maybeSingle();

      if (data) {
        setForm({
          daily_contact_target:   data.daily_contact_target   ?? 10,
          weekly_lead_target:     data.weekly_lead_target     ?? 50,
          monthly_revenue_target: data.monthly_revenue_target ?? 500000,
          followup_reminder_days: data.followup_reminder_days ?? 3,
          focus_mode:             data.focus_mode             ?? false,
        });
        setRowId(data.id);
      }
      setLoading(false);
    })();
  }, []);

  async function handleSave() {
    setSaving(true);
    // ✅ get user for scoping
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    if (rowId) {
      await supabase.from("daily_targets")
        .update(form)
        .eq("id", rowId)
        .eq("user_id", user.id);                     // ✅
    } else {
      const { data } = await supabase
        .from("daily_targets")
        .insert({ ...form, user_id: user.id })        // ✅
        .select()
        .single();
      if (data) setRowId(data.id);
    }
    setSaving(false);
    showToast("Targets saved!");
  }

  const FIELDS = [
    { key: "daily_contact_target"   as keyof DailyTarget, label: "Daily Lead Contact Target",   desc: "Leads to contact per day"   },
    { key: "weekly_lead_target"     as keyof DailyTarget, label: "Weekly New Lead Target",      desc: "New leads to add per week"  },
    { key: "monthly_revenue_target" as keyof DailyTarget, label: "Monthly Revenue Target (₹)", desc: "Revenue goal per month"     },
    { key: "followup_reminder_days" as keyof DailyTarget, label: "Follow-Up Reminder (days)",  desc: "Days before auto-reminder"  },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="glass rounded-xl p-6 space-y-6">
      <h3 className="font-heading text-lg text-foreground">Daily Targets & Discipline</h3>
      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading targets...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {FIELDS.map((f) => (
              <div key={f.key}>
                <label className="text-xs font-stats text-muted-foreground uppercase tracking-widest mb-1.5 block">
                  {f.label}
                </label>
                <input type="number" value={form[f.key] as number}
                  onChange={(e) => setForm((p) => ({ ...p, [f.key]: Number(e.target.value) }))}
                  className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border text-sm text-foreground font-stats focus:outline-none focus:ring-1 focus:ring-primary" />
                <p className="text-[10px] text-muted-foreground mt-1">{f.desc}</p>
              </div>
            ))}
          </div>
          <div className="glass rounded-lg p-4 border border-primary/20">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-primary" />
              <span className="text-xs font-stats text-primary uppercase tracking-widest">Focus Mode</span>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Show only today's priority leads</p>
              <Toggle on={form.focus_mode} onChange={(v) => setForm((p) => ({ ...p, focus_mode: v }))} />
            </div>
          </div>
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2.5 rounded-lg font-heading font-semibold text-sm text-primary-foreground flex items-center gap-2 hover:opacity-90 disabled:opacity-50 transition-all"
            style={{ background: "var(--gradient-primary)" }}>
            {saving
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...</>
              : <><Save className="w-3.5 h-3.5" /> Save Targets</>}
          </button>
        </>
      )}
    </motion.div>
  );
}

// ── Notification Settings ──────────────────────────────────────────────────────
function NotificationSettings() {
  const [prefs, setPrefs] = useState(() => {
    const saved = localStorage.getItem("crm_notif_prefs");
    return saved ? JSON.parse(saved) : {
      followup_reminders: true,
      overdue_alerts:     true,
      daily_summary:      false,
      new_lead_notif:     true,
      proposal_updates:   true,
      streak_reminders:   true,
    };
  });

  function toggle(key: string) {
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    localStorage.setItem("crm_notif_prefs", JSON.stringify(updated));
  }

  const OPTIONS = [
    { key: "followup_reminders", label: "Follow-up Reminders",      desc: "Get notified when follow-ups are due"          },
    { key: "overdue_alerts",     label: "Overdue Alerts",           desc: "Alert when leads are overdue for contact"      },
    { key: "daily_summary",      label: "Daily Summary Email",      desc: "Receive daily action summary at 8 AM"          },
    { key: "new_lead_notif",     label: "New Lead Notifications",   desc: "Notify when new leads are imported"            },
    { key: "proposal_updates",   label: "Proposal Status Updates",  desc: "Notify when proposals are viewed/accepted"     },
    { key: "streak_reminders",   label: "Streak Reminders",         desc: "Motivational reminder to maintain your streak" },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="glass rounded-xl p-6 space-y-4">
      <h3 className="font-heading text-lg text-foreground">Notification Preferences</h3>
      <p className="text-xs text-muted-foreground">Saved automatically when toggled.</p>
      {OPTIONS.map((opt) => (
        <div key={opt.key} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
          <div>
            <p className="text-sm font-medium text-foreground">{opt.label}</p>
            <p className="text-xs text-muted-foreground">{opt.desc}</p>
          </div>
          <Toggle on={prefs[opt.key]} onChange={() => toggle(opt.key)} />
        </div>
      ))}
    </motion.div>
  );
}

// ── Integration Settings ───────────────────────────────────────────────────────
function IntegrationSettings() {
  const hasRapidAPI = !!import.meta.env.VITE_RAPIDAPI_KEY;
  const hasGroq     = !!import.meta.env.VITE_GROQ_API_KEY;
  const hasSupabase = !!import.meta.env.VITE_SUPABASE_URL;

  const INTEGRATIONS = [
    { name: "Supabase Database",      desc: "Live data storage & realtime sync",     icon: Database, connected: hasSupabase, status: hasSupabase ? "Connected" : "Not configured",               key: "VITE_SUPABASE_URL + ANON_KEY" },
    { name: "RapidAPI · Google Places",desc: "Lead discovery & business search",     icon: Globe,    connected: hasRapidAPI, status: hasRapidAPI ? "Connected" : "Add VITE_RAPIDAPI_KEY to .env", key: "VITE_RAPIDAPI_KEY"            },
    { name: "Groq · Llama 3.3 70B",   desc: "AI pitches, proposals & briefings",    icon: Zap,      connected: hasGroq,     status: hasGroq     ? "Connected" : "Add VITE_GROQ_API_KEY to .env",  key: "VITE_GROQ_API_KEY"            },
    { name: "Email SMTP",              desc: "Send outreach emails directly",        icon: Mail,     connected: false,       status: "Coming Soon",                                               key: "—"                            },
    { name: "WhatsApp Business",       desc: "Send WhatsApp messages to leads",     icon: Shield,   connected: false,       status: "Coming Soon",                                               key: "—"                            },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="glass rounded-xl p-6 space-y-4">
      <h3 className="font-heading text-lg text-foreground">Integrations</h3>
      <p className="text-xs text-muted-foreground">
        Configure API keys in your <code className="text-primary bg-primary/10 px-1 py-0.5 rounded">.env</code> file at the project root.
      </p>
      {INTEGRATIONS.map((int) => (
        <div key={int.name}
          className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${int.connected ? "bg-primary/10" : "bg-muted"}`}>
              <int.icon className={`w-5 h-5 ${int.connected ? "text-primary" : "text-muted-foreground"}`} />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{int.name}</p>
              <p className="text-xs text-muted-foreground">{int.desc}</p>
              {!int.connected && int.key !== "—" && (
                <p className="text-[10px] font-stats text-amber-400 mt-0.5">{int.key}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {int.connected
              ? <span className="text-xs font-stats text-success flex items-center gap-1"><Check className="w-3 h-3" /> Active</span>
              : int.status === "Coming Soon"
              ? <span className="text-xs font-stats text-muted-foreground">{int.status}</span>
              : <span className="text-xs font-stats text-amber-400">Not configured</span>}
          </div>
        </div>
      ))}
    </motion.div>
  );
}

// ── Import / Export ────────────────────────────────────────────────────────────
function ImportExportSettings({ showToast }: { showToast: (m: string, t?: "success" | "error") => void }) {
  const fileRef                     = useRef<HTMLInputElement>(null);
  const [importing,    setImporting]    = useState(false);
  const [exporting,    setExporting]    = useState(false);
  const [importResult, setImportResult] = useState<{ added: number; skipped: number } | null>(null);

  // ✅ FIX: scope export to current user
  async function handleExport() {
    setExporting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser(); // ✅
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("leads")
        .select("business_name, category, city, state, phone, email, website, rating, review_count, score, score_label, status, deal_value, has_website, source, created_at")
        .eq("user_id", user.id)                      // ✅ only export own leads
        .order("created_at", { ascending: false });

      if (error) throw error;

      const headers = [
        "Business Name","Category","City","State","Phone","Email",
        "Website","Rating","Reviews","Score","Score Label",
        "Status","Deal Value","Has Website","Source","Created At",
      ];
      const rows = (data ?? []).map((l: any) => [
        l.business_name, l.category, l.city, l.state, l.phone, l.email,
        l.website, l.rating, l.review_count, l.score, l.score_label,
        l.status, l.deal_value, l.has_website, l.source, l.created_at,
      ].map((v) => `"${v ?? ""}"`).join(","));

      const csv  = [headers.join(","), ...rows].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `leads_export_${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`Exported ${data?.length ?? 0} leads successfully!`);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Export failed", "error");
    } finally {
      setExporting(false);
    }
  }

  // ✅ FIX: stamp user_id on every imported lead
  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);

    try {
      const { data: { user } } = await supabase.auth.getUser(); // ✅
      if (!user) throw new Error("Not authenticated");

      const text  = await file.text();
      const lines = text.trim().split("\n");
      if (lines.length < 2) throw new Error("CSV must have a header row and at least one data row.");

      const headers = lines[0].split(",").map((h) =>
        h.trim().replace(/"/g, "").toLowerCase().replace(/ /g, "_")
      );

      const records = lines.slice(1).map((line) => {
        const vals: string[] = [];
        let cur = "";
        let inQ = false;
        for (const ch of line) {
          if (ch === '"') { inQ = !inQ; continue; }
          if (ch === "," && !inQ) { vals.push(cur.trim()); cur = ""; continue; }
          cur += ch;
        }
        vals.push(cur.trim());
        const obj: Record<string, any> = {};
        headers.forEach((h, i) => { obj[h] = vals[i] ?? ""; });
        return obj;
      }).filter((r) => r.business_name || r["business name"]);

      const mapped = records.map((r) => ({
        business_name: r.business_name || r["business name"] || r.name || "",
        category:      r.category      || r.type             || "Business",
        city:          r.city          || "",
        state:         r.state         || "",
        phone:         r.phone         || "",
        email:         r.email         || "",
        website:       r.website       || "",
        rating:        parseFloat(r.rating) || 0,
        review_count:  parseInt(r.reviews || r.review_count) || 0,
        has_website:   !!(r.website),
        status:        r.status        || "New Lead",
        source:        "csv_import",
        score:         parseInt(r.score) || 30,
        score_label:   r.score_label   || "Low",
        user_id:       user.id,                      // ✅ stamp user_id on every row
      })).filter((r) => r.business_name.trim());

      if (mapped.length === 0) throw new Error("No valid rows found. Check column names.");

      let added = 0;
      const batchSize = 50;
      for (let i = 0; i < mapped.length; i += batchSize) {
        const batch = mapped.slice(i, i + batchSize);
        const { error } = await supabase.from("leads").insert(batch);
        if (!error) added += batch.length;
      }

      setImportResult({ added, skipped: mapped.length - added });
      showToast(`Imported ${added} leads successfully!`);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Import failed", "error");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="glass rounded-xl p-6 space-y-6">
      <h3 className="font-heading text-lg text-foreground">Import / Export</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Import */}
        <div
          onClick={() => !importing && fileRef.current?.click()}
          className="glass rounded-xl p-6 text-center border border-dashed border-border hover:border-primary/50 transition-all cursor-pointer group"
        >
          <input ref={fileRef} type="file" accept=".csv" onChange={handleImport} className="hidden" />
          {importing
            ? <Loader2 className="w-8 h-8 text-primary mx-auto mb-3 animate-spin" />
            : <Upload  className="w-8 h-8 text-primary mx-auto mb-3 group-hover:scale-110 transition-transform" />}
          <h4 className="font-heading text-sm text-foreground mb-1">
            {importing ? "Importing..." : "Import Leads (CSV)"}
          </h4>
          <p className="text-xs text-muted-foreground">Upload a CSV file with lead data</p>
          <p className="text-[10px] text-muted-foreground mt-2 font-stats">
            Columns: Name, Category, City, Phone, Email, Website
          </p>
          {importResult && (
            <div className="mt-3 text-xs font-stats">
              <span className="text-success">✓ {importResult.added} added</span>
              {importResult.skipped > 0 && (
                <span className="text-muted-foreground ml-2">{importResult.skipped} skipped</span>
              )}
            </div>
          )}
        </div>

        {/* Export */}
        <div
          onClick={!exporting ? handleExport : undefined}
          className="glass rounded-xl p-6 text-center border border-dashed border-border hover:border-primary/50 transition-all cursor-pointer group"
        >
          {exporting
            ? <Loader2  className="w-8 h-8 text-cyan-400 mx-auto mb-3 animate-spin" />
            : <Download className="w-8 h-8 text-cyan-400 mx-auto mb-3 group-hover:scale-110 transition-transform" />}
          <h4 className="font-heading text-sm text-foreground mb-1">
            {exporting ? "Exporting..." : "Export Leads (CSV)"}
          </h4>
          <p className="text-xs text-muted-foreground">Download all leads with current status</p>
          <p className="text-[10px] text-muted-foreground mt-2 font-stats">
            Includes: Score, Tags, Status, Contact History
          </p>
        </div>
      </div>

      {/* CSV template helper */}
      <div className="glass rounded-lg p-4 border border-border space-y-2">
        <p className="text-xs font-heading font-semibold text-foreground">CSV Template</p>
        <p className="text-[10px] font-stats text-muted-foreground leading-relaxed">
          Your CSV should have these columns (header row required):
        </p>
        <div className="flex flex-wrap gap-1.5">
          {["business_name","category","city","state","phone","email","website","rating","status"].map((col) => (
            <span key={col}
              className="text-[10px] font-stats px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
              {col}
            </span>
          ))}
        </div>
        <button
          onClick={() => {
            const template = "business_name,category,city,state,phone,email,website,rating,status\nExample Salon,Salon,Mumbai,Maharashtra,+91 98765 43210,contact@example.com,https://example.com,4.5,New Lead";
            const blob = new Blob([template], { type: "text/csv" });
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement("a");
            a.href     = url;
            a.download = "leads_template.csv";
            a.click();
          }}
          className="text-xs text-primary hover:underline font-stats">
          ↓ Download template CSV
        </button>
      </div>
    </motion.div>
  );
}

// ── Appearance ─────────────────────────────────────────────────────────────────
function AppearanceSettings() {
  const [compact,    setCompact]    = useState(() => localStorage.getItem("crm_compact")    === "true");
  const [animations, setAnimations] = useState(() => localStorage.getItem("crm_animations") !== "false");

  function toggleCompact() {
    const v = !compact;
    setCompact(v);
    localStorage.setItem("crm_compact", String(v));
  }

  function toggleAnimations() {
    const v = !animations;
    setAnimations(v);
    localStorage.setItem("crm_animations", String(v));
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="glass rounded-xl p-6 space-y-4">
      <h3 className="font-heading text-lg text-foreground">Appearance</h3>
      {[
        { icon: Moon,      label: "Dark Mode",     desc: "Always on — LeadHunter is built for the dark side",  control: <span className="text-xs font-stats text-primary">ALWAYS ON</span> },
        { icon: RefreshCw, label: "Compact Mode",  desc: "Reduce spacing for more data density",                control: <Toggle on={compact}    onChange={toggleCompact}    /> },
        { icon: Zap,       label: "Animations",    desc: "Smooth transitions and micro-interactions",           control: <Toggle on={animations} onChange={toggleAnimations} /> },
      ].map((item) => (
        <div key={item.label} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
          <div className="flex items-center gap-3">
            <item.icon className="w-4 h-4 text-primary" />
            <div>
              <p className="text-sm font-medium text-foreground">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
          </div>
          {item.control}
        </div>
      ))}
    </motion.div>
  );
}