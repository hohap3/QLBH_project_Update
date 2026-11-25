const WishlistModel = require("../models/wishlistModel");

class WishlistController {
  // [GET] /api/wishlist
  static async getMyWishlist(req, res) {
    try {
      const maND = req.user?.id || req.user?.maND || req.user?.mand;
      if (!maND) {
        return res
          .status(401)
          .json({ success: false, message: "Vui lòng đăng nhập!" });
      }

      const products = await WishlistModel.getWishlistByUser(maND);
      res.status(200).json({
        success: true,
        total: products.length,
        ids: products.map((p) => p.masp),
        products,
      });
    } catch (error) {
      console.error("GET WISHLIST ERROR:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi tải danh sách yêu thích!",
        error: error.message,
      });
    }
  }

  // [POST] /api/wishlist/toggle
  static async toggleWishlist(req, res) {
    try {
      const maND = req.user?.id || req.user?.maND || req.user?.mand;
      const maSP = (req.body?.maSP || req.body?.masp || "").trim();

      if (!maND) {
        return res
          .status(401)
          .json({ success: false, message: "Vui lòng đăng nhập!" });
      }
      if (!maSP) {
        return res
          .status(400)
          .json({ success: false, message: "Thiếu mã sản phẩm (maSP)!" });
      }

      const result = await WishlistModel.toggleWishlist(maND, maSP);
      res.status(200).json({
        success: true,
        ...result,
        message: result.liked
          ? "Đã thêm vào danh sách yêu thích!"
          : "Đã bỏ khỏi danh sách yêu thích.",
      });
    } catch (error) {
      console.error("TOGGLE WISHLIST ERROR:", error);
      const status = error.statusCode || 500;
      res.status(status).json({
        success: false,
        message: error.message || "Không thể cập nhật yêu thích!",
      });
    }
  }

  // [POST] /api/wishlist/merge
  static async mergeWishlist(req, res) {
    try {
      const maND = req.user?.id || req.user?.maND || req.user?.mand;
      const maSPs = req.body?.maSPs || [];

      if (!maND) {
        return res
          .status(401)
          .json({ success: false, message: "Vui lòng đăng nhập!" });
      }

      const products = await WishlistModel.mergeGuestWishlist(maND, maSPs);
      res.status(200).json({
        success: true,
        total: products.length,
        ids: products.map((p) => p.masp),
        products,
      });
    } catch (error) {
      console.error("MERGE WISHLIST ERROR:", error);
      res.status(500).json({
        success: false,
        message: "Không thể đồng bộ danh sách yêu thích!",
        error: error.message,
      });
    }
  }
}

module.exports = WishlistController;
