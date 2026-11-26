const CartModel = require("../models/cartModel");

class CartController {
  // [GET] /api/cart
  static async getMyCart(req, res) {
    try {
      const maND = req.user?.id || req.user?.maND || req.user?.mand;
      if (!maND) {
        return res
          .status(401)
          .json({ success: false, message: "Vui lòng đăng nhập!" });
      }
      const items = await CartModel.getCartByUser(maND);
      res.status(200).json({ success: true, items });
    } catch (error) {
      console.error("GET CART ERROR:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi tải giỏ hàng!",
        error: error.message,
      });
    }
  }

  // [POST] /api/cart/add
  static async addItem(req, res) {
    try {
      const maND = req.user?.id || req.user?.maND || req.user?.mand;
      const maSP = (req.body?.maSP || req.body?.MaSP || req.body?.masp || "").trim();
      const soLuong = req.body?.soLuong ?? req.body?.SoLuong ?? 1;

      if (!maSP) {
        return res
          .status(400)
          .json({ success: false, message: "Thiếu mã sản phẩm!" });
      }

      const items = await CartModel.addItem(maND, maSP, soLuong);
      res.status(200).json({ success: true, items });
    } catch (error) {
      console.error("ADD CART ITEM ERROR:", error);
      const status = error.statusCode || 500;
      res.status(status).json({
        success: false,
        message: error.message || "Không thể thêm vào giỏ hàng!",
      });
    }
  }

  // [PUT] /api/cart/item/:maSP
  static async updateItem(req, res) {
    try {
      const maND = req.user?.id || req.user?.maND || req.user?.mand;
      const { maSP } = req.params;
      const soLuong = req.body?.soLuong ?? req.body?.SoLuong;

      const items = await CartModel.updateItemQuantity(maND, maSP, soLuong);
      res.status(200).json({ success: true, items });
    } catch (error) {
      console.error("UPDATE CART ITEM ERROR:", error);
      const status = error.statusCode || 500;
      res.status(status).json({
        success: false,
        message: error.message || "Không thể cập nhật số lượng giỏ hàng!",
      });
    }
  }

  // [DELETE] /api/cart/item/:maSP
  static async removeItem(req, res) {
    try {
      const maND = req.user?.id || req.user?.maND || req.user?.mand;
      const { maSP } = req.params;

      const items = await CartModel.removeItem(maND, maSP);
      res.status(200).json({ success: true, items });
    } catch (error) {
      console.error("REMOVE CART ITEM ERROR:", error);
      res.status(500).json({
        success: false,
        message: "Không thể xóa sản phẩm khỏi giỏ hàng!",
      });
    }
  }

  // [POST] /api/cart/merge
  static async mergeCart(req, res) {
    try {
      const maND = req.user?.id || req.user?.maND || req.user?.mand;
      const itemsInput = req.body?.items || [];

      const items = await CartModel.mergeGuestCart(maND, itemsInput);
      res.status(200).json({ success: true, items });
    } catch (error) {
      console.error("MERGE CART ERROR:", error);
      res.status(500).json({
        success: false,
        message: "Không thể đồng bộ giỏ hàng!",
      });
    }
  }
}

module.exports = CartController;
