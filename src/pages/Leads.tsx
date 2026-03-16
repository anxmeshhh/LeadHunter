import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, ArrowUpDown, Star, Globe,
  Phone, Mail, MapPin, ChevronRight, Tag,
  Plus, RefreshCw, Loader2, AlertCircle, Trash2
} from "lucide-react";
import { useLeads, deleteLead, updateLeadStatus, addLead } from "../hooks/useLeads";
import type { Lead } from "../lib/supabase";

// ── Types ──────────────────────────────────────────────────────────────────────
interface TagData {
  id: string;
  name: string;
  color: string;
}

// Extend Lead to include tags (injected by useLeads hook)
interface LeadWithTags extends Lead {
  tags: TagData[];
}

// ── Score badge colors ─────────────────────────────────────────────────────────
const scoreColors: Record<string, string> = {
  High:   "text-primary bg-primary/10 border-primary/30",
  Medium: "text-accent bg-accent/10 border-accent/30",
  Low:    "text-muted-foreground bg-muted border-border",
};

// ── Status options ─────────────────────────────────────────────────────────────
const STATUS_OPTIONS: Lead["status"][] = [
  "New Lead", "Contacted", "Replied", "Interested",
  "Proposal Sent", "Negotiation", "Closed Won", "Closed Lost",
];

// ── Status colors ──────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  "New Lead":      "text-slate-400",
  "Contacted":     "text-cyan-400",
  "Replied":       "text-blue-400",
  "Interested":    "text-violet-400",
  "Proposal Sent": "text-purple-400",
  "Negotiation":   "text-amber-400",
  "Closed Won":    "text-emerald-400",
  "Closed Lost":   "text-red-400",
};

// ── Add Lead Modal ─────────────────────────────────────────────────────────────
function AddLeadModal({ onClose, onSave }: {
  onClose: () => void;
  onSave:  (lead: Partial<Lead>) => Promise<void>;
}) {
  const [form, setForm] = useState<Partial<Lead>>({
    business_name: "", category: "", city: "",
    phone: "", email: "", website: "", status: "New Lead",
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.business_name?.trim()) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
    onClose();
  };

  const FIELDS = [
    { key: "business_name", label: "Business Name *", placeholder: "e.g. Sharma Restaurant" },
    { key: "category",      label: "Category",        placeholder: "e.g. Restaurant, Salon, Gym" },
    { key: "city",          label: "City",            placeholder: "e.g. Mumbai" },
    { key: "phone",         label: "Phone",           placeholder: "+91 98765 43210" },
    { key: "email",         label: "Email",           placeholder: "info@business.com" },
    { key: "website",       label: "Website",         placeholder: "business.com" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="glass rounded-xl p-6 w-full max-w-md space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-heading font-bold text-foreground">Add New Lead</h2>

        {FIELDS.map(({ key, label, placeholder }) => (
          <div key={key}>
            <label className="text-xs font-stats text-muted-foreground uppercase tracking-widest mb-1 block">
              {label}
            </label>
            <input
              type="text"
              placeholder={placeholder}
              value={(form as any)[key] ?? ""}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
            />
          </div>
        ))}

        <div className="flex gap-3 pt-2">
          <button onClick={onClose}
            className="flex-1 py-2 rounded-lg border border-border text-muted-foreground text-sm hover:text-foreground transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || !form.business_name?.trim()}
            className="flex-1 py-2 rounded-lg text-sm font-heading font-semibold text-primary-foreground disabled:opacity-50 transition-all hover:opacity-90"
            style={{ background: "var(--gradient-primary)" }}>
            {saving ? "Saving..." : "Add Lead"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Main Leads Page ────────────────────────────────────────────────────────────
export default function Leads() {
  const navigate = useNavigate();

  // ✅ Cast leads to LeadWithTags since useLeads injects tags
  const { leads: rawLeads, loading, error, refetch } = useLeads();
  const leads = rawLeads as LeadWithTags[];

  const [searchQuery,  setSearchQuery]  = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("All");
  const [filterScore,  setFilterScore]  = useState<string>("All");
  const [sortBy,       setSortBy]       = useState<"score" | "created_at" | "rating">("created_at");
  const [showAddModal, setShowAddModal] = useState(false);
  const [deletingId,   setDeletingId]   = useState<string | null>(null);

  const handleAddLead = async (lead: Partial<Lead>) => {
    await addLead(lead);
    refetch();
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    await deleteLead(id);
    setDeletingId(null);
    refetch();
  };

  const handleStatusChange = async (id: string, status: Lead["status"]) => {
    await updateLeadStatus(id, status);
    refetch();
  };

  // ── Filter + Sort ────────────────────────────────────────────────────────────
  const filtered = leads
    .filter((l) => {
      const q           = searchQuery.toLowerCase();
      const matchSearch =
        l.business_name.toLowerCase().includes(q) ||
        (l.category ?? "").toLowerCase().includes(q) ||
        (l.city     ?? "").toLowerCase().includes(q) ||
        // ✅ also search by tag name
        (l.tags ?? []).some((t) => t.name.toLowerCase().includes(q));
      const matchStatus = filterStatus === "All" || l.status      === filterStatus;
      const matchScore  = filterScore  === "All" || l.score_label === filterScore;
      return matchSearch && matchStatus && matchScore;
    })
    .sort((a, b) => {
      if (sortBy === "score")  return b.score  - a.score;
      if (sortBy === "rating") return b.rating - a.rating;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">All Leads</h1>
          <p className="text-sm text-muted-foreground mt-1">
            <span className="font-stats text-primary">{leads.length}</span> leads in database
            {filtered.length !== leads.length && (
              <span className="ml-1 text-muted-foreground">
                · showing <span className="font-stats text-accent">{filtered.length}</span>
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refetch} disabled={loading}
            className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={() => setShowAddModal(true)}
            className="px-4 py-2 rounded-lg font-heading font-semibold text-sm text-primary-foreground flex items-center gap-2 transition-all hover:opacity-90"
            style={{ background: "var(--gradient-primary)" }}>
            <Plus className="w-4 h-4" /> Add Lead
          </button>
        </div>
      </motion.div>

      {/* Error */}
      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
          <button onClick={refetch} className="ml-auto text-xs underline">Retry</button>
        </div>
      )}

      {/* Search & Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder="Search by name, category, city or tag..."
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-muted border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
          />
        </div>

        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2.5 rounded-lg glass border border-border text-sm text-foreground bg-transparent focus:outline-none focus:ring-1 focus:ring-primary">
          <option value="All">All Status</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <select value={filterScore} onChange={(e) => setFilterScore(e.target.value)}
          className="px-3 py-2.5 rounded-lg glass border border-border text-sm text-foreground bg-transparent focus:outline-none focus:ring-1 focus:ring-primary">
          <option value="All">All Scores</option>
          <option value="High">High Potential</option>
          <option value="Medium">Medium Potential</option>
          <option value="Low">Low Priority</option>
        </select>

        <button
          onClick={() => setSortBy(
            sortBy === "score" ? "created_at" :
            sortBy === "created_at" ? "rating" : "score"
          )}
          className="px-4 py-2.5 rounded-lg glass border border-border text-muted-foreground hover:text-foreground flex items-center gap-2 text-sm transition-colors">
          <ArrowUpDown className="w-4 h-4" />
          Sort: {sortBy === "score" ? "Score" : sortBy === "rating" ? "Rating" : "Latest"}
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
          <span className="ml-2 text-sm text-muted-foreground">Loading leads...</span>
        </div>
      )}

      {/* Empty State */}
      {!loading && filtered.length === 0 && (
        <div className="glass rounded-xl p-16 text-center">
          <p className="text-muted-foreground text-sm">No leads found.</p>
          <p className="text-xs text-muted-foreground mt-1">
            {leads.length === 0
              ? "Add your first lead or use Discover to find prospects."
              : "Try adjusting your search or filters."}
          </p>
          {leads.length === 0 && (
            <button onClick={() => setShowAddModal(true)}
              className="mt-4 px-4 py-2 rounded-lg text-sm font-heading font-semibold text-primary-foreground"
              style={{ background: "var(--gradient-primary)" }}>
              Add First Lead
            </button>
          )}
        </div>
      )}

      {/* Table */}
      {!loading && filtered.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="glass rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {["Business", "Contact", "Rating", "Score", "Status", "Tags", ""].map((h) => (
                    <th key={h} className="text-left px-5 py-3 text-[10px] font-stats text-muted-foreground uppercase tracking-widest">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {filtered.map((lead, i) => (
                    <motion.tr key={lead.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      transition={{ delay: i * 0.03 }}
                      onClick={() => navigate(`/leads/${lead.id}`)}
                      className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer group">

                      {/* Business */}
                      <td className="px-5 py-4">
                        <p className="text-sm font-medium text-foreground">{lead.business_name}</p>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                          <MapPin className="w-3 h-3" />
                          {lead.city ?? "—"} · {lead.category ?? "—"}
                        </div>
                      </td>

                      {/* Contact */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          {lead.phone   && (
                            <a href={`tel:${lead.phone}`} onClick={(e) => e.stopPropagation()}
                              title={lead.phone} className="text-muted-foreground hover:text-primary transition-colors">
                              <Phone className="w-3.5 h-3.5" />
                            </a>
                          )}
                          {lead.email   && (
                            <a href={`mailto:${lead.email}`} onClick={(e) => e.stopPropagation()}
                              title={lead.email} className="text-muted-foreground hover:text-primary transition-colors">
                              <Mail className="w-3.5 h-3.5" />
                            </a>
                          )}
                          {lead.website && (
                            <a href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`}
                              target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                              title={lead.website} className="text-muted-foreground hover:text-primary transition-colors">
                              <Globe className="w-3.5 h-3.5" />
                            </a>
                          )}
                          {!lead.phone && !lead.email && !lead.website && (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </div>
                      </td>

                      {/* Rating */}
                      <td className="px-5 py-4">
                        {lead.rating > 0 ? (
                          <div className="flex items-center gap-1">
                            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                            <span className="text-sm font-stats text-foreground">{lead.rating}</span>
                            <span className="text-xs text-muted-foreground">({lead.review_count})</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* Score */}
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-stats border ${
                          scoreColors[lead.score_label] ?? scoreColors.Low
                        }`}>
                          {lead.score} · {lead.score_label}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        <select
                          value={lead.status}
                          onChange={(e) => handleStatusChange(lead.id, e.target.value as Lead["status"])}
                          onClick={(e) => e.stopPropagation()}
                          className={`text-xs font-stats bg-transparent border border-border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer ${
                            STATUS_COLORS[lead.status] ?? "text-muted-foreground"
                          }`}>
                          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>

                      {/* ✅ Tags — now correctly rendered from useLeads data */}
                      <td className="px-5 py-4">
                        <div className="flex gap-1 flex-wrap max-w-[200px]">
                          {(lead.tags ?? []).length > 0 ? (
                            (lead.tags ?? []).map((tag) => (
                              <span
                                key={tag.id}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-stats border"
                                style={{
                                  color:           tag.color,
                                  backgroundColor: `${tag.color}18`,
                                  borderColor:     `${tag.color}40`,
                                }}
                              >
                                {tag.name}
                              </span>
                            ))
                          ) : (
                            <span className="text-[10px] text-muted-foreground/40 font-stats">No tags</span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(lead.id); }}
                            disabled={deletingId === lead.id}
                            className="p-1 rounded text-muted-foreground hover:text-red-400 transition-colors">
                            {deletingId === lead.id
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <Trash2  className="w-3.5 h-3.5" />}
                          </button>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      <AnimatePresence>
        {showAddModal && (
          <AddLeadModal
            onClose={() => setShowAddModal(false)}
            onSave={handleAddLead}
          />
        )}
      </AnimatePresence>
    </div>
  );
}