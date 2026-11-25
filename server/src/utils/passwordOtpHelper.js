const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const mailer = require("../config/mailer");

const OTP_SECRET =
  process.env.JWT_SECRET || "hpstore_change_pass_fallback_secret";

function generateSixDigitOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function maskEmail(email = "") {
  const [local = "", domain = ""] = String(email).split("@");
  if (!domain) return email;
  if (local.length <= 2) return `${local[0] || "*"}***@${domain}`;
  return `${local.slice(0, 2)}***${local.slice(-1)}@${domain}`;
}

function formatVietnamTime(date = new Date()) {
  try {
    return new Intl.DateTimeFormat("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

async function createPasswordOtpToken({ maND, email, otp }) {
  const otpHash = await bcrypt.hash(String(otp), 10);
  return jwt.sign(
    {
      purpose: "change_password_otp",
      maND: String(maND),
      email: String(email).trim(),
      otpHash,
    },
    OTP_SECRET,
    { expiresIn: "5m" },
  );
}

async function verifyPasswordOtpToken({ maND, otp, otpToken }) {
  if (!otp || !otpToken) {
    return {
      ok: false,
      message: "Vui lòng nhập mã xác thực OTP đã gửi về email!",
    };
  }

  let payload;
  try {
    payload = jwt.verify(String(otpToken), OTP_SECRET);
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return {
        ok: false,
        message: "Mã OTP đã hết hạn (quá 5 phút). Vui lòng yêu cầu gửi lại mã mới!",
      };
    }
    return {
      ok: false,
      message: "Phiên xác thực OTP không hợp lệ. Vui lòng thử lại!",
    };
  }

  if (
    payload.purpose !== "change_password_otp" ||
    String(payload.maND) !== String(maND)
  ) {
    return {
      ok: false,
      message: "Mã OTP không khớp với tài khoản hiện tại!",
    };
  }

  const isOtpValid = await bcrypt.compare(String(otp).trim(), payload.otpHash);
  if (!isOtpValid) {
    return {
      ok: false,
      message: "Mã OTP không chính xác! Vui lòng kiểm tra lại email.",
    };
  }

  return { ok: true, email: payload.email };
}

async function sendPasswordChangeOtpEmail({ to, fullName, otp }) {
  const displayName = fullName || "Quý khách";
  const html = `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 560px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: #ffffff;">
      <div style="background: linear-gradient(135deg, #d70018 0%, #991b1b 100%); color: #ffffff; padding: 20px 24px;">
        <h2 style="margin: 0; font-size: 20px;">HP STORE — Xác thực đổi mật khẩu</h2>
      </div>
      <div style="padding: 24px; color: #1e293b; line-height: 1.6;">
        <p style="margin-top: 0;">Xin chào <strong>${displayName}</strong>,</p>
        <p>Chúng tôi vừa nhận được yêu cầu <strong>đổi mật khẩu</strong> cho tài khoản HP STORE của bạn. Vui lòng nhập mã OTP gồm 6 chữ số dưới đây để xác nhận:</p>
        <div style="text-align: center; margin: 24px 0;">
          <span style="display: inline-block; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #d70018; background: #fef2f2; border: 2px dashed #fca5a5; padding: 14px 28px; border-radius: 10px;">
            ${otp}
          </span>
        </div>
        <p style="margin: 0 0 12px;">Mã xác thực có hiệu lực trong vòng <strong>5 phút</strong>.</p>
        <p style="font-size: 13px; color: #64748b; margin-bottom: 0;">
          <strong>Lưu ý bảo mật:</strong> Tuyệt đối không chia sẻ mã OTP này cho bất kỳ ai. Nếu bạn không thực hiện yêu cầu này, hãy bỏ qua email và kiểm tra lại bảo mật tài khoản của mình.
        </p>
      </div>
      <div style="background: #f8fafc; padding: 14px 24px; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
        Email tự động từ hệ thống HP STORE • Hotline hỗ trợ: 1800.6868
      </div>
    </div>
  `;

  await mailer.sendMail({
    to,
    subject: "[HP STORE] Mã OTP xác thực đổi mật khẩu",
    html,
  });
}

async function sendPasswordChangedAlertEmail({ to, fullName, username }) {
  const displayName = fullName || "Quý khách";
  const changedAt = formatVietnamTime(new Date());
  const html = `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 560px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: #ffffff;">
      <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #ffffff; padding: 20px 24px;">
        <h2 style="margin: 0; font-size: 20px;">HP STORE — Thông báo bảo mật tài khoản</h2>
      </div>
      <div style="padding: 24px; color: #1e293b; line-height: 1.6;">
        <p style="margin-top: 0;">Xin chào <strong>${displayName}</strong>,</p>
        <p>Mật khẩu đăng nhập cho tài khoản HP STORE của bạn vừa được <strong>thay đổi thành công</strong>.</p>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 18px; margin: 18px 0; font-size: 14px;">
          ${username ? `<div><strong>Tài khoản:</strong> ${username}</div>` : ""}
          <div><strong>Email:</strong> ${to}</div>
          <div><strong>Thời gian thực hiện:</strong> ${changedAt} (GMT+7)</div>
        </div>
        <p style="margin-bottom: 12px;">Nếu chính bạn là người thực hiện thay đổi này, bạn có thể yên tâm bỏ qua email này.</p>
        <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 12px 16px; border-radius: 6px; font-size: 13px; color: #991b1b;">
          <strong>Cảnh báo:</strong> Nếu bạn <u>không</u> thực hiện thao tác đổi mật khẩu này, vui lòng sử dụng chức năng <strong>Quên mật khẩu</strong> để lấy lại quyền truy cập ngay lập tức hoặc liên hệ Hotline hỗ trợ <strong>1800.6868</strong>.
        </div>
      </div>
      <div style="background: #f8fafc; padding: 14px 24px; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
        Email cảnh báo bảo mật tự động từ HP STORE
      </div>
    </div>
  `;

  await mailer.sendMail({
    to,
    subject: "[HP STORE] Thông báo: Mật khẩu tài khoản của bạn vừa được thay đổi",
    html,
  });
}

module.exports = {
  generateSixDigitOtp,
  maskEmail,
  createPasswordOtpToken,
  verifyPasswordOtpToken,
  sendPasswordChangeOtpEmail,
  sendPasswordChangedAlertEmail,
};
