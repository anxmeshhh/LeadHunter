import { motion } from "framer-motion";
import { Flame, Target, Zap } from "lucide-react";

interface MotivationPanelProps {
  streak: number;
  dailyTarget: number;
  dailyDone: number;
}

export default function MotivationPanel({ streak, dailyTarget, dailyDone }: MotivationPanelProps) {
  const progress = Math.min((dailyDone / dailyTarget) * 100, 100);
  const isOnFire = streak >= 3;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="glass rounded-xl p-6 space-y-6"
    >
      {/* Streak */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-1">
          <Flame className={`w-6 h-6 ${isOnFire ? "text-primary animate-float" : "text-muted-foreground"}`} />
          <span className="font-stats text-4xl font-bold text-foreground">{streak}</span>
        </div>
        <span className="text-xs font-stats text-muted-foreground uppercase tracking-widest">
          Day Streak {isOnFire && "🔥"}
        </span>
      </div>

      {/* Daily Target */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            <span className="text-sm font-heading text-foreground">Today's Target</span>
          </div>
          <span className="font-stats text-sm text-primary">
            {dailyDone}/{dailyTarget}
          </span>
        </div>
        <div className="h-3 rounded-full bg-muted overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="h-full rounded-full"
            style={{ background: "var(--gradient-primary)" }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2 font-stats">
          {progress >= 100
            ? "🎯 Target smashed! Keep the momentum."
            : progress >= 50
            ? "⚡ Halfway there. Stay locked in."
            : "🚀 Start strong. Every lead counts."}
        </p>
      </div>

      {/* AI Insight */}
      <div className="glass rounded-lg p-3 border border-primary/20">
        <div className="flex items-center gap-2 mb-1">
          <Zap className="w-3 h-3 text-primary" />
          <span className="text-[10px] font-stats text-primary uppercase tracking-widest">AI Insight</span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Your best conversion window is 10AM–12PM. Coaching institutes respond 2.4x more on Tuesdays.
        </p>
      </div>
    </motion.div>
  );
}
