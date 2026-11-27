const ReviewModel = require("../models/reviewModel");

class ReviewController {
  // [GET] /api/reviews/:maSP
  static async getProductReviews(req, res) {
    try {
      const { maSP } = req.params;
      const star = req.query.star ? parseInt(req.query.star, 10) : null;
      const verifiedOnly = req.query.verified === "true" || req.query.verified === "1";

      const result = await ReviewModel.getReviewsByProduct(maSP, {
        star,
        verifiedOnly,
      });

      res.status(200).json({
        success: true,
        stats: result.stats,
        reviews: result.reviews,
      });
    } catch (error) {
      console.error("GET REVIEWS ERROR:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi tải danh sách đánh giá!",
        error: error.message,
      });
    }
  }

  // [POST] /api/reviews/:maSP (Mọi tài khoản đã đăng nhập — Cách A)
  static async createOrUpdateReview(req, res) {
    try {
      const { maSP } = req.params;
      const maND = req.user?.id || req.user?.maND || req.user?.mand;
      const soSao = parseInt(req.body?.soSao ?? req.body?.sosao, 10);
      const noiDung = String(req.body?.noiDung ?? req.body?.noidung ?? "").trim();

      if (!maND) {
        return res
          .status(401)
          .json({ success: false, message: "Vui lòng đăng nhập để đánh giá!" });
      }
      if (isNaN(soSao) || soSao < 1 || soSao > 5) {
        return res.status(400).json({
          success: false,
          message: "Vui lòng chọn số sao đánh giá từ 1 đến 5!",
        });
      }
      if (noiDung.length < 3 || noiDung.length > 1000) {
        return res.status(400).json({
          success: false,
          message: "Nội dung đánh giá phải từ 3 đến 1.000 ký tự!",
        });
      }

      const review = await ReviewModel.upsertReview({
        maSP,
        maND,
        soSao,
        noiDung,
      });

      res.status(200).json({
        success: true,
        message: "Cảm ơn bạn đã gửi đánh giá sản phẩm!",
        review,
      });
    } catch (error) {
      console.error("UPSERT REVIEW ERROR:", error);
      const status = error.statusCode || 500;
      res.status(status).json({
        success: false,
        message: error.message || "Không thể gửi đánh giá!",
      });
    }
  }

  // [PUT] /api/reviews/:maDanhGia/reply (Chỉ Admin / Manager / Staff)
  static async replyReview(req, res) {
    try {
      const { maDanhGia } = req.params;
      const adminId = req.user?.id || req.user?.maND || req.user?.mand;
      const phanHoi = String(req.body?.phanHoi ?? req.body?.phanhoi ?? "").trim();

      if (!phanHoi || phanHoi.length < 2) {
        return res.status(400).json({
          success: false,
          message: "Vui lòng nhập nội dung phản hồi!",
        });
      }

      const updated = await ReviewModel.replyReview({
        maDanhGia,
        adminId,
        phanHoi,
      });

      res.status(200).json({
        success: true,
        message: "Đã gửi phản hồi của HP STORE!",
        review: updated,
      });
    } catch (error) {
      console.error("REPLY REVIEW ERROR:", error);
      const status = error.statusCode || 500;
      res.status(status).json({
        success: false,
        message: error.message || "Không thể gửi phản hồi!",
      });
    }
  }

  // [DELETE] /api/reviews/:maDanhGia (Chính chủ hoặc Admin / Manager / Staff)
  static async deleteReview(req, res) {
    try {
      const { maDanhGia } = req.params;
      const requesterId = req.user?.id || req.user?.maND || req.user?.mand;
      const role = String(req.user?.role || "").toUpperCase();
      const isStaffOrAdmin = ["ADMIN", "MANAGER", "STAFF", "EMPLOYEE"].includes(role);

      await ReviewModel.deleteReview({
        maDanhGia,
        requesterId,
        isStaffOrAdmin,
      });

      res.status(200).json({
        success: true,
        message: "Đã xóa đánh giá thành công!",
      });
    } catch (error) {
      console.error("DELETE REVIEW ERROR:", error);
      const status = error.statusCode || 500;
      res.status(status).json({
        success: false,
        message: error.message || "Không thể xóa đánh giá!",
      });
    }
  }
}

module.exports = ReviewController;
