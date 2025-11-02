// src/application/mailer/mailer.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class MailerService {
  private readonly resend: Resend;
  private readonly from: string;
  private readonly logger = new Logger(MailerService.name);

  // correo de fallback para pruebas
  private readonly fallbackRecipient = 'trabajofinal866@gmail.com';

  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY);
    // Usa un remitente de dominio verificado en producción
    this.from = process.env.MAIL_FROM || 'Volantia <onboarding@resend.dev>';
  }

  /** Helper para cargar y reemplazar variables en plantillas */
  private loadTemplate(file: string, replacements: Record<string, string>): string {
    let html = fs.readFileSync(
      path.join(process.cwd(), 'src', 'application', 'mailer', 'templates', file),
      'utf8',
    );
    for (const [key, value] of Object.entries(replacements)) {
      html = html.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    return html;
  }

  /** Decide destinatario según modo */
  private resolveRecipient(to?: string): string {
    // Si MAIL_FROM sigue siendo el de testing, forzamos fallback
    if (this.from.includes('resend.dev')) {
      return this.fallbackRecipient;
    }
    return to || this.fallbackRecipient;
  }

  async sendWelcomeEmail(to?: string, name?: string | null) {
    try {
      const html = this.loadTemplate('welcome.hbs', {
        name: name || '¡Bienvenido!',
        actionUrl: process.env.FRONTEND_URL || 'http://localhost:3001',
        year: new Date().getFullYear().toString(),
      });

      const data = await this.resend.emails.send({
        from: this.from,
        to: this.resolveRecipient(to),
        subject: 'Bienvenido a Volantia 🎉',
        html,
      });

      this.logger.log(`✅ Welcome email enviado a ${this.resolveRecipient(to)}`, data);
    } catch (err) {
      this.logger.error('❌ Error enviando welcome email', err.stack || err);
    }
  }

  async sendLoginEmail(to?: string, name?: string | null) {
    try {
      const html = this.loadTemplate('login.hbs', {
        name: name || 'Usuario',
        resetUrl: (process.env.FRONTEND_URL || 'http://localhost:3001') + '/reset-password',
        year: new Date().getFullYear().toString(),
      });

      const data = await this.resend.emails.send({
        from: this.from,
        to: this.resolveRecipient(to),
        subject: 'Nuevo inicio de sesión detectado',
        html,
      });

      this.logger.log(`✅ Login email enviado a ${this.resolveRecipient(to)}`, data);
    } catch (err) {
      this.logger.error('❌ Error enviando login email', err.stack || err);
    }
  }

  async sendCouponEmail(to: string, code: string, discount: string) {
    try {
      const html = this.loadTemplate('coupon.hbs', {
        code,
        discount,
        year: new Date().getFullYear().toString(),
      });

      const data = await this.resend.emails.send({
        from: this.from,
        to: this.resolveRecipient(to),
        subject: `Tu cupón ${code} está listo 🎁`,
        html,
      });

      this.logger.log(`✅ Coupon email enviado a ${this.resolveRecipient(to)}`, data);
    } catch (err) {
      this.logger.error('❌ Error enviando coupon email', err.stack || err);
    }
  }
}