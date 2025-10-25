import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import hbs from 'nodemailer-express-handlebars';
import * as path from 'path';

@Injectable()
export class MailerService {
  private transporter: nodemailer.Transporter;
  private from: string;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: Number(process.env.MAIL_PORT),
      secure: false, // Gmail en 587 usa STARTTLS
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
      requireTLS: true,
    });

    // Configuración de Handlebars
    this.transporter.use(
      'compile',
      hbs({
        viewEngine: {
          extname: '.hbs',
          layoutsDir: path.join(process.cwd(), 'src', 'application', 'mailer', 'templates'),
          defaultLayout: false,
        },
        viewPath: path.join(process.cwd(), 'src', 'application', 'mailer', 'templates'),
        extName: '.hbs',
      }),
    );

    this.from = `"Volantia" <${process.env.MAIL_USER}>`;
  }

  async sendWelcomeEmail(to: string, name?: string | null) {
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: 'Bienvenido a Volantia 🎉',
      template: 'welcome', // usa welcome.hbs
      context: {
        name: name || '¡Bienvenido!',
        actionUrl: process.env.FRONTEND_URL || 'http://localhost:3001',
        year: new Date().getFullYear(),
      },
      attachments: [
        {
          filename: 'volantia.png',
          path: path.join(process.cwd(), 'assets', 'volantia.png'),
          cid: 'volantia-logo',
        },
      ],
    });
  }

  async sendLoginEmail(to: string, name?: string | null) {
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: 'Nuevo inicio de sesión detectado',
      template: 'login', // usa login.hbs
      context: {
        name: name || 'Usuario',
        resetUrl: (process.env.FRONTEND_URL || 'http://localhost:3001') + '/reset-password',
        year: new Date().getFullYear(),
      },
      attachments: [
        {
          filename: 'volantia.png',
          path: path.join(process.cwd(), 'assets', 'volantia.png'),
          cid: 'volantia-logo',
        },
      ],
    });
  }
}