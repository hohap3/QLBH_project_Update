const productModel = require("../models/productManagerModel");
const XLSX = require("xlsx");

const DEFAULT_ANGLE_LABELS = [
  "Mặt sau",
  "Cạnh viền",
  "Cụm Camera",
  "Hộp & PK",
  "Góc khác",
];

function parseJsonArray(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function buildExtraImagesPayload(files, rawLabels) {
  const labels = parseJsonArray(rawLabels);
  return (files || []).slice(0, 5).map((file, idx) => ({
    url: file.path,
    nhan:
      (labels[idx] && String(labels[idx]).trim()) ||
      DEFAULT_ANGLE_LABELS[idx] ||
      `Góc chụp ${idx + 1}`,
    loaigoc: `angle_${idx + 1}`,
  }));
}

const productManagerController = {
  // Lấy danh sách sản phẩm có Phân trang 10 và tìm kiếm
  // Trong productManagerController.js:
  getProducts: async (req, res) => {
    try {
      // Ép kiểu chắc chắn sang số nguyên cơ số 10 để Model tính toán OFFSET không bị NaN
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 10;
      const search = req.query.search || "";

      const offset = (page - 1) * limit;

      const { products, totalItems } = await productModel.getAllProducts(
        limit,
        offset,
        search,
      );

      const totalPages = Math.ceil(totalItems / limit);

      res.status(200).json({
        success: true,
        products: products,
        totalItems: totalItems,
        totalPages: totalPages,
        currentPage: page,
        limit: limit,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Lỗi hệ thống khi lấy danh sách sản phẩm",
        error: error.message,
      });
    }
  },

  // Lấy thông tin chi tiết một sản phẩm
  getProductById: async (req, res) => {
    try {
      const { id } = req.params;
      const product = await productModel.getProductById(id);

      if (product) {
        res.status(200).json(product);
      } else {
        res.status(404).json({ message: "Không tìm thấy sản phẩm" });
      }
    } catch (error) {
      res.status(500).json({
        message: "Lỗi khi lấy thông tin sản phẩm",
        error: error.message,
      });
    }
  },

  // Thêm mới sản phẩm thủ công (hỗ trợ 1 ảnh chính + tối đa 5 ảnh góc chụp phụ)
  addProduct: async (req, res) => {
    try {
      const mainFile =
        req.file || (req.files && req.files.HinhAnh && req.files.HinhAnh[0]);
      const extraFiles =
        (req.files && req.files.HinhAnhPhu) || [];

      const productData = {
        MaSP: req.body.MaSP,
        TenSP: req.body.TenSP,
        GiaNhap: parseFloat(req.body.GiaNhap) || 0,
        GiaBan: parseFloat(req.body.GiaBan) || 0,
        SoLuongTon: parseInt(req.body.SoLuongTon) || 0,
        MoTa: req.body.MoTa || null,
        DonViTinh: req.body.DonViTinh || null,
        MaDanhMuc: req.body.MaDanhMuc,
        MaNCC: req.body.MaNCC,
        HinhAnh: mainFile ? mainFile.path : req.body.HinhAnh || null,
        HinhAnhPhu: buildExtraImagesPayload(
          extraFiles,
          req.body.HinhAnhPhuLabels,
        ),
      };

      if (productData.GiaBan < 0 || productData.SoLuongTon < 0) {
        return res
          .status(400)
          .json({ message: "Giá bán và số lượng không được âm" });
      }

      await productModel.createProduct(productData);
      res.status(201).json({ message: "Thêm sản phẩm thành công" });
    } catch (error) {
      console.error("Lỗi thêm SP:", error.message);
      res
        .status(500)
        .json({ message: "Lỗi khi thêm sản phẩm", error: error.message });
    }
  },

  // Cập nhật thông tin sản phẩm (hỗ trợ cập nhật ảnh chính, thêm/xóa ảnh phụ tối đa 5 ảnh)
  editProduct: async (req, res) => {
    try {
      const { id } = req.params;
      const mainFile =
        req.file || (req.files && req.files.HinhAnh && req.files.HinhAnh[0]);
      const extraFiles =
        (req.files && req.files.HinhAnhPhu) || [];

      const updateData = {
        TenSP: req.body.TenSP,
        GiaNhap: parseFloat(req.body.GiaNhap) || 0,
        GiaBan: parseFloat(req.body.GiaBan) || 0,
        SoLuongTon: parseInt(req.body.SoLuongTon) || 0,
        MoTa: req.body.MoTa || null,
        DonViTinh: req.body.DonViTinh || null,
        MaDanhMuc: req.body.MaDanhMuc,
        MaNCC: req.body.MaNCC,
        HinhAnh: mainFile
          ? mainFile.path
          : req.body.HinhAnhCu || req.body.HinhAnh || null,
        HinhAnhPhu: buildExtraImagesPayload(
          extraFiles,
          req.body.HinhAnhPhuLabels,
        ),
        DeletedImageIds: parseJsonArray(req.body.DeletedImageIds),
      };

      await productModel.updateProduct(id, updateData);
      res.status(200).json({ message: "Cập nhật sản phẩm thành công" });
    } catch (error) {
      console.error("🔥 Lỗi chi tiết tại editProduct Controller:", error);

      return res.status(500).json({
        success: false,
        message: "Lỗi hệ thống khi thực hiện cập nhật sản phẩm.",
        error: error.message || String(error),
        dbCode: error.code || null,
        dbDetail: error.detail || null,
      });
    }
  },

  // Xóa 1 ảnh phụ riêng lẻ của sản phẩm
  removeProductImage: async (req, res) => {
    try {
      const { id, imageId } = req.params;
      const deleted = await productModel.deleteProductImage(id, imageId);
      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy ảnh phụ hoặc không thể xóa ảnh đại diện chính.",
        });
      }
      res.status(200).json({ success: true, message: "Đã xóa ảnh phụ thành công" });
    } catch (error) {
      console.error("Lỗi xóa ảnh phụ:", error.message);
      res.status(500).json({
        success: false,
        message: "Lỗi hệ thống khi xóa ảnh phụ",
        error: error.message,
      });
    }
  },

  // 🔥 Xóa sản phẩm (Có kiểm tra lỗi ràng buộc ngoại)
  removeProduct: async (req, res) => {
    try {
      const { id } = req.params;
      await productModel.deleteProduct(id);
      res.status(200).json({ message: "Xóa sản phẩm thành công" });
    } catch (error) {
      console.error("Lỗi xóa SP:", error.message);

      // Nếu là lỗi do dính ràng buộc dữ liệu từ Model hoặc từ DB ném về
      if (error.code === "23503" || error.message.includes("đơn hàng")) {
        return res.status(400).json({
          message:
            "Không thể xóa! Sản phẩm này đã phát sinh giao dịch và có trong dữ liệu đơn hàng.",
        });
      }

      res.status(500).json({
        message: "Lỗi hệ thống không thể xóa sản phẩm",
        error: error.message,
      });
    }
  },

  // Đọc Excel xử lý hàng loạt
  importExcel: async (req, res) => {
    try {
      if (!req.file) {
        return res
          .status(400)
          .json({ message: "Vui lòng đính kèm tệp Excel dữ liệu" });
      }

      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rawData = XLSX.utils.sheet_to_json(worksheet);

      if (rawData.length === 0) {
        return res
          .status(400)
          .json({ message: "Tệp Excel không chứa dữ liệu hợp lệ" });
      }

      const countInserted =
        await productModel.bulkCreateOrUpdateProducts(rawData);

      res.status(200).json({
        message: `Đồng bộ dữ liệu thành công! Đã xử lý ${countInserted}/${rawData.length} sản phẩm.`,
      });
    } catch (error) {
      console.error("Lỗi Import Excel Server:", error.message);
      res.status(500).json({
        message: "Có lỗi xảy ra trong quá trình đọc và đồng bộ file Excel.",
        error: error.message,
      });
    }
  },
};

module.exports = productManagerController;
