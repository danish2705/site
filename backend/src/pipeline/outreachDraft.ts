import type { OutreachDraft } from "../types.js";

/**
 * Site outreach — Srikanth's "once you identify the sites, send notification
 * to this sites requesting for support for clinical trial... probably there
 * would be an API that sends an email out to the sites" ask.
 *
 * WHAT THIS DOES: generates draft outreach text (subject + body) per
 * selected site, using real data already known about that site/trial. WHAT
 * THIS DELIBERATELY DOES NOT DO: actually send anything. Two real
 * constraints made that the right line to stop at, not a shortcut:
 *
 *  1. No reliable live contact address. ClinicalTrials.gov sometimes
 *     discloses a central sponsor/study contact, but that's the SPONSOR's
 *     contact for THEIR trial, not a general "we'd like to propose a new
 *     trial to you" address for the facility — and it's frequently absent
 *     entirely, especially on completed/closed studies. There is no live or
 *     public source of a facility's own business-development contact.
 *  2. Cold-emailing real medical facilities on a user's behalf is an
 *     action with real-world consequences (spam/consent/reputational risk
 *     for the requesting organization) that shouldn't happen silently
 *     inside a "generate a draft" feature — sending is a decision a human
 *     should make deliberately, with a real, verified contact, outside
 *     this app's auto-generated placeholder.
 *
 * So `contactEmail` here is a clearly-labeled SYNTHETIC placeholder
 * (contactEmailSource: "synthetic") — good enough to show the shape of the
 * feature and to let a user copy the draft text into their own outreach
 * tool once they've found the facility's real contact, but never presented
 * as a real address and never actually dispatched by this backend.
 */

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
      `Best regards,\n${sender}\n\n` +
      `[DRAFT — generated automatically; review, add specifics, and send from your own verified contact ` +
      `before use. The address below is a placeholder, not a real contact.]`;

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
