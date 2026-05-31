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
  qrDataUrl: string;
  subjectTemplate?: string;
  bodyTemplate?: string;
  variables: Record<string, any>;
}) {
  if (!hasSmtpConfig()) {
    throw new Error("SMTP is not configured.");
  }

  const defaultSubject = "Your event QR code";
  const defaultBody = `
    <p>Hello {{name}},</p>
    <p>Your event QR code is attached below. Please show it at the registration desk.</p>
    <p>{{qr_code_image}}</p>
    <p>If the image does not load, contact the organizing team.</p>
  `;

  let subject = input.subjectTemplate || defaultSubject;
  let html = input.bodyTemplate || defaultBody;

  // Prepare template variables
  const templateVars = {
    ...input.variables,
    qr_code_image: '<img src="cid:qrcode" alt="Event QR code" style="max-width: 260px; height: auto;" />'
  };

  // Interpolation function
  const interpolate = (str: string) => {
    return str.replace(/{{(.*?)}}/g, (match, key) => {
      const val = templateVars[key.trim()];
      return val !== undefined ? String(val) : match;
    });
  };

  subject = interpolate(subject);
  html = interpolate(html);

  const transport = createTransport();
  return transport.sendMail({
    from: config.SMTP_FROM,
    to: input.to,
    subject: subject,
    html: html,
    attachments: [
      {
        filename: "qrcode.png",
        path: input.qrDataUrl,
        cid: "qrcode"
      }
    ]
  });
}
