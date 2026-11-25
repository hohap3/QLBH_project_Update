const { pool } = require("../config/database");

const VN_ACCENTED =
  "áàảãạăắằẳẵặâấầẩẫậđéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵ";
const VN_PLAIN =
  "aaaaaaaaaaaaaaaaadeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyy";

function normalizeSearchTokens(keyword = "") {
  const normalized = String(keyword)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return [];
  return normalized.split(" ").filter(Boolean).slice(0, 6);
}

const NORMALIZED_SEARCH_EXPR = `translate(lower(COALESCE(sp.tensp, '') || ' ' || COALESCE(sp.masp, '') || ' ' || COALESCE(dm.tendanhmuc, '')), '${VN_ACCENTED}', '${VN_PLAIN}')`;

class ProductModel {
  // 1. LẤY SẢN PHẨM BÁN CHẠY / DEAL SỐC (CÓ LỌC THEO DANH MỤC & LEFT JOIN ĐỂ KHÔNG BỊ TRỐNG)
  static async getBestSellers(page = 1, limit = 8, category = "all") {
    try {
      const offset = (page - 1) * limit;
      const hasCategory =
        category &&
        category !== "all" &&
        category !== "undefined" &&
        String(category).trim() !== "";

      const whereClause = hasCategory ? "WHERE sp.madanhmuc = $1" : "";
      const countParams = hasCategory ? [String(category).trim()] : [];

      const countResult = await pool.query(
        `SELECT COUNT(*)::int AS total FROM sanpham sp ${whereClause}`,
        countParams,
      );
      const totalItems = parseInt(countResult.rows[0].total, 10) || 0;

      const dataParams = [...countParams, limit, offset];
      const limitIdx = countParams.length + 1;
      const offsetIdx = countParams.length + 2;

      const result = await pool.query(
        `
        SELECT
          sp.masp, sp.tensp, sp.giaban, sp.hinhanh, sp.madanhmuc,
          COALESCE(SUM(ct.soluong), 0)::int AS tongdaban
        FROM sanpham sp
        LEFT JOIN chitiet_donhang ct ON sp.masp = ct.masp
        ${whereClause}
        GROUP BY sp.masp, sp.tensp, sp.giaban, sp.hinhanh, sp.madanhmuc
        ORDER BY tongdaban DESC, sp.giaban DESC, sp.masp ASC
        LIMIT $${limitIdx} OFFSET $${offsetIdx}
      `,
        dataParams,
      );

      return { products: result.rows, totalItems };
    } catch (error) {
      throw error;
    }
  }

    // 2. LẤY TẤT CẢ SẢN PHẨM HOẶC THEO DANH MỤC (CÓ PHÂN TRANG & BỘ LỌC NÂNG CAO)
  static async getProducts(maDM = null, page = 1, limit = 8, filters = {}) {
    try {
      const offset = (page - 1) * limit;
      let countQuery = "SELECT COUNT(*) as total FROM sanpham sp LEFT JOIN danhmuc dm ON sp.madanhmuc = dm.madanhmuc WHERE 1=1";
      let dataQuery = `
        SELECT sp.*, dm.tendanhmuc,
          COALESCE((SELECT SUM(soluongton) FROM tonkho WHERE masp = sp.masp), 0) AS soluongton
        FROM sanpham sp
        LEFT JOIN danhmuc dm ON sp.madanhmuc = dm.madanhmuc
        WHERE 1=1
      `;
      const params = [];

      if (
        maDM &&
        maDM !== "all" &&
        maDM !== "undefined" &&
        maDM.trim() !== ""
      ) {
        params.push(maDM);
        countQuery += " AND sp.madanhmuc = $" + params.length;
        dataQuery += " AND sp.madanhmuc = $" + params.length;
      }

      if (filters.search && filters.search.trim() !== "") {
        const tokens = normalizeSearchTokens(filters.search);
        for (const token of tokens) {
          params.push(`%${token}%`);
          const clause = ` AND ${NORMALIZED_SEARCH_EXPR} LIKE $${params.length}`;
          countQuery += clause;
          dataQuery += clause;
        }
      }

      if (filters.minPrice !== null && !isNaN(filters.minPrice)) {
        params.push(filters.minPrice);
        countQuery += " AND sp.giaban >= $" + params.length;
        dataQuery += " AND sp.giaban >= $" + params.length;
      }

      if (filters.maxPrice !== null && !isNaN(filters.maxPrice)) {
        params.push(filters.maxPrice);
        countQuery += " AND sp.giaban <= $" + params.length;
        dataQuery += " AND sp.giaban <= $" + params.length;
      }

      const countResult = await pool.query(countQuery, params);
      const totalItems = parseInt(countResult.rows[0].total) || 0;

      const dataParams = [...params];
      dataParams.push(limit);
      dataParams.push(offset);

      dataQuery += " ORDER BY sp.masp ASC LIMIT $" + (dataParams.length - 1) + " OFFSET $" + dataParams.length;
      const resultData = await pool.query(dataQuery, dataParams);

      return { products: resultData.rows, totalItems };
    } catch (error) {
      throw error;
    }
  }

  // 3. TÌM KIẾM SẢN PHẨM THÔNG MINH (Tách nhiều từ + không dấu tiếng Việt + Mã SP / Tên SP / Danh mục)
  static async searchProducts(keyword) {
    try {
      const tokens = normalizeSearchTokens(keyword);
      if (tokens.length === 0) return [];

      const params = tokens.map((t) => `%${t}%`);
      const whereConditions = params
        .map((_, idx) => `${NORMALIZED_SEARCH_EXPR} LIKE $${idx + 1}`)
        .join(" AND ");

      const queryStr = `
        SELECT 
          sp.masp, 
          sp.tensp, 
          sp.giaban, 
          sp.hinhanh, 
          COALESCE((SELECT SUM(soluongton) FROM tonkho WHERE masp = sp.masp), 0) AS soluongton,
          dm.tendanhmuc
        FROM sanpham sp
        LEFT JOIN danhmuc dm ON sp.madanhmuc = dm.madanhmuc
        WHERE ${whereConditions}
        ORDER BY sp.tensp ASC
        LIMIT 6
      `;

      const result = await pool.query(queryStr, params);
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  // 4. CHI TIẾT SẢN PHẨM (kèm bộ ảnh đa góc chụp từ hinhanh_sanpham)
  static async getProductById(maSP) {
    try {
      const result = await pool.query(
        `
        SELECT sp.*, dm.tendanhmuc, ncc.tenncc,
          COALESCE((SELECT SUM(soluongton) FROM tonkho WHERE masp = sp.masp), 0) AS soluongton,
          (SELECT COALESCE(SUM(soluong), 0) FROM chitiet_donhang WHERE masp = sp.masp) as tongdaban
        FROM sanpham sp
        LEFT JOIN danhmuc dm ON sp.madanhmuc = dm.madanhmuc
        LEFT JOIN nhacungcap ncc ON sp.mancc = ncc.mancc
        WHERE sp.masp = $1
      `,
        [maSP],
      );
      const product = result.rows[0];
      if (!product) return null;

      try {
        const imgResult = await pool.query(
          `SELECT maanh, duongdan, nhan, loaigoc, thutu, la_anh_chinh
           FROM hinhanh_sanpham
           WHERE masp = $1
           ORDER BY la_anh_chinh DESC, thutu ASC, maanh ASC`,
          [maSP],
        );
        product.images = imgResult.rows;
      } catch (imgErr) {
        product.images = [];
      }

      return product;
    } catch (error) {
      throw error;
    }
  }

  // 5. SẢN PHẨM LIÊN QUAN
  static async getRelatedProducts(maDanhMuc, currentMaSP) {
    try {
      const result = await pool.query(
        `
        SELECT sp.masp, sp.tensp, sp.giaban, sp.hinhanh, dm.tendanhmuc,
          COALESCE((SELECT SUM(soluongton) FROM tonkho WHERE masp = sp.masp), 0) AS soluongton
        FROM sanpham sp
        LEFT JOIN danhmuc dm ON sp.madanhmuc = dm.madanhmuc
        WHERE sp.madanhmuc = $1 AND sp.masp != $2
        LIMIT 4
      `,
        [maDanhMuc, currentMaSP],
      );
      return result.rows;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = ProductModel;
