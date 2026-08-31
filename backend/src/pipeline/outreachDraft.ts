import type { OutreachDraft } from "../types.js";

export interface OutreachDraftSiteInput {
  siteId: string;
  siteName: string;
  city?: string | null;
  country?: string | null;
}

export interface BuildOutreachDraftsParams {
  sites: OutreachDraftSiteInput[];
  indication: string;
  phase?: string;
  targetEnrollment?: number;
  senderOrganization?: string;
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "site"
  );
}

function syntheticContactEmailFor(site: OutreachDraftSiteInput): string {
  // Deterministic, not random — same site always gets the same placeholder
  // address across calls, but it is fabricated, not looked up.
  return `trials-outreach@${slugify(site.siteName)}.example`;
}

export function buildOutreachDrafts(
  params: BuildOutreachDraftsParams,
): { drafts: OutreachDraft[]; warnings: string[] } {
  const warnings: string[] = [];
  if (params.sites.length === 0) {
    warnings.push("No sites were provided to draft outreach for.");
    return { drafts: [], warnings };
  }

  warnings.push(
    "Every contact address below is a SYNTHETIC placeholder, not a real facility contact — " +
      "ClinicalTrials.gov does not reliably disclose one. Verify each facility's real contact " +
      "before sending; this app does not send anything on its own.",
  );

  const sender = params.senderOrganization || "[Your organization]";
  const phaseText = params.phase ? ` ${params.phase}` : "";
  const targetText =
    params.targetEnrollment && params.targetEnrollment > 0
      ? ` targeting approximately ${params.targetEnrollment.toLocaleString()} enrolled patients`
      : "";

  const drafts: OutreachDraft[] = params.sites.map((site) => {
    const locality = [site.city, site.country].filter(Boolean).join(", ");
    const subject = `Clinical trial site inquiry — ${params.indication}${phaseText} trial`;
    const body =
      `Dear ${site.siteName} Clinical Research Team,\n\n` +
      `${sender} is planning a${phaseText || ""} clinical trial for ${params.indication}${targetText}, ` +
      `and your facility${locality ? ` in ${locality}` : ""} was identified as a potential site based on its ` +
      `disclosed trial history and patient population for this indication on ClinicalTrials.gov.\n\n` +
      `We would like to ask whether your site would be able to support this trial, and if so, to request ` +
      `more information on your current capacity, relevant investigator experience, and interest in ` +
      `participating.\n\n` +
      `Please let us know a good time to discuss further.\n\n` +
      `Best regards,\n${sender}`;

    return {
      siteId: site.siteId,
      siteName: site.siteName,
      city: site.city ?? null,
      country: site.country ?? null,
      contactEmail: syntheticContactEmailFor(site),
      contactEmailSource: "synthetic",
      subject,
      body,
    };
  });

  return { drafts, warnings };
}
