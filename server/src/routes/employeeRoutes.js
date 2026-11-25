const express = require("express");
const router = express.Router();
const employeeController = require("../controllers/employeeController");
const { verifyToken, requireSuperAdmin, authorizeRoles } = require("../middleware/auth");

// Bảo vệ toàn bộ route Quản lý Nhân sự (Bắt buộc đăng nhập với quyền Admin / Manager)
router.use(verifyToken, authorizeRoles("Admin", "Manager"));

// Lấy danh sách tất cả nhân viên (Hỗ trợ lọc theo quyền Admin / Manager)
router.get("/", (req, res) => employeeController.getAll(req, res));

// Lấy chi tiết một nhân viên
router.get("/:id", (req, res) => employeeController.getById(req, res));

// Tạo mới nhân viên
router.post("/", (req, res) => employeeController.create(req, res));

// Cập nhật thông tin nhân viên
router.put("/:id", (req, res) => employeeController.update(req, res));

// 🛡️ API Ủy quyền Admin / Phân quyền Quản lý Chi nhánh (CHỈ SUPER ADMIN)
router.put("/:id/role", verifyToken, requireSuperAdmin, (req, res) =>
  employeeController.updateRole(req, res)
);

// Thay đổi trạng thái khóa/mở tài khoản nhanh
router.patch("/:id/toggle-status", (req, res) =>
  employeeController.toggleStatus(req, res)
);

module.exports = router;
