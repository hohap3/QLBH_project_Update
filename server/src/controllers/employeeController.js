// src/controllers/employeeController.js
const EmployeeModel = require("../models/employeeModel");
const bcrypt = require("bcrypt");
const crypto = require("crypto");

class EmployeeController {
  // [GET] /api/employees?page=1&limit=10
  async getAll(req, res) {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 10;
      const search = req.query.search || "";
      const status = req.query.status !== undefined ? req.query.status : "";

      // Xác định quyền hạn của người gọi API
      const userRole = (req.user?.role || "ADMIN").toUpperCase();
      const userBranch = req.user?.machinhanh || null;

      // Truyền bộ lọc vào cả hàm lấy dữ liệu và hàm đếm tổng số lượng
      const [employees, totalItems] = await Promise.all([
        EmployeeModel.getAllEmployees(page, limit, search, status, userRole, userBranch),
        EmployeeModel.countEmployees(search, status, userRole, userBranch),
      ]);

      const totalPages = Math.ceil(totalItems / limit);

      return res.status(200).json({
        success: true,
        data: employees,
        pagination: {
          totalItems,
          totalPages,
          currentPage: page,
          limit,
        },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Lỗi lấy danh sách nhân viên.",
        error: error.message,
      });
    }
  }

  // [GET] /api/employees/:id
  async getById(req, res) {
    try {
      const employee = await EmployeeModel.getEmployeeById(req.params.id);
      if (!employee) {
        return res.status(404).json({
          success: false,
          message:
            "Không tìm thấy nhân viên hoặc tài khoản không tồn tại.",
        });
      }
      return res.status(200).json({ success: true, data: employee });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Lỗi lấy thông tin chi tiết nhân viên.",
        error: error.message,
      });
    }
  }

  // [POST] /api/employees
  async create(req, res) {
    try {
      const { TenDangNhap, MatKhau, HoTen, Email, SDT, MaVaiTro, MaChiNhanh } = req.body;

      if (!TenDangNhap || !MatKhau) {
        return res.status(400).json({
          success: false,
          message: "Tên đăng nhập và mật khẩu không được để trống.",
        });
      }

      const MaND = crypto.randomUUID();
      const salt = await bcrypt.genSalt(10);
      const MatKhauHash = await bcrypt.hash(MatKhau, salt);

      const newEmployee = await EmployeeModel.createEmployee({
        MaND,
        TenDangNhap,
        MatKhauHash,
        HoTen,
        Email,
        SDT,
        MaVaiTro: MaVaiTro || "STAFF",
        MaChiNhanh: MaChiNhanh || null,
      });

      return res.status(201).json({
        success: true,
        message: "Thêm mới tài khoản nhân viên thành công!",
        data: newEmployee,
      });
    } catch (error) {
      if (error.code === "23505") {
        return res.status(400).json({
          success: false,
          message:
            "Tên đăng nhập, Email hoặc Số điện thoại này đã tồn tại trên hệ thống.",
        });
      }
      return res.status(500).json({
        success: false,
        message: "Lỗi máy chủ khi tạo tài khoản nhân viên.",
        error: error.message,
      });
    }
  }

  // [PUT] /api/employees/:id
  async update(req, res) {
    try {
      const { HoTen, Email, SDT, MaChiNhanh } = req.body;

      const employee = await EmployeeModel.getEmployeeById(req.params.id);
      if (!employee) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy tài khoản nhân viên cần chỉnh sửa.",
        });
      }

      await EmployeeModel.updateEmployee(req.params.id, { HoTen, Email, SDT, MaChiNhanh });
      return res.status(200).json({
        success: true,
        message: "Cập nhật thông tin nhân viên thành công.",
      });
    } catch (error) {
      if (error.code === "23505") {
        return res.status(400).json({
          success: false,
          message:
            "Email hoặc Số điện thoại cập nhật bị trùng với tài khoản khác.",
        });
      }
      return res.status(500).json({
        success: false,
        message: "Lỗi khi cập nhật thông tin nhân viên.",
        error: error.message,
      });
    }
  }

  // [PUT] /api/employees/:id/role - Ủy quyền Admin hoặc gán Quản lý Chi nhánh
  async updateRole(req, res) {
    try {
      const targetId = req.params.id;
      const { newRole, newBranch } = req.body;

      if (!newRole) {
        return res.status(400).json({
          success: false,
          message: "Vui lòng chỉ định vai trò mới (ADMIN, MANAGER, STAFF).",
        });
      }

      const roleUpper = String(newRole).toUpperCase();
      if (!["ADMIN", "MANAGER", "STAFF"].includes(roleUpper)) {
        return res.status(400).json({
          success: false,
          message: "Vai trò không hợp lệ. Chỉ chấp nhận: ADMIN, MANAGER, STAFF.",
        });
      }

      // Nếu là Quản lý hoặc Nhân viên chi nhánh, bắt buộc phải chọn chi nhánh
      if (roleUpper === "MANAGER" && !newBranch) {
        return res.status(400).json({
          success: false,
          message: "Quản lý Chi nhánh bắt buộc phải được gán vào một Chi nhánh cụ thể!",
        });
      }

      // Chặn Admin tự tước quyền của chính mình
      const currentUserId = req.user?.id || req.user?.mand || req.user?.maND;
      if (currentUserId === targetId && roleUpper !== "ADMIN") {
        return res.status(400).json({
          success: false,
          message: "Bạn không thể tự hạ quyền Admin của chính mình!",
        });
      }

      const employee = await EmployeeModel.getEmployeeById(targetId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy người dùng cần phân quyền.",
        });
      }

      await EmployeeModel.updateRoleAndBranch(targetId, {
        newRole: roleUpper,
        newBranch: newBranch || null,
      });

      return res.status(200).json({
        success: true,
        message: `Phân quyền thành công! Tài khoản ${employee.tendangnhap} đã được cập nhật vai trò ${roleUpper}.`,
      });
    } catch (error) {
      console.error("Lỗi phân quyền nhân sự:", error);
      return res.status(500).json({
        success: false,
        message: "Lỗi hệ thống khi cập nhật quyền hạn.",
        error: error.message,
      });
    }
  }

  // [PATCH] /api/employees/:id/toggle-status
  async toggleStatus(req, res) {
    try {
      const { TrangThai } = req.body;

      if (TrangThai === undefined || typeof TrangThai !== "boolean") {
        return res.status(400).json({
          success: false,
          message:
            "Trạng thái truyền lên không hợp lệ (phải là true hoặc false).",
        });
      }

      const employee = await EmployeeModel.getEmployeeById(req.params.id);
      if (!employee) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy tài khoản nhân viên cần đổi trạng thái.",
        });
      }

      await EmployeeModel.toggleStatus(req.params.id, TrangThai);
      return res.status(200).json({
        success: true,
        message: TrangThai
          ? "Kích hoạt tài khoản nhân viên thành công."
          : "Khóa tài khoản nhân viên thành công.",
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Lỗi thực thi đổi trạng thái tài khoản.",
        error: error.message,
      });
    }
  }
}

module.exports = new EmployeeController();
