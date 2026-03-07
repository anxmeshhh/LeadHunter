import { motion } from "framer-motion";
import { ReactNode } from "react";

interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: ReactNode;
  glowColor?: "primary" | "secondary" | "accent";
}

export default function StatCard({ title, value, change, changeType = "neutral", icon, glowColor = "primary" }: StatCardProps) {
  const glowClass = {
    primary: "glow-primary",
    secondary: "glow-secondary",
    accent: "glow-accent",
  }[glowColor];

  const changeColorClass = {
    positive: "text-success",
    negative: "text-destructive",
    neutral: "text-muted-foreground",
  }[changeType];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      className={`glass rounded-xl p-5 ${glowClass} transition-all duration-300`}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs font-stats text-muted-foreground uppercase tracking-wider">
          {title}
        </span>
        <div className="text-primary">{icon}</div>
      </div>
      <div className="font-stats text-3xl font-bold text-foreground animate-counter-up">
        {value}
      </div>
      {change && (
        <span className={`text-xs font-stats mt-1 inline-block ${changeColorClass}`}>
          {change}
        </span>
      )}
    </motion.div>
  );
}
