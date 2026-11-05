// Emails optionnels [D21] : sans SMTP_URL, pas de transport et les routes qui
// en dependent repondent AUTH_007. Les tests injectent un faux transport.
import nodemailer from "nodemailer";

import type { Env } from "../config/env.ts";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

export function createMailer(env: Env): Mailer | null {
  if (!env.SMTP_URL) return null;
  const transport = nodemailer.createTransport(env.SMTP_URL);
  return {
    send: async (message) => {
      await transport.sendMail({ from: env.SMTP_FROM, ...message });
    },
  };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

/** Gabarit simple : un paragraphe, un lien, une mention de fin. Textes vus : accentues [D87]. */
function linkMail(
  to: string,
  subject: string,
  intro: string,
  label: string,
  url: string
): MailMessage {
  const outro = "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.";
  return {
    to,
    subject,
    text: `${intro}\n\n${label} : ${url}\n\n${outro}\n`,
    html: `<p>${escapeHtml(intro)}</p><p><a href="${escapeHtml(url)}">${escapeHtml(label)}</a></p><p>${escapeHtml(outro)}</p>`,
  };
}

export function verifyEmailMail(to: string, username: string, url: string): MailMessage {
  return linkMail(
    to,
    "Confirmez votre adresse email",
    `Bonjour ${username}, confirmez votre adresse email pour Forest Manager (lien valable 24 heures).`,
    "Confirmer mon adresse",
    url
  );
}

export function resetPasswordMail(to: string, username: string, url: string): MailMessage {
  return linkMail(
    to,
    "Réinitialisation de votre mot de passe",
    `Bonjour ${username}, choisissez un nouveau mot de passe pour Forest Manager (lien valable 1 heure).`,
    "Choisir un nouveau mot de passe",
    url
  );
}
