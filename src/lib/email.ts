import nodemailer from "nodemailer";

// Création du transport Gmail (réutilisé via singleton)
function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: false, // STARTTLS
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

const globalForMailer = globalThis as unknown as {
  mailer: ReturnType<typeof createTransport> | undefined;
};

const mailer = globalForMailer.mailer ?? createTransport();
if (process.env.NODE_ENV !== "production") globalForMailer.mailer = mailer;

export interface EmailPayload {
  to: string | string[];
  subject: string;
  html: string;
}

/**
 * Envoie un email. Ne bloque jamais l'action principale.
 * Retourne true si envoyé, false sinon.
 */
export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn("[email] SMTP non configuré — email non envoyé :", payload.subject);
    return false;
  }

  try {
    await mailer.sendMail({
      from: process.env.EMAIL_FROM ?? process.env.SMTP_USER,
      to: Array.isArray(payload.to) ? payload.to.join(", ") : payload.to,
      subject: payload.subject,
      html: payload.html,
    });
    console.log("[email] Envoyé :", payload.subject, "→", payload.to);
    return true;
  } catch (err) {
    console.error("[email] Échec envoi :", err);
    return false;
  }
}
