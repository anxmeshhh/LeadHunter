import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase environment variables. Check your .env file.");
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// ── Types ──────────────────────────────────────────────────────────────────────

export interface Lead {
  id: string;
  business_name: string;
  category: string | null;
  city: string | null;
  state: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  google_place_id: string | null;
  rating: number;
  review_count: number;
  score: number;
  score_label: "High" | "Medium" | "Low";
  status:
    | "New Lead"
    | "Contacted"
    | "Replied"
    | "Interested"
    | "Proposal Sent"
    | "Negotiation"
    | "Closed Won"
    | "Closed Lost";
  deal_value: number;
  ai_analysis: string | null;
  ai_pitch: string | null;
  ai_opportunities: string[] | null;
  has_website: boolean;
  has_ssl: boolean;
  has_mobile: boolean;
  has_contact_form: boolean;
  has_whatsapp: boolean;
  has_seo: boolean;
  source: "google_places" | "manual" | "csv_import";
  created_at: string;
  updated_at: string;
  tags?: Tag[];
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface LeadNote {
  id: string;
  lead_id: string;
  note: string;
  created_at: string;
}

export interface Task {
  id: string;
  lead_id: string;
  title: string;
  description: string | null;
  due_date: string;
  is_done: boolean;
  priority: "High" | "Medium" | "Low";
  created_at: string;
}

export interface OutreachHistory {
  id: string;
  lead_id: string;
  contact_mode: "Call" | "Email" | "WhatsApp" | "LinkedIn" | "Other";
  subject: string | null;
  message: string | null;
  status: "Sent" | "Opened" | "Replied" | "Bounced";
  contacted_at: string;
}

export interface DailyTarget {
  id: string;
  date: string;
  daily_target: number;
  daily_done: number;
  streak: number;
}