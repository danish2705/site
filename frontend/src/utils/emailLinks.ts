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
