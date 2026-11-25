const express = require("express");
const router = express.Router();
const productController = require("../controllers/productManagerController");
const { verifyToken, authorizeRoles } = require("../middleware/auth");
const multer = require("multer");

// 🔥 Cấu hình Cloudinary hỗ trợ 1 ảnh đại diện chính + tối đa 5 ảnh góc chụp phụ
const uploadCloud = require("../middleware/cloudinaryConfig");
const excelUpload = multer({ storage: multer.memoryStorage() });

const productUploadFields = uploadCloud.fields([
  { name: "HinhAnh", maxCount: 1 },
  { name: "HinhAnhPhu", maxCount: 5 },
]);

const handleProductUpload = (req, res, next) => {
  productUploadFields(req, res, function (err) {
    if (err) {
      console.error("⚠️ Lỗi phát sinh tại Middleware Cloudinary Route:", err.message);
      const message =
        err.code === "LIMIT_UNEXPECTED_FILE"
          ? "Tối đa chỉ được tải lên 5 ảnh góc chụp phụ cho mỗi sản phẩm!"
          : "Lỗi xử lý file hình ảnh tải lên!";
      return res.status(400).json({
        success: false,
        message,
        error: err.message,
      });
    }
    next();
  });
};

const staffGuard = [
  verifyToken,
  authorizeRoles("Admin", "Manager", "Employee", "Staff"),
];

// Đọc sản phẩm giữ công khai cho Trang chủ & Giỏ hàng
router.get("/", productController.getProducts);
router.get("/:id", productController.getProductById);

// Các thao tác Thêm / Sửa / Xóa / Import bắt buộc có JWT của Quản trị hoặc Nhân viên
router.post("/add", ...staffGuard, handleProductUpload, productController.addProduct);
router.put("/update/:id", ...staffGuard, handleProductUpload, productController.editProduct);
router.delete("/:id/images/:imageId", ...staffGuard, productController.removeProductImage);
router.delete("/delete/:id", ...staffGuard, productController.removeProduct);
router.post(
  "/import-excel",
  ...staffGuard,
  excelUpload.single("excelFile"),
  productController.importExcel,
);

module.exports = router;
