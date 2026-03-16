import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Tag, Plus, X, Filter, Users, Search,
  Loader2, Trash2, Edit3, Save, AlertCircle,
  Check, RefreshCw
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import { useNavigate } from "react-router-dom";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ── Types ──────────────────────────────────────────────────────────────────────
interface TagData {
  id: string;
  name: string;
  color: string;
  count?: number;
}

interface TaggedLead {
  lead_id: string;
  tag_id: string;
  leads: {
    id: string;
    business_name: string;
    city: string;
    category: string;
    status: string;
    score: number;
  };
}

// ── Predefined tags every new user gets ───────────────────────────────────────
const PREDEFINED_TAGS = [
  { name: "🔥 Hot Lead",        color: "#EF4444" },
  { name: "💰 High Budget",     color: "#F59E0B" },
  { name: "⚡ Urgent",          color: "#F97316" },
  { name: "🎯 Decision Maker",  color: "#8B5CF6" },
  { name: "🌐 Needs Website",   color: "#06B6D4" },
  { name: "📈 SEO Opportunity", color: "#10B981" },
  { name: "🤝 Referral",        color: "#3B82F6" },
  { name: "💬 Responded",       color: "#84CC16" },
  { name: "🕐 Follow Up",       color: "#EC4899" },
  { name: "⭐ VIP Client",      color: "#6366F1" },
  { name: "🏪 Local Business",  color: "#14B8A6" },
  { name: "❌ Not Interested",  color: "#94A3B8" },
];

const COLOR_PRESETS = [
  "#8B5CF6", "#06B6D4", "#10B981", "#F59E0B",
  "#EF4444", "#EC4899", "#3B82F6", "#84CC16",
  "#F97316", "#6366F1", "#14B8A6", "#A855F7",
];

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

export default function Tags() {
  const navigate = useNavigate();

  const [tags,        setTags]        = useState<TagData[]>([]);
  const [leadTags,    setLeadTags]    = useState<TaggedLead[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [showCreate,  setShowCreate]  = useState(false);
  const [newTagName,  setNewTagName]  = useState("");
  const [newTagColor, setNewTagColor] = useState(COLOR_PRESETS[0]);
  const [creating,    setCreating]    = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [editingTag,  setEditingTag]  = useState<string | null>(null);
  const [editName,    setEditName]    = useState("");
  const [editColor,   setEditColor]   = useState("");
  const [saving,      setSaving]      = useState(false);
  const [deletingTag, setDeletingTag] = useState<string | null>(null);

  // ── Seed predefined tags for new users ────────────────────────────────────
  async function seedPredefinedTags(userId: string) {
    // Check if user already has tags
    const { data: existing } = await supabase
      .from("tags")
      .select("id")
      .eq("user_id", userId)
      .limit(1);

    // If they already have at least one tag, don't seed
    if (existing && existing.length > 0) return;

    // Insert all predefined tags for this user
    await supabase.from("tags").insert(
      PREDEFINED_TAGS.map((t) => ({
        name:    t.name,
        color:   t.color,
        user_id: userId,
      }))
    );
  }

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // ✅ Seed predefined tags if this is a new user
      await seedPredefinedTags(user.id);

      // ✅ Step 1: fetch only this user's tags
      const { data: tagsData, error: tagsErr } = await supabase
        .from("tags")
        .select("*")
        .eq("user_id", user.id)
        .order("name");

      if (tagsErr) throw tagsErr;

      const userTagIds = (tagsData ?? []).map((t: TagData) => t.id);

      // ✅ Step 2: fetch lead_tags filtered by user's tag IDs
      const { data: leadTagsData, error: ltErr } = userTagIds.length > 0
        ? await supabase
            .from("lead_tags")
            .select("lead_id, tag_id, leads(id, business_name, city, category, status, score)")
            .in("tag_id", userTagIds)
            .order("lead_id")
        : { data: [], error: null };

      if (ltErr) throw ltErr;

      // ✅ Step 3: count leads per tag
      const countMap: Record<string, number> = {};
      (leadTagsData ?? []).forEach((lt: any) => {
        countMap[lt.tag_id] = (countMap[lt.tag_id] ?? 0) + 1;
      });

      const enriched = (tagsData ?? []).map((t: TagData) => ({
        ...t,
        count: countMap[t.id] ?? 0,
      }));

      setTags(enriched);
      setLeadTags((leadTagsData ?? []) as unknown as TaggedLead[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load tags");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    const ch = supabase
      .channel("realtime:tags-page")
      .on("postgres_changes", { event: "*", schema: "public", table: "tags" },      fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "lead_tags" }, fetchAll)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchAll]);

  // ── Create Tag ─────────────────────────────────────────────────────────────
  async function handleCreate() {
    if (!newTagName.trim()) return;
    setCreating(true);
    setCreateError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setCreating(false); return; }

    const { error: err } = await supabase
      .from("tags")
      .insert({ name: newTagName.trim(), color: newTagColor, user_id: user.id });

    if (err) {
      setCreateError(err.message);
    } else {
      setNewTagName("");
      setNewTagColor(COLOR_PRESETS[0]);
      setShowCreate(false);
      fetchAll();
    }
    setCreating(false);
  }

  // ── Update Tag ─────────────────────────────────────────────────────────────
  async function handleUpdate(id: string) {
    if (!editName.trim()) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase
      .from("tags")
      .update({ name: editName.trim(), color: editColor })
      .eq("id", id)
      .eq("user_id", user?.id);
    setEditingTag(null);
    setSaving(false);
    fetchAll();
  }

  // ── Delete Tag ─────────────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    setDeletingTag(id);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("lead_tags").delete().eq("tag_id", id);
    await supabase.from("tags").delete().eq("id", id).eq("user_id", user?.id);
    if (selectedTag === tags.find((t) => t.id === id)?.name) setSelectedTag(null);
    setDeletingTag(null);
    fetchAll();
  }

  // ── Filtered leads ─────────────────────────────────────────────────────────
  const selectedTagId = selectedTag
    ? tags.find((t) => t.name === selectedTag)?.id
    : null;

  const filteredLeadTags = leadTags.filter((lt) => {
    const lead = Array.isArray(lt.leads) ? lt.leads[0] : lt.leads;
    if (!lead) return false;
    const matchTag    = selectedTagId ? lt.tag_id === selectedTagId : true;
    const matchSearch = searchQuery
      ? lead.business_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.city?.toLowerCase().includes(searchQuery.toLowerCase())
      : true;
    return matchTag && matchSearch;
  });

  const seenLeads = new Set<string>();
  const uniqueLeadTags = filteredLeadTags.filter((lt) => {
    if (seenLeads.has(lt.lead_id)) return false;
    seenLeads.add(lt.lead_id);
    return true;
  });

  function getLeadTagNames(leadId: string): TagData[] {
    return leadTags
      .filter((lt) => lt.lead_id === leadId)
      .map((lt) => tags.find((t) => t.id === lt.tag_id))
      .filter(Boolean) as TagData[];
  }

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Lead Tags</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Click any tag to filter leads ·{" "}
            <span className="font-stats text-primary">{tags.length} tags</span>
            {" · "}
            <span className="font-stats text-muted-foreground">{leadTags.length} assignments</span>
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
          <button onClick={() => setShowCreate(!showCreate)}
            className="px-4 py-2.5 rounded-lg font-heading font-semibold text-sm text-primary-foreground transition-all hover:opacity-90 flex items-center gap-2"
            style={{ background: "var(--gradient-primary)" }}>
            <Plus className="w-4 h-4" /> Custom Tag
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

      {/* Create Tag Panel */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            className="overflow-hidden"
          >
            <div className="glass rounded-xl p-5 space-y-4 border border-primary/20">
              <p className="text-sm font-heading font-semibold text-foreground">Create Custom Tag</p>
              <div className="flex gap-3 flex-wrap">
                <input
                  autoFocus
                  type="text"
                  placeholder="Tag name e.g. VIP, Callback Needed..."
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  className="flex-1 min-w-[200px] px-3 py-2.5 rounded-lg bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <div className="flex gap-2 items-center flex-wrap">
                  {COLOR_PRESETS.map((c) => (
                    <button key={c} onClick={() => setNewTagColor(c)}
                      className={`w-6 h-6 rounded-full border-2 transition-all ${newTagColor === c ? "border-white scale-110" : "border-transparent"}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              {newTagName && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-stats">Preview:</span>
                  <span
                    className="inline-flex items-center gap-1.5 text-xs font-stats px-2.5 py-1 rounded-full border"
                    style={{ color: newTagColor, backgroundColor: `${newTagColor}18`, borderColor: `${newTagColor}40` }}
                  >
                    <Tag className="w-3 h-3" /> {newTagName}
                  </span>
                </div>
              )}

              {createError && <p className="text-xs text-red-400">{createError}</p>}

              <div className="flex gap-2">
                <button onClick={() => { setShowCreate(false); setNewTagName(""); }}
                  className="flex-1 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Cancel
                </button>
                <button onClick={handleCreate} disabled={creating || !newTagName.trim()}
                  className="flex-1 py-2 rounded-lg text-sm font-heading font-semibold text-primary-foreground disabled:opacity-40 flex items-center justify-center gap-2 transition-all hover:opacity-90"
                  style={{ background: "var(--gradient-primary)" }}>
                  {creating
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Creating...</>
                    : <><Check className="w-3.5 h-3.5" /> Create Tag</>}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tags Cloud */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-heading text-base text-foreground">Your Tags</h3>
            <p className="text-[10px] font-stats text-muted-foreground mt-0.5">
              Click a tag to filter leads · hover to edit or delete
            </p>
          </div>
          {selectedTag && (
            <button onClick={() => setSelectedTag(null)}
              className="text-xs font-stats text-primary hover:underline flex items-center gap-1">
              <X className="w-3 h-3" /> Clear filter
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex gap-2 flex-wrap">
            {[1,2,3,4,5,6,7,8].map((i) => (
              <div key={i} className="h-9 w-32 rounded-full bg-muted/50 animate-pulse" />
            ))}
          </div>
        ) : tags.length === 0 ? (
          <div className="text-center py-8">
            <Tag className="w-6 h-6 text-muted-foreground mx-auto mb-2 opacity-40" />
            <p className="text-sm text-muted-foreground">Loading your tags...</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2.5">
            {tags.map((tag) => (
              <div key={tag.id} className="group relative">
                {editingTag === tag.id ? (
                  <div className="flex items-center gap-2 p-2 rounded-xl border border-primary/30 bg-muted/80">
                    <input autoFocus value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleUpdate(tag.id)}
                      className="w-32 px-2 py-1 rounded-lg bg-muted border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <div className="flex gap-1">
                      {COLOR_PRESETS.slice(0, 6).map((c) => (
                        <button key={c} onClick={() => setEditColor(c)}
                          className={`w-4 h-4 rounded-full border transition-all ${editColor === c ? "border-white scale-110" : "border-transparent"}`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                    <button onClick={() => handleUpdate(tag.id)} disabled={saving}
                      className="text-primary hover:text-primary/80">
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => setEditingTag(null)}
                      className="text-muted-foreground hover:text-foreground">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setSelectedTag(selectedTag === tag.name ? null : tag.name)}
                    className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-stats border transition-all hover:scale-105 active:scale-95 ${
                      selectedTag === tag.name
                        ? "ring-2 ring-offset-1 ring-offset-background scale-105 shadow-lg"
                        : "hover:shadow-md"
                    }`}
                    style={{
                      color:           tag.color,
                      backgroundColor: selectedTag === tag.name
                        ? `${tag.color}30`
                        : `${tag.color}15`,
                      borderColor:     `${tag.color}50`,
                      
                      boxShadow:       selectedTag === tag.name
                        ? `0 0 12px ${tag.color}40`
                        : undefined,
                    }}
                  >
                    {tag.name}
                    {(tag.count ?? 0) > 0 && (
                      <span
                        className="font-stats font-bold text-[10px] px-1.5 py-0.5 rounded-full"
                        style={{ backgroundColor: `${tag.color}30` }}
                      >
                        {tag.count}
                      </span>
                    )}
                  </button>
                )}

                {/* Edit / Delete on hover */}
                {editingTag !== tag.id && (
                  <div className="absolute -top-2 -right-1 hidden group-hover:flex gap-1 z-10">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingTag(tag.id);
                        setEditName(tag.name);
                        setEditColor(tag.color);
                      }}
                      className="p-1 rounded-full bg-background border border-border text-muted-foreground hover:text-primary shadow-md transition-colors">
                      <Edit3 className="w-2.5 h-2.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(tag.id); }}
                      disabled={deletingTag === tag.id}
                      className="p-1 rounded-full bg-background border border-border text-muted-foreground hover:text-red-400 shadow-md transition-colors">
                      {deletingTag === tag.id
                        ? <Loader2 className="w-2.5 h-2.5 animate-spin" />
                        : <Trash2  className="w-2.5 h-2.5" />}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Tagged Leads */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-xl p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-primary" />
            <h3 className="font-heading text-base text-foreground">
              {selectedTag
                ? <span>Leads tagged <span style={{ color: tags.find(t => t.name === selectedTag)?.color }}>{selectedTag}</span></span>
                : "All Tagged Leads"}
            </h3>
            <span className="text-xs font-stats text-muted-foreground">({uniqueLeadTags.length})</span>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input type="text" placeholder="Search leads..."
              value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary w-48"
            />
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1,2,3,4].map((i) => <div key={i} className="h-14 rounded-lg bg-muted/50 animate-pulse" />)}
          </div>
        ) : uniqueLeadTags.length === 0 ? (
          <div className="text-center py-10 space-y-2">
            <Users className="w-6 h-6 text-muted-foreground mx-auto opacity-40" />
            <p className="text-sm text-muted-foreground">
              {selectedTag
                ? `No leads tagged "${selectedTag}" yet.`
                : "No tagged leads yet."}
            </p>
            <p className="text-xs text-muted-foreground">
              Open any lead and assign tags from the Lead Detail page.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {uniqueLeadTags.map((lt, i) => {
                const lead = Array.isArray(lt.leads) ? lt.leads[0] : lt.leads;
                if (!lead) return null;
                const leadTagNames = getLeadTagNames(lt.lead_id);
                return (
                  <motion.div
                    key={lt.lead_id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => navigate(`/leads/${lt.lead_id}`)}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/60 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Users className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                          {lead.business_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {lead.city} · {lead.category}
                          {lead.status && (
                            <span className={`ml-2 font-stats ${STATUS_COLORS[lead.status] ?? "text-muted-foreground"}`}>
                              · {lead.status}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      {lead.score > 0 && (
                        <span className="text-[10px] font-stats text-primary">{lead.score}pts</span>
                      )}
                      {leadTagNames.map((tag) => (
                        <span key={tag.id}
                          className="text-[10px] font-stats px-2.5 py-1 rounded-full border"
                          style={{
                            color:           tag.color,
                            backgroundColor: `${tag.color}15`,
                            borderColor:     `${tag.color}40`,
                          }}>
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </motion.div>
    </div>
  );
}