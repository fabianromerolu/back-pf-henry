// src/application/mailer/mailer.service.ts
import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class MailerService {
  private resend: Resend;
  private from: string;
  private readonly testRecipient = 'trabajofinal866@gmail.com'; // 👈 tu correo

  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY);
    this.from = process.env.MAIL_FROM || 'Volantia <onboarding@resend.dev>';
  }

  async sendWelcomeEmail(_to: string, name?: string | null) {
    try {
      const html = fs.readFileSync(
        path.join(process.cwd(), 'src', 'application', 'mailer', 'templates', 'welcome.hbs'),
        'utf8',
      )
        .replace('{{name}}', name || '¡Bienvenido!')
        .replace('{{actionUrl}}', process.env.FRONTEND_URL || 'http://localhost:3001')
        .replace('{{year}}', new Date().getFullYear().toString());

      const data = await this.resend.emails.send({
        from: this.from,
        to: this.testRecipient, // 👈 siempre a tu Gmail
        subject: 'Bienvenido a Volantia 🎉',
        html,
      });

      console.log(`✅ Welcome email enviado a ${this.testRecipient}`, data);
    } catch (err) {
      console.error('❌ Error enviando welcome email:', err);
    }
  }

  async sendLoginEmail(_to: string, name?: string | null) {
    try {
      const html = fs.readFileSync(
        path.join(process.cwd(), 'src', 'application', 'mailer', 'templates', 'login.hbs'),
        'utf8',
      )
        .replace('{{name}}', name || 'Usuario')
        .replace('{{resetUrl}}', (process.env.FRONTEND_URL || 'http://localhost:3001') + '/reset-password')
        .replace('{{year}}', new Date().getFullYear().toString());

      const data = await this.resend.emails.send({
        from: this.from,
        to: this.testRecipient, // 👈 siempre a tu Gmail
        subject: 'Nuevo inicio de sesión detectado',
        html,
      });

      console.log(`✅ Login email enviado a ${this.testRecipient}`, data);
    } catch (err) {
      console.error('❌ Error enviando login email:', err);
    }
  }
}