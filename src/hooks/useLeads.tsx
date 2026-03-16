import { useEffect, useState, useCallback } from "react";
import { supabase, type Lead, type Tag } from "../lib/supabase";

// ── Helper: get current user id ───────────────────────────────────────────────
async function getCurrentUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// ── Fetch all leads with their tags (scoped to current user) ──────────────────
export function useLeads() {
  const [leads,   setLeads]   = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const userId = await getCurrentUserId();
      if (!userId) { setLeads([]); setLoading(false); return; }

      const { data: leadsData, error: leadsError } = await supabase
        .from("leads")
        .select("*")
        .eq("user_id", userId)                          // ← AUTH
        .order("created_at", { ascending: false });

      if (leadsError) throw leadsError;

      const leadsWithTags = await Promise.all(
        (leadsData ?? []).map(async (lead) => {
          const { data: tagData } = await supabase
            .from("lead_tags")
            .select("tags(id, name, color)")
            .eq("lead_id", lead.id);
          const tags = tagData?.map((t: any) => t.tags).filter(Boolean) ?? [];
          return { ...lead, tags };
        })
      );

      setLeads(leadsWithTags);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to fetch leads");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeads();
    const channel = supabase
      .channel("leads-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, fetchLeads)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchLeads]);

  return { leads, loading, error, refetch: fetchLeads };
}

// ── Add a new lead (auto-injects user_id) ─────────────────────────────────────
export async function addLead(lead: Partial<Lead>): Promise<Lead | null> {
  const userId = await getCurrentUserId();
  if (!userId) { console.error("addLead: not authenticated"); return null; }

  const { data, error } = await supabase
    .from("leads")
    .insert([{ ...lead, user_id: userId }])             // ← AUTH
    .select()
    .single();

  if (error) { console.error("addLead error:", error); return null; }
  return data;
}

// ── Update lead status ─────────────────────────────────────────────────────────
export async function updateLeadStatus(
  id: string,
  status: Lead["status"]
): Promise<boolean> {
  const { error } = await supabase
    .from("leads")
    .update({ status })
    .eq("id", id);
  if (error) { console.error("updateLeadStatus error:", error); return false; }
  return true;
}

// ── Update deal value ──────────────────────────────────────────────────────────
export async function updateDealValue(
  id: string,
  deal_value: number
): Promise<boolean> {
  const { error } = await supabase
    .from("leads")
    .update({ deal_value })
    .eq("id", id);
  if (error) { console.error("updateDealValue error:", error); return false; }
  return true;
}

// ── Delete a lead ──────────────────────────────────────────────────────────────
export async function deleteLead(id: string): Promise<boolean> {
  const { error } = await supabase.from("leads").delete().eq("id", id);
  if (error) { console.error("deleteLead error:", error); return false; }
  return true;
}

// ── Fetch all tags (scoped to current user) ────────────────────────────────────
export function useTags() {
  const [tags, setTags] = useState<Tag[]>([]);

  useEffect(() => {
    (async () => {
      const userId = await getCurrentUserId();
      if (!userId) return;
      const { data } = await supabase
        .from("tags")
        .select("*")
        .eq("user_id", userId)                          // ← AUTH
        .order("name");
      setTags(data ?? []);
    })();
  }, []);

  return tags;
}

// ── Add tag to lead ────────────────────────────────────────────────────────────
export async function addTagToLead(
  lead_id: string,
  tag_id: string
): Promise<boolean> {
  const { error } = await supabase
    .from("lead_tags")
    .insert([{ lead_id, tag_id }]);
  if (error) { console.error("addTagToLead error:", error); return false; }
  return true;
}

// ── Remove tag from lead ───────────────────────────────────────────────────────
export async function removeTagFromLead(
  lead_id: string,
  tag_id: string
): Promise<boolean> {
  const { error } = await supabase
    .from("lead_tags")
    .delete()
    .eq("lead_id", lead_id)
    .eq("tag_id", tag_id);
  if (error) { console.error("removeTagFromLead error:", error); return false; }
  return true;
}

// ── Bulk insert leads (auto-injects user_id) ──────────────────────────────────
export async function bulkInsertLeads(leads: Partial<Lead>[]): Promise<number> {
  const userId = await getCurrentUserId();
  if (!userId) { console.error("bulkInsertLeads: not authenticated"); return 0; }

  const leadsWithUser = leads.map((l) => ({ ...l, user_id: userId }));  // ← AUTH

  const { data, error } = await supabase
    .from("leads")
    .upsert(leadsWithUser, { onConflict: "google_place_id" })
    .select();
  if (error) { console.error("bulkInsertLeads error:", error); return 0; }
  return data?.length ?? 0;
}

// ── Compute lead score ─────────────────────────────────────────────────────────
export function computeLeadScore(lead: Partial<Lead>): {
  score: number;
  score_label: "High" | "Medium" | "Low";
} {
  let score = 0;

  if (lead.has_website)                              score += 10;
  if (lead.email)                                    score += 15;
  if (lead.phone)                                    score += 10;
  if (lead.rating && lead.rating >= 4.0)             score += 20;
  if (lead.review_count && lead.review_count >= 100) score += 15;
  if (!lead.has_ssl)                                 score += 10;
  if (!lead.has_mobile)                              score += 10;
  if (!lead.has_seo)                                 score += 10;

  const score_label: "High" | "Medium" | "Low" =
    score >= 70 ? "High" : score >= 40 ? "Medium" : "Low";

  return { score, score_label };
}