const ProfileModel = require("../models/profileModel");
const bcrypt = require("bcrypt");
const {
  generateSixDigitOtp,
  maskEmail,
  createPasswordOtpToken,
  verifyPasswordOtpToken,
  sendPasswordChangeOtpEmail,
  sendPasswordChangedAlertEmail,
} = require("../utils/passwordOtpHelper");

class ProfileController {
  // Lấy thông tin tài khoản
  static async getProfile(req, res) {
    try {
      const { maND } = req.params;
      const profile = await ProfileModel.getProfileByMaND(maND);

      if (!profile) {
        return res
          .status(404)
          .json({ success: false, message: "Không tìm thấy người dùng!" });
      }

      // Trả về dữ liệu (Lúc này các thuộc tính đều là chữ thường theo chuẩn Postgres)
      res.status(200).json(profile);
    } catch (err) {
      console.error("GET PROFILE ERROR:", err);
      res.status(500).json({
        success: false,
        message: "Lỗi hệ thống khi lấy thông tin hồ sơ!",
        error: err.message,
      });
    }
  }

  // Cập nhật thông tin tài khoản
  static async updateProfile(req, res) {
    try {
      const { maND } = req.params;
      // Nhận dữ liệu từ req.body (giữ nguyên quy tắc camelCase/PascalCase từ Frontend gửi lên nếu có)
      const { HoTen, SDT, Email, DiaChi } = req.body;

      if (!HoTen || !SDT) {
        return res.status(400).json({
          success: false,
          message: "Họ tên và Số điện thoại là bắt buộc!",
        });
      }

      // Đổi sang key tương ứng với cấu trúc biến dùng trong Model
      await ProfileModel.updateProfile(maND, {
        hoten: HoTen,
        sdt: SDT,
        email: Email,
        diachi: DiaChi,
      });

      res
        .status(200)
        .json({ success: true, message: "Cập nhật thông tin thành công!" });
    } catch (err) {
      console.error("UPDATE PROFILE ERROR:", err);
      res.status(500).json({
        success: false,
        message: "Lỗi hệ thống khi cập nhật hồ sơ!",
        error: err.message,
      });
    }
  }

  // Bước 1: Kiểm tra mật khẩu hiện tại & gửi mã OTP về email chính chủ
  static async requestPasswordChangeOtp(req, res) {
    try {
      const { maND } = req.params;
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          message: "Vui lòng nhập đủ mật khẩu hiện tại và mật khẩu mới!",
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: "Mật khẩu mới phải từ 6 ký tự trở lên!",
        });
      }

      if (currentPassword === newPassword) {
        return res.status(400).json({
          success: false,
          message: "Mật khẩu mới không được trùng mật khẩu hiện tại!",
        });
      }

      const [passwordRow, profile] = await Promise.all([
        ProfileModel.getPasswordHash(maND),
        ProfileModel.getProfileByMaND(maND),
      ]);

      if (!passwordRow || !profile) {
        return res
          .status(404)
          .json({ success: false, message: "Người dùng không tồn tại!" });
      }

      const isMatch = await bcrypt.compare(
        currentPassword,
        passwordRow.matkhauhash,
      );
      if (!isMatch) {
        return res.status(400).json({
          success: false,
          message: "Mật khẩu hiện tại không chính xác!",
        });
      }

      const userEmail = (profile.email || "").trim();
      if (!userEmail) {
        return res.status(400).json({
          success: false,
          message:
            "Tài khoản chưa có địa chỉ email! Vui lòng cập nhật email trong hồ sơ trước khi đổi mật khẩu.",
        });
      }

      const otp = generateSixDigitOtp();
      const otpToken = await createPasswordOtpToken({
        maND,
        email: userEmail,
        otp,
      });

      await sendPasswordChangeOtpEmail({
        to: userEmail,
        fullName: profile.hoten,
        otp,
      });

      res.status(200).json({
        success: true,
        message: `Đã gửi mã OTP xác thực về email ${maskEmail(userEmail)}.`,
        maskedEmail: maskEmail(userEmail),
        otpToken,
      });
    } catch (err) {
      console.error("REQUEST PASSWORD OTP ERROR:", err);
      res.status(500).json({
        success: false,
        message: "Không thể gửi mã OTP qua email. Vui lòng thử lại sau!",
        error: err.message,
      });
    }
  }

  // Bước 2: Xác thực OTP, đổi mật khẩu và gửi email cảnh báo cho chính chủ
  static async changePassword(req, res) {
    try {
      const { maND } = req.params;
      const { currentPassword, newPassword, otp, otpToken } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          message: "Vui lòng nhập đủ mật khẩu cũ và mới!",
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: "Mật khẩu mới phải từ 6 ký tự trở lên!",
        });
      }

      const otpCheck = await verifyPasswordOtpToken({ maND, otp, otpToken });
      if (!otpCheck.ok) {
        return res.status(400).json({
          success: false,
          message: otpCheck.message,
        });
      }

      const [user, profile] = await Promise.all([
        ProfileModel.getPasswordHash(maND),
        ProfileModel.getProfileByMaND(maND),
      ]);
      if (!user || !profile) {
        return res
          .status(404)
          .json({ success: false, message: "Người dùng không tồn tại!" });
      }

      const isMatch = await bcrypt.compare(currentPassword, user.matkhauhash);
      if (!isMatch) {
        return res.status(400).json({
          success: false,
          message: "Mật khẩu hiện tại không chính xác!",
        });
      }

      const salt = await bcrypt.genSalt(10);
      const newPasswordHash = await bcrypt.hash(newPassword, salt);

      await ProfileModel.updatePassword(maND, newPasswordHash);

      const ownerEmail = (profile.email || otpCheck.email || "").trim();
      if (ownerEmail) {
        try {
          await sendPasswordChangedAlertEmail({
            to: ownerEmail,
            fullName: profile.hoten,
            username: profile.tendangnhap,
          });
        } catch (mailErr) {
          console.error(
            "SEND PASSWORD CHANGED ALERT EMAIL ERROR (profile):",
            mailErr,
          );
        }
      }

      res.status(200).json({
        success: true,
        message:
          "Thay đổi mật khẩu thành công! Email thông báo đã được gửi về hộp thư của bạn.",
      });
    } catch (err) {
      console.error("CHANGE PASSWORD ERROR:", err);
      res.status(500).json({
        success: false,
        message: "Lỗi hệ thống khi đổi mật khẩu!",
        error: err.message,
      });
    }
  }
}

module.exports = ProfileController;
