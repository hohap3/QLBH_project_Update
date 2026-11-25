const { pool } = require("../config/database");

class AuthModel {
  // 1. Tìm người dùng bằng tên đăng nhập hoặc email
  static async findByIdentifier(identifier) {
    try {
      const result = await pool.query(
        "SELECT * FROM nguoidung WHERE tendangnhap = $1 OR email = $1",
        [identifier],
      );

      const user = result.rows[0];

      if (user && (user.trangthai === false || user.trangthai === 0)) {
        const error = new Error(
          "Tài khoản này chưa được kích hoạt hoặc đã bị khóa. Vui lòng xác thực Email hoặc liên hệ Admin!",
        );
        error.status = 403;
        throw error;
      }

      return user;
    } catch (error) {
      throw error;
    }
  }

  // 2. Tìm người dùng bằng mã (Dùng để verify token)
  static async findByMaND(maND) {
    try {
      const result = await pool.query(
        "SELECT mand, tendangnhap, hoten, mavaitro, machinhanh, trangthai FROM nguoidung WHERE mand = $1",
        [maND],
      );
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // 3. Kiểm tra trùng lặp tài khoản / email (không phân biệt HOA/thường với email)
  static async checkDuplicate(username, email) {
    try {
      const result = await pool.query(
        "SELECT tendangnhap, email FROM nguoidung WHERE tendangnhap = $1 OR LOWER(TRIM(email)) = LOWER($2)",
        [String(username).trim(), String(email).trim()],
      );
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  // 4. Tạo tài khoản mới ứng dụng Transaction của PostgreSQL
  // isActive = true khi đã xác thực OTP xong (không lưu rác vào DB trước khi nhập OTP)
  static async createND(data) {
    const client = await pool.connect();
    const isActive = data.isActive === true;

    try {
      await client.query("BEGIN");

      const insertUserSql = `
        INSERT INTO nguoidung (mand, tendangnhap, matkhauhash, hoten, email, sdt, mavaitro, trangthai, ngaytao, otp_code, otp_expired)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9, $10)
      `;
      const userParams = [
        data.maND,
        data.username,
        data.passwordHash,
        data.fullname,
        data.email,
        data.phone,
        data.maVaiTro || "Client",
        isActive,
        isActive ? null : data.otpCode || null,
        isActive ? null : data.otpExpired || null,
      ];
      await client.query(insertUserSql, userParams);

      // Lệnh 2: Thêm thông tin tương ứng vào bảng khachhang
      const insertCustomerSql = `
        INSERT INTO khachhang (makh, hoten, sdt, email, diachi, mand, ngaytao, diemtichluy)
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), 0)
      `;
      const customerParams = [
        data.maKH,
        data.fullname,
        data.phone,
        data.email,
        data.diaChi || null,
        data.maND,
      ];
      await client.query(insertCustomerSql, customerParams);

      await client.query("COMMIT");
      return { success: true };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  // Cập nhật hoặc cấp lại OTP (tính hạn 5 phút trực tiếp bằng NOW() của PostgreSQL để tránh lệch múi giờ)
  static async updateOTP(email, otpCode) {
    try {
      const result = await pool.query(
        `UPDATE nguoidung
         SET otp_code = $1, otp_expired = NOW() + INTERVAL '5 minutes'
         WHERE LOWER(TRIM(email)) = LOWER($2)
         RETURNING mand, email, hoten, tendangnhap`,
        [String(otpCode).trim(), String(email).trim()],
      );
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // 🟢 BỔ SUNG: Hàm xác thực kích hoạt tài khoản đăng ký mới
  static async activateAccount(email, otp) {
    try {
      const userResult = await pool.query(
        "SELECT otp_code, otp_expired, trangthai FROM nguoidung WHERE email = $1",
        [email],
      );

      if (userResult.rows.length === 0) {
        return {
          success: false,
          message: "Tài khoản không tồn tại trên hệ thống!",
        };
      }

      const user = userResult.rows[0];

      if (user.trangthai === true || user.trangthai === 1) {
        return {
          success: false,
          message: "Tài khoản này đã được kích hoạt từ trước!",
        };
      }

      if (!user.otp_code || user.otp_code !== otp) {
        return {
          success: false,
          message: "Mã xác thực OTP kích hoạt không chính xác!",
        };
      }

      if (new Date() > new Date(user.otp_expired)) {
        return {
          success: false,
          message: "Mã xác thực OTP đã hết hạn (quá 5 phút)!",
        };
      }

      // Kích hoạt tài khoản thành công (trangthai = true) và xóa OTP cũ
      await pool.query(
        "UPDATE nguoidung SET trangthai = true, otp_code = NULL, otp_expired = NULL WHERE email = $1::text",
        [email],
      );

      return { success: true };
    } catch (error) {
      throw error;
    }
  }

  // Khôi phục mật khẩu (Dành cho chức năng quên mật khẩu)
  static async verifyAndResetPassword(email, otp, newPasswordHash) {
    try {
      const userResult = await pool.query(
        `SELECT mand, email, hoten, tendangnhap, otp_code,
                (otp_expired IS NULL OR otp_expired < NOW()) AS is_expired
         FROM nguoidung
         WHERE LOWER(TRIM(email)) = LOWER($1)`,
        [String(email).trim()],
      );

      if (userResult.rows.length === 0) {
        return {
          success: false,
          message: "Email không tồn tại trên hệ thống!",
        };
      }

      const user = userResult.rows[0];

      if (!user.otp_code || String(user.otp_code).trim() !== String(otp).trim()) {
        return { success: false, message: "Mã xác thực OTP không chính xác!" };
      }

      if (user.is_expired) {
        return {
          success: false,
          message: "Mã xác thực OTP đã hết hạn (quá 5 phút). Vui lòng bấm Gửi lại mã mới!",
        };
      }

      await pool.query(
        "UPDATE nguoidung SET matkhauhash = $1, otp_code = NULL, otp_expired = NULL WHERE mand = $2",
        [newPasswordHash, user.mand],
      );

      return {
        success: true,
        user: {
          mand: user.mand,
          email: user.email,
          hoten: user.hoten,
          tendangnhap: user.tendangnhap,
        },
      };
    } catch (error) {
      throw error;
    }
  }
}

module.exports = AuthModel;
