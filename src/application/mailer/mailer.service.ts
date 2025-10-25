// src/application/mailer/mailer.service.ts
import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private transporter: nodemailer.Transporter;
  private readonly from: string;

  constructor() {
    const host = process.env.MAIL_HOST || 'smtp.gmail.com';
    const port = Number(process.env.MAIL_PORT || 587);
    const user = process.env.MAIL_USER;
    const pass = process.env.MAIL_PASS;

    this.from =
      process.env.MAIL_FROM ||
      (user ? `"Volantia" <${user}>` : '"Volantia" <no-reply@volantia.app>');

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // solo true si usas 465
      auth: user && pass ? { user, pass } : undefined,
      // pool: true, // opcional si vas a mandar muchos correos
    });
  }

  /** Email simple de bienvenida para nuevos registros */
  async sendWelcomeEmail(to: string, name?: string | null) {
    const safeName = (name || '').trim() || '¡Bienvenido!';
    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.5">
        <h2 style="margin:0 0 8px 0">¡Bienvenido, ${safeName}!</h2>
        <p>Gracias por unirte a nuestra plataforma. Esperamos que disfrutes la experiencia.</p>
        <p>Si tienes dudas, responde a este correo y te ayudamos.</p>
        <br/>
        <p><b>Equipo Volantia</b></p>
      </div>
    `;

    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: 'Bienvenido a Volantia 🎉',
      html,
    });
  }

  /** Email breve en cada login (si así lo deseas) */
  async sendLoginEmail(to: string, name?: string | null) {
    const safeName = (name || '').trim() || '';
    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.5">
        <p>Hola ${safeName || '👋'}, detectamos un nuevo inicio de sesión en tu cuenta.</p>
        <p>Si no fuiste tú, cambia tu contraseña de inmediato.</p>
        <br/>
        <p><b>Equipo Volantia</b></p>
      </div>
    `;

    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: 'Nuevo inicio de sesión',
      html,
    });
  }
}
