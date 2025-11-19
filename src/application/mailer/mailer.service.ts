// mailer.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { google } from 'googleapis';
import * as nodemailer from 'nodemailer';
import * as hbs from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private oAuth2Client;
  private readonly gmail: any;
  private readonly from: string;

  constructor() {
    this.oAuth2Client = new google.auth.OAuth2(
      process.env.MAILER_CLIENT_ID,
      process.env.MAILER_CLIENT_SECRET,
      process.env.MAILER_REDIRECT_URI,
    );
    this.oAuth2Client.setCredentials({
      refresh_token: process.env.MAILER_REFRESH_TOKEN,
    });

    this.gmail = google.gmail({ version: 'v1', auth: this.oAuth2Client });
    this.from = process.env.MAILER_USER ?? ''; // tu cuenta gmail autorizada
  }

  private resolveBasePath(subfolder: 'templates' | 'assets') {
    return path.join(__dirname, subfolder);
  }

  private compileTemplate(templateName: string, context: any): string {
    const filePath = path.join(this.resolveBasePath('templates'), `${templateName}.hbs`);
    const source = fs.readFileSync(filePath, 'utf8');
    const template = hbs.compile(source);
    return template(context);
  }

  private getAssetBase64(filename: string): string | null {
    try {
      const assetPath = path.join(this.resolveBasePath('assets'), filename);
      const buffer = fs.readFileSync(assetPath);
      return buffer.toString('base64');
    } catch (err: any) {
      this.logger.warn(`No se encontró asset ${filename}: ${err.message}`);
      return null;
    }
  }

  /** convierte Buffer o string base64 estándar a base64url para Gmail API */
  private toBase64Url(input: Buffer | string) {
    const b64 = Buffer.isBuffer(input) ? input.toString('base64') : Buffer.from(input).toString('base64');
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  /** Convierte un Readable stream a Buffer */
  private streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (c: Buffer | string) => {
        chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(String(c)));
      });
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  /**
   * Genera el MIME raw usando nodemailer en modo streamTransport (no conecta SMTP)
   * y luego lo envía con Gmail API (users.messages.send).
   */
  private async sendTemplateMail(to: string, subject: string, templateName: string, context: any) {
    try {
      // Compila HTML
      let html = this.compileTemplate(templateName, context);

      // reemplazo cid por dataURL si existe el asset (útil si tu template usa cid:volantia-logo)
      const logoB64 = this.getAssetBase64('volantia.png');
      if (logoB64) {
        const dataUrl = `data:image/png;base64,${logoB64}`;
        html = html.replace(/src=(["'])cid:volantia-logo\1/gi, `src="${dataUrl}"`);
        html = html.replace(/cid:volantia-logo/gi, dataUrl);
        context.volantiaLogo = dataUrl;
      }

      // Generar transporter en modo "stream" para obtener el MIME sin enviar por SMTP
      const transporter = nodemailer.createTransport({
        streamTransport: true,
        buffer: true,
        newline: 'unix',
      });

      // Si quieres adjuntar file real y mantener cid, inclúyelo en attachments.
      const attachments: any[] = [];
      if (logoB64) {
        attachments.push({
          filename: 'volantia.png',
          content: Buffer.from(logoB64, 'base64'),
          cid: 'volantia-logo',
        });
      }
   const mailOptions = {
        from: `${process.env.MAILER_NAME || 'Volantia'} <${this.from}>`,
        to,
        subject,
        html,
        // text (opcional): genera una versión simple
        text: html.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<\/?[^>]+(>|$)/g, '').trim().slice(0, 1000),
        attachments,
      };


      // nodemailer genera el MIME en lugar de enviarlo (info.message puede ser Buffer|string|Readable)
      const info: any = await transporter.sendMail(mailOptions);

      // Obtener Buffer seguro desde info.message (puede ser Buffer|string|Readable)
      let rawMessageBuffer: Buffer;
      const maybeMessage = info?.message ?? info?.message?.message ?? info?.raw ?? null;

      if (Buffer.isBuffer(maybeMessage)) {
        rawMessageBuffer = maybeMessage;
      } else if (typeof maybeMessage === 'string') {
        rawMessageBuffer = Buffer.from(maybeMessage, 'utf-8');
      } else if (maybeMessage && typeof (maybeMessage as any).pipe === 'function') {
        // es un stream
        rawMessageBuffer = await this.streamToBuffer(maybeMessage as unknown as NodeJS.ReadableStream);
      } else if (info && info.message && typeof info.message === 'object' && typeof (info.message as any).toString === 'function') {
        // fallback: try convert to string then buffer
        rawMessageBuffer = Buffer.from(String(info.message));
      } else {
        throw new Error('No se pudo obtener el MIME raw del mensaje generado por nodemailer');
      }

      // convertir a base64url y enviar con Gmail API
      const raw = this.toBase64Url(rawMessageBuffer);
      const res = await this.gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw,
        },
      });

      const messageId = res?.data?.id ?? 'unknown-id';
      this.logger.log(`Email enviado a ${to} - id: ${messageId}`);
      return res;
    } catch (err: any) {
      this.logger.error('Error enviando email con Gmail API', err?.message ?? err);
      throw err;
    }
  }

  // Métodos consumidos por AuthService
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

  async sendCouponEmail(to: string, code: string, discount: number) {
    return this.sendTemplateMail(to, 'Tu cupón de bienvenida', 'coupon', {
      code,
      discount,
      year: new Date().getFullYear(),
    });
  }
}
