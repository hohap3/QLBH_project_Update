const nodemailer = require("nodemailer");
const path = require("path");
require("dotenv").config();
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

// Tạo SMTP transporter có timeout ngắn (10-15s) để không bao giờ bị treo spin vô hạn
const createSmtpTransporter = () => {
  const smtpTimeouts = {
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  };

  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    return nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER.trim(),
        pass: process.env.EMAIL_PASS.replace(/\s+/g, ""), // Tự động bỏ dấu cách trong App Password 16 ký tự
      },
      ...smtpTimeouts,
    });
  }

  return nodemailer.createTransport({
    host: "sandbox.smtp.mailtrap.io",
    port: 2525,
    auth: {
      user: "2e6383f826ee5d",
      pass: "ec230fa76ba898",
    },
    ...smtpTimeouts,
  });
};

const mailer = {
  sendMail: async (mailOptions) => {
    const fromName = "HP STORE SYSTEM";
    const fromEmail =
      (process.env.EMAIL_USER && process.env.EMAIL_USER.trim()) ||
      "no-reply@hpstore.com";

    try {
      // 🟢 CÁCH 1 (KHUYÊN DÙNG TRÊN RENDER FREE): Gửi Gmail thật qua Google Apps Script (HTTPS 443)
      // Render Free chặn cổng SMTP (25, 465, 587), nhưng gọi HTTPS 443 qua Apps Script chạy mượt 100%
      if (process.env.GOOGLE_SCRIPT_URL) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000);
        try {
          const response = await fetch(process.env.GOOGLE_SCRIPT_URL.trim(), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: mailOptions.to,
              subject: mailOptions.subject,
              html: mailOptions.html,
              fromName,
            }),
            redirect: "follow",
            signal: controller.signal,
          });

          const resultText = await response.text();
          let result;
          try {
            result = JSON.parse(resultText);
          } catch {
            result = { success: response.ok };
          }

          if (!response.ok || result.success === false) {
            throw new Error(
              result.error ||
                `Google Apps Script trả về lỗi HTTP ${response.status}`,
            );
          }

          console.log(
            `👉 [Google Apps Script] Đã gửi OTP thành công tới Gmail: ${mailOptions.to}`,
          );
          return result;
        } finally {
          clearTimeout(timer);
        }
      }

      // 🟢 CÁCH 2 (RENDER FREE): Gửi Gmail thật qua Brevo HTTP API (HTTPS 443)
      if (process.env.BREVO_API_KEY) {
        const response = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            accept: "application/json",
            "api-key": process.env.BREVO_API_KEY.trim(),
            "content-type": "application/json",
          },
          body: JSON.stringify({
            sender: { name: fromName, email: fromEmail },
            to: [{ email: mailOptions.to }],
            subject: mailOptions.subject,
            htmlContent: mailOptions.html,
          }),
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(
            data.message || `Brevo API lỗi HTTP ${response.status}`,
          );
        }

        console.log(
          `👉 [Brevo HTTP API] Đã gửi OTP thành công tới email: ${mailOptions.to}`,
        );
        return data;
      }

      // 🟢 CÁCH 3 (RENDER FREE): Gửi qua Resend HTTP API (HTTPS 443)
      if (process.env.RESEND_API_KEY) {
        const { Resend } = require("resend");
        const resendClient = new Resend(process.env.RESEND_API_KEY.trim());
        const fromAddress =
          process.env.RESEND_FROM || "HP STORE <onboarding@resend.dev>";
        const { data, error } = await resendClient.emails.send({
          from: fromAddress,
          to: [mailOptions.to],
          subject: mailOptions.subject,
          html: mailOptions.html,
        });
        if (error) {
          throw new Error(error.message || "Resend API error");
        }
        console.log(
          `👉 [Resend] Đã gửi OTP thành công tới: ${mailOptions.to}`,
        );
        return data;
      }

      // 🟢 CÁCH 4 (LOCALHOST / RENDER PAID): Gmail SMTP (465) hoặc Mailtrap Sandbox
      const smtpTransporter = createSmtpTransporter();
      const info = await smtpTransporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: mailOptions.to,
        subject: mailOptions.subject,
        html: mailOptions.html,
      });
      console.log(
        `👉 [SMTP] Đã gửi OTP thành công tới email: ${mailOptions.to}`,
      );
      return info;
    } catch (error) {
      console.error("❌ Lỗi gửi mail:", error.message);
      throw error;
    }
  },
};

module.exports = mailer;
