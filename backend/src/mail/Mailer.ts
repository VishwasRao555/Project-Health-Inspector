import nodemailer from "nodemailer";

export interface MailMessage {
  to: string;
  subject: string;
  body: string;
}

/** Seam #6. Hides delivery mechanism behind one method. */
export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

/** MVP default: logs the email (incl. reset link) to stdout. Zero config required. */
export class ConsoleMailer implements Mailer {
  async send(message: MailMessage): Promise<void> {
    console.log(
      "\n────────────── EMAIL (ConsoleMailer) ──────────────\n" +
        `To:      ${message.to}\n` +
        `Subject: ${message.subject}\n\n` +
        `${message.body}\n` +
        "───────────────────────────────────────────────────\n"
    );
  }
}

/** Real delivery via SMTP (nodemailer). Drop-in when SMTP_* env vars are set. */
export class SmtpMailer implements Mailer {
  private readonly transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
  });

  async send(message: MailMessage): Promise<void> {
    await this.transport.sendMail({
      from: process.env.SMTP_FROM ?? "Project Health Inspector <no-reply@phi.local>",
      to: message.to,
      subject: message.subject,
      text: message.body,
    });
  }
}

/** Picks SMTP when configured, otherwise the console mailer. */
export function createMailer(): Mailer {
  return process.env.SMTP_HOST ? new SmtpMailer() : new ConsoleMailer();
}
