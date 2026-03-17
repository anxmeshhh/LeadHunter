/**
 * generateProposalPDF.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Generates a professional PDF acceptance document for a signed proposal.
 * Uses pdf-lib (pure browser, no server needed).
 *
 * HOW TO USE:
 *   import { generateProposalPDF } from "../lib/generateProposalPDF";
 *   await generateProposalPDF(proposal);
 *
 * INSTALL:
 *   npm install pdf-lib
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from "pdf-lib";

// ── Types ──────────────────────────────────────────────────────────────────────
interface ServiceLine {
  name:         string;
  price:        number;
  description?: string;
}

interface ProposalForPDF {
  id:            string;
  title:         string;
  lead_name?:    string;
  lead_city?:    string;
  lead_category?:string;
  services:      ServiceLine[];
  total_amount:  number;
  timeline?:     string;
  scope_of_work?:string;
  deliverables?: string[];
  gst_enabled?:  boolean;
  gst_number?:   string;
  gst_amount?:   number;
  total_with_gst?:number;
  signed_by?:    string;
  signed_at?:    string;
  created_at:    string;
  status:        string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function formatINR(amount: number): string {
  return `Rs. ${amount.toLocaleString("en-IN")}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric", month: "long", year: "numeric",
  });
}

function wrapText(text: string, maxChars: number): string[] {
  const words  = text.split(" ");
  const lines: string[] = [];
  let current  = "";
  for (const word of words) {
    if ((current + " " + word).trim().length <= maxChars) {
      current = (current + " " + word).trim();
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// ── Colors ─────────────────────────────────────────────────────────────────────
const BRAND_GREEN  = rgb(0.20, 0.83, 0.40);   // #33D466
const BRAND_DARK   = rgb(0.04, 0.05, 0.09);   // #0A0D17
const GRAY_LIGHT   = rgb(0.94, 0.94, 0.96);   // #F0F0F5
const GRAY_MED     = rgb(0.55, 0.57, 0.62);   // #8C919E
const GRAY_DARK    = rgb(0.20, 0.22, 0.27);   // #333845
const TEXT_MAIN    = rgb(0.10, 0.11, 0.14);   // #1A1C24
const AMBER        = rgb(0.98, 0.75, 0.14);   // #FABF24
const WHITE        = rgb(1, 1, 1);

// ── Main Generator ─────────────────────────────────────────────────────────────
export async function generateProposalPDF(proposal: ProposalForPDF): Promise<void> {
  const pdfDoc  = await PDFDocument.create();
  const pageW   = 595.28;  // A4 width
  const pageH   = 841.89;  // A4 height
  const margin  = 48;

  const fontReg  = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // ── Helper: draw text ──────────────────────────────────────────────────────
  function text(
    page: PDFPage,
    content: string,
    x: number, y: number,
    { font = fontReg, size = 10, color = TEXT_MAIN }: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb> } = {}
  ) {
    page.drawText(content, { x, y, size, font, color });
  }

  function line(page: PDFPage, x1: number, y1: number, x2: number, y2: number, color = GRAY_LIGHT, thickness = 0.5) {
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness, color });
  }

  function rect(page: PDFPage, x: number, y: number, w: number, h: number, color: ReturnType<typeof rgb>, opacity = 1) {
    page.drawRectangle({ x, y, width: w, height: h, color, opacity });
  }

  // ── PAGE 1 ─────────────────────────────────────────────────────────────────
  const page1 = pdfDoc.addPage([pageW, pageH]);

  // Header bar
  rect(page1, 0, pageH - 80, pageW, 80, BRAND_DARK);

  // Brand name
  text(page1, "LeadHunter", margin, pageH - 35, { font: fontBold, size: 18, color: BRAND_GREEN });
  text(page1, "AI Sales Engine", margin, pageH - 52, { size: 9, color: GRAY_MED });

  // Document type badge
  rect(page1, pageW - margin - 120, pageH - 58, 120, 28, BRAND_GREEN);
  text(page1, "PROPOSAL ACCEPTED", pageW - margin - 112, pageH - 48, { font: fontBold, size: 8, color: BRAND_DARK });

  // Proposal title section
  let y = pageH - 110;
  text(page1, proposal.title || "Service Proposal", margin, y, { font: fontBold, size: 16, color: TEXT_MAIN });
  y -= 18;
  text(page1, `Prepared for: ${proposal.lead_name ?? "Client"} · ${proposal.lead_city ?? ""} · ${proposal.lead_category ?? ""}`, margin, y, { size: 9, color: GRAY_MED });
  y -= 12;
  text(page1, `Reference: LH-${proposal.id.slice(0, 8).toUpperCase()} · Date: ${formatDate(proposal.created_at)}`, margin, y, { size: 9, color: GRAY_MED });

  // Divider
  y -= 16;
  line(page1, margin, y, pageW - margin, y, GRAY_LIGHT, 1);
  y -= 20;

  // ── Scope of Work ──────────────────────────────────────────────────────────
  if (proposal.scope_of_work) {
    text(page1, "SCOPE OF WORK", margin, y, { font: fontBold, size: 8, color: GRAY_MED });
    y -= 14;
    const scopeLines = wrapText(proposal.scope_of_work, 90);
    for (const l of scopeLines) {
      text(page1, l, margin, y, { size: 10, color: TEXT_MAIN });
      y -= 14;
    }
    y -= 8;
  }

  // ── Timeline ───────────────────────────────────────────────────────────────
  if (proposal.timeline) {
    text(page1, "TIMELINE", margin, y, { font: fontBold, size: 8, color: GRAY_MED });
    y -= 14;
    text(page1, proposal.timeline, margin, y, { size: 10, color: TEXT_MAIN });
    y -= 22;
  }

  // ── Services Table ─────────────────────────────────────────────────────────
  text(page1, "SERVICES & PRICING", margin, y, { font: fontBold, size: 8, color: GRAY_MED });
  y -= 14;

  // Table header
  rect(page1, margin, y - 2, pageW - margin * 2, 22, BRAND_DARK);
  text(page1, "Service", margin + 8, y + 6, { font: fontBold, size: 9, color: WHITE });
  text(page1, "Description", margin + 260, y + 6, { font: fontBold, size: 9, color: WHITE });
  text(page1, "Amount", pageW - margin - 70, y + 6, { font: fontBold, size: 9, color: WHITE });
  y -= 24;

  // Table rows
  let rowAlt = false;
  for (const svc of proposal.services ?? []) {
    if (rowAlt) rect(page1, margin, y - 2, pageW - margin * 2, 20, GRAY_LIGHT, 0.5);
    text(page1, svc.name, margin + 8, y + 5, { size: 9, color: TEXT_MAIN, font: fontBold });
    if (svc.description) {
      text(page1, svc.description.slice(0, 40), margin + 260, y + 5, { size: 8, color: GRAY_MED });
    }
    text(page1, formatINR(svc.price), pageW - margin - 68, y + 5, { size: 9, color: TEXT_MAIN });
    y -= 22;
    rowAlt = !rowAlt;
  }

  // ── Totals Box ─────────────────────────────────────────────────────────────
  y -= 10;
  const subtotal   = proposal.total_amount ?? 0;
  const gstAmt     = proposal.gst_enabled ? Math.round(subtotal * 0.18) : 0;
  const totalFinal = subtotal + gstAmt;

  const boxX = pageW - margin - 200;
  const boxY = y - (proposal.gst_enabled ? 70 : 44);
  rect(page1, boxX, boxY, 200, proposal.gst_enabled ? 74 : 48, GRAY_LIGHT, 0.6);

  let ty = y - 12;
  text(page1, "Subtotal", boxX + 10, ty, { size: 9, color: GRAY_DARK });
  text(page1, formatINR(subtotal), boxX + 200 - 10 - fontReg.widthOfTextAtSize(formatINR(subtotal), 9), ty, { size: 9, color: TEXT_MAIN });
  ty -= 18;

  if (proposal.gst_enabled) {
    text(page1, `GST @ 18%${proposal.gst_number ? ` (${proposal.gst_number})` : ""}`, boxX + 10, ty, { size: 9, color: GRAY_DARK });
    text(page1, `+ ${formatINR(gstAmt)}`, boxX + 200 - 10 - fontReg.widthOfTextAtSize(`+ ${formatINR(gstAmt)}`, 9), ty, { size: 9, color: AMBER });
    ty -= 4;
    line(page1, boxX + 8, ty, boxX + 192, ty, GRAY_MED, 0.4);
    ty -= 14;
  }

  // Total row — green highlight
  rect(page1, boxX, ty - 6, 200, 22, BRAND_GREEN, 0.15);
  text(page1, "TOTAL PAYABLE", boxX + 10, ty + 4, { font: fontBold, size: 9, color: BRAND_DARK });
  text(page1, formatINR(totalFinal), boxX + 200 - 10 - fontBold.widthOfTextAtSize(formatINR(totalFinal), 11), ty + 3, { font: fontBold, size: 11, color: BRAND_DARK });

  y = boxY - 20;

  // ── Deliverables ───────────────────────────────────────────────────────────
  if ((proposal.deliverables ?? []).length > 0) {
    text(page1, "DELIVERABLES", margin, y, { font: fontBold, size: 8, color: GRAY_MED });
    y -= 14;
    for (const d of proposal.deliverables ?? []) {
      text(page1, `  -  ${d}`, margin, y, { size: 9, color: TEXT_MAIN });
      y -= 13;
    }
    y -= 8;
  }

  // ── PAGE 2: Acceptance Certificate ────────────────────────────────────────
  const page2 = pdfDoc.addPage([pageW, pageH]);

  // Header bar
  rect(page2, 0, pageH - 80, pageW, 80, BRAND_DARK);
  text(page2, "LeadHunter", margin, pageH - 35, { font: fontBold, size: 18, color: BRAND_GREEN });
  text(page2, "AI Sales Engine", margin, pageH - 52, { size: 9, color: GRAY_MED });
  text(page2, "ACCEPTANCE CERTIFICATE", pageW - margin - 160, pageH - 44, { font: fontBold, size: 10, color: BRAND_GREEN });

  let y2 = pageH - 120;

  // Big checkmark area
  rect(page2, margin, y2 - 60, pageW - margin * 2, 70, rgb(0.07, 0.33, 0.17), 0.15);
  rect(page2, margin, y2 - 60, pageW - margin * 2, 70, BRAND_GREEN, 0.05);
  text(page2, "PROPOSAL DIGITALLY ACCEPTED", margin + 20, y2 - 15, { font: fontBold, size: 16, color: BRAND_DARK });
  text(page2, "This document confirms that the proposal has been reviewed and accepted.", margin + 20, y2 - 35, { size: 9, color: GRAY_DARK });
  text(page2, `Acceptance recorded on: ${proposal.signed_at ? formatDate(proposal.signed_at) : formatDate(new Date().toISOString())}`, margin + 20, y2 - 50, { size: 9, color: GRAY_MED });
  y2 -= 90;

  // Proposal details
  text(page2, "PROPOSAL DETAILS", margin, y2, { font: fontBold, size: 8, color: GRAY_MED });
  y2 -= 16;

  const details = [
    ["Proposal Title",  proposal.title ?? "—"],
    ["Client",          `${proposal.lead_name ?? "—"} · ${proposal.lead_city ?? ""}`],
    ["Reference No.",   `LH-${proposal.id.slice(0, 8).toUpperCase()}`],
    ["Proposal Date",   formatDate(proposal.created_at)],
    ["Timeline",        proposal.timeline ?? "As agreed"],
    ["Total Amount",    `${formatINR(totalFinal)}${proposal.gst_enabled ? " (incl. 18% GST)" : ""}`],
  ];

  for (const [label, value] of details) {
    rect(page2, margin, y2 - 4, pageW - margin * 2, 20, GRAY_LIGHT, 0.4);
    text(page2, label, margin + 8, y2 + 4, { size: 9, color: GRAY_MED });
    text(page2, value, margin + 160, y2 + 4, { font: fontBold, size: 9, color: TEXT_MAIN });
    y2 -= 22;
  }

  y2 -= 20;

  // Digital signature section
  text(page2, "DIGITAL ACCEPTANCE", margin, y2, { font: fontBold, size: 8, color: GRAY_MED });
  y2 -= 14;

  rect(page2, margin, y2 - 70, pageW - margin * 2, 80, rgb(0.07, 0.33, 0.17), 0.08);

  // Shield icon substitute (circle)
  page2.drawCircle({ x: margin + 30, y: y2 - 30, size: 18, color: BRAND_GREEN, opacity: 0.15 });
  page2.drawCircle({ x: margin + 30, y: y2 - 30, size: 18, borderColor: BRAND_GREEN, borderWidth: 1.5, color: undefined });
  text(page2, "OK", margin + 20, y2 - 34, { font: fontBold, size: 11, color: BRAND_GREEN });

  text(page2, "Digitally Accepted by:", margin + 56, y2 - 16, { size: 8, color: GRAY_MED });
  text(page2, proposal.signed_by ?? "Client", margin + 56, y2 - 30, { font: fontBold, size: 14, color: TEXT_MAIN });
  text(page2, `Date: ${proposal.signed_at ? formatDate(proposal.signed_at) : "—"}`, margin + 56, y2 - 46, { size: 9, color: GRAY_DARK });
  text(page2, `IP Reference: LeadHunter CRM · Ref LH-${proposal.id.slice(0, 8).toUpperCase()}`, margin + 56, y2 - 60, { size: 8, color: GRAY_MED });

  y2 -= 100;

  // Terms
  text(page2, "TERMS & CONDITIONS", margin, y2, { font: fontBold, size: 8, color: GRAY_MED });
  y2 -= 14;
  const terms = [
    "1. This acceptance constitutes a binding agreement between the client and service provider.",
    "2. Work will commence within 3 business days of receiving the advance payment.",
    "3. Payment terms: 50% advance, 50% on delivery unless otherwise agreed.",
    "4. Any changes to scope after acceptance will be subject to a separate change order.",
    "5. This document was generated by LeadHunter CRM and is legally binding upon digital acceptance.",
  ];
  for (const t of terms) {
    text(page2, t, margin, y2, { size: 8, color: GRAY_DARK });
    y2 -= 13;
  }

  y2 -= 20;

  // Signature lines
  const midX = pageW / 2;
  line(page2, margin, y2, midX - 20, y2, GRAY_MED, 0.8);
  line(page2, midX + 20, y2, pageW - margin, y2, GRAY_MED, 0.8);
  text(page2, "Client Signature", margin, y2 - 12, { size: 8, color: GRAY_MED });
  text(page2, proposal.signed_by ?? "Client", margin, y2 - 24, { font: fontBold, size: 9, color: TEXT_MAIN });
  text(page2, "Service Provider Signature", midX + 20, y2 - 12, { size: 8, color: GRAY_MED });

  // Footer
  const footerY = 30;
  rect(page2, 0, 0, pageW, footerY + 10, BRAND_DARK);
  text(page2, "Generated by LeadHunter AI Sales Engine", margin, footerY, { size: 7, color: GRAY_MED });
  text(page2, `Document ID: LH-${proposal.id.slice(0, 8).toUpperCase()} · ${formatDate(new Date().toISOString())}`, pageW - margin - 220, footerY, { size: 7, color: GRAY_MED });

  // Also add footer to page 1
  rect(page1, 0, 0, pageW, 40, BRAND_DARK);
  text(page1, "Generated by LeadHunter AI Sales Engine", margin, 15, { size: 7, color: GRAY_MED });
  text(page1, `Document ID: LH-${proposal.id.slice(0, 8).toUpperCase()} · Page 1 of 2`, pageW - margin - 160, 15, { size: 7, color: GRAY_MED });

  // ── Save & Download ────────────────────────────────────────────────────────
  const pdfBytes = await pdfDoc.save();
  const blob     = new Blob([pdfBytes.buffer as ArrayBuffer], { type: "application/pdf" });
  const url      = URL.createObjectURL(blob);
  const a        = document.createElement("a");
  a.href         = url;
  a.download     = `LeadHunter_Proposal_${(proposal.lead_name ?? "Client").replace(/\s+/g, "_")}_LH${proposal.id.slice(0, 6).toUpperCase()}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}