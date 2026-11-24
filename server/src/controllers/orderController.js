const Order = require("../models/oderModel");

const orderController = {
  // 1. API lấy danh sách đơn hàng kèm theo phân trang (Admin/Staff)
  getOrders: async (req, res) => {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const trangThai = req.query.trangThai || ""; // 🟢 Bổ sung nhận diện query trạng thái từ FE
      const limit = 10;

      // Truyền thêm tham số bộ lọc vào Model để tính toán phân trang chính xác
      const paginationResult = await Order.getWithPagination(
        page,
        limit,
        trangThai,
      );

      res.status(200).json({
        success: true,
        currentPage: page,
        limitPerPage: limit,
        totalRecords: paginationResult.totalRecords,
        totalPages: paginationResult.totalPages,
        data: paginationResult.orders,
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: "Lỗi khi lấy danh sách đơn hàng",
        error: err.message,
      });
    }
  },

  // 2. Lấy chi tiết đơn hàng (Có bảo mật chống xem trộm đơn)
  // Cập nhật logic xử lý trong hàm getOrderById ở OrderController của bạn:
  getOrderById: async (req, res) => {
    try {
      const { id } = req.params;

      // Gọi Model lấy dữ liệu từ Database
      const rows = await Order.getDetails(id);

      // 🟢 KIỂM TRA BẢO VỆ 1: Nếu database không trả về hàng nào (rows undefined hoặc rỗng)
      if (!rows || rows.length === 0) {
        return res.status(204).json([]); // Trả về mảng rỗng thay vì nổ lỗi 500
      }

      // 1. Lấy thông tin chung của đơn hàng từ dòng đầu tiên
      const firstRow = rows[0];

      // 2. Chuyển đổi cấu trúc phẳng từ DB thành cấu trúc Object lồng nhau
      // 🟢 KIỂM TRA BẢO VỆ 2: Sử dụng toán tử ?. hoặc || để tránh lỗi "Cannot read properties of undefined"
      const formattedOrder = {
        MaDonHang: firstRow.madonhang,
        NgayDat: firstRow.ngaydat,
        TrangThai: firstRow.trangthai,
        GhiChu: firstRow.ghichu || "Không có",
        TongTien: Number(firstRow.tongtien || 0),
        KhachHang: {
          HoTen: firstRow.hotenkhachhang || "Khách vãng lai",
          SDT: firstRow.sdtkhachhang || "---",
          Email: firstRow.emailkhachhang || "---",
          DiaChi: firstRow.diachikhachhang || "---",
          TenDangNhap: firstRow.tendangnhap || "Không có",
        },
        // 3. Gom tất cả các dòng sản phẩm thuộc đơn hàng này vào mảng Items
        Items: rows
          .filter((row) => row.masp !== null) // Chỉ lấy các dòng có mã sản phẩm hợp lệ
          .map((row) => ({
            MaSP: row.masp,
            SoLuong: Number(row.soluong || 0),
            GiaBan: Number(row.giaban || 0),
            GiamGia: Number(row.giamgia || 0),
          })),
      };

      // Trả về JSON sạch đẹp cấu trúc chữ Hoa cho Frontend
      return res.status(200).json(formattedOrder);
    } catch (error) {
      // 🟢 QUAN TRỌNG: In lỗi chi tiết ra Terminal của Render/VsCode để debug xem thực tế lỗi ở dòng nào
      console.error("❌ LỖI CHI TIẾT TẠI CONTROLLER:", error.message);
      console.error(error.stack);

      return res.status(500).json({
        success: false,
        message: "Lỗi hệ thống khi lấy chi tiết đơn hàng",
        error_details: error.message, // Đẩy tạm message gốc ra để bạn nhìn cho nhanh
      });
    }
  },

  // 3. Cập nhật trạng thái đơn hàng (Admin/Staff)
  updateOrderStatus: async (req, res) => {
    const { id } = req.params;
    const { TrangThai } = req.body;
    try {
      const result = await Order.updateStatus(id, TrangThai);

      if (result.rowCount === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Đơn hàng không tồn tại" });
      }
      res
        .status(200)
        .json({ success: true, message: "Cập nhật trạng thái thành công" });
    } catch (err) {
      res
        .status(500)
        .json({ success: false, message: "Lỗi cập nhật", error: err.message });
    }
  },

  // 4. 🟢 BỔ SUNG: API Hủy đơn hàng giữa chừng + Hoàn trả kho hàng
  cancelOrder: async (req, res) => {
    try {
      const { madonhang } = req.params;
      const currentUserId = req.user.id;

      // Check đơn tồn tại
      const order = await Order.getOrderByCode(madonhang);
      if (!order) {
        return res
          .status(404)
          .json({ success: false, message: "Đơn hàng không tồn tại." });
      }

      // Nếu là khách hàng, kiểm tra xem đơn này có phải do họ đặt không
      if (req.user.role === "Client" && order.mand !== currentUserId) {
        return res.status(403).json({
          success: false,
          message: "Bạn không có quyền hủy đơn hàng của người khác.",
        });
      }

      // Check trạng thái hợp lệ
      if (
        !["Chờ xác nhận", "Chờ Xác Nhận", "Chờ xử lý"].includes(order.trangthai)
      ) {
        return res.status(400).json({
          success: false,
          message: `Không thể hủy! Đơn hàng hiện đang ở trạng thái [${order.trangthai}].`,
        });
      }

      // Lấy chi tiết sản phẩm và chạy transaction hủy đơn hoàn kho
      const orderDetails = await Order.getOrderDetailsForCancel(madonhang);
      await Order.processCancelAndRestoreStock(madonhang, orderDetails);

      return res.status(200).json({
        success: true,
        message:
          "Hủy đơn hàng thành công, số lượng sản phẩm đã được hoàn lại vào kho.",
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: "Lỗi hệ thống khi thực hiện hủy đơn hàng",
        error: err.message,
      });
    }
  },

  updateBulkStatus: async (req, res) => {
    try {
      const { orderIds, actionType } = req.body;

      // Kiểm tra dữ liệu đầu vào cơ bản
      if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Danh sách mã đơn hàng trống hoặc không hợp lệ.",
        });
      }

      if (!["APPROVE", "CANCEL"].includes(actionType)) {
        return res.status(400).json({
          success: false,
          message:
            "Hành động xử lý (actionType) không hợp lệ. Chỉ chấp nhận 'APPROVE' hoặc 'CANCEL'.",
        });
      }

      // Thực thi Transaction trong Model
      await Order.processBulkStatusUpdate(orderIds, actionType);

      return res.status(200).json({
        success: true,
        message: `Đã xử lý hàng loạt thành công cho ${orderIds.length} đơn hàng.`,
      });
    } catch (err) {
      console.error("❌ LỖI DUYỆT HÀNG LOẠT TẠI CONTROLLER:", err.message);
      return res.status(500).json({
        success: false,
        message: "Lỗi hệ thống khi cập nhật trạng thái đơn hàng loạt.",
        error: err.message,
      });
    }
  },
};

module.exports = orderController;
