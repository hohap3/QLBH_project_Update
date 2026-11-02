const { pool } = require("../config/database");

class WarehouseModel {
  // 1. Lấy danh sách lịch sử giao dịch kho theo kho hàng (makho) có phân trang
  static async getAllTransactions(page = 1, limit = 10, loaiGD = null, makho = 'KHO_TONG') {
    try {
      const offset = (page - 1) * limit;
      let whereClause = "WHERE gdk.makho = $3";
      const params = [limit, offset, makho];

      if (loaiGD !== null && loaiGD !== undefined && loaiGD !== "") {
        whereClause += " AND gdk.loaigd = $4";
        params.push(parseInt(loaiGD, 10));
      }

      const dataQuery = `
        SELECT gdk.*, sp.tensp, sp.donvitinh 
        FROM giaodichkho gdk
        JOIN sanpham sp ON gdk.masp = sp.masp
        ${whereClause}
        ORDER BY gdk.ngaygd DESC
        LIMIT $1 OFFSET $2
      `;
      const dataResult = await pool.query(dataQuery, params);

      let countQuery = "SELECT COUNT(*) FROM giaodichkho gdk";
      const countParams = [makho];

      if (loaiGD !== null && loaiGD !== undefined && loaiGD !== "") {
        countQuery += " WHERE gdk.makho = $1 AND gdk.loaigd = $2";
        countParams.push(parseInt(loaiGD, 10));
      } else {
        countQuery += " WHERE gdk.makho = $1";
      }

      const countResult = await pool.query(countQuery, countParams);
      const totalRecords = parseInt(countResult.rows[0].count, 10);

      return {
        transactions: dataResult.rows,
        totalRecords: totalRecords,
        totalPages: Math.ceil(totalRecords / limit),
      };
    } catch (error) {
      throw error;
    }
  }

  // 2. Lấy lịch sử giao dịch của riêng một sản phẩm cụ thể tại 1 kho
  static async getTransactionsByProduct(maSP, makho = 'KHO_TONG') {
    try {
      const query = `
        SELECT gdk.*, sp.tensp 
        FROM giaodichkho gdk
        JOIN sanpham sp ON gdk.masp = sp.masp
        WHERE gdk.masp = $1 AND gdk.makho = $2
        ORDER BY gdk.ngaygd DESC
      `;
      const result = await pool.query(query, [maSP, makho]);
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  // 3. Xử lý tạo giao dịch kho với Transaction an toàn (Lock dòng để tránh Race Condition)
  static async createTransaction({ maGD, maSP, makho = 'KHO_TONG', loaiGD, soLuong }) {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // 1. Kiểm tra sản phẩm có tồn tại trong hệ thống hay không
      const spCheck = await client.query("SELECT masp, tensp FROM sanpham WHERE masp = $1", [maSP]);
      if (spCheck.rows.length === 0) {
        throw new Error(`Sản phẩm với mã '${maSP}' không tồn tại trong hệ thống!`);
      }

      // 2. Đảm bảo dòng tồn kho tồn tại trước khi khóa (tránh lỗi khi chi nhánh mới nhập hàng lần đầu)
      await client.query(
        `INSERT INTO tonkho (makho, masp, soluongton, soluongtamgiu)
         VALUES ($1, $2, 0, 0)
         ON CONFLICT (makho, masp) DO NOTHING`,
        [makho, maSP]
      );

      // 3. Khóa dòng tồn kho cụ thể của sản phẩm tại kho đang thao tác (FOR UPDATE)
      const productQuery = `SELECT soluongton FROM tonkho WHERE masp = $1 AND makho = $2 FOR UPDATE`;
      const productRes = await client.query(productQuery, [maSP, makho]);

      const tonTruoc = parseFloat(productRes.rows[0]?.soluongton) || 0;
      let tonSau = tonTruoc;
      const soLuongNum = parseFloat(soLuong);

      if (loaiGD === 1) { // Nhập kho
        tonSau = tonTruoc + soLuongNum;
      } else if (loaiGD === 2) { // Xuất kho
        if (tonTruoc < soLuongNum) {
          throw new Error(
            `Kho hàng '${makho}' không đủ số lượng xuất! (Hiện tồn: ${tonTruoc}, yêu cầu xuất: ${soLuongNum})`
          );
        }
        tonSau = tonTruoc - soLuongNum;
      } else {
        throw new Error("Loại giao dịch không hợp lệ (1: Nhập, 2: Xuất)!");
      }

      // 4. Ghi lại lịch sử giao dịch (Sổ cái - Ledger)
      const insertGDQuery = `
        INSERT INTO giaodichkho (magd, masp, makho, loaigd, soluong, tontruoc, tonsau, ngaygd)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `;
      await client.query(insertGDQuery, [
        maGD, maSP, makho, loaiGD, soLuongNum, tonTruoc, tonSau
      ]);

      // 5. Cập nhật lại số lượng tồn kho mới vào bảng tonkho
      const updateStockQuery = `
        UPDATE tonkho 
        SET soluongton = $1, ngaycapnhat = NOW()
        WHERE masp = $2 AND makho = $3
      `;
      await client.query(updateStockQuery, [tonSau, maSP, makho]);

      await client.query("COMMIT");

      return {
        maGD, maSP, makho, loaiGD, soLuong: soLuongNum, tonTruoc, tonSau, ngayGD: new Date()
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = WarehouseModel;
