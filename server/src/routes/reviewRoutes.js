const express = require("express");
const router = express.Router();
const ReviewController = require("../controllers/reviewController");
const { verifyToken, authorizeRoles } = require("../middleware/auth");

// Công khai: Ai cũng xem được đánh giá sản phẩm
router.get("/:maSP", ReviewController.getProductReviews);

// Cần đăng nhập: Khách hàng gửi / sửa đánh giá của mình
router.post("/:maSP", verifyToken, ReviewController.createOrUpdateReview);

// Admin / Manager / Staff phản hồi đánh giá
router.put(
  "/:maDanhGia/reply",
  verifyToken,
  authorizeRoles("Admin", "Manager", "Employee", "Staff"),
  ReviewController.replyReview,
);

// Chính chủ hoặc Admin / Manager / Staff xóa đánh giá
router.delete("/:maDanhGia", verifyToken, ReviewController.deleteReview);

module.exports = router;
