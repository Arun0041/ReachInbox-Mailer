import nodemailer, { type Transporter } from "nodemailer";
import { config } from "../config.js";

let transporter: Transporter | null = null;
let previewNote = "using configured Ethereal credentials";

/**
 * Ethereal Email (fake SMTP). If no credentials are configured, a throwaway
 * test account is created at boot so the system always has a working SMTP.
 */
export async function initMailer(): Promise<void> {
  if (config.etherealUser && config.etherealPass) {
    transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: { user: config.etherealUser, pass: config.etherealPass },
    });
  } else {
    const account = await nodemailer.createTestAccount();
    previewNote = `auto-created Ethereal account ${account.user}`;
    transporter = nodemailer.createTransport({
      host: account.smtp.host,
      port: account.smtp.port,
      secure: account.smtp.secure,
      auth: { user: account.user, pass: account.pass },
    });
  }
  console.log(`[mailer] ready (${previewNote})`);
}

export interface SendResult {
  messageId: string;
  previewUrl: string | null;
}

export async function sendEmail(params: {
  from: string;
  to: string;
  subject: string;
  /** HTML body (composed in the rich-text editor) */
  html: string;
}): Promise<SendResult> {
  if (!transporter) throw new Error("Mailer not initialised");
  // Plain-text fallback: strip tags so non-HTML clients still read it.
  const text = params.html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|blockquote|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();

  const info = await transporter.sendMail({
    from: params.from,
    to: params.to,
    subject: params.subject,
    text,
    html: params.html,
  });
  return {
    messageId: info.messageId,
    previewUrl: nodemailer.getTestMessageUrl(info) || null,
  };
}
