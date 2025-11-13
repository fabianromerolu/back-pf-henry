// mailer.service.ts
import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { google } from 'googleapis';
import * as hbs from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class MailerService {
  private oAuth2Client;

  constructor() {
    this.oAuth2Client = new google.auth.OAuth2(
      process.env.MAILER_CLIENT_ID,
      process.env.MAILER_CLIENT_SECRET,
      process.env.MAILER_REDIRECT_URI,
    );
    this.oAuth2Client.setCredentials({
      refresh_token: process.env.MAILER_REFRESH_TOKEN,
    });
  }

  private async createTransporter() {
    const accessToken = await this.oAuth2Client.getAccessToken();

    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: process.env.MAILER_USER,
        clientId: process.env.MAILER_CLIENT_ID,
        clientSecret: process.env.MAILER_CLIENT_SECRET,
        refreshToken: process.env.MAILER_REFRESH_TOKEN,
        accessToken: accessToken.token || '',
      },
    });
  }

 private resolveBasePath(subfolder: 'templates' | 'assets') {
    // __dirname es la ruta de la carpeta del archivo actual.
    // En desarrollo (ts-node): .../src/application/mailer
    // En producción (node):   .../dist/application/mailer
    // 
    // Ambas carpetas (gracias al nest-cli.json) ahora contienen 
    // las carpetas 'templates' y 'assets' junto a este archivo.
    //
    // Esta ÚNICA LÍNEA funciona para ambos entornos:
    return path.join(__dirname, subfolder);
}

  private compileTemplate(templateName: string, context: any): string {
    const filePath = path.join(
      this.resolveBasePath('templates'),
      `${templateName}.hbs`,
    );
    const source = fs.readFileSync(filePath, 'utf8');
    const template = hbs.compile(source);
    return template(context);
  }

  private async sendTemplateMail(
    to: string,
    subject: string,
    templateName: string,
    context: any,
  ) {
    const transporter = await this.createTransporter();
    const html = this.compileTemplate(templateName, context);

    const mailOptions = {
      from: `Volantia <${process.env.MAILER_USER}>`,
      to,
      subject,
      html,
      attachments: [
        {
          filename: 'volantia.png',
          path: path.join(this.resolveBasePath('assets'), 'volantia.png'),
          cid: 'volantia-logo',
        },
      ],
    };

    return transporter.sendMail(mailOptions);
  }

  // 👇 Métodos específicos que tu AuthService espera
  async sendWelcomeEmail(to: string, name: string) {
    return this.sendTemplateMail(to, 'Bienvenido a Volantia', 'welcome', {
      name,
      actionUrl: 'https://volantia.com/start',
      year: new Date().getFullYear(),
    });
  }

  async sendLoginEmail(to: string, name: string) {
    return this.sendTemplateMail(to, 'Nuevo inicio de sesión', 'login', {
      name,
      resetUrl: 'https://volantia.com/reset',
      year: new Date().getFullYear(),
    });
  }
}