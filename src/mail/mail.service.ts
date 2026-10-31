import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(MailService.name);

  constructor() {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.MAIL_USER, // e.g. your-email@gmail.com
        pass: process.env.MAIL_PASS, // e.g. 16-character App Password
      },
    });
  }

  async sendOtpEmail(to: string, otp: string) {
    if (!process.env.MAIL_USER || !process.env.MAIL_PASS) {
      this.logger.warn(`Mail configuration missing. Mocking email to ${to}. OTP is: ${otp}`);
      return;
    }

    try {
      await this.transporter.sendMail({
        from: `"Hệ Thống Cảnh Báo" <${process.env.MAIL_USER}>`,
        to,
        subject: 'Mã xác thực Đặt lại mật khẩu (OTP)',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
            <h2 style="color: #0056b3;">Khôi phục mật khẩu</h2>
            <p>Xin chào,</p>
            <p>Bạn vừa yêu cầu khôi phục mật khẩu cho tài khoản ứng dụng Cảnh báo thiên tai.</p>
            <p>Mã xác thực OTP của bạn là:</p>
            <h1 style="background: #f4f4f4; padding: 10px; display: inline-block; border-radius: 5px; letter-spacing: 5px;">${otp}</h1>
            <p>Mã này sẽ hết hạn trong vòng 15 phút. Vui lòng không chia sẻ mã này cho bất kỳ ai.</p>
            <p>Trân trọng,<br/>Đội ngũ phát triển</p>
          </div>
        `,
      });
      this.logger.log(`OTP email successfully sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}: ${(error as Error).message}`);
      throw error;
    }
  }
}
