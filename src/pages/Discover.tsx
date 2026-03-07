import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, MapPin, Zap, Star, Globe, Phone,
  Plus, Loader2, AlertCircle, CheckCircle,
  Target, Brain, ChevronDown, X, Sparkles
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { computeLeadScore } from "../hooks/useLeads";

// ── Types ──────────────────────────────────────────────────────────────────────
interface DiscoveredLead {
  place_id: string;
  business_name: string;
  address: string;
  city: string;
  phone: string;
  website: string;
  rating: number;
  review_count: number;
  category: string;
  saved: boolean;
  saving: boolean;
  loadingDetails: boolean;
  opportunityScore: number;
  opportunityLabel: "🔴 Hot Target" | "🟡 Warm Target" | "🟢 Low Priority";
  opportunities: string[];
  aiPitch: string;
  loadingPitch: boolean;
}

// ── Hunt Categories ────────────────────────────────────────────────────────────
const HUNT_CATEGORIES = [
  { label: "Clinics & Doctors",     icon: "🏥", query: "clinics doctors",        reason: "Need booking systems + website" },
  { label: "Salons & Spas",         icon: "💇", query: "salons spas",             reason: "Need online booking + portfolio" },
  { label: "Restaurants & Cafes",   icon: "🍽️", query: "restaurants cafes",      reason: "Need menu site + reservations" },
  { label: "Law Firms & CA",        icon: "⚖️", query: "law firms CA offices",    reason: "No websites, high budget" },
  { label: "Real Estate",           icon: "🏠", query: "real estate agents",      reason: "Need property listing sites" },
  { label: "Interior Designers",    icon: "🛋️", query: "interior designers",      reason: "Need portfolio websites" },
  { label: "Event Planners",        icon: "🎪", query: "event planners",          reason: "Need booking + portfolio" },
  { label: "Schools & Institutes",  icon: "📚", query: "schools institutes",      reason: "Need admission portals" },
  { label: "Manufacturers",         icon: "🏭", query: "local manufacturers",     reason: "Zero digital presence" },
  { label: "Retail Shops",          icon: "🛍️", query: "retail shops",           reason: "Need ecommerce/catalogue" },
  { label: "Gyms & Fitness",        icon: "🏋️", query: "gyms fitness centers",   reason: "Need membership booking" },
  { label: "Photographers",         icon: "📸", query: "photographers studios",   reason: "Need portfolio + booking" },
];

// ── Top Indian Cities ──────────────────────────────────────────────────────────
const CITIES = [
  "Mumbai", "Delhi", "Bangalore", "Hyderabad", "Chennai",
  "Pune", "Kolkata", "Ahmedabad", "Jaipur", "Surat",
  "Lucknow", "Kanpur", "Nagpur", "Indore", "Bhopal",
  "Visakhapatnam", "Patna", "Vadodara", "Coimbatore", "Kochi",
];

// ── Helpers ────────────────────────────────────────────────────────────────────
function extractCity(address: string): string {
  const parts = address.split(",");
  return parts.length >= 2
    ? parts[parts.length - 3]?.trim() ?? parts[0]?.trim()
    : address;
}

function extractCategory(types: string[] = []): string {
  const skip = ["establishment", "point_of_interest", "premise", "political", "geocode"];
  const clean = types.find((t) => !skip.includes(t));
  if (!clean) return "Business";
  return clean.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Compute Opportunity Score ──────────────────────────────────────────────────
function computeOpportunity(lead: Partial<DiscoveredLead>): {
  opportunityScore: number;
  opportunityLabel: DiscoveredLead["opportunityLabel"];
  opportunities: string[];
} {
  const opportunities: string[] = [];
  let score = 0;

  if (!lead.website) {
    opportunities.push("❌ No website — pitch web design");
    score += 40;
  } else {
    opportunities.push("✅ Has website — pitch redesign/SEO");
    score += 10;
  }

  if (!lead.phone) {
    opportunities.push("❌ No phone listed — pitch contact setup");
    score += 10;
  }

  if (lead.rating && lead.rating >= 4.0 && lead.review_count && lead.review_count >= 50) {
    opportunities.push("⭐ Popular business — high budget potential");
    score += 20;
  }

  if (lead.review_count && lead.review_count < 20) {
    opportunities.push("📉 Low reviews — pitch review management");
    score += 15;
  }

  if (lead.rating && lead.rating < 3.5) {
    opportunities.push("⚠️ Low rating — pitch reputation management");
    score += 10;
  }

  opportunities.push("📱 No booking system detected — pitch CRM");
  score += 15;

  const opportunityLabel: DiscoveredLead["opportunityLabel"] =
    score >= 60 ? "🔴 Hot Target" :
    score >= 30 ? "🟡 Warm Target" :
    "🟢 Low Priority";

  return { opportunityScore: Math.min(score, 100), opportunityLabel, opportunities };
}

// ── Fetch Place Details (v2) ───────────────────────────────────────────────────
async function fetchPlaceDetails(
  placeId: string,
  apiKey: string,
  apiHost: string
): Promise<{ website: string; phone: string }> {
  try {
    const url = `https://${apiHost}/v1/places/${placeId}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "x-rapidapi-key":  apiKey,
        "x-rapidapi-host": apiHost,
        "X-Goog-FieldMask": "websiteUri,nationalPhoneNumber,internationalPhoneNumber",
      },
    });
    if (!response.ok) return { website: "", phone: "" };
    const data = await response.json();
    return {
      website: data.websiteUri ?? "",
      phone:   data.nationalPhoneNumber ?? data.internationalPhoneNumber ?? "",
    };
  } catch {
    return { website: "", phone: "" };
  }
}

// ── Generate AI Pitch via Groq ─────────────────────────────────────────────────
async function generateAIPitch(lead: DiscoveredLead): Promise<string> {
  try {
    const groqKey = import.meta.env.VITE_GROQ_API_KEY;
    if (!groqKey) return "Add VITE_GROQ_API_KEY to .env to enable AI pitches.";

    const prompt = `You are an expert freelance sales consultant. Generate a short, personalized cold outreach message (WhatsApp/call script) for a freelancer offering web design and CRM/booking systems.

Business: ${lead.business_name}
Category: ${lead.category}
City: ${lead.city}
Has Website: ${lead.website ? "Yes - " + lead.website : "No"}
Phone: ${lead.phone || "Not listed"}
Rating: ${lead.rating} (${lead.review_count} reviews)
Opportunities identified: ${lead.opportunities.join(", ")}

Write a 3-4 line personalized pitch. Be direct, friendly, and value-focused. Mention their specific gap. End with a call to action. No fluff.`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${groqKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 200,
        temperature: 0.7,
      }),
    });

    const data = await response.json();
    return data.choices?.[0]?.message?.content ?? "Could not generate pitch.";
  } catch {
    return "Could not generate pitch. Check your Groq API key.";
  }
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function Discover() {
  const [city, setCity]                   = useState("");
  const [customQuery, setCustomQuery]     = useState("");
  const [selectedCategory, setSelectedCategory] = useState<typeof HUNT_CATEGORIES[0] | null>(null);
  const [results, setResults]             = useState<DiscoveredLead[]>([]);
  const [loading, setLoading]             = useState(false);
  const [loadingMore, setLoadingMore]     = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const [searched, setSearched]           = useState(false);
  const [savedCount, setSavedCount]       = useState(0);
  const [filterMode, setFilterMode]       = useState<"all" | "hot" | "warm" | "nowebsite">("all");
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const [expandedPitch, setExpandedPitch] = useState<string | null>(null);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [currentQuery, setCurrentQuery]   = useState<string>("");

  // ── Filtered Results ─────────────────────────────────────────────────────────
  const displayResults = results.filter((r) => {
    if (r.loadingDetails) return filterMode === "all";
    if (filterMode === "hot")       return r.opportunityLabel === "🔴 Hot Target";
    if (filterMode === "warm")      return r.opportunityLabel === "🟡 Warm Target";
    if (filterMode === "nowebsite") return !r.website;
    return true;
  });

  const hotCount       = results.filter((r) => !r.loadingDetails && r.opportunityLabel === "🔴 Hot Target").length;
  const warmCount      = results.filter((r) => !r.loadingDetails && r.opportunityLabel === "🟡 Warm Target").length;
  const noWebsiteCount = results.filter((r) => !r.loadingDetails && !r.website).length;
  const stillLoading   = results.some((r) => r.loadingDetails);

  // ── Build Search Query ───────────────────────────────────────────────────────
  function buildQuery(): string {
    const location = city.trim() || "India";
    if (customQuery.trim()) return `${customQuery} in ${location}`;
    if (selectedCategory)   return `${selectedCategory.query} in ${location}`;
    return "";
  }

  // ── Fetch and process results from API (v2) ─────────────────────────────────
  async function fetchAndProcess(query: string, pageToken: string | null, append: boolean) {
    const apiKey  = import.meta.env.VITE_RAPIDAPI_KEY;
    const apiHost = import.meta.env.VITE_RAPIDAPI_HOST;
    if (!apiKey || !apiHost) throw new Error("RapidAPI credentials missing.");

    const url = `https://${apiHost}/v1/places:searchText`;

    const body: any = {
      textQuery:    query,
      languageCode: "en",
      regionCode:   "IN",
      maxResultCount: 20,
    };
    if (pageToken) body.pageToken = pageToken;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "x-rapidapi-key":  apiKey,
        "x-rapidapi-host": apiHost,
        "Content-Type":    "application/json",
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.types,places.rating,places.userRatingCount,places.nationalPhoneNumber,places.websiteUri,nextPageToken",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) throw new Error(`RapidAPI error: ${response.status}`);
    const data = await response.json();

    // Save next page token
    setNextPageToken(data.nextPageToken ?? null);

    const places = data.places ?? [];
    if (places.length === 0) return;

    // Avoid duplicates
    const existingIds = append
      ? new Set(results.map((r) => r.place_id))
      : new Set<string>();

    const newPlaces = places.filter((p: any) => !existingIds.has(p.id));

    const basicLeads: DiscoveredLead[] = newPlaces.map((place: any) => ({
      place_id:         place.id,
      business_name:    place.displayName?.text ?? "Unknown",
      address:          place.formattedAddress ?? "",
      city:             extractCity(place.formattedAddress ?? ""),
      phone:            place.nationalPhoneNumber ?? "",
      website:          place.websiteUri ?? "",
      rating:           place.rating ?? 0,
      review_count:     place.userRatingCount ?? 0,
      category:         extractCategory(place.types ?? []),
      saved:            false,
      saving:           false,
      loadingDetails:   false, // v2 returns website+phone directly
      opportunityScore: 0,
      opportunityLabel: "🟡 Warm Target" as const,
      opportunities:    [],
      aiPitch:          "",
      loadingPitch:     false,
    }));

    // Compute opportunity scores immediately since we have all data
    const scoredLeads = basicLeads.map((lead) => ({
      ...lead,
      ...computeOpportunity(lead),
    }));

    if (append) {
      setResults((prev) => [...prev, ...scoredLeads]);
    } else {
      setResults(scoredLeads);
    }
  }

  // ── Search ───────────────────────────────────────────────────────────────────
  async function handleSearch() {
    const q = buildQuery();
    if (!q) return;
    setLoading(true);
    setError(null);
    setResults([]);
    setNextPageToken(null);
    setSearched(true);
    setCurrentQuery(q);
    try {
      await fetchAndProcess(q, null, false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Search failed.");
    } finally {
      setLoading(false);
    }
  }

  // ── Load More ────────────────────────────────────────────────────────────────
  async function handleLoadMore() {
    if (!nextPageToken || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      await fetchAndProcess(currentQuery, nextPageToken, true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load more.");
    } finally {
      setLoadingMore(false);
    }
  }

  // ── Generate AI Pitch for one lead ───────────────────────────────────────────
  async function handleGeneratePitch(placeId: string) {
    setResults((prev) =>
      prev.map((r) => r.place_id === placeId ? { ...r, loadingPitch: true } : r)
    );
    const lead = results.find((r) => r.place_id === placeId)!;
    const pitch = await generateAIPitch(lead);
    setResults((prev) =>
      prev.map((r) => r.place_id === placeId ? { ...r, aiPitch: pitch, loadingPitch: false } : r)
    );
    setExpandedPitch(placeId);
  }

  // ── Save Lead ────────────────────────────────────────────────────────────────
  async function handleSaveLead(placeId: string) {
    const lead = results.find((r) => r.place_id === placeId);
    if (!lead || lead.saved || lead.saving) return;

    setResults((prev) =>
      prev.map((r) => r.place_id === placeId ? { ...r, saving: true } : r)
    );

    try {
      const { score, score_label } = computeLeadScore({
        has_website:  !!lead.website,
        email:        null,
        phone:        lead.phone || null,
        rating:       lead.rating,
        review_count: lead.review_count,
      });

      const { error: insertError } = await supabase.from("leads").upsert(
        {
          business_name:    lead.business_name,
          category:         lead.category,
          city:             lead.city,
          address:          lead.address,
          phone:            lead.phone   || null,
          website:          lead.website || null,
          google_place_id:  lead.place_id,
          rating:           lead.rating,
          review_count:     lead.review_count,
          has_website:      !!lead.website,
          ai_pitch:         lead.aiPitch || null,
          ai_opportunities: lead.opportunities,
          score,
          score_label,
          status:           "New Lead",
          source:           "google_places",
        },
        { onConflict: "google_place_id" }
      );

      if (insertError) throw insertError;
      setResults((prev) =>
        prev.map((r) => r.place_id === placeId ? { ...r, saved: true, saving: false } : r)
      );
      setSavedCount((c) => c + 1);
    } catch (err) {
      console.error("Save error:", err);
      setResults((prev) =>
        prev.map((r) => r.place_id === placeId ? { ...r, saving: false } : r)
      );
    }
  }

  // ── Save All Visible ─────────────────────────────────────────────────────────
  async function handleSaveAll() {
    const unsaved = displayResults.filter((r) => !r.saved && !r.loadingDetails);
    for (const lead of unsaved) await handleSaveLead(lead.place_id);
  }

  // ── Opportunity color ────────────────────────────────────────────────────────
  function oppColor(label: DiscoveredLead["opportunityLabel"]) {
    if (label === "🔴 Hot Target")   return "border-red-500/40 bg-red-500/5";
    if (label === "🟡 Warm Target")  return "border-yellow-500/40 bg-yellow-500/5";
    return "border-border";
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Lead Discovery</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your AI-powered client hunting ground ·{" "}
            <span className="font-stats text-primary">Pan India</span>
          </p>
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
          <Zap className="w-3 h-3 text-primary animate-pulse" />
          <span className="text-xs font-stats text-primary">AI ENGINE ACTIVE</span>
        </div>
      </motion.div>

      {/* Hunt Control Panel */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="glass rounded-xl p-6 space-y-5"
      >
        {/* City + Custom Query Row */}
        <div className="flex gap-3 flex-wrap">

          {/* City Selector */}
          <div className="relative">
            <button
              onClick={() => setShowCityDropdown(!showCityDropdown)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-muted border border-border text-sm text-foreground hover:border-primary/50 transition-all min-w-[160px]"
            >
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <span>{city || "Select City"}</span>
              <ChevronDown className="w-3 h-3 text-muted-foreground ml-auto" />
            </button>
            <AnimatePresence>
              {showCityDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="absolute top-full mt-1 left-0 z-50 glass rounded-xl border border-border p-2 w-48 max-h-60 overflow-y-auto shadow-xl"
                >
                  <button
                    onClick={() => { setCity(""); setShowCityDropdown(false); }}
                    className="w-full text-left px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground rounded transition-colors"
                  >
                    Pan India (no filter)
                  </button>
                  {CITIES.map((c) => (
                    <button
                      key={c}
                      onClick={() => { setCity(c); setShowCityDropdown(false); }}
                      className={`w-full text-left px-3 py-1.5 text-xs rounded transition-colors ${
                        city === c ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Custom Query */}
          <div className="flex-1 relative min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Custom search e.g. 'dentists' or 'wedding planners'..."
              value={customQuery}
              onChange={(e) => { setCustomQuery(e.target.value); setSelectedCategory(null); }}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-muted border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-all"
            />
          </div>

          {/* Search Button */}
          <button
            onClick={handleSearch}
            disabled={loading || (!selectedCategory && !customQuery.trim())}
            className="px-6 py-2.5 rounded-lg font-heading font-semibold text-sm text-primary-foreground transition-all hover:opacity-90 glow-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            style={{ background: "var(--gradient-primary)" }}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4" />}
            {loading ? "Hunting..." : "Hunt Leads"}
          </button>
        </div>

        {/* Category Grid */}
        <div>
          <p className="text-xs font-stats text-muted-foreground uppercase tracking-widest mb-3">
            Quick Hunt by Category
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {HUNT_CATEGORIES.map((cat) => (
              <button
                key={cat.label}
                onClick={() => { setSelectedCategory(cat); setCustomQuery(""); }}
                className={`flex flex-col items-center gap-1 p-3 rounded-xl border text-center transition-all ${
                  selectedCategory?.label === cat.label
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-muted/50 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
              >
                <span className="text-xl">{cat.icon}</span>
                <span className="text-[10px] font-stats leading-tight">{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Selected category reason */}
        {selectedCategory && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20">
            <span className="text-lg">{selectedCategory.icon}</span>
            <div>
              <p className="text-xs font-heading font-semibold text-primary">{selectedCategory.label}</p>
              <p className="text-[10px] text-muted-foreground">{selectedCategory.reason}</p>
            </div>
            <button onClick={() => setSelectedCategory(null)} className="ml-auto text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </motion.div>

      {/* Error */}
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-3">
          <AlertCircle className="w-4 h-4 shrink-0" />{error}
        </div>
      )}

      {/* Results */}
      {searched && !loading && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">

          {/* Stats Bar */}
          {results.length > 0 && (
            <div className="glass rounded-xl p-4 flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  <span className="font-stats text-primary">{results.length}</span> found
                </span>
                {stillLoading && (
                  <span className="text-xs text-muted-foreground font-stats flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> analyzing...
                  </span>
                )}
              </div>

              {/* Filter Tabs */}
              <div className="flex gap-2 flex-wrap">
                {[
                  { key: "all",       label: `All (${results.length})`,          color: "text-foreground" },
                  { key: "hot",       label: `🔴 Hot (${hotCount})`,              color: "text-red-400" },
                  { key: "warm",      label: `🟡 Warm (${warmCount})`,            color: "text-yellow-400" },
                  { key: "nowebsite", label: `🎯 No Website (${noWebsiteCount})`, color: "text-primary" },
                ].map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setFilterMode(f.key as any)}
                    className={`px-3 py-1 rounded-lg text-xs font-stats border transition-all ${
                      filterMode === f.key
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/30"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <button
                onClick={handleSaveAll}
                disabled={displayResults.every((r) => r.saved) || stillLoading}
                className="ml-auto px-4 py-1.5 rounded-lg text-xs font-heading font-semibold text-primary-foreground flex items-center gap-2 hover:opacity-90 disabled:opacity-40 transition-all"
                style={{ background: "var(--gradient-primary)" }}
              >
                <Plus className="w-3.5 h-3.5" /> Save {filterMode !== "all" ? "Filtered" : "All"} to CRM
              </button>
            </div>
          )}

          {/* No Results */}
          {results.length === 0 && (
            <div className="glass rounded-xl p-12 text-center">
              <Target className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-50" />
              <p className="text-muted-foreground text-sm">No results found. Try a different category or city.</p>
            </div>
          )}

          {/* Results Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <AnimatePresence>
              {displayResults.map((lead) => (
                <motion.div
                  key={lead.place_id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`glass rounded-xl p-4 space-y-3 border transition-all ${
                    lead.saved ? "border-success/40 bg-success/5" : oppColor(lead.opportunityLabel)
                  }`}
                >
                  {/* Name + Opportunity Label */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-heading font-semibold text-foreground leading-tight truncate">
                        {lead.business_name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{lead.category}</p>
                    </div>
                    {lead.saved ? (
                      <CheckCircle className="w-4 h-4 text-success shrink-0" />
                    ) : lead.loadingDetails ? (
                      <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin shrink-0" />
                    ) : (
                      <span className={`text-[10px] font-stats px-1.5 py-0.5 rounded border shrink-0 ${
                        lead.opportunityLabel === "🔴 Hot Target"
                          ? "text-red-400 bg-red-400/10 border-red-400/30"
                          : lead.opportunityLabel === "🟡 Warm Target"
                          ? "text-yellow-400 bg-yellow-400/10 border-yellow-400/30"
                          : "text-muted-foreground bg-muted border-border"
                      }`}>
                        {lead.opportunityLabel}
                      </span>
                    )}
                  </div>

                  {/* Address */}
                  <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="w-3 h-3 shrink-0 mt-0.5" />
                    <span className="line-clamp-1">{lead.address}</span>
                  </div>

                  {/* Contact */}
                  <div className="flex flex-wrap gap-3 min-h-[18px]">
                    {lead.loadingDetails ? (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> Fetching...
                      </span>
                    ) : (
                      <>
                        {lead.phone && (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Phone className="w-3 h-3" /> {lead.phone}
                          </span>
                        )}
                        {lead.website ? (
                          <a
                            href={`https://${lead.website.replace(/^https?:\/\//, "")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Globe className="w-3 h-3" /> Website
                          </a>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-red-400/80">
                            <Globe className="w-3 h-3" /> No website
                          </span>
                        )}
                      </>
                    )}
                  </div>

                  {/* Rating */}
                  {lead.rating > 0 && (
                    <div className="flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 text-primary fill-primary" />
                      <span className="text-xs font-stats text-foreground">{lead.rating}</span>
                      <span className="text-xs text-muted-foreground">({lead.review_count} reviews)</span>
                    </div>
                  )}

                  {/* Opportunities */}
                  {!lead.loadingDetails && lead.opportunities.length > 0 && (
                    <div className="space-y-1">
                      {lead.opportunities.slice(0, 2).map((opp, i) => (
                        <p key={i} className="text-[10px] font-stats text-muted-foreground">{opp}</p>
                      ))}
                    </div>
                  )}

                  {/* Opportunity Score Bar */}
                  {!lead.loadingDetails && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-stats text-muted-foreground">OPPORTUNITY</span>
                        <span className="text-[10px] font-stats text-primary">{lead.opportunityScore}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${lead.opportunityScore}%` }}
                          transition={{ duration: 0.8, ease: "easeOut" }}
                          className={`h-full rounded-full ${
                            lead.opportunityScore >= 60 ? "bg-red-400" :
                            lead.opportunityScore >= 30 ? "bg-yellow-400" :
                            "bg-primary"
                          }`}
                        />
                      </div>
                    </div>
                  )}

                  {/* AI Pitch Section */}
                  {!lead.loadingDetails && (
                    <div className="space-y-2">
                      {lead.aiPitch && expandedPitch === lead.place_id ? (
                        <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/20">
                          <div className="flex items-center gap-1 mb-1.5">
                            <Sparkles className="w-3 h-3 text-primary" />
                            <span className="text-[10px] font-stats text-primary">AI PITCH</span>
                          </div>
                          <p className="text-xs text-foreground leading-relaxed">{lead.aiPitch}</p>
                          <button
                            onClick={() => setExpandedPitch(null)}
                            className="text-[10px] text-muted-foreground mt-1 hover:text-foreground"
                          >
                            collapse
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => lead.aiPitch ? setExpandedPitch(lead.place_id) : handleGeneratePitch(lead.place_id)}
                          disabled={lead.loadingPitch}
                          className="w-full py-1.5 rounded-lg text-[10px] font-stats border border-primary/30 text-primary hover:bg-primary/10 flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                        >
                          {lead.loadingPitch
                            ? <><Loader2 className="w-3 h-3 animate-spin" /> Generating pitch...</>
                            : lead.aiPitch
                            ? <><Sparkles className="w-3 h-3" /> Show AI Pitch</>
                            : <><Brain className="w-3 h-3" /> Generate AI Pitch</>
                          }
                        </button>
                      )}
                    </div>
                  )}

                  {/* Save Button */}
                  <button
                    onClick={() => handleSaveLead(lead.place_id)}
                    disabled={lead.saved || lead.saving || lead.loadingDetails}
                    className={`w-full py-2 rounded-lg text-xs font-heading font-semibold flex items-center justify-center gap-2 transition-all ${
                      lead.saved
                        ? "bg-success/10 text-success border border-success/30 cursor-default"
                        : lead.loadingDetails
                        ? "opacity-40 cursor-wait"
                        : "text-primary-foreground hover:opacity-90"
                    }`}
                    style={!lead.saved && !lead.loadingDetails ? { background: "var(--gradient-primary)" } : {}}
                  >
                    {lead.saving ? <><Loader2 className="w-3 h-3 animate-spin" /> Saving...</>
                      : lead.saved ? <><CheckCircle className="w-3 h-3" /> Saved to CRM</>
                      : lead.loadingDetails ? <><Loader2 className="w-3 h-3 animate-spin" /> Loading...</>
                      : <><Plus className="w-3 h-3" /> Save to CRM</>
                    }
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Load More Button */}
          {nextPageToken && !stillLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center gap-2 pt-2"
            >
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="px-8 py-3 rounded-xl font-heading font-semibold text-sm border border-primary/40 text-primary hover:bg-primary/10 flex items-center gap-2 transition-all disabled:opacity-50"
              >
                {loadingMore ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Loading more leads...</>
                ) : (
                  <><Plus className="w-4 h-4" /> Load More Results</>
                )}
              </button>
              {loadingMore && (
                <p className="text-xs text-muted-foreground font-stats">
                  Fetching next page · {results.length} loaded so far
                </p>
              )}
            </motion.div>
          )}

          {/* All loaded indicator */}
          {!nextPageToken && results.length > 0 && !stillLoading && (
            <p className="text-center text-xs text-muted-foreground font-stats py-2">
              ✓ All {results.length} results loaded for "{currentQuery}"
            </p>
          )}
        </motion.div>
      )}

      {/* Initial State */}
      {!searched && (
        <div className="glass rounded-xl p-16 text-center space-y-3">
          <Target className="w-10 h-10 text-primary mx-auto opacity-40" />
          <p className="text-foreground font-heading font-semibold">Select a category and city to start hunting</p>
          <p className="text-xs text-muted-foreground font-stats">
            AI will score each lead and generate personalized pitches for you
          </p>
        </div>
      )}
    </div>
  );
}