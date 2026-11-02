const { pool } = require("../config/database");

class ProductModel {
  // 1. LẤY SẢN PHẨM BÁN CHẠY (CÓ PHÂN TRANG & TỔNG ĐÃ BÁN > 0)
  static async getBestSellers(page = 1, limit = 8) {
    try {
      const offset = (page - 1) * limit;
      const countResult = await pool.query(`
        SELECT COUNT(DISTINCT sp.masp) as total 
        FROM sanpham sp
        INNER JOIN chitiet_donhang ct ON sp.masp = ct.masp
      `);
      const totalItems = parseInt(countResult.rows[0].total) || 0;

      const result = await pool.query(
        `
        SELECT 
          sp.masp, sp.tensp, sp.giaban, sp.hinhanh, 
          SUM(ct.soluong) as tongdaban
        FROM sanpham sp
        INNER JOIN chitiet_donhang ct ON sp.masp = ct.masp
        GROUP BY sp.masp, sp.tensp, sp.giaban, sp.hinhanh
        HAVING SUM(ct.soluong) > 0
        ORDER BY tongdaban DESC, sp.masp ASC
        LIMIT $1 OFFSET $2
      `,
        [limit, offset],
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
        params.push("%" + filters.search.trim() + "%");
        countQuery += " AND (sp.tensp ILIKE $" + params.length + " OR sp.masp ILIKE $" + params.length + " OR dm.tendanhmuc ILIKE $" + params.length + ")";
        dataQuery += " AND (sp.tensp ILIKE $" + params.length + " OR sp.masp ILIKE $" + params.length + " OR dm.tendanhmuc ILIKE $" + params.length + ")";
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

  // 3. 🟢 CẬP NHẬT: TÌM KIẾM SẢN PHẨM THEO TÊN HOẶC TÊN DANH MỤC
  static async searchProducts(keyword) {
    try {
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
        WHERE sp.tensp ILIKE $1 OR dm.tendanhmuc ILIKE $1
        ORDER BY sp.tensp ASC
        LIMIT 5
      `;

      const result = await pool.query(queryStr, [`%${keyword}%`]);
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  // 4. CHI TIẾT SẢN PHẨM
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
      return result.rows[0];
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
