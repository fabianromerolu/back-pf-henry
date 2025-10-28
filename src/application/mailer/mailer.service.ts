// src/application/mailer/mailer.service.ts
import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class MailerService {
  private transporter: nodemailer.Transporter;
  private from: string;
  private templatesDir: string;

  constructor() {
    // 1) Transport
    this.transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: Number(process.env.MAIL_PORT),
      secure: false, // STARTTLS (587)
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
      requireTLS: true,
    });

    // 2) From
    this.from = process.env.MAIL_FROM || `"Volantia" <${process.env.MAIL_USER}>`;

    // 3) Templates dir (funciona en dev y en prod/dist)
    const candidateDirs = [
      // cuando compilas: dist/application/mailer/templates
      path.resolve(__dirname, 'templates'),
      // en dev: src/application/mailer/templates
      path.resolve(process.cwd(), 'src', 'application', 'mailer', 'templates'),
    ];
    this.templatesDir = candidateDirs.find((p) => fs.existsSync(p)) || candidateDirs[0];

    // 4) Registrar plugin handlebars (compatible con CJS y ESM default)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('nodemailer-express-handlebars');
    const hbs = mod?.default ?? mod;

    this.transporter.use(
      'compile',
      hbs({
        viewEngine: {
          extname: '.hbs',
          layoutsDir: this.templatesDir,
          defaultLayout: false,
        },
        viewPath: this.templatesDir,
        extName: '.hbs',
      }),
    );
  }

  async sendWelcomeEmail(to: string, name?: string | null) {
    try {
      const logoPath = path.resolve(process.cwd(), 'assets', 'volantia.png');

      await this.transporter.sendMail({
        from: this.from,
        to,
        subject: 'Bienvenido a Volantia 🎉',
        template: 'welcome', // welcome.hbs
        context: {
          name: name || '¡Bienvenido!',
          actionUrl: process.env.FRONTEND_URL || 'http://localhost:3001',
          year: new Date().getFullYear(),
        },
        attachments: fs.existsSync(logoPath)
          ? [
              {
                filename: 'volantia.png',
                path: logoPath,
                cid: 'volantia-logo',
              },
            ]
          : [],
      });
    } catch (err) {
      // sin drama: loguea y sigue
      // eslint-disable-next-line no-console
      console.error('Error enviando welcome email:', err);
    }
  }

  async sendLoginEmail(to: string, name?: string | null) {
    try {
      const logoPath = path.resolve(process.cwd(), 'assets', 'volantia.png');

      await this.transporter.sendMail({
        from: this.from,
        to,
        subject: 'Nuevo inicio de sesión detectado',
        template: 'login', // login.hbs
        context: {
          name: name || 'Usuario',
          resetUrl: (process.env.FRONTEND_URL || 'http://localhost:3001') + '/reset-password',
          year: new Date().getFullYear(),
        },
        attachments: fs.existsSync(logoPath)
          ? [
              {
                filename: 'volantia.png',
                path: logoPath,
                cid: 'volantia-logo',
              },
            ]
          : [],
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error enviando login email:', err);
    }
  }
}
