import nodemailer from 'nodemailer';

interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  private async getTransporter() {
    if (this.transporter) return this.transporter;

    const host = process.env.SMTP_HOST?.replace(/['"]/g, '').trim();
    const port = parseInt(process.env.SMTP_PORT?.replace(/['"]/g, '') || '465', 10);
    const user = process.env.SMTP_USER?.replace(/['"]/g, '').trim();
    const pass = process.env.SMTP_PASS?.replace(/['"]/g, '').replace(/\s+/g, '');
    const isSecure = process.env.SMTP_SECURE === 'true' || port === 465;

    if (host && user && pass) {
      if (host.includes('gmail.com')) {
        this.transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user,
            pass,
          },
        });
      } else {
        this.transporter = nodemailer.createTransport({
          host,
          port,
          secure: isSecure,
          auth: { user, pass },
        });
      }
      console.log(`✉️ SMTP Transporter ready for: ${user}`);
    } else {
      // Create local fallback test account (Ethereal) for dev if SMTP not configured
      const testAccount = await nodemailer.createTestAccount();
      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      console.log('✉️ Initialized Ethereal test mail transporter:', testAccount.user);
    }

    return this.transporter;
  }

  async sendMail({ to, subject, html, text }: SendMailOptions) {
    try {
      const transporter = await this.getTransporter();
      const rawFrom = process.env.SMTP_FROM?.replace(/['"]/g, '').trim();
      const from = rawFrom ? `"Bizion Support" <${rawFrom}>` : '"Bizion Platform" <no-reply@bizion.in>';

      const info = await transporter.sendMail({
        from,
        to,
        subject,
        html,
        text: text || html.replace(/<[^>]*>?/gm, ''),
      });

      console.log(`✉️ Email dispatched to ${to} [ID: ${info.messageId}]`);
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        console.log(`🔗 Ethereal Preview URL: ${previewUrl}`);
      }

      return { success: true, messageId: info.messageId, previewUrl };
    } catch (error) {
      console.error('❌ Failed to send email:', error);
      return { success: false, error };
    }
  }

  async sendPasswordResetEmail(to: string, resetLink: string, userName?: string) {
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; border: 1px solid #e4e4e7; border-radius: 16px; background-color: #ffffff;">
        <div style="margin-bottom: 24px; text-align: center;">
          <h2 style="color: #18181b; font-size: 24px; font-weight: 800; margin: 0; letter-spacing: -0.5px;">Bizion</h2>
          <p style="color: #71717a; font-size: 13px; margin: 4px 0 0 0;">Password Reset Request</p>
        </div>
        <div style="color: #3f3f46; font-size: 14px; line-height: 22px;">
          <p style="margin: 0 0 16px 0;">Hello ${userName || 'there'},</p>
          <p style="margin: 0 0 24px 0;">We received a request to reset your password. Click the button below to set a new password. This link will expire in <strong>15 minutes</strong>.</p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${resetLink}" style="background-color: #18181b; color: #ffffff; padding: 12px 28px; font-size: 13px; font-weight: 700; text-decoration: none; border-radius: 10px; display: inline-block;">Reset Password</a>
          </div>
          <p style="color: #71717a; font-size: 12px; margin: 0 0 8px 0;">Or copy and paste this URL into your browser:</p>
          <p style="color: #d97706; font-size: 11px; word-break: break-all; margin: 0 0 24px 0;">${resetLink}</p>
          <p style="color: #a1a1aa; font-size: 12px; margin: 0; border-top: 1px solid #f4f4f5; padding-top: 16px;">If you didn't request a password reset, you can safely ignore this email.</p>
        </div>
      </div>
    `;

    return this.sendMail({
      to,
      subject: 'Reset your Bizion password',
      html,
    });
  }
}

export const emailService = new EmailService();
