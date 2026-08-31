import { CloseIcon } from "./Icons";
import { buildGmailComposeUrl, buildOutlookComposeUrl } from "../../utils/emailLinks";
import type { OutreachDraft } from "../../types";

/**
 * Popup for a single outreach draft (used from both the Final Recommendation
 * panel and the Site Ranking table). Shown as a modal instead of expanding
 * inline in the page, since the inline block pushed surrounding content
 * around and read as clutter, especially inside a table row.
 */
export default function OutreachDraftModal({
  draft,
  onClose,
}: {
  draft: OutreachDraft;
  onClose: () => void;
}) {
  return (
    <div className="run-modal-backdrop" onClick={onClose}>
      <div
        className="run-modal"
        style={{ width: "min(720px, 100%)" }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="run-modal-head run-modal-head--sticky">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h2 style={{ fontSize: 18 }}>Outreach draft (not sent)</h2>
          </div>
          <button
            type="button"
            className="icon-close-btn"
            onClick={onClose}
            data-tooltip="Close"
            aria-label="Close"
          >
            <CloseIcon className="btn-icon" />
          </button>
        </div>

        <div style={{ fontSize: 13 }}>
          <div>
            <strong>To:</strong> {draft.contactEmail}
          </div>
          <div>
            <strong>Subject:</strong> {draft.subject}
          </div>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              marginTop: 6,
              fontFamily: "inherit",
              background: "var(--background)",
              border: "1px solid var(--line)",
              borderRadius: 10,
              padding: "12px 14px",
            }}
          >
            {draft.body}
          </pre>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <a
            className="save-run-btn"
            style={{ textDecoration: "none" }}
            href={buildGmailComposeUrl({
              to: draft.contactEmail,
              subject: draft.subject,
              body: draft.body,
            })}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open in Gmail
          </a>
          <a
            className="save-run-btn"
            style={{ textDecoration: "none" }}
            href={buildOutlookComposeUrl({
              to: draft.contactEmail,
              subject: draft.subject,
              body: draft.body,
            })}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open in Outlook
          </a>
        </div>
      </div>
    </div>
  );
}
