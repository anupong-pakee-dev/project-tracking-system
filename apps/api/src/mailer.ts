import nodemailer from "nodemailer";

export interface Email {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface Mailer {
  send(email: Email): Promise<void>;
}

/** SMTP mailer. Locally this is Mailpit (docker-compose) — open http://localhost:8025 to read mail. */
export function createSmtpMailer(smtpUrl: string, from: string): Mailer {
  const transport = nodemailer.createTransport(smtpUrl);
  return {
    async send(email) {
      await transport.sendMail({ from, ...email });
    },
  };
}

/** Keeps sent emails in memory — for tests. */
export function createMemoryMailer(): Mailer & { sent: Email[] } {
  const sent: Email[] = [];
  return {
    sent,
    async send(email) {
      sent.push(email);
    },
  };
}
