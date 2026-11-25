const { pool } = require("../config/database");
const crypto = require("crypto");

let transferTableInitPromise = null;

class WarehouseModel {
  // Đảm bảo bảng yeucauchuyenkho tồn tại (chạy tự động 1 lần, không ảnh hưởng bảng cũ)
  static async ensureTransferTable() {
    if (!transferTableInitPromise) {
      transferTableInitPromise = (async () => {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS yeucauchuyenkho (
            mayeucau      VARCHAR(24) PRIMARY KEY,
            masp          VARCHAR(20) NOT NULL REFERENCES sanpham(masp) ON UPDATE CASCADE,
            khonguon      VARCHAR(50) NOT NULL,
            khodich       VARCHAR(50) NOT NULL,
            soluong       INTEGER NOT NULL CHECK (soluong > 0),
            lydo          TEXT,
            trangthai     VARCHAR(20) NOT NULL DEFAULT 'CHO_DUYET'
                            CHECK (trangthai IN ('CHO_DUYET', 'DA_DUYET', 'TU_CHOI')),
            nguoitao      VARCHAR(20) REFERENCES nguoidung(mand) ON DELETE SET NULL,
            tennguoitao   VARCHAR(100),
            nguoiduyet    VARCHAR(20) REFERENCES nguoidung(mand) ON DELETE SET NULL,
            tennguoiduyet VARCHAR(100),
            ghichuduyet   TEXT,
            ngaytao       TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
            ngayduyet     TIMESTAMP WITHOUT TIME ZONE,
            CHECK (khonguon <> khodich)
          );
        `);
        await pool.query(`
          CREATE INDEX IF NOT EXISTS idx_yeucauchuyenkho_trangthai_ngaytao
            ON yeucauchuyenkho (trangthai, ngaytao DESC);
        `);
      })().catch((err) => {
        transferTableInitPromise = null;
        throw err;
      });
    }
    return transferTableInitPromise;
  }

  // Lấy tên người dùng từ bảng nguoidung theo mand
  static async getUserDisplayName(maND) {
    if (!maND) return null;
    try {
      const res = await pool.query(
        "SELECT hoten, tendangnhap FROM nguoidung WHERE mand = $1 LIMIT 1",
        [String(maND)],
      );
      if (res.rows.length > 0) {
        return res.rows[0].hoten || res.rows[0].tendangnhap || String(maND);
      }
      return String(maND);
    } catch {
      return String(maND);
    }
  }

  // Lấy tồn kho của 1 sản phẩm tại 1 kho cụ thể
  static async getStockByWarehouse(maSP, makho = "KHO_TONG") {
    const res = await pool.query(
      `SELECT soluongton, soluongtamgiu, soluongkha_dung
       FROM tonkho
       WHERE masp = $1 AND makho = $2
       LIMIT 1`,
      [maSP, makho],
    );
    if (res.rows.length === 0) {
      return { soluongton: 0, soluongtamgiu: 0, soluongkha_dung: 0 };
    }
    return {
      soluongton: Number(res.rows[0].soluongton) || 0,
      soluongtamgiu: Number(res.rows[0].soluongtamgiu) || 0,
      soluongkha_dung: Number(res.rows[0].soluongkha_dung) || 0,
    };
  }
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

  // Hàm nội bộ: Thực thi điều chuyển liên kho nguyên tử trong cùng 1 Transaction
  static async _executeStockTransferTx(client, { maSP, khoNguon, khoDich, soLuong }) {
    const soLuongInt = parseInt(soLuong, 10);
    if (isNaN(soLuongInt) || soLuongInt <= 0) {
      throw new Error("Số lượng điều chuyển phải là số nguyên lớn hơn 0!");
    }
    if (khoNguon === khoDich) {
      throw new Error("Kho nguồn và kho đích không được trùng nhau!");
    }

    // 1. Kiểm tra sản phẩm tồn tại
    const spCheck = await client.query(
      "SELECT masp, tensp FROM sanpham WHERE masp = $1",
      [maSP],
    );
    if (spCheck.rows.length === 0) {
      throw new Error(`Sản phẩm với mã '${maSP}' không tồn tại trong hệ thống!`);
    }

    // 2. Đảm bảo cả 2 dòng tồn kho (kho nguồn & kho đích) đều tồn tại
    await client.query(
      `INSERT INTO tonkho (makho, masp, soluongton, soluongtamgiu)
       VALUES ($1, $2, 0, 0), ($3, $2, 0, 0)
       ON CONFLICT (makho, masp) DO NOTHING`,
      [khoNguon, maSP, khoDich],
    );

    // 3. Khóa cả 2 dòng theo thứ tự makho tăng dần để chống Deadlock
    const lockedRows = await client.query(
      `SELECT makho, soluongton
       FROM tonkho
       WHERE masp = $1 AND makho IN ($2, $3)
       ORDER BY makho ASC
       FOR UPDATE`,
      [maSP, khoNguon, khoDich],
    );

    const stockMap = {};
    for (const r of lockedRows.rows) {
      stockMap[r.makho] = Math.trunc(Number(r.soluongton) || 0);
    }

    const tonTruocNguon = stockMap[khoNguon] ?? 0;
    const tonTruocDich = stockMap[khoDich] ?? 0;

    if (tonTruocNguon < soLuongInt) {
      throw new Error(
        `Kho nguồn '${khoNguon}' không đủ tồn kho để điều chuyển! (Hiện tồn: ${tonTruocNguon}, yêu cầu: ${soLuongInt})`,
      );
    }

    const tonSauNguon = tonTruocNguon - soLuongInt;
    const tonSauDich = tonTruocDich + soLuongInt;

    // 4. Cập nhật tồn kho ở Kho nguồn (-) và Kho đích (+)
    await client.query(
      `UPDATE tonkho SET soluongton = $1, ngaycapnhat = NOW() WHERE masp = $2 AND makho = $3`,
      [tonSauNguon, maSP, khoNguon],
    );
    await client.query(
      `UPDATE tonkho SET soluongton = $1, ngaycapnhat = NOW() WHERE masp = $2 AND makho = $3`,
      [tonSauDich, maSP, khoDich],
    );

    // 5. Ghi 2 dòng sổ cái vào giaodichkho (magd <= 20 ký tự, loaigd: 2=Xuất, 1=Nhập)
    const maGDXuat = `XK${crypto.randomBytes(9).toString("hex").toUpperCase()}`;
    const maGDNhap = `NK${crypto.randomBytes(9).toString("hex").toUpperCase()}`;

    await client.query(
      `INSERT INTO giaodichkho (magd, masp, makho, loaigd, soluong, tontruoc, tonsau, ngaygd)
       VALUES ($1, $2, $3, 2, $4, $5, $6, NOW())`,
      [maGDXuat, maSP, khoNguon, soLuongInt, tonTruocNguon, tonSauNguon],
    );

    await client.query(
      `INSERT INTO giaodichkho (magd, masp, makho, loaigd, soluong, tontruoc, tonsau, ngaygd)
       VALUES ($1, $2, $3, 1, $4, $5, $6, NOW())`,
      [maGDNhap, maSP, khoDich, soLuongInt, tonTruocDich, tonSauDich],
    );

    return {
      maGDXuat,
      maGDNhap,
      tonTruocNguon,
      tonSauNguon,
      tonTruocDich,
      tonSauDich,
    };
  }

  // 4. Lấy danh sách phiếu yêu cầu / điều chuyển liên kho (có phân trang + đếm Chờ duyệt)
  static async getTransferRequests({
    page = 1,
    limit = 10,
    status = "",
    search = "",
    onlyUserId = null,
  } = {}) {
    await this.ensureTransferTable();

    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];

    if (onlyUserId) {
      params.push(String(onlyUserId));
      conditions.push(`yc.nguoitao = $${params.length}`);
    }

    if (status && ["CHO_DUYET", "DA_DUYET", "TU_CHOI"].includes(status)) {
      params.push(status);
      conditions.push(`yc.trangthai = $${params.length}`);
    }

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      const idx = params.length;
      conditions.push(
        `(yc.mayeucau ILIKE $${idx} OR yc.masp ILIKE $${idx} OR sp.tensp ILIKE $${idx} OR COALESCE(yc.tennguoitao, '') ILIKE $${idx} OR COALESCE(yc.lydo, '') ILIKE $${idx})`,
      );
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const dataQuery = `
      SELECT yc.*, sp.tensp, sp.donvitinh
      FROM yeucauchuyenkho yc
      JOIN sanpham sp ON yc.masp = sp.masp
      ${whereClause}
      ORDER BY
        CASE WHEN yc.trangthai = 'CHO_DUYET' THEN 0 ELSE 1 END ASC,
        yc.ngaytao DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM yeucauchuyenkho yc
      JOIN sanpham sp ON yc.masp = sp.masp
      ${whereClause}
    `;

    const pendingParams = [];
    let pendingWhere = "WHERE trangthai = 'CHO_DUYET'";
    if (onlyUserId) {
      pendingParams.push(String(onlyUserId));
      pendingWhere += " AND nguoitao = $1";
    }
    const pendingQuery = `SELECT COUNT(*) AS pending FROM yeucauchuyenkho ${pendingWhere}`;

    const [dataRes, countRes, pendingRes] = await Promise.all([
      pool.query(dataQuery, [...params, limit, offset]),
      pool.query(countQuery, params),
      pool.query(pendingQuery, pendingParams),
    ]);

    const totalRecords = parseInt(countRes.rows[0]?.total || 0, 10);
    const pendingCount = parseInt(pendingRes.rows[0]?.pending || 0, 10);

    return {
      transfers: dataRes.rows,
      totalRecords,
      totalPages: Math.max(1, Math.ceil(totalRecords / limit)),
      pendingCount,
    };
  }

  // 5. Nhân viên / Quản lý lập yêu cầu chuyển kho (trạng thái CHO_DUYET)
  static async createTransferRequest({
    maYeuCau,
    maSP,
    khoNguon,
    khoDich,
    soLuong,
    lyDo,
    nguoiTao,
    tenNguoiTao,
  }) {
    await this.ensureTransferTable();

    const spCheck = await pool.query(
      "SELECT masp FROM sanpham WHERE masp = $1",
      [maSP],
    );
    if (spCheck.rows.length === 0) {
      throw new Error(`Sản phẩm với mã '${maSP}' không tồn tại trong hệ thống!`);
    }

    const result = await pool.query(
      `INSERT INTO yeucauchuyenkho (
        mayeucau, masp, khonguon, khodich, soluong, lydo, trangthai, nguoitao, tennguoitao, ngaytao
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'CHO_DUYET', $7, $8, NOW())
      RETURNING *`,
      [
        maYeuCau,
        maSP,
        khoNguon,
        khoDich,
        parseInt(soLuong, 10),
        lyDo || null,
        nguoiTao || null,
        tenNguoiTao || null,
      ],
    );

    return result.rows[0];
  }

  // 6. Quản lý (ADMIN / MANAGER) điều chuyển liên kho trực tiếp (duyệt & chuyển ngay)
  static async directTransfer({
    maYeuCau,
    maSP,
    khoNguon,
    khoDich,
    soLuong,
    lyDo,
    nguoiTao,
    tenNguoiTao,
  }) {
    await this.ensureTransferTable();
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const txDetail = await this._executeStockTransferTx(client, {
        maSP,
        khoNguon,
        khoDich,
        soLuong,
      });

      const insertRes = await client.query(
        `INSERT INTO yeucauchuyenkho (
          mayeucau, masp, khonguon, khodich, soluong, lydo,
          trangthai, nguoitao, tennguoitao, nguoiduyet, tennguoiduyet, ghichuduyet, ngaytao, ngayduyet
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'DA_DUYET', $7, $8, $7, $8, $9, NOW(), NOW())
        RETURNING *`,
        [
          maYeuCau,
          maSP,
          khoNguon,
          khoDich,
          parseInt(soLuong, 10),
          lyDo || "Điều chuyển hàng liên kho trực tiếp",
          nguoiTao || null,
          tenNguoiTao || null,
          "Thực thi trực tiếp bởi Quản lý",
        ],
      );

      await client.query("COMMIT");
      return { request: insertRes.rows[0], stockChange: txDetail };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  // 7. Quản lý duyệt yêu cầu chuyển kho của nhân viên
  static async approveTransferRequest({
    maYeuCau,
    nguoiDuyet,
    tenNguoiDuyet,
    ghiChuDuyet,
  }) {
    await this.ensureTransferTable();
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const reqRes = await client.query(
        "SELECT * FROM yeucauchuyenkho WHERE mayeucau = $1 FOR UPDATE",
        [maYeuCau],
      );
      if (reqRes.rows.length === 0) {
        throw new Error(`Không tìm thấy phiếu yêu cầu chuyển kho '${maYeuCau}'!`);
      }

      const transferReq = reqRes.rows[0];
      if (transferReq.trangthai !== "CHO_DUYET") {
        throw new Error(
          `Phiếu '${maYeuCau}' đã được xử lý trước đó (${transferReq.trangthai})!`,
        );
      }

      const txDetail = await this._executeStockTransferTx(client, {
        maSP: transferReq.masp,
        khoNguon: transferReq.khonguon,
        khoDich: transferReq.khodich,
        soLuong: transferReq.soluong,
      });

      const updated = await client.query(
        `UPDATE yeucauchuyenkho
         SET trangthai = 'DA_DUYET',
             nguoiduyet = $1,
             tennguoiduyet = $2,
             ghichuduyet = $3,
             ngayduyet = NOW()
         WHERE mayeucau = $4
         RETURNING *`,
        [
          nguoiDuyet || null,
          tenNguoiDuyet || null,
          ghiChuDuyet || "Đã duyệt và hoàn tất điều chuyển",
          maYeuCau,
        ],
      );

      await client.query("COMMIT");
      return { request: updated.rows[0], stockChange: txDetail };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  // 8. Quản lý từ chối yêu cầu chuyển kho
  static async rejectTransferRequest({
    maYeuCau,
    nguoiDuyet,
    tenNguoiDuyet,
    ghiChuDuyet,
  }) {
    await this.ensureTransferTable();
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const reqRes = await client.query(
        "SELECT * FROM yeucauchuyenkho WHERE mayeucau = $1 FOR UPDATE",
        [maYeuCau],
      );
      if (reqRes.rows.length === 0) {
        throw new Error(`Không tìm thấy phiếu yêu cầu chuyển kho '${maYeuCau}'!`);
      }

      if (reqRes.rows[0].trangthai !== "CHO_DUYET") {
        throw new Error(
          `Phiếu '${maYeuCau}' đã được xử lý trước đó (${reqRes.rows[0].trangthai})!`,
        );
      }

      const updated = await client.query(
        `UPDATE yeucauchuyenkho
         SET trangthai = 'TU_CHOI',
             nguoiduyet = $1,
             tennguoiduyet = $2,
             ghichuduyet = $3,
             ngayduyet = NOW()
         WHERE mayeucau = $4
         RETURNING *`,
        [
          nguoiDuyet || null,
          tenNguoiDuyet || null,
          ghiChuDuyet || "Quản lý từ chối yêu cầu",
          maYeuCau,
        ],
      );

      await client.query("COMMIT");
      return updated.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = WarehouseModel;
