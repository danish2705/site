/**
 * Compose-link builders for the outreach drafts (RecommendationPanel,
 * SiteRankingPanel). This app never sends anything itself — these just hand
 * the already-drafted To/Subject/Body off to the user's own Gmail, Outlook,
 * or default mail app so they can review, fix up the (synthetic) contact
 * address, and send it themselves.
 */
export interface EmailDraftFields {
  to: string;
  subject: string;
  body: string;
}

export function buildGmailComposeUrl({ to, subject, body }: EmailDraftFields): string {
  const params = new URLSearchParams({
    view: "cm",
    fs: "1",
    to,
    su: subject,
    body,
  });
  return `https://mail.google.com/mail/?${params.toString()}`;
}

export function buildOutlookComposeUrl({ to, subject, body }: EmailDraftFields): string {
  const params = new URLSearchParams({ to, subject, body });
  return `https://outlook.office.com/mail/deeplink/compose?${params.toString()}`;
}

export function buildMailtoUrl({ to, subject, body }: EmailDraftFields): string {
  const params = new URLSearchParams({ subject, body });
  return `mailto:${encodeURIComponent(to)}?${params.toString()}`;
}
