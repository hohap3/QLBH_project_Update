const userModel = require("../models/userModel");
const bcrypt = require("bcrypt");
const {
  generateSixDigitOtp,
  maskEmail,
  createPasswordOtpToken,
  verifyPasswordOtpToken,
  sendPasswordChangeOtpEmail,
  sendPasswordChangedAlertEmail,
} = require("../utils/passwordOtpHelper");

const userController = {
  // [GET] Lấy thông tin tài khoản cá nhân
  getProfile: async (req, res) => {
    try {
      const maND = req.query.id;

      if (!maND) {
        return res.status(400).json({ message: "Thiếu ID người dùng" });
      }

      const user = await userModel.getUserById(maND);

      if (!user) {
        return res
          .status(404)
          .json({ message: "Không tìm thấy người dùng trong hệ thống" });
      }

      // Trả về Object chứa chữ thường (mand, tendangnhap, hoten...) theo cơ chế Postgres
      res.status(200).json(user);
    } catch (error) {
      res
        .status(500)
        .json({ message: "Lỗi server khi lấy profile", error: error.message });
    }
  },

  // [POST/PUT] Cập nhật thông tin tài khoản
  updateProfile: async (req, res) => {
    try {
      console.log("Dữ liệu nhận từ Frontend:", req.body);
      const { MaND, HoTen, Email, SDT } = req.body;

      if (!MaND) {
        return res
          .status(400)
          .json({ message: "Không tìm thấy MaND trong yêu cầu" });
      }

      // Kiểm tra trùng lặp
      const duplicate = await userModel.checkDuplicate(MaND, Email, SDT);
      console.log("Kết quả kiểm tra trùng:", duplicate);

      // 🟢 ĐỒNG BỘ: Đọc kết quả dạng chữ thường từ Postgres (emailcount và sdtcount)
      if (duplicate && duplicate.emailcount > 0) {
        return res
          .status(400)
          .json({ message: "Email đã tồn tại ở tài khoản khác" });
      }
      if (duplicate && duplicate.sdtcount > 0) {
        return res
          .status(400)
          .json({ message: "Số điện thoại đã tồn tại ở tài khoản khác" });
      }

      // Tiến hành cập nhật dữ liệu
      await userModel.updateUser(MaND, { HoTen, Email, SDT });
      res
        .status(200)
        .json({ success: true, message: "Cập nhật thông tin thành công!" });
    } catch (error) {
      console.error("Lỗi Controller (updateProfile):", error);
      res.status(500).json({ message: "Lỗi Server khi cập nhật thông tin!" });
    }
  },

  // [POST] Bước 1: Kiểm tra mật khẩu cũ & gửi OTP về email chính chủ (Admin/Nhân viên)
  requestPasswordChangeOtp: async (req, res) => {
    try {
      const { MaND, OldPassword, NewPassword } = req.body;

      if (!MaND || !OldPassword || !NewPassword) {
        return res
          .status(400)
          .json({ message: "Vui lòng nhập đầy đủ thông tin yêu cầu!" });
      }

      if (OldPassword === NewPassword) {
        return res
          .status(400)
          .json({ message: "Mật khẩu mới không được giống mật khẩu cũ!" });
      }

      const [currentHash, user] = await Promise.all([
        userModel.getPassword(MaND),
        userModel.getUserById(MaND),
      ]);

      if (!currentHash || !user) {
        return res.status(404).json({ message: "Người dùng không tồn tại!" });
      }

      const isMatch = await bcrypt.compare(OldPassword, currentHash);
      if (!isMatch) {
        return res
          .status(400)
          .json({ message: "Mật khẩu cũ không chính xác!" });
      }

      const userEmail = (user.email || "").trim();
      if (!userEmail) {
        return res.status(400).json({
          message:
            "Tài khoản chưa có email! Vui lòng cập nhật email trong thông tin tài khoản trước khi đổi mật khẩu.",
        });
      }

      const otp = generateSixDigitOtp();
      const otpToken = await createPasswordOtpToken({
        maND: MaND,
        email: userEmail,
        otp,
      });

      await sendPasswordChangeOtpEmail({
        to: userEmail,
        fullName: user.hoten,
        otp,
      });

      res.status(200).json({
        success: true,
        message: `Đã gửi mã OTP xác thực về email ${maskEmail(userEmail)}.`,
        maskedEmail: maskEmail(userEmail),
        otpToken,
      });
    } catch (error) {
      console.error("Lỗi Controller (requestPasswordChangeOtp):", error);
      res
        .status(500)
        .json({ message: "Không thể gửi mã OTP qua email. Vui lòng thử lại sau!" });
    }
  },

  // [PUT] Bước 2: Xác thực OTP, đổi mật khẩu và gửi email thông báo cho chính chủ
  changePassword: async (req, res) => {
    try {
      const { MaND, OldPassword, NewPassword, Otp, OtpToken } = req.body;

      if (!MaND || !OldPassword || !NewPassword) {
        return res
          .status(400)
          .json({ message: "Vui lòng nhập đầy đủ thông tin yêu cầu!" });
      }

      const otpCheck = await verifyPasswordOtpToken({
        maND: MaND,
        otp: Otp,
        otpToken: OtpToken,
      });
      if (!otpCheck.ok) {
        return res.status(400).json({ message: otpCheck.message });
      }

      // 1. Lấy mật khẩu băm hiện tại từ DB
      const [currentHash, user] = await Promise.all([
        userModel.getPassword(MaND),
        userModel.getUserById(MaND),
      ]);
      if (!currentHash || !user) {
        return res.status(404).json({ message: "Người dùng không tồn tại!" });
      }

      // 2. Kiểm tra đối chiếu mật khẩu cũ
      const isMatch = await bcrypt.compare(OldPassword, currentHash);
      if (!isMatch) {
        return res
          .status(400)
          .json({ message: "Mật khẩu cũ không chính xác!" });
      }

      // 3. Tiến hành mã hóa mật khẩu mới
      const salt = await bcrypt.genSalt(10);
      const newHash = await bcrypt.hash(NewPassword, salt);

      // 4. Lưu cập nhật vào DB
      await userModel.updatePassword(MaND, newHash);

      // 5. Gửi email thông báo cho chính chủ
      const ownerEmail = (user.email || otpCheck.email || "").trim();
      if (ownerEmail) {
        try {
          await sendPasswordChangedAlertEmail({
            to: ownerEmail,
            fullName: user.hoten,
            username: user.tendangnhap,
          });
        } catch (mailErr) {
          console.error(
            "SEND PASSWORD CHANGED ALERT EMAIL ERROR (user):",
            mailErr,
          );
        }
      }

      res.status(200).json({
        success: true,
        message:
          "Đổi mật khẩu thành công! Email thông báo bảo mật đã được gửi về hộp thư của bạn.",
      });
    } catch (error) {
      console.error("Lỗi Controller (changePassword):", error);
      res.status(500).json({ message: "Lỗi server khi đổi mật khẩu!" });
    }
  },
};

module.exports = userController;
