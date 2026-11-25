const express = require("express");
const router = express.Router();
const categoryController = require("../controllers/productCategoryController");
const { verifyToken, authorizeRoles } = require("../middleware/auth");

const staffGuard = [
  verifyToken,
  authorizeRoles("Admin", "Manager", "Employee", "Staff"),
];

// 1. Lấy danh sách tất cả danh mục (công khai cho Trang chủ)
router.get("/", categoryController.getCategories);

// 2. Lấy chi tiết một danh mục theo ID
router.get("/:id", categoryController.getCategoryById);

// 3. Thêm / Sửa / Xóa danh mục (Bắt buộc đăng nhập Quản trị / Nhân viên)
router.post("/add", ...staffGuard, categoryController.addCategory);
router.put("/update/:id", ...staffGuard, categoryController.editCategory);
router.delete("/delete/:id", ...staffGuard, categoryController.removeCategory);

module.exports = router;
