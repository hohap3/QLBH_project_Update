const checkoutModel = require("../models/checkoutModel");
const { sendOrderCreatedEmail } = require("../utils/orderEmailHelper");

const createCheckoutOrder = async (req, res) => {
  try {
    const {
      MaNguoiDung,
      MaKho,
      MaChiNhanh,
      NguoiNhan,
      SDTNguoiNhan,
      DiaChi,
      PhuongThucThanhToan,
      PhiVanChuyen,
      PointsToDeduct,
      TongGiamGia,
      GhiChu,
      ChiTiet,
    } = req.body;

    // 1. Kiểm tra dữ liệu đầu vào chống rỗng thông tin giao nhận
    if (!NguoiNhan || !SDTNguoiNhan || !DiaChi || !PhuongThucThanhToan) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp đầy đủ thông tin giao hàng!",
      });
    }

    // 2. Kiểm tra thông tin tài khoản
    if (!MaNguoiDung) {
      return res.status(401).json({
        success: false,
        message:
          "Không tìm thấy thông tin tài khoản đặt hàng. Vui lòng đăng nhập lại!",
      });
    }

    // 3. Kiểm tra giỏ hàng rỗng
    if (!ChiTiet || !Array.isArray(ChiTiet) || ChiTiet.length === 0) {
      return res.status(400).json({
        success: false,
        message:
          "Giỏ hàng trống hoặc không đúng định dạng, không thể tạo đơn hàng!",
      });
    }

    // 4. Đóng gói dữ liệu sạch (giữ nguyên chuỗi MaNguoiDung chuẩn VARCHAR(20), giữ đủ MaKho/MaChiNhanh/PhiVanChuyen)
    const cleanPayload = {
      MaNguoiDung: String(MaNguoiDung).trim(),
      MaKho: MaKho ? String(MaKho).trim() : null,
      MaChiNhanh: MaChiNhanh ? String(MaChiNhanh).trim() : null,
      NguoiNhan: String(NguoiNhan).trim(),
      SDTNguoiNhan: String(SDTNguoiNhan).trim(),
      DiaChi: String(DiaChi).trim(),
      PhuongThucThanhToan: String(PhuongThucThanhToan).trim(),
      PhiVanChuyen: Math.max(0, parseFloat(PhiVanChuyen) || 0),
      GhiChu: GhiChu ? String(GhiChu).trim() : null,
      PointsToDeduct: Math.max(0, parseInt(PointsToDeduct, 10) || 0),
      TongGiamGia: Math.max(0, parseFloat(TongGiamGia) || 0),
      ChiTiet: ChiTiet.map((item) => ({
        MaSP: String(item.MaSP || item.masp || "").trim(),
        SoLuong: parseInt(item.SoLuong || item.soluong, 10) || 0,
        GiaBan: parseFloat(item.GiaBan || item.giaban) || 0,
        GiamGia: parseFloat(item.GiamGia || item.giamgia) || 0,
      })),
    };

    const result = await checkoutModel.saveCheckoutTransaction(cleanPayload);
    const createdOrderId = result.maDonHang || result.MaDonHang;

    // Gửi email xác nhận đơn hàng chạy nền (không làm chậm phản hồi đặt hàng)
    void sendOrderCreatedEmail(createdOrderId);

    return res.status(200).json({
      success: true,
      message: "Đơn hàng tạo thành công trên hệ thống HP STORE!",
      maDonHang: createdOrderId,
      tongTien: result.tongTien,
      makho: result.makho,
    });
  } catch (error) {
    console.error("🔥 Lỗi tại checkoutController:", error);
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message:
        statusCode === 400
          ? error.message
          : "Lỗi máy chủ hệ thống, quá trình đặt hàng thất bại.",
      error: error.message,
    });
  }
};

module.exports = {
  createCheckoutOrder,
};
