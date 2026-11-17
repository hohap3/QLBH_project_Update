const nodemailer = require("nodemailer");
require("dotenv").config();

// Ưu tiên dùng Gmail thật nếu đã cấu hình EMAIL_USER & EMAIL_PASS,
// nếu chưa có thì fallback về Mailtrap Sandbox để không làm crash server khi test.
const transporter =
  process.env.EMAIL_USER && process.env.EMAIL_PASS
    ? nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      })
    : nodemailer.createTransport({
        host: "sandbox.smtp.mailtrap.io",
        port: 2525,
        auth: {
          user: "2e6383f826ee5d",
          pass: "ec230fa76ba898",
        },
      });

const mailer = {
  sendMail: async (mailOptions) => {
    try {
      const fromEmail = process.env.EMAIL_USER || "no-reply@hpstore.com";
      const info = await transporter.sendMail({
        from: `"HP STORE SYSTEM" <${fromEmail}>`,
        to: mailOptions.to, // 🟢 TỰ ĐỘNG LẤY EMAIL TRONG DB (từ authController truyền sang)
        subject: mailOptions.subject,
        html: mailOptions.html,
      });
      console.log(`👉 Đã gửi OTP thành công tới email: ${mailOptions.to}`);
      return info;
    } catch (error) {
      console.error("❌ Lỗi gửi mail:", error.message);
      throw error;
    }
  },
};

module.exports = mailer;
