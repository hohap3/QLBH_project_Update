const WarehouseModel = require("../models/warehouseModel");
const crypto = require("crypto");

const VALID_WAREHOUSES = ["KHO_TONG", "KHO_CN1", "KHO_CN2"];

function generateTransferRequestCode() {
  const datePart = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  const randPart = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `CK${datePart}${randPart}`; // 16 ký tự <= 24
}

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

  // [GET] /api/warehouse/stock?maSP=...&makho=...
  static async getWarehouseStock(req, res) {
    try {
      const { maSP, makho = "KHO_TONG" } = req.query;
      if (!maSP) {
        return res
          .status(400)
          .json({ success: false, message: "Thiếu mã sản phẩm (maSP)!" });
      }
      const stock = await WarehouseModel.getStockByWarehouse(maSP, makho);
      res.status(200).json({ success: true, maSP, makho, ...stock });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Lỗi server khi tra cứu tồn kho!",
        error: error.message,
      });
    }
  }

  // [GET] /api/warehouse/transfers
  static async getTransferRequests(req, res) {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const limit = 10;
      const status = (req.query.status || "").trim().toUpperCase();
      const search = (req.query.search || "").trim();

      const role = String(req.user?.role || "").toUpperCase();
      const isManagerOrAdmin = ["ADMIN", "MANAGER"].includes(role);
      const onlyUserId = isManagerOrAdmin ? null : req.user?.id || null;

      const result = await WarehouseModel.getTransferRequests({
        page,
        limit,
        status,
        search,
        onlyUserId,
      });

      res.status(200).json({
        success: true,
        currentPage: page,
        limitPerPage: limit,
        totalRecords: result.totalRecords,
        totalPages: result.totalPages,
        pendingCount: result.pendingCount,
        data: result.transfers,
      });
    } catch (error) {
      console.error("GET TRANSFERS ERROR:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi server khi tải danh sách phiếu chuyển kho!",
        error: error.message,
      });
    }
  }

  // [POST] /api/warehouse/transfers/request (Nhân viên hoặc Quản lý lập yêu cầu)
  static async createTransferRequest(req, res) {
    try {
      const { maSP, khoNguon, khoDich, soLuong, lyDo } = req.body;

      if (!maSP || !khoNguon || !khoDich || soLuong === undefined || soLuong === "") {
        return res.status(400).json({
          success: false,
          message:
            "Vui lòng chọn đầy đủ Sản phẩm, Kho nguồn, Kho đích và Số lượng!",
        });
      }

      if (
        !VALID_WAREHOUSES.includes(khoNguon) ||
        !VALID_WAREHOUSES.includes(khoDich)
      ) {
        return res.status(400).json({
          success: false,
          message: "Mã kho nguồn hoặc kho đích không hợp lệ!",
        });
      }

      if (khoNguon === khoDich) {
        return res.status(400).json({
          success: false,
          message: "Kho nguồn và kho đích không được trùng nhau!",
        });
      }

      const parsedQty = parseInt(soLuong, 10);
      if (isNaN(parsedQty) || parsedQty <= 0 || parsedQty > 100000) {
        return res.status(400).json({
          success: false,
          message: "Số lượng yêu cầu phải là số nguyên từ 1 đến 100.000!",
        });
      }

      const nguoiTao = req.user?.id || null;
      const tenNguoiTao =
        (await WarehouseModel.getUserDisplayName(nguoiTao)) ||
        req.user?.name ||
        req.user?.username ||
        "Nhân viên";

      const maYeuCau = generateTransferRequestCode();
      const created = await WarehouseModel.createTransferRequest({
        maYeuCau,
        maSP,
        khoNguon,
        khoDich,
        soLuong: parsedQty,
        lyDo: (lyDo || "").trim(),
        nguoiTao,
        tenNguoiTao,
      });

      res.status(201).json({
        success: true,
        message: `Đã lập phiếu yêu cầu chuyển kho ${maYeuCau} và gửi cho Quản lý duyệt!`,
        data: created,
      });
    } catch (error) {
      console.error("CREATE TRANSFER REQUEST ERROR:", error);
      res.status(400).json({
        success: false,
        message: error.message || "Không thể lập yêu cầu chuyển kho!",
      });
    }
  }

  // [POST] /api/warehouse/transfers/direct (Chỉ ADMIN / MANAGER điều chuyển trực tiếp)
  static async directTransfer(req, res) {
    try {
      const { maSP, khoNguon, khoDich, soLuong, lyDo } = req.body;

      if (!maSP || !khoNguon || !khoDich || soLuong === undefined || soLuong === "") {
        return res.status(400).json({
          success: false,
          message:
            "Vui lòng chọn đầy đủ Sản phẩm, Kho nguồn, Kho đích và Số lượng!",
        });
      }

      if (
        !VALID_WAREHOUSES.includes(khoNguon) ||
        !VALID_WAREHOUSES.includes(khoDich)
      ) {
        return res.status(400).json({
          success: false,
          message: "Mã kho nguồn hoặc kho đích không hợp lệ!",
        });
      }

      if (khoNguon === khoDich) {
        return res.status(400).json({
          success: false,
          message: "Kho nguồn và kho đích không được trùng nhau!",
        });
      }

      const parsedQty = parseInt(soLuong, 10);
      if (isNaN(parsedQty) || parsedQty <= 0 || parsedQty > 100000) {
        return res.status(400).json({
          success: false,
          message: "Số lượng điều chuyển phải là số nguyên từ 1 đến 100.000!",
        });
      }

      const nguoiTao = req.user?.id || null;
      const tenNguoiTao =
        (await WarehouseModel.getUserDisplayName(nguoiTao)) ||
        req.user?.name ||
        req.user?.username ||
        "Quản lý";

      const maYeuCau = generateTransferRequestCode();
      const result = await WarehouseModel.directTransfer({
        maYeuCau,
        maSP,
        khoNguon,
        khoDich,
        soLuong: parsedQty,
        lyDo: (lyDo || "").trim(),
        nguoiTao,
        tenNguoiTao,
      });

      res.status(201).json({
        success: true,
        message: `Điều chuyển thành công ${parsedQty} sản phẩm từ ${khoNguon} sang ${khoDich} (Mã phiếu: ${maYeuCau})!`,
        data: result,
      });
    } catch (error) {
      console.error("DIRECT TRANSFER ERROR:", error);
      res.status(400).json({
        success: false,
        message: error.message || "Điều chuyển hàng liên kho thất bại!",
      });
    }
  }

  // [PUT] /api/warehouse/transfers/:maYeuCau/approve (Chỉ ADMIN / MANAGER)
  static async approveTransferRequest(req, res) {
    try {
      const { maYeuCau } = req.params;
      const { ghiChuDuyet } = req.body || {};

      const nguoiDuyet = req.user?.id || null;
      const tenNguoiDuyet =
        (await WarehouseModel.getUserDisplayName(nguoiDuyet)) ||
        req.user?.name ||
        req.user?.username ||
        "Quản lý";

      const result = await WarehouseModel.approveTransferRequest({
        maYeuCau,
        nguoiDuyet,
        tenNguoiDuyet,
        ghiChuDuyet: (ghiChuDuyet || "").trim(),
      });

      res.status(200).json({
        success: true,
        message: `Đã duyệt phiếu ${maYeuCau} và hoàn tất chuyển tồn kho!`,
        data: result,
      });
    } catch (error) {
      console.error("APPROVE TRANSFER ERROR:", error);
      res.status(400).json({
        success: false,
        message: error.message || "Duyệt phiếu chuyển kho thất bại!",
      });
    }
  }

  // [PUT] /api/warehouse/transfers/:maYeuCau/reject (Chỉ ADMIN / MANAGER)
  static async rejectTransferRequest(req, res) {
    try {
      const { maYeuCau } = req.params;
      const { ghiChuDuyet } = req.body || {};

      const nguoiDuyet = req.user?.id || null;
      const tenNguoiDuyet =
        (await WarehouseModel.getUserDisplayName(nguoiDuyet)) ||
        req.user?.name ||
        req.user?.username ||
        "Quản lý";

      const updated = await WarehouseModel.rejectTransferRequest({
        maYeuCau,
        nguoiDuyet,
        tenNguoiDuyet,
        ghiChuDuyet: (ghiChuDuyet || "").trim(),
      });

      res.status(200).json({
        success: true,
        message: `Đã từ chối phiếu chuyển kho ${maYeuCau}.`,
        data: updated,
      });
    } catch (error) {
      console.error("REJECT TRANSFER ERROR:", error);
      res.status(400).json({
        success: false,
        message: error.message || "Từ chối phiếu chuyển kho thất bại!",
      });
    }
  }
}

module.exports = WarehouseController;
