const WarehouseModel = require("../models/warehouseModel");
const crypto = require("crypto");

function generateRandomTransactionCode() {
  // Sinh 9 bytes ngẫu nhiên -> chuyển thành 18 ký tự Hex (Ví dụ: 4f8e21a9c3d4f5e6b7)
  const randomHex = crypto.randomBytes(9).toString("hex").toUpperCase();
  // Kết hợp tiền tố "GD" tạo thành chuỗi đúng 20 ký tự (Ví dụ: GD4F8E21A9C3D4F5E6B7)
  return `GD${randomHex}`;
}

class WarehouseController {
  // [GET] /api/warehouse/transactions
  static async getAllTransactions(req, res) {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const loaiGD = req.query.loaiGD || null;
      const makho = req.query.makho || 'KHO_TONG'; // Thêm tham số kho
      const limit = 10;

      const paginationResult = await WarehouseModel.getAllTransactions(
        page,
        limit,
        loaiGD,
        makho
      );

      res.status(200).json({
        success: true,
        currentPage: page,
        limitPerPage: limit,
        totalRecords: paginationResult.totalRecords,
        totalPages: paginationResult.totalPages,
        data: paginationResult.transactions,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Lỗi server khi lấy dữ liệu kho!",
        error: error.message,
      });
    }
  }

  // [GET] /api/warehouse/transactions/:maSP
  static async getTransactionsByProduct(req, res) {
    try {
      const { maSP } = req.params;
      const makho = req.query.makho || 'KHO_TONG'; // Lọc theo kho

      const data = await WarehouseModel.getTransactionsByProduct(maSP, makho);
      res.status(200).json({
        success: true,
        message: `Lấy lịch sử kho của sản phẩm ${maSP} tại kho ${makho} thành công!`,
        data: data,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Lỗi server khi tìm kiếm lịch sử sản phẩm!",
        error: error.message,
      });
    }
  }

  // [POST] /api/warehouse/transaction
  static async createTransaction(req, res) {
    try {
      let { maSP, loaiGD, soLuong, makho } = req.body; 

      if (!makho) makho = 'KHO_TONG'; // Gán mặc định nếu không có

      // 1. Kiểm tra các trường dữ liệu bắt buộc
      if (
        !maSP ||
        loaiGD === undefined ||
        soLuong === undefined ||
        soLuong === ""
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Vui lòng điền đầy đủ thông tin: Mã sản phẩm, Loại, Số lượng và Kho hàng!",
        });
      }

      // 2. TỰ ĐỘNG SINH MÃ GIAO DỊCH NGẪU NHIÊN CHUẨN VARCHAR(20)
      const randomHex = crypto.randomBytes(9).toString("hex").toUpperCase();
      const maGD = `GD${randomHex}`;

      const parsedSoLuong = parseFloat(soLuong);
      const parsedLoaiGD = parseInt(loaiGD, 10);

      if (isNaN(parsedSoLuong) || parsedSoLuong <= 0) {
        return res.status(400).json({
          success: false,
          message: "Số lượng giao dịch kho bắt buộc phải lớn hơn 0!",
        });
      }

      if (parsedSoLuong > 100000) {
        return res.status(400).json({
          success: false,
          message:
            "Số lượng cho mỗi giao dịch không được phép vượt quá giới hạn an toàn!",
        });
      }

      if (parsedLoaiGD !== 1 && parsedLoaiGD !== 2) {
        return res.status(400).json({
          success: false,
          message: "Loại giao dịch không hợp lệ (1: Nhập kho, 2: Xuất kho)!",
        });
      }

      // 3. Gọi model xử lý DB Transaction với makho
      const result = await WarehouseModel.createTransaction({
        maGD,
        maSP,
        makho,
        loaiGD: parsedLoaiGD,
        soLuong: parsedSoLuong,
      });

      res.status(201).json({
        success: true,
        message:
          parsedLoaiGD === 1
            ? `Nhập kho sản phẩm thành công vào kho ${makho}!`
            : `Xuất kho sản phẩm thành công từ kho ${makho}!`,
        data: result,
      });
    } catch (error) {
      if (error.code === "23505") {
        return res.status(400).json({
          success: false,
          message:
            "Mã giao dịch ngẫu nhiên bị trùng lặp hệ thống! Vui lòng thử lại lần nữa.",
        });
      }

      res.status(400).json({
        success: false,
        message: error.message || "Thao tác kho hàng thất bại!",
      });
    }
  }
}

module.exports = WarehouseController;
