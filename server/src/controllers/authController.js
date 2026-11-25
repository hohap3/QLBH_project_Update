const AuthModel = require("../models/authModel");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const transporter = require("../config/mailer");
const {
  maskEmail,
  sendPasswordChangedAlertEmail,
} = require("../utils/passwordOtpHelper");

// 1. Bước 1 Đăng ký: Validate, kiểm tra trùng, gửi OTP — CHƯA lưu vào Database cho đến khi xác thực OTP thành công
exports.register = async (req, res) => {
  try {
    const { fullname, username, email, phone, password, address } = req.body;

    if (!fullname || !username || !email || !phone || !password) {
      return res
        .status(400)
        .json({ message: "Vui lòng cung cấp đầy đủ thông tin!" });
    }

    const cleanUsername = username.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanFullname = fullname.trim();
    const cleanPhone = phone.trim();

    // Chặn ký tự HTML (<, >) để phòng chống Stored XSS ngay từ bước đăng ký
    if (/[<>]/.test(cleanFullname) || /[<>]/.test(cleanUsername)) {
      return res.status(400).json({
        message: "Họ tên và tên đăng nhập không được chứa ký tự đặc biệt < hoặc >!",
      });
    }

    const duplicates = await AuthModel.checkDuplicate(cleanUsername, cleanEmail);
    if (duplicates && duplicates.length > 0) {
      const isUserTaken = duplicates.some((u) => u.tendangnhap === cleanUsername);
      if (isUserTaken) {
        return res.status(400).json({ message: "Tên đăng nhập đã tồn tại!" });
      }
      return res.status(400).json({ message: "Email này đã được sử dụng!" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // TẠO MÃ OTP 6 SỐ ĐỂ XÁC THỰC EMAIL ĐĂNG KÝ
    const activationOtp = Math.floor(
      100000 + Math.random() * 900000,
    ).toString();
    const otpHash = await bcrypt.hash(activationOtp, 8);

    // GỬI MAIL XÁC THỰC TRƯỚC — Nếu lỗi gửi mail, không tạo dữ liệu rác trong DB
    const mailOptions = {
      to: cleanEmail,
      subject: "[HP STORE] - Xác nhận kích hoạt tài khoản mới",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
          <h2 style="color: #d70018; text-align: center;">HP STORE</h2>
          <p>Chào <b>${cleanFullname}</b>,</p>
          <p>Cảm ơn bạn đã đăng ký thành viên tại HP STORE. Vui lòng nhập mã OTP dưới đây để hoàn tất đăng ký tài khoản:</p>
          <div style="background: #fff1f2; padding: 15px; text-align: center; font-size: 26px; font-weight: bold; letter-spacing: 5px; color: #d70018; border-radius: 5px; margin: 20px 0;">
            ${activationOtp}
          </div>
          <p style="color: #64748b; font-size: 13px;">* Mã xác thực có hiệu lực trong vòng 5 phút. Tài khoản chỉ được tạo sau khi bạn nhập đúng mã này.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    // Đóng gói thông tin chờ xác thực vào JWT có hạn 5 phút (stateless, không lưu rác vào DB)
    const jwtSecret = process.env.JWT_SECRET || "hpstore_register_fallback_secret";
    const pendingToken = jwt.sign(
      {
        purpose: "register_otp",
        fullname: cleanFullname,
        username: cleanUsername,
        email: cleanEmail,
        phone: cleanPhone,
        address: address || null,
        passwordHash: hashedPassword,
        otpHash,
      },
      jwtSecret,
      { expiresIn: "5m" },
    );

    return res.status(200).json({
      message:
        "Mã OTP đã được gửi đến Email của bạn! Vui lòng nhập mã OTP để hoàn tất đăng ký.",
      email: cleanEmail,
      pendingToken,
    });
  } catch (error) {
    console.error("REGISTER ERROR:", error);
    return res.status(500).json({
      message: error.message || "Lỗi hệ thống khi đăng ký thành viên!",
      error: error.message,
    });
  }
};

// 2. Bước 2 Đăng ký: Xác thực OTP — CHỈ LÚC NÀY MỚI LƯU TÀI KHOẢN VÀO DATABASE
exports.verifyActivation = async (req, res) => {
  try {
    const { email, otp, pendingToken } = req.body;

    const cleanEmail = email ? email.trim().toLowerCase() : "";
    const cleanOtp = otp ? otp.trim() : "";

    if (!cleanEmail || !cleanOtp) {
      return res
        .status(400)
        .json({ message: "Thiếu dữ liệu Email hoặc mã OTP xác thực!" });
    }

    // Luồng mới: Xác thực qua pendingToken rồi mới INSERT vào DB với trangthai = true
    if (pendingToken) {
      const jwtSecret = process.env.JWT_SECRET || "hpstore_register_fallback_secret";
      let payload;
      try {
        payload = jwt.verify(pendingToken, jwtSecret);
      } catch (err) {
        return res.status(400).json({
          message: "Mã OTP đã hết hạn (quá 5 phút) hoặc không hợp lệ. Vui lòng gửi lại mã mới!",
        });
      }

      if (payload.purpose !== "register_otp" || payload.email !== cleanEmail) {
        return res.status(400).json({
          message: "Thông tin xác thực không khớp với email đăng ký!",
        });
      }

      const isOtpValid = await bcrypt.compare(cleanOtp, payload.otpHash);
      if (!isOtpValid) {
        return res.status(400).json({
          message: "Mã xác thực OTP không chính xác!",
        });
      }

      // Kiểm tra trùng lặp lần cuối trước khi ghi vào DB (chống bấm đúp / race condition)
      const duplicates = await AuthModel.checkDuplicate(payload.username, payload.email);
      if (duplicates && duplicates.length > 0) {
        return res.status(400).json({
          message: "Tài khoản hoặc Email này đã được đăng ký trước đó!",
        });
      }

      const shortID = Date.now().toString().slice(-7);
      const randomID = Math.floor(Math.random() * 100);

      await AuthModel.createND({
        maND: `ND${shortID}${randomID}`,
        maKH: `KH${shortID}${randomID}`,
        username: payload.username,
        passwordHash: payload.passwordHash,
        fullname: payload.fullname,
        email: payload.email,
        phone: payload.phone,
        diaChi: payload.address || null,
        maVaiTro: "Client",
        isActive: true,
      });

      return res.status(201).json({
        message:
          "Đăng ký và kích hoạt tài khoản thành công! Hiện tại bạn đã có thể đăng nhập.",
      });
    }

    // Fallback cho các tài khoản cũ đã lỡ nằm trong DB ở trạng thái chờ kích hoạt
    const result = await AuthModel.activateAccount(cleanEmail, cleanOtp);

    if (!result.success) {
      return res.status(400).json({ message: result.message });
    }

    return res.status(200).json({
      message:
        "Tài khoản của bạn đã được kích hoạt thành công! Hiện tại bạn đã có thể đăng nhập.",
    });
  } catch (error) {
    console.error("VERIFY ACTIVATION ERROR:", error);
    return res.status(500).json({
      message: "Lỗi hệ thống trong quá trình kích hoạt tài khoản!",
      error: error.message,
    });
  }
};

// 3. Xử lý Đăng nhập tài khoản
exports.login = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res
        .status(400)
        .json({ message: "Vui lòng nhập đầy đủ thông tin!" });
    }

    const user = await AuthModel.findByIdentifier(identifier);

    if (!user) {
      return res
        .status(401)
        .json({ message: "Tài khoản hoặc email không tồn tại!" });
    }

    if (user.trangthai === false || user.trangthai === 0) {
      return res.status(403).json({
        message:
          "Tài khoản chưa kích hoạt hoặc bị khóa. Vui lòng kiểm tra lại Email của bạn hoặc liên hệ Admin!",
      });
    }

    if (!user.matkhauhash) {
      return res.status(500).json({
        message:
          "Không tìm thấy trường mật khẩu băm từ Database! Kiểm tra lại tên cột.",
      });
    }

    const isMatch = await bcrypt.compare(password, user.matkhauhash);
    if (!isMatch) {
      return res.status(401).json({ message: "Mật khẩu không chính xác!" });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        message: "Lỗi cấu hình Server!",
        error:
          "Biến môi trường JWT_SECRET chưa được cấu hình trên Render Dashboard!",
      });
    }

    const token = jwt.sign(
      {
        maND: user.mand,
        username: user.tendangnhap,
        role: user.mavaitro,
        machinhanh: user.machinhanh || null,
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" },
    );

    return res.status(200).json({
      message: "Đăng nhập thành công!",
      token,
      user: {
        maND: user.mand,
        username: user.tendangnhap,
        fullname: user.hoten,
        role: user.mavaitro,
        machinhanh: user.machinhanh || null,
      },
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error);
    if (error.status === 403) {
      return res.status(403).json({ message: error.message });
    }
    return res.status(500).json({
      message: "Lỗi server nội bộ!",
      error: error.message,
    });
  }
};

// 4. Thẩm định quyền hạn thời gian thực
exports.verifyRole = async (req, res) => {
  try {
    const { maND } = req.user;
    const user = await AuthModel.findByMaND(maND);

    if (!user) {
      return res
        .status(401)
        .json({ message: "Tài khoản không tồn tại trên hệ thống!" });
    }

    if (user.trangthai === false || user.trangthai === 0) {
      return res
        .status(403)
        .json({ message: "Tài khoản của bạn đã bị khóa hoặc chưa kích hoạt!" });
    }

    return res.status(200).json({
      role: user.mavaitro,
      username: user.tendangnhap,
      fullname: user.hoten,
      machinhanh: user.machinhanh || null,
    });
  } catch (error) {
    console.error("VERIFY ROLE ERROR:", error);
    return res.status(500).json({
      message: "Lỗi kiểm tra quyền hạn hệ thống!",
      error: error.message,
    });
  }
};

// 5. Xử lý OTP khi quên mật khẩu
exports.forgotPassword = async (req, res) => {
  try {
    const cleanEmail = (req.body?.email || "").trim();
    if (!cleanEmail) {
      return res
        .status(400)
        .json({ message: "Vui lòng cung cấp địa chỉ Email!" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    const user = await AuthModel.updateOTP(cleanEmail, otp);
    if (!user) {
      return res
        .status(404)
        .json({ message: "Địa chỉ Email này không tồn tại trên hệ thống!" });
    }

    const targetEmail = (user.email || cleanEmail).trim();
    const displayName = user.hoten || "bạn";

    const mailOptions = {
      to: targetEmail,
      subject: "[HP STORE] - Mã xác thực khôi phục mật khẩu",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
          <h2 style="color: #6138ff; text-align: center; margin-top: 0;">HP STORE</h2>
          <p>Chào <strong>${displayName}</strong>,</p>
          <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Dưới đây là mã xác thực OTP:</p>
          <div style="background: #f4f4ff; padding: 15px; text-align: center; font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #6138ff; border-radius: 8px; margin: 20px 0;">
            ${otp}
          </div>
          <p style="color: #ff3838; font-size: 13px;">* Mã OTP này có hiệu lực trong vòng 5 phút. Vui lòng không chia sẻ mã này cho bất kỳ ai.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    return res.status(200).json({
      success: true,
      maskedEmail: maskEmail(targetEmail),
      message: `Mã OTP đã được gửi tới email ${maskEmail(targetEmail)} (kiểm tra cả mục Spam nếu chưa thấy)!`,
    });
  } catch (error) {
    console.error("FORGOT PASSWORD ERROR:", error);
    return res
      .status(500)
      .json({ message: "Lỗi hệ thống khi gửi mã OTP!", error: error.message });
  }
};

// 6. Đặt lại mật khẩu mới qua OTP + gửi email thông báo bảo mật cho chính chủ
exports.resetPassword = async (req, res) => {
  try {
    const email = (req.body?.email || "").trim();
    const otp = String(req.body?.otp || "").trim();
    const newPassword = req.body?.newPassword || "";

    if (!email || !otp || !newPassword) {
      return res
        .status(400)
        .json({ message: "Vui lòng cung cấp đầy đủ thông tin yêu cầu!" });
    }

    if (newPassword.length < 6) {
      return res
        .status(400)
        .json({ message: "Mật khẩu mới phải từ 6 ký tự trở lên!" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    const result = await AuthModel.verifyAndResetPassword(
      email,
      otp,
      hashedPassword,
    );

    if (!result.success) {
      return res.status(400).json({ message: result.message });
    }

    // Gửi email cảnh báo bảo mật cho chính chủ
    const ownerEmail = (result.user?.email || email).trim();
    if (ownerEmail) {
      try {
        await sendPasswordChangedAlertEmail({
          to: ownerEmail,
          fullName: result.user?.hoten,
          username: result.user?.tendangnhap,
        });
      } catch (mailErr) {
        console.error("RESET PASSWORD ALERT EMAIL ERROR:", mailErr);
      }
    }

    return res.status(200).json({
      success: true,
      message:
        "Đặt lại mật khẩu thành công! Email thông báo bảo mật đã được gửi về hộp thư của bạn.",
    });
  } catch (error) {
    console.error("RESET PASSWORD ERROR:", error);
    return res.status(500).json({
      message: "Lỗi hệ thống khi đổi mật khẩu!",
      error: error.message,
    });
  }
};
