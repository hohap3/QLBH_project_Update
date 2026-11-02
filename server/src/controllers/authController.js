const AuthModel = require("../models/authModel");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const transporter = require("../config/mailer");

// 1. Xử lý Đăng ký thành viên & Tự động gửi Email xác nhận kích hoạt
exports.register = async (req, res) => {
  try {
    const { fullname, username, email, phone, password, address } = req.body;

    if (!fullname || !username || !email || !phone || !password) {
      return res
        .status(400)
        .json({ message: "Vui lòng cung cấp đầy đủ thông tin!" });
    }

    const duplicates = await AuthModel.checkDuplicate(username, email);
    if (duplicates && duplicates.length > 0) {
      const isUserTaken = duplicates.some((u) => u.tendangnhap === username);
      if (isUserTaken) {
        return res.status(400).json({ message: "Tên đăng nhập đã tồn tại!" });
      }
      return res.status(400).json({ message: "Email này đã được sử dụng!" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const shortID = Date.now().toString().slice(-7);
    const randomID = Math.floor(Math.random() * 100);

    // TẠO MÃ OTP ĐỂ XÁC THỰC EMAIL ĐĂNG KÝ
    const activationOtp = Math.floor(
      100000 + Math.random() * 900000,
    ).toString();
    const expiredAt = new Date(Date.now() + 5 * 60 * 1000); // 5 phút hiệu lực

    const newUser = {
      maND: `ND${shortID}${randomID}`,
      maKH: `KH${shortID}${randomID}`,
      username: username,
      passwordHash: hashedPassword,
      fullname: fullname,
      email: email,
      phone: phone,
      diaChi: address || null,
      maVaiTro: "Client",
      otpCode: activationOtp,
      otpExpired: expiredAt,
    };

    // Tạo tài khoản ở trạng thái chờ kích hoạt (trangthai = false)
    await AuthModel.createND(newUser);

    // TIẾN HÀNH GỬI MAIL KÍCH HOẠT NGAY SAU KHI INSERT THÀNH CÔNG
    const mailOptions = {
      to: email,
      subject: "[HP STORE] - Xác nhận kích hoạt tài khoản mới",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
          <h2 style="color: #6138ff; text-align: center;">HP STORE</h2>
          <p>Chào <b>${fullname}</b>,</p>
          <p>Cảm ơn bạn đã đăng ký thành viên tại HP STORE. Để trải nghiệm dịch vụ, vui lòng nhập mã OTP dưới đây để hoàn tất kích hoạt tài khoản:</p>
          <div style="background: #f4f4ff; padding: 15px; text-align: center; font-size: 26px; font-weight: bold; letter-spacing: 5px; color: #6138ff; border-radius: 5px; margin: 20px 0;">
            ${activationOtp}
          </div>
          <p style="color: #ff3838; font-size: 13px;">* Mã xác thực kích hoạt này có hiệu lực trong vòng 5 phút. Vui lòng không cung cấp mã này cho người khác.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    return res.status(201).json({
      message:
        "Đăng ký thành công! Vui lòng kiểm tra hộp thư Email để lấy mã xác thực kích hoạt tài khoản.",
      email: email,
    });
  } catch (error) {
    console.error("REGISTER ERROR:", error);
    return res.status(500).json({
      message: "Lỗi hệ thống khi đăng ký thành viên!",
      error: error.message,
    });
  }
};

// 2. API Xác nhận kích thực tài khoản (Verify Email OTP)
exports.verifyActivation = async (req, res) => {
  try {
    const { email, otp } = req.body;

    // Loại bỏ khoảng trắng thừa nếu có
    const cleanEmail = email ? email.trim() : "";
    const cleanOtp = otp ? otp.trim() : "";

    if (!cleanEmail || !cleanOtp) {
      return res
        .status(400)
        .json({ message: "Thiếu dữ liệu Email hoặc mã OTP xác thực!" });
    }

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
    const { email } = req.body;
    if (!email) {
      return res
        .status(400)
        .json({ message: "Vui lòng cung cấp địa chỉ Email!" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiredAt = new Date(Date.now() + 5 * 60 * 1000);

    const user = await AuthModel.updateOTP(email, otp, expiredAt);
    if (!user) {
      return res
        .status(404)
        .json({ message: "Địa chỉ Email này không tồn tại trên hệ thống!" });
    }

    const mailOptions = {
      to: email,
      subject: "[HP STORE] - Mã xác thực khôi phục mật khẩu",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
          <h2 style="color: #6138ff; text-align: center;">HP STORE</h2>
          <p>Chào bạn,</p>
          <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu của bạn. Dưới đây là mã xác thực OTP:</p>
          <div style="background: #f4f4ff; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #6138ff; border-radius: 5px; margin: 20px 0;">
            ${otp}
          </div>
          <p style="color: #ff3838; font-size: 13px;">* Mã OTP này có hiệu lực trong vòng 5 phút. Vui lòng không chia sẻ mã này cho bất kỳ ai.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    return res
      .status(200)
      .json({ message: "Mã OTP đã được gửi thành công đến Email của bạn!" });
  } catch (error) {
    console.error("FORGOT PASSWORD ERROR:", error);
    return res
      .status(500)
      .json({ message: "Lỗi hệ thống khi gửi mã OTP!", error: error.message });
  }
};

// 6. Đặt lại mật khẩu mới qua OTP
exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

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

    return res
      .status(200)
      .json({ message: "Mật khẩu của bạn đã được cập nhật thành công!" });
  } catch (error) {
    console.error("RESET PASSWORD ERROR:", error);
    return res.status(500).json({
      message: "Lỗi hệ thống khi đổi mật khẩu!",
      error: error.message,
    });
  }
};
