const { poolPromise } = require("../config/database");

const productManagerModel = {
  // Lấy sản phẩm kết hợp Phân trang (LIMIT/OFFSET) và Tìm kiếm dữ liệu từ Database
  getAllProducts: async (limit = 10, offset = 0, search = "") => {
    try {
      const pool = await poolPromise;
      let queryArgs = [];

      let whereClause = "";
      if (search && search.trim() !== "") {
        whereClause = `WHERE sp.masp ILIKE $1 OR sp.tensp ILIKE $1 OR dm.tendanhmuc ILIKE $1`;
        queryArgs.push(`%${search.trim()}%`);
      }

      const countQuery = `
        SELECT COUNT(*)::int AS count 
        FROM sanpham sp
        LEFT JOIN danhmuc dm ON sp.madanhmuc = dm.madanhmuc
        ${whereClause}
      `;
      const countResult = await pool.query(countQuery, queryArgs);
      const totalItems = countResult.rows[0].count;

      const dataParamIndex1 = queryArgs.length + 1;
      const dataParamIndex2 = queryArgs.length + 2;
      queryArgs.push(limit, offset);

      const dataQuery = `
        SELECT sp.*, dm.tendanhmuc AS "tendanhmuc", ncc.tenncc AS "tenncc",
          COALESCE((SELECT SUM(soluongton) FROM tonkho WHERE masp = sp.masp), 0) AS "soluongton"
        FROM sanpham sp
        LEFT JOIN danhmuc dm ON sp.madanhmuc = dm.madanhmuc
        LEFT JOIN nhacungcap ncc ON sp.mancc = ncc.mancc
        ${whereClause}
        ORDER BY sp.masp DESC
        LIMIT $${dataParamIndex1} OFFSET $${dataParamIndex2}
      `;
      const dataResult = await pool.query(dataQuery, queryArgs);

      return {
        products: dataResult.rows,
        totalItems: totalItems,
      };
    } catch (error) {
      throw error;
    }
  },

  // Lấy chi tiết một sản phẩm theo ID
  getProductById: async (maSP) => {
    try {
      const pool = await poolPromise;

      // Nếu cột masp trong DB là INT, hãy chuyển đổi nó sang số.
      // Nếu masp của bạn bản chất là chuỗi (VARCHAR), hãy giữ nguyên maSP.
      const parsedId = isNaN(maSP) ? maSP : parseInt(maSP, 10);

      const query = `
        SELECT sp.*, dm.tendanhmuc AS "tendanhmuc", ncc.tenncc AS "tenncc",
          COALESCE((SELECT SUM(soluongton) FROM tonkho WHERE masp = sp.masp), 0) AS "soluongton"
        FROM sanpham sp
        LEFT JOIN danhmuc dm ON sp.madanhmuc = dm.madanhmuc
        LEFT JOIN nhacungcap ncc ON sp.mancc = ncc.mancc
        WHERE sp.masp = $1
      `;
      const result = await pool.query(query, [parsedId]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  },

  // Thêm sản phẩm mới (Tích hợp phân kho Phase 4)
  createProduct: async (data) => {
    const pool = await poolPromise;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const query = `
        INSERT INTO sanpham (masp, tensp, gianhap, giaban, mota, donvitinh, madanhmuc, mancc, hinhanh)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `;
      const values = [
        data.MaSP,
        data.TenSP,
        parseFloat(data.GiaNhap) || 0,
        parseFloat(data.GiaBan) || 0,
        data.MoTa || null,
        data.DonViTinh || null,
        data.MaDanhMuc,
        data.MaNCC,
        data.HinhAnh || null,
      ];
      await client.query(query, values);

      // Thêm tồn kho ban đầu vào Kho Tổng
      const initStock = parseInt(data.SoLuongTon, 10) || 0;
      await client.query(
        `INSERT INTO tonkho (makho, masp, soluongton, soluongtamgiu)
         VALUES ('KHO_TONG', $1, $2, 0)
         ON CONFLICT (makho, masp) DO UPDATE SET soluongton = EXCLUDED.soluongton`,
        [data.MaSP, initStock]
      );

      await client.query("COMMIT");
      return true;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  // Cập nhật thông tin sản phẩm (Tích hợp phân kho Phase 4)
  updateProduct: async (maSP, data) => {
    const pool = await poolPromise;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const parsedId = isNaN(maSP) ? maSP : parseInt(maSP, 10);

      const query = `
        UPDATE sanpham 
        SET tensp = $1, gianhap = $2, giaban = $3, 
            mota = $4, donvitinh = $5, 
            madanhmuc = $6, mancc = $7, hinhanh = $8
        WHERE masp = $9
      `;
      const values = [
        data.TenSP,
        parseFloat(data.GiaNhap) || 0,
        parseFloat(data.GiaBan) || 0,
        data.MoTa || null,
        data.DonViTinh || null,
        data.MaDanhMuc,
        data.MaNCC,
        data.HinhAnh || null,
        parsedId,
      ];
      await client.query(query, values);

      if (data.SoLuongTon !== undefined) {
        const updateStock = parseInt(data.SoLuongTon, 10) || 0;
        await client.query(
          `INSERT INTO tonkho (makho, masp, soluongton, soluongtamgiu)
           VALUES ('KHO_TONG', $1, $2, 0)
           ON CONFLICT (makho, masp) DO UPDATE SET soluongton = EXCLUDED.soluongton`,
          [parsedId, updateStock]
        );
      }

      await client.query("COMMIT");
      return true;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  // 🔥 Xóa sản phẩm có kiểm tra ràng buộc dữ liệu đơn hàng
  deleteProduct: async (maSP) => {
    try {
      const pool = await poolPromise;

      // 1. Kiểm tra xem sản phẩm có nằm trong chi tiết đơn hàng nào không
      const checkOrderQuery = `
        SELECT COUNT(*)::int AS count 
        FROM chitiet_donhang 
        WHERE masp = $1
      `;
      const checkResult = await pool.query(checkOrderQuery, [maSP]);
      const constraintCount = checkResult.rows[0].count;

      // 2. Nếu có tồn tại trong đơn hàng, chặn lại và ném lỗi nghiệp vụ
      if (constraintCount > 0) {
        const error = new Error(
          "Sản phẩm đã có trong đơn hàng bán ra. Không thể xóa dữ liệu lịch sử!",
        );
        error.code = "23503"; // Giả lập mã lỗi Foreign Key Constraint của PostgreSQL
        throw error;
      }

      // 3. Nếu an toàn, tiến hành xóa khỏi hệ thống
      const query = "DELETE FROM sanpham WHERE masp = $1";
      await pool.query(query, [maSP]);
      return true;
    } catch (error) {
      throw error;
    }
  },

  // Đồng bộ hàng loạt sản phẩm từ file Excel
  bulkCreateOrUpdateProducts: async (productsList) => {
    try {
      const pool = await poolPromise;
      let successCount = 0;

      for (const item of productsList) {
        const maSP = item.MaSP || item.masp;
        const tenSP = item.TenSP || item.tensp;
        const maDanhMuc = item.MaDanhMuc || item.madanhmuc;
        const maNCC = item.MaNCC || item.mancc;

        if (!maSP || !tenSP || !maDanhMuc || !maNCC) continue;

        const checkQuery =
          "SELECT COUNT(*)::int AS count FROM sanpham WHERE masp = $1";
        const checkExist = await pool.query(checkQuery, [maSP]);
        const isExist = checkExist.rows[0].count > 0;

        const giaNhap = parseFloat(item.GiaNhap || item.gianhap) || 0;
        const giaBan = parseFloat(item.GiaBan || item.giaban) || 0;
        const soLuongTon = parseInt(item.SoLuongTon || item.soluongton) || 0;
        const moTa = item.MoTa || item.mota || null;
        const donViTinh = item.DonViTinh || item.donvitinh || null;
        const hinhAnh = item.HinhAnh || item.hinhanh || null;

        if (isExist) {
          const updateQuery = `
            UPDATE sanpham 
            SET tensp = $1, gianhap = $2, giaban = $3, 
                soluongton = $4, mota = $5, donvitinh = $6, 
                madanhmuc = $7, mancc = $8, hinhanh = COALESCE($9, hinhanh)
            WHERE masp = $10
          `;
          await pool.query(updateQuery, [
            tenSP,
            giaNhap,
            giaBan,
            soLuongTon,
            moTa,
            donViTinh,
            maDanhMuc,
            maNCC,
            hinhAnh,
            maSP,
          ]);
        } else {
          const insertQuery = `
            INSERT INTO sanpham (masp, tensp, gianhap, giaban, soluongton, mota, donvitinh, madanhmuc, mancc, hinhanh)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          `;
          await pool.query(insertQuery, [
            maSP,
            tenSP,
            giaNhap,
            giaBan,
            soLuongTon,
            moTa,
            donViTinh,
            maDanhMuc,
            maNCC,
            hinhAnh,
          ]);
        }
        successCount++;
      }
      return successCount;
    } catch (error) {
      throw error;
    }
  },
};

module.exports = productManagerModel;
