import "server-only";

import nodemailer, { type Transporter } from "nodemailer";

/**
 * SMTP transport.
 *
 * Built once and reused — nodemailer pools connections, and rebuilding the
 * transport per message would open a new TCP+TLS handshake for every absence
 * alert in a batch.
 */

export type Mail = {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Recipient's language — decides the document direction. */
  locale: string;
};

let cached: Transporter | null = null;

/** Configured only when a host is present; otherwise the channel stays a stub. */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
}

function transport(): Transporter {
  if (cached) return cached;
  const port = Number(process.env.SMTP_PORT ?? 587);
  cached = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    // 465 is implicit TLS; 587 starts plaintext and upgrades via STARTTLS.
    secure: port === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
    pool: true,
    maxConnections: 3,
  });
  return cached;
}

/**
 * Sends one message. Throws on failure — the caller decides what a failure
 * means, and for notifications it means the row is recorded FAILED rather than
 * quietly claiming to have been sent.
 */
export async function sendMail(mail: Mail): Promise<void> {
  if (!isEmailConfigured()) throw new Error("SMTP not configured");
  await transport().sendMail({
    from: process.env.SMTP_FROM,
    to: mail.to,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  });
}

/** Verifies the SMTP credentials without sending anything. */
export async function verifyEmail(): Promise<void> {
  if (!isEmailConfigured()) throw new Error("SMTP not configured");
  await transport().verify();
}

/**
 * Wraps a notification body in a minimal bilingual-aware shell.
 *
 * Deliberately plain: parents read these on low-end Android phones through
 * whatever mail client shipped with the device, so this uses table-free markup,
 * inline styles, and no images. `dir`/`lang` on the root element is what makes
 * Arabic render right-to-left in Gmail and Outlook.
 */
export function renderEmail(params: {
  locale: string;
  title: string;
  body: string;
  /** Absolute URL to the relevant page, if any. */
  url?: string;
  actionLabel: string;
  schoolName: string;
}): { html: string; text: string } {
  const rtl = params.locale === "ar";
  const dir = rtl ? "rtl" : "ltr";
  const align = rtl ? "right" : "left";

  const action = params.url
    ? `<p style="margin:24px 0 0"><a href="${escapeHtml(params.url)}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">${escapeHtml(params.actionLabel)}</a></p>`
    : "";

  const html = `<!doctype html>
<html lang="${escapeHtml(params.locale)}" dir="${dir}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px;background:#f6f7f8;font-family:system-ui,-apple-system,'Segoe UI',Tahoma,Arial,sans-serif">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:24px;text-align:${align}">
<p style="margin:0 0 16px;font-size:13px;color:#6b7280">${escapeHtml(params.schoolName)}</p>
<h1 style="margin:0 0 12px;font-size:18px;color:#111827">${escapeHtml(params.title)}</h1>
<p style="margin:0;font-size:15px;line-height:1.7;color:#374151">${escapeHtml(params.body)}</p>
${action}
</div>
</body>
</html>`;

  const text = [params.schoolName, "", params.title, "", params.body, params.url ?? ""]
    .filter((line) => line !== undefined)
    .join("\n")
    .trim();

  return { html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
