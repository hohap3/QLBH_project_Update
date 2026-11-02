const ProductModel = require("../models/productModel");

// 1. Lấy sản phẩm bán chạy
exports.getBestSellers = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 8;
    const { products, totalItems } = await ProductModel.getBestSellers(
      page,
      limit,
    );
    const totalPages = totalItems > 0 ? Math.ceil(totalItems / limit) : 1;

    res.status(200).json({
      success: true,
      products,
      totalItems,
      currentPage: page,
      totalPages,
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Lỗi server", error: error.message });
  }
};

// 2. Lấy danh sách sản phẩm theo danh mục
// 2. Lấy danh sách sản phẩm theo danh mục & bộ lọc nâng cao (Search, Mức giá, Brand)
exports.getProducts = async (req, res) => {
  try {
    const maDM = req.query.category;
    const search = req.query.search || req.query.q || null;
    const minPrice = req.query.minPrice ? parseFloat(req.query.minPrice) : null;
    const maxPrice = req.query.maxPrice ? parseFloat(req.query.maxPrice) : null;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;

    const { products, totalItems } = await ProductModel.getProducts(
      maDM,
      page,
      limit,
      { search, minPrice, maxPrice }
    );

    res.status(200).json({
      success: true,
      products,
      totalItems,
      currentPage: page,
      totalPages: Math.ceil(totalItems / limit) || 1,
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Lỗi server", error: error.message });
  }
};

// 3. 🟢 CẬP NHẬT: Tìm kiếm sản phẩm thông minh (Tên + Danh mục)
exports.searchProducts = async (req, res) => {
  try {
    const { q } = req.query;

    // Nếu không truyền từ khóa hoặc từ khóa rỗng, trả về mảng trống luôn
    if (!q || q.trim() === "") {
      return res.status(200).json({ success: true, data: [] });
    }

    const products = await ProductModel.searchProducts(q.trim());

    res.status(200).json({
      success: true,
      message: `Tìm thấy ${products.length} kết quả phù hợp`,
      data: products,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi server khi tìm kiếm",
      error: error.message,
    });
  }
};

// 4. Lấy chi tiết sản phẩm theo ID
exports.getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await ProductModel.getProductById(id);

    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy sản phẩm yêu cầu." });
    }

    res.status(200).json(product);
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Lỗi server", error: error.message });
  }
};

// 5. Lấy sản phẩm liên quan
exports.getRelatedProducts = async (req, res) => {
  try {
    const { id } = req.params;
    const { categoryId } = req.query;

    if (!categoryId) {
      return res
        .status(400)
        .json({ success: false, message: "Thiếu mã danh mục (categoryId)" });
    }

    const products = await ProductModel.getRelatedProducts(categoryId, id);
    res.status(200).json(products);
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Lỗi server", error: error.message });
  }
};
