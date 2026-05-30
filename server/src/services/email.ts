import nodemailer from "nodemailer";
import { config } from "../config.js";

export function hasSmtpConfig() {
  return Boolean(config.SMTP_HOST && config.SMTP_USER && config.SMTP_PASS);
}

export function createTransport() {
  return nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_SECURE,
    auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASS } : undefined
  });
}

export async function sendQrEmail(input: {
  to: string;
  name: string;
  qrDataUrl: string;
}) {
  if (!hasSmtpConfig()) {
    throw new Error("SMTP is not configured.");
  }

  const transport = createTransport();
  return transport.sendMail({
    from: config.SMTP_FROM,
    to: input.to,
    subject: "Your event QR code",
    html: `
      <p>Hello ${input.name},</p>
      <p>Your event QR code is attached below. Please show it at the registration desk.</p>
      <p><img src="cid:qrcode" alt="Event QR code" style="width: 260px; height: 260px;" /></p>
      <p>If the image does not load, contact the organizing team.</p>
    `,
    attachments: [
      {
        filename: "qrcode.png",
        path: input.qrDataUrl,
        cid: "qrcode"
      }
    ]
  });
}
