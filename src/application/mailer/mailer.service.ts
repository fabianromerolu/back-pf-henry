import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailerService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST || 'smtp.gmail.com',
      port: Number(process.env.MAIL_PORT) || 587,
      secure: false, // true solo si usas puerto 465
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    });
  }

  async sendWelcomeEmail(to: string, name: string) {
    const html = `
      <h2>¡Bienvenido, ${name}!</h2>
      <p>Gracias por unirte a nuestra plataforma. Esperamos que disfrutes la experiencia.</p>
      <p><b>Equipo Volantia</b></p>
    `;

    await this.transporter.sendMail({
      from: `"Volantia" <${process.env.MAIL_USER}>`,
      to,
      subject: 'Bienvenido a Volantia 🎉',
      html,
    });
  }
}
