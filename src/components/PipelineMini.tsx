import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ─── Types ────────────────────────────────────────────────────────────────────
interface PipelineStage {
  name: string;
  count: number;
  value: number;
  color: string;
}

// Must match the CHECK constraint in your leads table
const STAGE_CONFIG: Record<string, { color: string; order: number }> = {
  "New Lead":      { color: "bg-muted-foreground", order: 1 },
  "Contacted":     { color: "bg-secondary",        order: 2 },
  "Replied":       { color: "bg-accent",            order: 3 },
  "Interested":    { color: "bg-accent",            order: 4 },
  "Proposal Sent": { color: "bg-primary",           order: 5 },
  "Negotiation":   { color: "bg-primary",           order: 6 },
  "Closed Won":    { color: "bg-success",           order: 7 },
  "Closed Lost":   { color: "bg-destructive",       order: 8 },
};

function formatValue(amount: number): string {
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000)   return `₹${(amount / 1000).toFixed(1)}K`;
  if (amount === 0)     return "₹0";
  return `₹${amount}`;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PipelineMini() {
  const [stages, setStages]   = useState<PipelineStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const fetchPipeline = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch all leads with their status and deal_value
      const { data, error: fetchError } = await supabase
        .from("leads")
        .select("status, deal_value");

      if (fetchError) throw fetchError;

      // Group by status
      const grouped: Record<string, { count: number; value: number }> = {};

      for (const lead of data ?? []) {
        const s = lead.status ?? "New Lead";
        if (!grouped[s]) grouped[s] = { count: 0, value: 0 };
        grouped[s].count += 1;
        grouped[s].value += lead.deal_value ?? 0;
      }

      // Build stage array in defined order, only include stages that exist in data
      const built: PipelineStage[] = Object.entries(STAGE_CONFIG)
        .sort(([, a], [, b]) => a.order - b.order)
        .filter(([name]) => grouped[name]?.count > 0)  // only show stages with leads
        .map(([name, cfg]) => ({
          name,
          count: grouped[name]?.count ?? 0,
          value: grouped[name]?.value ?? 0,
          color: cfg.color,
        }));

      // If no leads at all, show skeleton stages with 0
      if (built.length === 0) {
        setStages(
          Object.entries(STAGE_CONFIG)
            .sort(([, a], [, b]) => a.order - b.order)
            .slice(0, 6)
            .map(([name, cfg]) => ({ name, count: 0, value: 0, color: cfg.color }))
        );
      } else {
        setStages(built);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load pipeline");
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Real-time subscription ──────────────────────────────────────────────────
  useEffect(() => {
    fetchPipeline();

    const channel = supabase
      .channel("realtime:pipeline")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leads" },
        () => fetchPipeline()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchPipeline]);

  const maxCount    = Math.max(...stages.map((s) => s.count), 1);
  const totalClosed = stages.find((s) => s.name === "Closed Won")?.value ?? 0;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-xl p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-heading text-lg text-foreground">Pipeline Overview</h3>
        <div className="flex items-center gap-2">
          {loading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
          <span className="text-xs font-stats text-success">
            {formatValue(totalClosed)} closed
          </span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <p className="text-xs text-destructive mb-3">⚠ {error}</p>
      )}

      {/* Loading skeleton */}
      {loading && stages.length === 0 && (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-24 h-3 rounded bg-muted/50 animate-pulse" />
              <div className="flex-1 h-6 rounded-md bg-muted/50 animate-pulse" />
              <div className="w-12 h-3 rounded bg-muted/50 animate-pulse" />
            </div>
          ))}
        </div>
      )}

      {/* Pipeline bars */}
      {stages.length > 0 && (
        <div className="space-y-3">
          {stages.map((stage, i) => (
            <div key={stage.name} className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-24 truncate font-stats">
                {stage.name}
              </span>
              <div className="flex-1 h-6 bg-muted rounded-md overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: stage.count === 0 ? "4px" : `${(stage.count / maxCount) * 100}%` }}
                  transition={{ duration: 0.8, delay: i * 0.08, ease: "easeOut" }}
                  className={`h-full ${stage.color} rounded-md flex items-center justify-end pr-2 min-w-[24px]`}
                >
                  {stage.count > 0 && (
                    <span className="text-[10px] font-stats font-bold text-foreground">
                      {stage.count}
                    </span>
                  )}
                </motion.div>
              </div>
              <span className="text-xs font-stats text-muted-foreground w-16 text-right">
                {formatValue(stage.value)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && stages.every((s) => s.count === 0) && !error && (
        <p className="text-center text-xs text-muted-foreground py-4">
          No leads in pipeline yet. Start by discovering leads!
        </p>
      )}
    </motion.div>
  );
}