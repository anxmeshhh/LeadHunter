import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Clock, Phone, Mail, MessageSquare, ArrowRight, Loader2, RefreshCw } from "lucide-react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ─── Types ────────────────────────────────────────────────────────────────────
interface FollowUp {
  id: string;
  businessName: string;
  category: string;
  city: string;
  dueTime: string;
  rawDueDate: string;
  mode: "Call" | "Email" | "WhatsApp" | "LinkedIn" | "Other";
  isOverdue: boolean;
  title: string;
}

const modeIcons = {
  Call:     Phone,
  Email:    Mail,
  WhatsApp: MessageSquare,
  LinkedIn: MessageSquare,
  Other:    Clock,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDueTime(dueDateStr: string): { label: string; isOverdue: boolean } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDateStr);
  due.setHours(0, 0, 0, 0);

  const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0)  return { label: diffDays === -1 ? "Yesterday" : `${Math.abs(diffDays)} days ago`, isOverdue: true };
  if (diffDays === 0) return { label: "Today", isOverdue: false };
  if (diffDays === 1) return { label: "Tomorrow", isOverdue: false };
  return {
    label: due.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
    isOverdue: false,
  };
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function FollowUpList() {
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  const fetchFollowUps = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const today = new Date().toISOString().split("T")[0];

      // Fetch tasks due today or overdue, not yet done, joined with lead info
      const { data, error: fetchError } = await supabase
        .from("tasks")
        .select(`
          id,
          title,
          due_date,
          is_done,
          priority,
          leads (
            business_name,
            category,
            city
          )
        `)
        .eq("is_done", false)
        .lte("due_date", today)           // today or overdue
        .order("due_date", { ascending: true })
        .limit(10);

      if (fetchError) throw fetchError;

      const mapped: FollowUp[] = (data ?? []).map((task: any) => {
        const { label, isOverdue } = formatDueTime(task.due_date);

        // Infer contact mode from task title keywords
        const titleLower = (task.title ?? "").toLowerCase();
        let mode: FollowUp["mode"] = "Call";
        if (titleLower.includes("email"))    mode = "Email";
        else if (titleLower.includes("whatsapp") || titleLower.includes("wa")) mode = "WhatsApp";
        else if (titleLower.includes("linkedin")) mode = "LinkedIn";

        return {
          id:          task.id,
          title:       task.title,
          businessName: task.leads?.business_name ?? "Unknown Lead",
          category:    task.leads?.category       ?? "—",
          city:        task.leads?.city           ?? "—",
          dueTime:     label,
          rawDueDate:  task.due_date,
          mode,
          isOverdue,
        };
      });

      setFollowUps(mapped);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load follow-ups");
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Real-time subscription ──────────────────────────────────────────────────
  useEffect(() => {
    fetchFollowUps();

    const channel = supabase
      .channel("realtime:tasks")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        () => fetchFollowUps()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchFollowUps]);

  const overdue  = followUps.filter((f) => f.isOverdue);
  const upcoming = followUps.filter((f) => !f.isOverdue);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-xl p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-heading text-lg text-foreground">Today's Follow-Ups</h3>
        <div className="flex items-center gap-2">
          {loading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
          <button
            onClick={fetchFollowUps}
            disabled={loading}
            className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
          <span className="text-xs font-stats text-primary">{followUps.length} actions</span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <p className="text-xs text-destructive mb-3">⚠ {error}</p>
      )}

      {/* Loading skeleton */}
      {loading && followUps.length === 0 && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 rounded-lg bg-muted/50 animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && followUps.length === 0 && !error && (
        <div className="py-8 text-center">
          <Clock className="w-6 h-6 text-muted-foreground mx-auto mb-2 opacity-40" />
          <p className="text-sm text-muted-foreground">No follow-ups due today 🎉</p>
        </div>
      )}

      {/* Overdue */}
      {overdue.length > 0 && (
        <div className="mb-4">
          <span className="text-[10px] font-stats text-destructive uppercase tracking-widest mb-2 block">
            ⚠ Overdue ({overdue.length})
          </span>
          <div className="space-y-2">
            {overdue.map((item) => (
              <FollowUpItem key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}

      {/* Upcoming today */}
      {upcoming.length > 0 && (
        <div>
          <span className="text-[10px] font-stats text-muted-foreground uppercase tracking-widest mb-2 block">
            Due Today
          </span>
          <div className="space-y-2">
            {upcoming.map((item) => (
              <FollowUpItem key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ─── Follow-Up Item ───────────────────────────────────────────────────────────
function FollowUpItem({ item }: { item: FollowUp }) {
  const ModeIcon = modeIcons[item.mode] ?? Clock;

  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-200 cursor-pointer group ${
        item.isOverdue
          ? "bg-destructive/10 border border-destructive/20 hover:bg-destructive/15"
          : "bg-muted/50 hover:bg-muted"
      }`}
    >
      <div className={`p-2 rounded-lg ${item.isOverdue ? "bg-destructive/20" : "bg-primary/10"}`}>
        <ModeIcon className={`w-4 h-4 ${item.isOverdue ? "text-destructive" : "text-primary"}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{item.businessName}</p>
        <p className="text-xs text-muted-foreground truncate">
          {item.title} · {item.city}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" />
          <span className={`font-stats ${item.isOverdue ? "text-destructive" : ""}`}>
            {item.dueTime}
          </span>
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
}