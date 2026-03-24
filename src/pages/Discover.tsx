import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, MapPin, Zap, Star, Globe, Phone,
  Plus, Loader2, AlertCircle, CheckCircle,
  Target, Brain, ChevronDown, X, Sparkles, Filter,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { computeLeadScore } from "../hooks/useLeads";

interface DiscoveredLead {
  place_id:         string;
  business_name:    string;
  address:          string;
  city:             string;
  phone:            string;
  website:          string;
  rating:           number;
  review_count:     number;
  category:         string;
  rawTypes:         string[];
  saved:            boolean;
  saving:           boolean;
  opportunityScore: number;
  opportunityLabel: "🔴 Hot Target" | "🟡 Warm Target" | "🟢 Low Priority";
  opportunities:    string[];
  aiPitch:          string;
  loadingPitch:     boolean;
}

const HUNT_CATEGORIES = [
  { label: "Clinics & Doctors",    icon: "🏥", query: "clinics doctors",      reason: "High budget, need booking + website" },
  { label: "Salons & Spas",        icon: "💇", query: "salons spas",           reason: "Need online booking + portfolio"     },
  { label: "Restaurants & Cafes",  icon: "🍽️", query: "restaurants cafes",    reason: "Need menu site + reservations"       },
  { label: "Law Firms & CA",       icon: "⚖️", query: "law firms CA offices",  reason: "No websites, highest budget"         },
  { label: "Real Estate",          icon: "🏠", query: "real estate agents",    reason: "Need property listing sites"         },
  { label: "Interior Designers",   icon: "🛋️", query: "interior designers",    reason: "Need portfolio websites"             },
  { label: "Event Planners",       icon: "🎪", query: "event planners",        reason: "Need booking + portfolio"            },
  { label: "Schools & Institutes", icon: "📚", query: "schools institutes",    reason: "Need admission portals"              },
  { label: "Manufacturers",        icon: "🏭", query: "local manufacturers",   reason: "Zero digital presence"               },
  { label: "Retail Shops",         icon: "🛍️", query: "retail shops",         reason: "Need ecommerce/catalogue"            },
  { label: "Gyms & Fitness",       icon: "🏋️", query: "gyms fitness centers", reason: "Need membership booking"             },
  { label: "Photographers",        icon: "📸", query: "photographers studios", reason: "Need portfolio + booking"            },
];

const QUICK_STARTS = [HUNT_CATEGORIES[0], HUNT_CATEGORIES[1], HUNT_CATEGORIES[3]];

const CITIES = [
  "Mumbai", "Delhi", "Bangalore", "Hyderabad", "Chennai",
  "Pune", "Kolkata", "Ahmedabad", "Jaipur", "Surat",
  "Lucknow", "Kanpur", "Nagpur", "Indore", "Bhopal",
  "Visakhapatnam", "Patna", "Vadodara", "Coimbatore", "Kochi",
];

const HIGH_VALUE_TYPES = [
  "lawyer", "doctor", "dentist", "real_estate_agency",
  "accounting", "insurance_agency", "hospital", "school",
  "university", "physiotherapist", "veterinary_care",
];

function extractCity(address: string): string {
  if (!address) return "";
  const parts = address.split(",").map((s) => s.trim()).filter(Boolean);
  const indiaIdx = parts.findIndex((p) => /^india$/i.test(p));
  if (indiaIdx >= 2) return parts[indiaIdx - 2];
  if (indiaIdx === 1) return parts[0];
  return parts[Math.max(0, parts.length - 3)];
}

function extractCategory(types: string[] = []): string {
  const skip = new Set([
    "establishment", "point_of_interest", "premise", "political",
    "geocode", "locality", "sublocality", "sublocality_level_1",
    "sublocality_level_2", "country", "administrative_area_level_1",
    "administrative_area_level_2", "route", "street_address",
  ]);
  const clean = types.find((t) => !skip.has(t));
  if (!clean) return "Business";
  return clean.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function normalisePlaceFields(p: any): {
  website: string; phone: string; review_count: number;
  business_name: string; address: string;
} {
  const rawWebsite = p.websiteUri ?? p.website ?? p.website_uri ?? "";
  const website: string = typeof rawWebsite === "string" ? rawWebsite.trim() : "";
  const rawPhone = p.nationalPhoneNumber ?? p.national_phone_number ?? p.phoneNumber
    ?? p.phone ?? p.internationalPhoneNumber ?? p.international_phone_number ?? "";
  const phone: string = typeof rawPhone === "string" ? rawPhone.trim() : "";
  const review_count: number =
    p.userRatingCount ?? p.user_rating_count ?? p.reviewCount ?? p.review_count ?? 0;
  const business_name: string = p.displayName?.text ?? p.name ?? "Unknown";
  const address: string = p.formattedAddress ?? p.formatted_address ?? "";
  return { website, phone, review_count, business_name, address };
}

function computeOpportunity(lead: {
  website: string; phone: string; rating: number;
  review_count: number; rawTypes: string[];
}): {
  opportunityScore: number;
  opportunityLabel: DiscoveredLead["opportunityLabel"];
  opportunities:    string[];
} {
  const ops: string[] = [];
  let score = 0;

  if (!lead.website) {
    ops.push("❌ No website — direct web design pitch");
    score += 45;
    if (lead.review_count > 50) {
      ops.push("🔥 Busy business with zero web presence — hottest lead");
      score += 20;
    }
  } else {
    if (lead.review_count < 25) {
      ops.push("🔄 Has website but very low visibility — pitch SEO/redesign");
      score += 10;
    }
  }

  if (!lead.phone) {
    ops.push("❌ No phone on Google — pitch GMB optimisation");
    score += 10;
  }

  if (lead.review_count === 0) {
    ops.push("📉 Zero Google reviews — pitch presence setup");
    score += 20;
  } else if (lead.review_count < 10) {
    ops.push("📉 Very few reviews — pitch review management");
    score += 12;
  } else if (lead.review_count < 25) {
    ops.push("📊 Below-average reviews — room to grow");
    score += 5;
  }

  if (lead.rating > 0 && lead.rating < 3.0) {
    ops.push("⚠️ Poor rating (<3★) — pitch reputation management");
    score += 20;
  } else if (lead.rating >= 3.0 && lead.rating < 3.8) {
    ops.push("⚠️ Below-average rating — pitch review strategy");
    score += 10;
  }

  const isHighValue = lead.rawTypes.some((t) => HIGH_VALUE_TYPES.includes(t));
  if (isHighValue) {
    ops.push("💰 High-budget category — prioritise outreach");
    score += 15;
  }

  if (ops.length === 0) ops.push("✅ Established presence — pitch SEO, ads or CRM");

  const opportunityLabel: DiscoveredLead["opportunityLabel"] =
    score >= 55 ? "🔴 Hot Target"  :
    score >= 22 ? "🟡 Warm Target" :
                  "🟢 Low Priority";

  return { opportunityScore: Math.min(score, 100), opportunityLabel, opportunities: ops };
}

async function generateAIPitch(lead: DiscoveredLead): Promise<string> {
  const groqKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!groqKey) return "Add VITE_GROQ_API_KEY to .env to enable AI pitches.";

  const websiteContext = lead.website
    ? `They have a website: ${lead.website}`
    : "They have NO website at all.";

  const prompt = `You are a sharp freelance sales consultant in India pitching web design and digital growth services to local businesses.

Business: ${lead.business_name}
Category: ${lead.category}
City: ${lead.city}
${websiteContext}
Phone: ${lead.phone || "Not listed on Google"}
Rating: ${lead.rating > 0 ? `${lead.rating}★ (${lead.review_count} reviews)` : "No rating yet"}
Gaps identified: ${lead.opportunities.join(" | ")}

Write a 3-4 sentence WhatsApp opening message. Rules:
- Reference their SPECIFIC gap (missing website / low rating / few reviews)
- Sound human and direct — not salesy
- End with one clear call to action
- English only, no emojis`;

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method:  "POST",
      headers: { "Authorization": `Bearer ${groqKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 180, temperature: 0.65,
      }),
    });
    if (!res.ok) return "Groq API error — check your API key.";
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() ?? "Could not generate pitch.";
  } catch {
    return "Could not reach Groq. Check network and API key.";
  }
}

async function fetchPlaces(
  query: string, city: string, pageToken: string | null,
): Promise<{ leads: DiscoveredLead[]; nextPageToken: string | null }> {
  const apiKey  = import.meta.env.VITE_RAPIDAPI_KEY;
  const apiHost = import.meta.env.VITE_RAPIDAPI_HOST;
  if (!apiKey || !apiHost) throw new Error("Missing VITE_RAPIDAPI_KEY or VITE_RAPIDAPI_HOST in .env");

  const body: Record<string, unknown> = {
    textQuery: query, languageCode: "en", regionCode: "IN", pageSize: 20,
  };

  if (!city) {
    body.locationRestriction = {
      rectangle: {
        low:  { latitude: 6.4627,  longitude: 68.1097 },
        high: { latitude: 35.5133, longitude: 97.3953 },
      },
    };
  }

  if (pageToken) body.pageToken = pageToken;

  const res = await fetch(`https://${apiHost}/v1/places:searchText`, {
    method: "POST",
    headers: {
      "x-rapidapi-key":  apiKey,
      "x-rapidapi-host": apiHost,
      "Content-Type":    "application/json",
      "X-Goog-FieldMask": [
        "places.id", "places.displayName", "places.formattedAddress",
        "places.types", "places.rating", "places.userRatingCount",
        "places.nationalPhoneNumber", "places.websiteUri", "nextPageToken",
      ].join(","),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text.slice(0, 160)}`);
  }

  const data = await res.json();
  const places: any[] = data.places ?? [];
  const nextToken: string | null = data.nextPageToken ?? null;

  if (import.meta.env.DEV && places.length > 0) {
    console.log("[LeadHunter] Raw place sample keys:", Object.keys(places[0]));
    console.log("[LeadHunter] website field value:", places[0].websiteUri ?? places[0].website ?? "(none)");
  }

  const leads: DiscoveredLead[] = places.map((p) => {
    const { website, phone, review_count, business_name, address } = normalisePlaceFields(p);
    const rawTypes: string[] = p.types ?? [];
    const base = {
      place_id: p.id ?? "", business_name, address,
      city: extractCity(address), phone, website,
      rating: typeof p.rating === "number" ? p.rating : 0,
      review_count, category: extractCategory(rawTypes), rawTypes,
      saved: false, saving: false, aiPitch: "", loadingPitch: false,
      opportunityScore: 0, opportunityLabel: "🟡 Warm Target" as const, opportunities: [] as string[],
    };
    return { ...base, ...computeOpportunity(base) };
  });

  return { leads, nextPageToken: nextToken };
}

const OPP_STYLES = {
  "🔴 Hot Target":   { card: "border-l-[3px] border-l-red-500/70",   badge: "bg-red-500/10 text-red-400 border-red-500/30",       bar: "from-orange-400 to-red-500"   },
  "🟡 Warm Target":  { card: "border-l-[3px] border-l-amber-400/70", badge: "bg-amber-400/10 text-amber-400 border-amber-400/30", bar: "from-yellow-400 to-amber-500" },
  "🟢 Low Priority": { card: "border-l-[3px] border-l-slate-500/40", badge: "bg-slate-500/10 text-slate-400 border-slate-500/30", bar: "from-slate-400 to-slate-500"  },
} as const;

export default function Discover() {
  const [city,          setCity]          = useState("");
  const [customQuery,   setCustomQuery]   = useState("");
  const [selectedCat,   setSelectedCat]   = useState<typeof HUNT_CATEGORIES[0] | null>(null);
  const [results,       setResults]       = useState<DiscoveredLead[]>([]);
  const [loading,       setLoading]       = useState(false);
  const [loadingMore,   setLoadingMore]   = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [searched,      setSearched]      = useState(false);
  const [filterMode,    setFilterMode]    = useState<"all" | "hot" | "warm" | "nowebsite">("all");
  const [showCityDD,    setShowCityDD]    = useState(false);
  const [expandedPitch, setExpandedPitch] = useState<string | null>(null);
  const [pageToken,     setPageToken]     = useState<string | null>(null);
  const [currentQuery,  setCurrentQuery]  = useState("");
  const [savingAll,     setSavingAll]     = useState(false);

  const hotCount       = results.filter((r) => r.opportunityLabel === "🔴 Hot Target").length;
  const warmCount      = results.filter((r) => r.opportunityLabel === "🟡 Warm Target").length;
  const noWebsiteCount = results.filter((r) => !r.website).length;

  const displayResults = results.filter((r) => {
    if (filterMode === "hot")       return r.opportunityLabel === "🔴 Hot Target";
    if (filterMode === "warm")      return r.opportunityLabel === "🟡 Warm Target";
    if (filterMode === "nowebsite") return !r.website;
    return true;
  });

  const unsavedVisible = displayResults.filter((r) => !r.saved).length;

  function buildQuery(): string {
    const loc = city.trim() || "India";
    if (customQuery.trim()) return `${customQuery.trim()} in ${loc}`;
    if (selectedCat)        return `${selectedCat.query} in ${loc}`;
    return "";
  }

  async function handleSearch() {
    const q = buildQuery();
    if (!q) return;
    setLoading(true); setError(null); setResults([]);
    setPageToken(null); setSearched(true); setCurrentQuery(q);
    setFilterMode("all"); setExpandedPitch(null);
    try {
      const { leads, nextPageToken } = await fetchPlaces(q, city, null);
      setResults(leads); setPageToken(nextPageToken);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Search failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLoadMore() {
    if (!pageToken || loadingMore) return;
    setLoadingMore(true);
    try {
      const existingIds = new Set(results.map((r) => r.place_id));
      const { leads, nextPageToken } = await fetchPlaces(currentQuery, city, pageToken);
      const fresh = leads.filter((l) => !existingIds.has(l.place_id));
      setResults((prev) => [...prev, ...fresh]);
      setPageToken(nextPageToken);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load more.");
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleGeneratePitch(placeId: string) {
    const lead = results.find((r) => r.place_id === placeId);
    if (!lead || lead.loadingPitch) return;
    setResults((prev) => prev.map((r) => r.place_id === placeId ? { ...r, loadingPitch: true } : r));
    const pitch = await generateAIPitch(lead);
    setResults((prev) => prev.map((r) => r.place_id === placeId ? { ...r, aiPitch: pitch, loadingPitch: false } : r));
    setExpandedPitch(placeId);
  }

  // ✅ FIX: stamp user_id on every upsert
  async function handleSaveLead(placeId: string) {
  const lead = results.find((r) => r.place_id === placeId);
  if (!lead || lead.saved || lead.saving) return;

  setResults((prev) => prev.map((r) => r.place_id === placeId ? { ...r, saving: true } : r));

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { score, score_label } = computeLeadScore({
      has_website:  !!lead.website,
      email:        null,
      phone:        lead.phone || null,
      rating:       lead.rating,
      review_count: lead.review_count,
    });

    const payload = {
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
      user_id:          user.id,
    };

    // Check if lead already exists for this user
    const { data: existing } = await supabase
      .from("leads")
      .select("id")
      .eq("google_place_id", lead.place_id)
      .eq("user_id", user.id)
      .maybeSingle();

    let dbError;
    if (existing) {
      ({ error: dbError } = await supabase
        .from("leads")
        .update(payload)
        .eq("id", existing.id));
    } else {
      ({ error: dbError } = await supabase
        .from("leads")
        .insert(payload));
    }

    if (dbError) throw dbError;

    setResults((prev) => prev.map((r) =>
      r.place_id === placeId ? { ...r, saved: true, saving: false } : r
    ));
  } catch (e) {
    console.error("Save error:", e);
    setResults((prev) => prev.map((r) =>
      r.place_id === placeId ? { ...r, saving: false } : r
    ));
  }
}

  async function handleSaveAll() {
    const unsavedIds = displayResults.filter((r) => !r.saved && !r.saving).map((r) => r.place_id);
    if (!unsavedIds.length) return;
    setSavingAll(true);
    for (const id of unsavedIds) await handleSaveLead(id);
    setSavingAll(false);
  }

  return (
    <div className="p-6 pb-28 space-y-6">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Lead Discovery</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real businesses from Google · scored by actual data ·{" "}
            <span className="font-stats text-primary">Pan India</span>
          </p>
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
          <Zap className="w-3 h-3 text-primary animate-pulse" />
          <span className="text-[10px] font-stats text-primary uppercase tracking-widest">AI Active</span>
        </div>
      </motion.div>

      {/* Control Panel */}
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="glass rounded-2xl p-5 space-y-5"
        style={{ boxShadow: "0 0 40px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)" }}
      >
        <div className="flex gap-3 flex-wrap">

          {/* City dropdown */}
          <div className="relative shrink-0">
            <button
              onClick={() => setShowCityDD((v) => !v)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-muted border border-border text-sm text-foreground hover:border-primary/50 transition-all min-w-[156px]"
            >
              <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="flex-1 text-left">{city || "All India"}</span>
              <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${showCityDD ? "rotate-180" : ""}`} />
            </button>
            <AnimatePresence>
              {showCityDD && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full mt-1 left-0 z-50 rounded-xl border border-border p-2 w-52 max-h-64 overflow-y-auto shadow-2xl"
                  style={{ background: "rgba(10,12,18,0.97)", backdropFilter: "blur(20px)" }}
                >
                  <button
                    onClick={() => { setCity(""); setShowCityDD(false); }}
                    className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors mb-1 ${
                      !city ? "text-primary bg-primary/10 font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    🇮🇳 All India
                  </button>
                  <div className="border-t border-border/50 mb-1" />
                  {CITIES.map((c) => (
                    <button key={c}
                      onClick={() => { setCity(c); setShowCityDD(false); }}
                      className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors ${
                        city === c ? "text-primary bg-primary/10 font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      }`}
                    >
                      {city === c ? "✓ " : ""}{c}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Query input */}
          <div className="flex-1 relative min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="e.g. dentists, wedding planners, chartered accountants..."
              value={customQuery}
              onChange={(e) => { setCustomQuery(e.target.value); setSelectedCat(null); }}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary transition-all"
            />
          </div>

          {/* Hunt button */}
          <button
            onClick={handleSearch}
            disabled={loading || (!selectedCat && !customQuery.trim())}
            className="px-6 py-2.5 rounded-xl font-heading font-bold text-sm text-primary-foreground flex items-center gap-2 transition-all hover:opacity-90 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed glow-primary"
            style={{ background: "var(--gradient-primary)" }}
          >
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Hunting...</>
              : <><Target className="w-4 h-4" /> Hunt Leads</>}
          </button>
        </div>

        {/* Category grid */}
        <div>
          <p className="text-[9px] font-stats text-muted-foreground uppercase tracking-widest mb-2.5">Quick Hunt</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {HUNT_CATEGORIES.map((cat) => {
              const active = selectedCat?.label === cat.label;
              return (
                <button key={cat.label}
                  onClick={() => { setSelectedCat(active ? null : cat); setCustomQuery(""); }}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-all duration-200 group ${
                    active
                      ? "border-primary bg-primary/10 scale-[1.04] shadow-lg shadow-primary/10"
                      : "border-border bg-muted/30 hover:border-primary/40 hover:bg-muted/60 hover:scale-[1.02]"
                  }`}
                >
                  <span className="text-lg leading-none">{cat.icon}</span>
                  <span className={`text-[10px] font-stats leading-tight ${active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`}>
                    {cat.label}
                  </span>
                  {active && <span className="text-[8px] font-stats text-primary/70 leading-tight">{cat.reason}</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Active category banner */}
        <AnimatePresence>
          {selectedCat && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-primary/5 border border-primary/20 overflow-hidden"
            >
              <span className="text-xl">{selectedCat.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-heading font-semibold text-primary">{selectedCat.label}</p>
                <p className="text-[10px] text-muted-foreground">{selectedCat.reason}</p>
              </div>
              <button onClick={() => setSelectedCat(null)} className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="p-4 rounded-xl flex items-start gap-3"
            style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.25)" }}
          >
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-heading font-semibold text-red-400">Search failed</p>
              <p className="text-xs text-red-400/70 mt-0.5">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="text-red-400/50 hover:text-red-400 shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading skeletons */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ delay: i * 0.06 }} className="glass rounded-2xl p-4 space-y-3">
              <div className="h-4 w-2/3 rounded-lg bg-muted/60 animate-pulse" />
              <div className="h-3 w-1/3 rounded-lg bg-muted/40 animate-pulse" />
              <div className="h-2 w-full rounded-lg bg-muted/30 animate-pulse" />
              <div className="h-2 w-4/5 rounded-lg bg-muted/30 animate-pulse" />
              <div className="h-1.5 w-full rounded-full bg-muted/20 animate-pulse mt-2" />
            </motion.div>
          ))}
        </div>
      )}

      {/* Results */}
      {searched && !loading && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">

          {results.length > 0 && (
            <div className="glass rounded-2xl px-4 py-3 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-stats text-muted-foreground">
                  <span className="text-foreground font-bold">{results.length}</span> leads found
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {([
                  { key: "all",       label: "All",      count: results.length, active: "border-primary bg-primary/10 text-primary",         inactive: "border-border text-muted-foreground"       },
                  { key: "hot",       label: "🔴 Hot",    count: hotCount,       active: "border-red-500/40 bg-red-500/10 text-red-400",       inactive: "border-red-500/20 text-red-400/50"         },
                  { key: "warm",      label: "🟡 Warm",   count: warmCount,      active: "border-amber-400/40 bg-amber-400/10 text-amber-400", inactive: "border-amber-400/20 text-amber-400/50"     },
                  { key: "nowebsite", label: "🎯 No Web", count: noWebsiteCount, active: "border-primary/40 bg-primary/10 text-primary",       inactive: "border-primary/20 text-primary/50"         },
                ] as const).map((f) => (
                  <button key={f.key} onClick={() => setFilterMode(f.key)}
                    className={`px-3 py-1 rounded-lg text-[11px] font-stats border transition-all flex items-center gap-1.5 ${
                      filterMode === f.key ? f.active : f.inactive
                    }`}
                  >
                    {f.label}
                    <span className={`text-[10px] font-bold px-1 py-0.5 rounded ${filterMode === f.key ? "bg-white/10" : "opacity-50"}`}>
                      {f.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {results.length === 0 && (
            <div className="glass rounded-2xl p-16 text-center space-y-3">
              <Target className="w-10 h-10 text-muted-foreground/30 mx-auto" />
              <p className="text-foreground font-heading font-semibold">No results found</p>
              <p className="text-xs text-muted-foreground font-stats">Try a different category, city, or search term</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <AnimatePresence mode="popLayout">
              {displayResults.map((lead, i) => {
                const s = OPP_STYLES[lead.opportunityLabel];
                return (
                  <motion.div key={lead.place_id} layout
                    initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96 }} transition={{ delay: i * 0.025 }}
                    className={`glass rounded-2xl overflow-hidden group transition-all duration-200 ${
                      lead.saved ? "border-l-[3px] border-l-emerald-500/60" : s.card
                    }`}
                    style={{ border: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    <div className="px-4 pt-3 pb-2 flex items-center justify-between">
                      {lead.saved ? (
                        <div className="flex items-center gap-1.5">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-[10px] font-stats text-emerald-400 uppercase tracking-widest">Saved to CRM</span>
                        </div>
                      ) : (
                        <span className={`text-[10px] font-stats px-2 py-0.5 rounded-md border ${s.badge}`}>
                          {lead.opportunityLabel}
                        </span>
                      )}
                      <span className="text-[10px] font-stats text-muted-foreground/40 truncate ml-2 max-w-[120px]">
                        {lead.category}
                      </span>
                    </div>

                    <div className="px-4 pb-4 space-y-3">
                      <div>
                        <h3 className="text-[15px] font-heading font-bold text-foreground leading-snug line-clamp-1">
                          {lead.business_name}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <MapPin className="w-2.5 h-2.5 text-muted-foreground/40 shrink-0" />
                          <p className="text-[11px] text-muted-foreground/60 line-clamp-1">{lead.address}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        {lead.phone ? (
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3 h-3 text-muted-foreground/40 shrink-0" />
                            <span className="text-[11px] font-stats text-foreground/70">{lead.phone}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3 h-3 text-red-400/50" />
                            <span className="text-[11px] font-stats text-red-400/60">No phone listed</span>
                          </div>
                        )}
                        {lead.website ? (
                          <a href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`}
                            target="_blank" rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1.5 text-[11px] font-stats text-primary hover:underline">
                            <Globe className="w-3 h-3 shrink-0" /> Website ↗
                          </a>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <Globe className="w-3 h-3 text-red-400/60" />
                            <span className="text-[11px] font-stats text-red-400/80 font-semibold">No website</span>
                          </div>
                        )}
                      </div>

                      {lead.rating > 0 && (
                        <div className="flex items-center gap-2">
                          <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                          <span className="text-[12px] font-stats font-bold text-foreground">{lead.rating}</span>
                          <span className="text-[11px] font-stats text-muted-foreground/50">
                            ({lead.review_count.toLocaleString()} reviews)
                          </span>
                        </div>
                      )}

                      <div className="space-y-1 pt-1 border-t border-white/[0.04]">
                        {lead.opportunities.map((opp, idx) => (
                          <p key={idx} className="text-[10px] font-stats text-muted-foreground/75 leading-relaxed">{opp}</p>
                        ))}
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-stats text-muted-foreground/40 uppercase tracking-widest">Opportunity Score</span>
                          <span className="text-[11px] font-stats font-bold text-foreground">{lead.opportunityScore}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${lead.opportunityScore}%` }}
                            transition={{ duration: 0.8, ease: "easeOut", delay: i * 0.02 }}
                            className={`h-full rounded-full bg-gradient-to-r ${s.bar}`}
                          />
                        </div>
                      </div>

                      {lead.aiPitch && expandedPitch === lead.place_id ? (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                          className="rounded-xl p-3 overflow-hidden bg-primary/5 border border-primary/15"
                        >
                          <div className="flex items-center gap-1.5 mb-2">
                            <Sparkles className="w-3 h-3 text-primary" />
                            <span className="text-[9px] font-stats text-primary uppercase tracking-widest">AI Pitch</span>
                          </div>
                          <p className="text-[11px] text-foreground/90 leading-relaxed">{lead.aiPitch}</p>
                          <button onClick={() => setExpandedPitch(null)}
                            className="text-[9px] font-stats text-muted-foreground mt-2 hover:text-foreground transition-colors">
                            collapse ↑
                          </button>
                        </motion.div>
                      ) : (
                        <button
                          onClick={() => lead.aiPitch ? setExpandedPitch(lead.place_id) : handleGeneratePitch(lead.place_id)}
                          disabled={lead.loadingPitch}
                          className="w-full py-2 rounded-xl text-[11px] font-stats border border-primary/20 text-primary hover:bg-primary/8 flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 group"
                          style={{ background: "rgba(0,0,0,0.15)" }}
                        >
                          {lead.loadingPitch ? (
                            <><Loader2 className="w-3 h-3 animate-spin" /> Generating...</>
                          ) : lead.aiPitch ? (
                            <><Sparkles className="w-3 h-3" /> Show Pitch</>
                          ) : (
                            <><Brain className="w-3 h-3 group-hover:scale-110 transition-transform" /> Generate AI Pitch</>
                          )}
                        </button>
                      )}

                      <button
                        onClick={() => handleSaveLead(lead.place_id)}
                        disabled={lead.saved || lead.saving}
                        className={`w-full py-2.5 rounded-xl text-xs font-heading font-bold flex items-center justify-center gap-2 transition-all ${
                          lead.saved ? "cursor-default" : "hover:opacity-90 hover:scale-[1.01] active:scale-[0.99]"
                        }`}
                        style={
                          lead.saved
                            ? { background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)", color: "#34d399" }
                            : { background: "var(--gradient-primary)", color: "var(--primary-foreground)" }
                        }
                      >
                        {lead.saving  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...</>
                        : lead.saved  ? <><CheckCircle className="w-3.5 h-3.5" /> Saved to CRM</>
                        :               <><Plus className="w-3.5 h-3.5" /> Save to CRM</>}
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {pageToken && !loadingMore && (
            <div className="flex justify-center pt-2">
              <button onClick={handleLoadMore}
                className="px-8 py-3 rounded-xl font-heading font-semibold text-sm border border-primary/30 text-primary hover:bg-primary/8 flex items-center gap-2 transition-all">
                <Plus className="w-4 h-4" /> Load More Results
              </button>
            </div>
          )}
          {loadingMore && (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span className="ml-2 text-sm font-stats text-muted-foreground">{results.length} loaded…</span>
            </div>
          )}
          {!pageToken && results.length > 0 && (
            <p className="text-center text-[10px] font-stats text-muted-foreground/30 py-2">
              ✓ All {results.length} results loaded for "{currentQuery}"
            </p>
          )}
        </motion.div>
      )}

      {/* Empty state */}
      {!searched && !loading && (
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="glass rounded-2xl p-10 text-center space-y-6"
        >
          <div className="relative w-14 h-14 mx-auto">
            <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Target className="w-6 h-6 text-primary" />
            </div>
            <div className="absolute inset-0 rounded-full border border-primary/10 animate-ping" />
          </div>
          <div>
            <p className="text-foreground font-heading font-bold text-lg">Start Hunting</p>
            <p className="text-xs text-muted-foreground font-stats mt-1">
              Pick a category or type a search — every lead is scored from real data
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {QUICK_STARTS.map((cat) => (
              <button key={cat.label}
                onClick={() => { setSelectedCat(cat); setCustomQuery(""); }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-muted/40 hover:border-primary/40 hover:bg-primary/5 transition-all text-muted-foreground hover:text-foreground">
                <span>{cat.icon}</span>
                <span className="font-stats text-xs">{cat.label}</span>
              </button>
            ))}
          </div>
          <p className="text-[10px] font-stats text-muted-foreground/30">
            Powered by Google Places · No fabricated signals · Every score backed by real data
          </p>
        </motion.div>
      )}

      {/* Sticky save bar */}
      <AnimatePresence>
        {unsavedVisible > 0 && searched && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-5 py-3 rounded-2xl"
            style={{
              background: "rgba(10,12,20,0.94)", border: "1px solid rgba(255,255,255,0.1)",
              backdropFilter: "blur(20px)", boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
            }}
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-sm font-heading font-semibold text-foreground">
                {unsavedVisible} lead{unsavedVisible !== 1 ? "s" : ""} ready to save
              </span>
              {filterMode !== "all" && (
                <span className="text-[10px] font-stats text-muted-foreground">(filtered view)</span>
              )}
            </div>
            <button onClick={handleSaveAll} disabled={savingAll}
              className="px-5 py-2 rounded-xl font-heading font-bold text-xs text-primary-foreground flex items-center gap-2 hover:opacity-90 transition-all disabled:opacity-50"
              style={{ background: "var(--gradient-primary)" }}>
              {savingAll
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...</>
                : <><Plus className="w-3.5 h-3.5" /> Save All to CRM</>}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}