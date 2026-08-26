/**
 * The branded email template.
 *
 * One layout for every mail the platform sends: navy masthead with the
 * wordmark, white body card, aqua pill button, coral heart. Built as nested
 * tables with inline styles, because email clients — Outlook above all —
 * ignore anything subtler.
 *
 * Every mail is sent with a plain-text part too, built from the same content,
 * for text-only clients and better spam scoring.
 */

/** Brand colours, mirroring tailwind.config.ts. */
const NAVY = "#01122C"; // headings — the page blue
const HEADER = "#021734"; // the masthead, same tone as the site header
const AQUA = "#04A4B4";
const CORAL = "#F6514D";
const TEXT = "#334A5E";
const MUTED = "#8CA3B8";
const GROUND = "#EEF2F7";

export interface AuthEmail {
  subject: string;
  heading: string;
  /** Plain sentences. Lines starting with "• " render as a list. */
  paragraphs: string[];
  cta?: { label: string; href: string };
  footnote?: string;
  /** Logged instead of sending when no mail key is configured. */
  link: string;
}

/** User-supplied strings (names) must not be able to inject markup. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function emailText(mail: AuthEmail): string {
  return [
    mail.heading,
    "",
    ...mail.paragraphs,
    ...(mail.cta ? ["", `${mail.cta.label}: ${mail.cta.href}`] : []),
    ...(mail.footnote ? ["", mail.footnote] : []),
    "",
    "I Love Durban — The Heartbeat of Our City",
  ].join("\n");
}

const FONT = "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export function emailHtml(mail: AuthEmail): string {
  const paragraphs = mail.paragraphs
    .map((line) => {
      const safe = escapeHtml(line);
      if (line.startsWith("• ")) {
        return `<tr><td style="padding:0 0 8px;font:400 14px/1.6 ${FONT};color:${TEXT};">
          <span style="color:${AQUA};font-weight:700;">&bull;</span>&nbsp; ${safe.slice(2)}
        </td></tr>`;
      }
      return `<tr><td style="padding:0 0 14px;font:400 14px/1.65 ${FONT};color:${TEXT};">${safe}</td></tr>`;
    })
    .join("");

  const button = mail.cta
    ? `<tr><td style="padding:8px 0 20px;">
        <a href="${escapeHtml(mail.cta.href)}"
           style="display:inline-block;background:${AQUA};color:#ffffff;font:700 14px ${FONT};
                  text-decoration:none;padding:13px 32px;border-radius:999px;">
          ${escapeHtml(mail.cta.label)}
        </a>
      </td></tr>
      <tr><td style="padding:0 0 18px;font:400 11px/1.6 ${FONT};color:${MUTED};word-break:break-all;">
        If the button does not work, copy this link into your browser:<br>
        <a href="${escapeHtml(mail.cta.href)}" style="color:${AQUA};">${escapeHtml(mail.cta.href)}</a>
      </td></tr>`
    : "";

  const footnote = mail.footnote
    ? `<tr><td style="padding:14px 0 0;border-top:1px solid #E4EAF1;font:400 12px/1.6 ${FONT};color:${MUTED};">
        ${escapeHtml(mail.footnote)}
      </td></tr>`
    : "";

  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:${GROUND};">
  <div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(mail.heading)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${GROUND};">
    <tr><td align="center" style="padding:28px 12px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="max-width:520px;background:#ffffff;border-radius:18px;overflow:hidden;">

        <!-- Masthead — the site's logo lockup, set in type so it renders in
             every client without image blocking getting in the way. -->
        <tr><td align="center" style="background:${HEADER};padding:26px 32px 22px;">
          <div style="font:800 26px ${FONT};color:#ffffff;letter-spacing:-0.5px;">
            I<span style="color:${CORAL};">&nbsp;&#10084;&#65039;&nbsp;</span>DURBAN
          </div>
          <div style="font:600 9px ${FONT};color:${MUTED};letter-spacing:2.5px;padding-top:6px;">
            THE HEARTBEAT OF OUR CITY
          </div>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px 32px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:0 0 14px;font:800 20px/1.3 ${FONT};color:${NAVY};">
              ${escapeHtml(mail.heading)}
            </td></tr>
            ${paragraphs}
            ${button}
            ${footnote}
          </table>
        </td></tr>

        <!-- Footer -->
        <tr><td align="center" style="background:#F6F9FC;padding:18px 32px;">
          <div style="font:400 11px/1.7 ${FONT};color:${MUTED};">
            I Love Durban &middot; Support local <span style="color:${CORAL};">&#9829;</span><br>
            <a href="https://ilovedurban.co.za" style="color:${AQUA};text-decoration:none;">ilovedurban.co.za</a>
          </div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
