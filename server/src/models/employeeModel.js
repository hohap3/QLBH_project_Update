// src/models/employeeModel.js
const { poolPromise } = require("../config/database");
const crypto = require("crypto");

class EmployeeModel {
  // 1. Lấy danh sách nhân viên có phân trang (Kèm vai trò và chi nhánh công tác)
  static async getAllEmployees(
    page = 1,
    limit = 10,
    search = "",
    status = "",
    userRole = "ADMIN",
    userBranch = null
  ) {
    try {
      const pool = await poolPromise;
      const offset = (page - 1) * limit;

      let query = `
        SELECT 
          u.mand, u.tendangnhap, u.hoten, u.email, u.sdt, u.ngaytao, u.trangthai, u.mavaitro, u.machinhanh,
          COALESCE(c.tenchinhanh, 'Toàn hệ thống (Hội sở)') AS tenchinhanh
        FROM nguoidung u
        LEFT JOIN chinhanh c ON u.machinhanh = c.machinhanh
        WHERE 1=1
      `;
      const values = [];
      let paramIndex = 1;

      // Phân quyền phạm vi truy cập:
      // Quản lý Chi nhánh (MANAGER) chỉ xem được nhân sự (STAFF) thuộc chi nhánh của mình
      if (userRole === "MANAGER" && userBranch) {
        query += ` AND u.mavaitro = 'STAFF' AND u.machinhanh = $${paramIndex}`;
        values.push(userBranch);
        paramIndex++;
      }

      // Tìm kiếm từ khóa (Mã, Họ tên, SĐT, Email, Tên đăng nhập)
      if (search) {
        query += ` AND (u.mand::text ILIKE $${paramIndex} OR u.hoten ILIKE $${paramIndex} OR u.sdt ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex} OR u.tendangnhap ILIKE $${paramIndex})`;
        values.push(`%${search}%`);
        paramIndex++;
      }

      // Bộ lọc trạng thái
      if (status !== "") {
        query += ` AND u.trangthai = $${paramIndex}`;
        values.push(status === "1" || status === "HOAT_DONG" ? "HOAT_DONG" : "KHOA");
        paramIndex++;
      }

      // Sắp xếp và phân trang
      query += ` ORDER BY u.ngaytao DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      values.push(limit, offset);

      const result = await pool.query(query, values);
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  // 1b. Đếm tổng số lượng nhân viên thỏa mãn điều kiện lọc
  static async countEmployees(
    search = "",
    status = "",
    userRole = "ADMIN",
    userBranch = null
  ) {
    try {
      const pool = await poolPromise;

      let query = `
        SELECT COUNT(*) as total 
        FROM nguoidung u
        WHERE 1=1
      `;
      const values = [];
      let paramIndex = 1;

      if (userRole === "MANAGER" && userBranch) {
        query += ` AND u.mavaitro = 'STAFF' AND u.machinhanh = $${paramIndex}`;
        values.push(userBranch);
        paramIndex++;
      }

      if (search) {
        query += ` AND (u.mand::text ILIKE $${paramIndex} OR u.hoten ILIKE $${paramIndex} OR u.sdt ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex} OR u.tendangnhap ILIKE $${paramIndex})`;
        values.push(`%${search}%`);
        paramIndex++;
      }

      if (status !== "") {
        query += ` AND u.trangthai = $${paramIndex}`;
        values.push(status === "1" || status === "HOAT_DONG" ? "HOAT_DONG" : "KHOA");
        paramIndex++;
      }

      const result = await pool.query(query, values);
      return parseInt(result.rows[0].total, 10);
    } catch (error) {
      throw error;
    }
  }

  // 2. Lấy thông tin chi tiết một nhân viên theo Mã
  static async getEmployeeById(id) {
    try {
      const pool = await poolPromise;
      const query = `
        SELECT 
          u.mand, u.tendangnhap, u.hoten, u.email, u.sdt, u.ngaytao, u.trangthai, u.mavaitro, u.machinhanh,
          COALESCE(c.tenchinhanh, 'Toàn hệ thống (Hội sở)') AS tenchinhanh
        FROM nguoidung u
        LEFT JOIN chinhanh c ON u.machinhanh = c.machinhanh
        WHERE u.mand::text = $1
      `;
      const result = await pool.query(query, [id]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // 3. Thêm mới một nhân sự kèm vai trò và chi nhánh làm việc
  static async createEmployee(employeeData) {
    try {
      const pool = await poolPromise;
      const mand =
        employeeData.MaND &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          employeeData.MaND
        )
          ? employeeData.MaND
          : crypto.randomUUID();

      const vaiTro = employeeData.MaVaiTro || "STAFF";
      const chiNhanh = vaiTro === "ADMIN" ? null : employeeData.MaChiNhanh || null;

      const query = `
        INSERT INTO nguoidung (mand, tendangnhap, matkhauhash, hoten, email, sdt, mavaitro, machinhanh, trangthai)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'HOAT_DONG')
      `;
      const values = [
        mand,
        employeeData.TenDangNhap,
        employeeData.MatKhauHash,
        employeeData.HoTen,
        employeeData.Email,
        employeeData.SDT,
        vaiTro,
        chiNhanh,
      ];
      await pool.query(query, values);
      return { mand, TenDangNhap: employeeData.TenDangNhap, MaVaiTro: vaiTro, MaChiNhanh: chiNhanh };
    } catch (error) {
      throw error;
    }
  }

  // 4. Cập nhật thông tin cơ bản của nhân viên
  static async updateEmployee(id, employeeData) {
    try {
      const pool = await poolPromise;
      const query = `
        UPDATE nguoidung 
        SET hoten = $1, email = $2, sdt = $3, machinhanh = COALESCE($4, machinhanh)
        WHERE mand::text = $5
      `;
      const values = [
        employeeData.HoTen,
        employeeData.Email,
        employeeData.SDT,
        employeeData.MaChiNhanh || null,
        id,
      ];
      const result = await pool.query(query, values);
      return result.rowCount > 0;
    } catch (error) {
      throw error;
    }
  }

  // 5. Cấp quyền Admin/Manager và phân bổ Chi nhánh (Dành riêng cho Quản lý Tổng)
  static async updateRoleAndBranch(id, { newRole, newBranch }) {
    try {
      const pool = await poolPromise;
      const targetRole = String(newRole).toUpperCase();
      const targetBranch = targetRole === "ADMIN" ? null : newBranch;

      const query = `
        UPDATE nguoidung 
        SET mavaitro = $1, machinhanh = $2
        WHERE mand::text = $3
      `;
      const result = await pool.query(query, [targetRole, targetBranch, id]);
      return result.rowCount > 0;
    } catch (error) {
      throw error;
    }
  }

  // 6. Thay đổi trạng thái Hoạt động / Khóa tài khoản
  static async toggleStatus(id, status) {
    try {
      const pool = await poolPromise;
      const newStatus =
        status === true || status === "1" || status === "HOAT_DONG"
          ? "HOAT_DONG"
          : "KHOA";

      const query = `
        UPDATE nguoidung 
        SET trangthai = $1 
        WHERE mand::text = $2
      `;
      const result = await pool.query(query, [newStatus, id]);
      return result.rowCount > 0;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = EmployeeModel;
