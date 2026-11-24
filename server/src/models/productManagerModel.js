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

  // Lấy chi tiết một sản phẩm theo ID (kèm bộ ảnh từ hinhanh_sanpham)
  getProductById: async (maSP) => {
    try {
      const pool = await poolPromise;
      const productId = String(maSP);

      const query = `
        SELECT sp.*, dm.tendanhmuc AS "tendanhmuc", ncc.tenncc AS "tenncc",
          COALESCE((SELECT SUM(soluongton) FROM tonkho WHERE masp = sp.masp), 0) AS "soluongton"
        FROM sanpham sp
        LEFT JOIN danhmuc dm ON sp.madanhmuc = dm.madanhmuc
        LEFT JOIN nhacungcap ncc ON sp.mancc = ncc.mancc
        WHERE sp.masp = $1
      `;
      const result = await pool.query(query, [productId]);
      const product = result.rows[0];
      if (!product) return null;

      try {
        const imgResult = await pool.query(
          `SELECT maanh, masp, duongdan, nhan, loaigoc, thutu, la_anh_chinh
           FROM hinhanh_sanpham
           WHERE masp = $1
           ORDER BY la_anh_chinh DESC, thutu ASC, maanh ASC`,
          [productId],
        );
        product.images = imgResult.rows;
      } catch (imgErr) {
        product.images = [];
      }

      return product;
    } catch (error) {
      throw error;
    }
  },

  // Thêm sản phẩm mới (Tích hợp phân kho Phase 4 + Đa hình ảnh)
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
        [data.MaSP, initStock],
      );

      // Lưu ảnh đại diện chính vào hinhanh_sanpham
      if (data.HinhAnh) {
        await client.query(
          `INSERT INTO hinhanh_sanpham (masp, duongdan, nhan, loaigoc, thutu, la_anh_chinh)
           VALUES ($1, $2, 'Mặt trước', 'front', 0, true)`,
          [data.MaSP, data.HinhAnh],
        );
      }

      // Lưu tối đa 5 ảnh góc chụp phụ vào hinhanh_sanpham (giữ đúng loaigoc & thutu của từng ô)
      const extraImages = Array.isArray(data.HinhAnhPhu)
        ? data.HinhAnhPhu.slice(0, 5)
        : [];
      for (let i = 0; i < extraImages.length; i++) {
        const img = extraImages[i];
        await client.query(
          `INSERT INTO hinhanh_sanpham (masp, duongdan, nhan, loaigoc, thutu, la_anh_chinh)
           VALUES ($1, $2, $3, $4, $5, false)`,
          [
            data.MaSP,
            img.url,
            img.nhan || `Góc chụp ${i + 1}`,
            img.loaigoc || "gallery",
            img.thutu || i + 1,
          ],
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

  // Cập nhật thông tin sản phẩm (Tích hợp phân kho Phase 4 + Đa hình ảnh)
  updateProduct: async (maSP, data) => {
    const pool = await poolPromise;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const productId = String(maSP);

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
        productId,
      ];
      await client.query(query, values);

      if (data.SoLuongTon !== undefined) {
        const updateStock = parseInt(data.SoLuongTon, 10) || 0;
        await client.query(
          `INSERT INTO tonkho (makho, masp, soluongton, soluongtamgiu)
           VALUES ('KHO_TONG', $1, $2, 0)
           ON CONFLICT (makho, masp) DO UPDATE SET soluongton = EXCLUDED.soluongton`,
          [productId, updateStock],
        );
      }

      // Đồng bộ ảnh đại diện chính trong hinhanh_sanpham
      if (data.HinhAnh) {
        const mainUpdate = await client.query(
          `UPDATE hinhanh_sanpham
           SET duongdan = $1
           WHERE masp = $2 AND la_anh_chinh = true`,
          [data.HinhAnh, productId],
        );
        if (mainUpdate.rowCount === 0) {
          await client.query(
            `INSERT INTO hinhanh_sanpham (masp, duongdan, nhan, loaigoc, thutu, la_anh_chinh)
             VALUES ($1, $2, 'Mặt trước', 'front', 0, true)`,
            [productId, data.HinhAnh],
          );
        }
      }

      // Xóa các ảnh phụ Admin đã chọn gỡ bỏ
      const deletedIds = Array.isArray(data.DeletedImageIds)
        ? data.DeletedImageIds.map((x) => parseInt(x, 10)).filter(
            (n) => !isNaN(n),
          )
        : [];
      if (deletedIds.length > 0) {
        await client.query(
          `DELETE FROM hinhanh_sanpham
           WHERE masp = $1 AND maanh = ANY($2::int[]) AND la_anh_chinh = false`,
          [productId, deletedIds],
        );
      }

      // Thêm ảnh góc chụp phụ mới (giới hạn tổng tối đa 5 ảnh phụ / sản phẩm)
      const newExtraImages = Array.isArray(data.HinhAnhPhu)
        ? data.HinhAnhPhu
        : [];
      if (newExtraImages.length > 0) {
        const countRes = await client.query(
          `SELECT COUNT(*)::int AS cnt, COALESCE(MAX(thutu), 0)::int AS max_order
           FROM hinhanh_sanpham
           WHERE masp = $1 AND la_anh_chinh = false`,
          [productId],
        );
        const currentExtraCount = countRes.rows[0].cnt || 0;
        let nextOrder = (countRes.rows[0].max_order || 0) + 1;
        const remainingSlots = Math.max(0, 5 - currentExtraCount);

        const toInsert = newExtraImages.slice(0, remainingSlots);
        for (const img of toInsert) {
          const orderVal = img.thutu || nextOrder;
          await client.query(
            `INSERT INTO hinhanh_sanpham (masp, duongdan, nhan, loaigoc, thutu, la_anh_chinh)
             VALUES ($1, $2, $3, $4, $5, false)`,
            [
              productId,
              img.url,
              img.nhan || `Góc chụp ${orderVal}`,
              img.loaigoc || "gallery",
              orderVal,
            ],
          );
          nextOrder++;
        }
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

  // Xóa 1 ảnh phụ riêng lẻ của sản phẩm
  deleteProductImage: async (maSP, imageId) => {
    const pool = await poolPromise;
    const result = await pool.query(
      `DELETE FROM hinhanh_sanpham
       WHERE masp = $1 AND maanh = $2 AND la_anh_chinh = false
       RETURNING maanh`,
      [String(maSP), parseInt(imageId, 10)],
    );
    return result.rowCount > 0;
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
