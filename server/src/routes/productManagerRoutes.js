const express = require("express");
const router = express.Router();
const productController = require("../controllers/productManagerController");
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

router.get("/", productController.getProducts);
router.post("/add", handleProductUpload, productController.addProduct);
router.get("/:id", productController.getProductById);
router.put("/update/:id", handleProductUpload, productController.editProduct);
router.delete("/:id/images/:imageId", productController.removeProductImage);
router.delete("/delete/:id", productController.removeProduct);
router.post(
  "/import-excel",
  excelUpload.single("excelFile"),
  productController.importExcel,
);

module.exports = router;
