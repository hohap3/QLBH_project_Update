const { pool } = require("../config/database");

let cartTableInitPromise = null;

class CartModel {
  // Tự động tạo bảng giohang 1 lần duy nhất (khớp VARCHAR(20) của nguoidung & sanpham)
  static async ensureCartTable() {
    if (!cartTableInitPromise) {
      cartTableInitPromise = (async () => {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS giohang (
            mand        VARCHAR(20) NOT NULL REFERENCES nguoidung(mand) ON DELETE CASCADE,
            masp        VARCHAR(20) NOT NULL REFERENCES sanpham(masp) ON DELETE CASCADE,
            soluong     INTEGER NOT NULL CHECK (soluong > 0),
            ngaycapnhat TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
            PRIMARY KEY (mand, masp)
          );
        `);
        await pool.query(`
          CREATE INDEX IF NOT EXISTS idx_giohang_mand_ngaycapnhat
            ON giohang (mand, ngaycapnhat DESC);
        `);
      })().catch((err) => {
        cartTableInitPromise = null;
        throw err;
      });
    }
    return cartTableInitPromise;
  }

  // Lấy toàn bộ giỏ hàng của user (JOIN sanpham để luôn có giá, ảnh, tồn kho mới nhất)
  static async getCartByUser(maND) {
    await this.ensureCartTable();
    const res = await pool.query(
      `
      SELECT
        gh.masp,
        gh.soluong,
        gh.ngaycapnhat,
        sp.tensp,
        sp.giaban,
        sp.hinhanh,
        COALESCE((SELECT SUM(soluongton) FROM tonkho WHERE masp = sp.masp), 0)::int AS soluongton
      FROM giohang gh
      JOIN sanpham sp ON gh.masp = sp.masp
      WHERE gh.mand = $1
      ORDER BY gh.ngaycapnhat DESC
      `,
      [String(maND).trim()],
    );

    return res.rows.map((r) => ({
      MaSP: r.masp,
      TenSP: r.tensp,
      GiaBan: parseFloat(r.giaban) || 0,
      HinhAnh: r.hinhanh,
      SoLuong: parseInt(r.soluong, 10) || 1,
      SoLuongTon: parseInt(r.soluongton, 10) || 0,
    }));
  }

  // Thêm sản phẩm vào giỏ (hoặc cộng dồn số lượng nếu đã có)
  static async addItem(maND, maSP, soLuong = 1) {
    await this.ensureCartTable();
    const cleanND = String(maND).trim();
    const cleanSP = String(maSP).trim();
    const qty = Math.max(1, parseInt(soLuong, 10) || 1);

    const spRes = await pool.query(
      `SELECT sp.masp,
              COALESCE((SELECT SUM(soluongton) FROM tonkho WHERE masp = sp.masp), 0)::int AS soluongton
       FROM sanpham sp WHERE sp.masp = $1 LIMIT 1`,
      [cleanSP],
    );
    if (spRes.rows.length === 0) {
      const err = new Error("Sản phẩm không tồn tại trong hệ thống!");
      err.statusCode = 404;
      throw err;
    }

    const stock = spRes.rows[0].soluongton || 0;
    const existingRes = await pool.query(
      "SELECT soluong FROM giohang WHERE mand = $1 AND masp = $2",
      [cleanND, cleanSP],
    );
    const currentQty =
      existingRes.rows.length > 0 ? parseInt(existingRes.rows[0].soluong, 10) : 0;
    const nextQty = currentQty + qty;

    if (stock > 0 && nextQty > stock) {
      const err = new Error(
        `Trong kho chỉ còn tối đa ${stock} sản phẩm (giỏ hàng hiện đã có ${currentQty}).`,
      );
      err.statusCode = 400;
      throw err;
    }

    await pool.query(
      `
      INSERT INTO giohang (mand, masp, soluong, ngaycapnhat)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (mand, masp)
      DO UPDATE SET soluong = giohang.soluong + EXCLUDED.soluong, ngaycapnhat = NOW()
      `,
      [cleanND, cleanSP, qty],
    );

    return this.getCartByUser(cleanND);
  }

  // Cập nhật số lượng 1 sản phẩm trong giỏ (<= 0 sẽ xóa)
  static async updateItemQuantity(maND, maSP, soLuong) {
    await this.ensureCartTable();
    const cleanND = String(maND).trim();
    const cleanSP = String(maSP).trim();
    const qty = parseInt(soLuong, 10);

    if (isNaN(qty) || qty <= 0) {
      await pool.query("DELETE FROM giohang WHERE mand = $1 AND masp = $2", [
        cleanND,
        cleanSP,
      ]);
      return this.getCartByUser(cleanND);
    }

    const stockRes = await pool.query(
      "SELECT COALESCE(SUM(soluongton), 0)::int AS soluongton FROM tonkho WHERE masp = $1",
      [cleanSP],
    );
    const stock = stockRes.rows[0]?.soluongton || 0;
    if (stock > 0 && qty > stock) {
      const err = new Error(
        `Sản phẩm này chỉ còn tối đa ${stock} sản phẩm trong kho.`,
      );
      err.statusCode = 400;
      throw err;
    }

    await pool.query(
      `
      INSERT INTO giohang (mand, masp, soluong, ngaycapnhat)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (mand, masp)
      DO UPDATE SET soluong = EXCLUDED.soluong, ngaycapnhat = NOW()
      `,
      [cleanND, cleanSP, qty],
    );

    return this.getCartByUser(cleanND);
  }

  // Xóa 1 sản phẩm khỏi giỏ hàng
  static async removeItem(maND, maSP) {
    await this.ensureCartTable();
    const cleanND = String(maND).trim();
    const cleanSP = String(maSP).trim();
    await pool.query("DELETE FROM giohang WHERE mand = $1 AND masp = $2", [
      cleanND,
      cleanSP,
    ]);
    return this.getCartByUser(cleanND);
  }

  // Gộp giỏ hàng khách (localStorage) lên DB khi đăng nhập
  static async mergeGuestCart(maND, items = []) {
    await this.ensureCartTable();
    const cleanND = String(maND).trim();
    const list = Array.isArray(items) ? items.slice(0, 50) : [];

    for (const raw of list) {
      const maSP = String(raw?.MaSP || raw?.masp || "").trim();
      const qty = Math.max(1, parseInt(raw?.SoLuong || raw?.soluong, 10) || 1);
      if (!maSP) continue;

      try {
        const spCheck = await pool.query(
          "SELECT masp FROM sanpham WHERE masp = $1 LIMIT 1",
          [maSP],
        );
        if (spCheck.rows.length === 0) continue;

        await pool.query(
          `
          INSERT INTO giohang (mand, masp, soluong, ngaycapnhat)
          VALUES ($1, $2, $3, NOW())
          ON CONFLICT (mand, masp)
          DO UPDATE SET soluong = GREATEST(giohang.soluong, EXCLUDED.soluong), ngaycapnhat = NOW()
          `,
          [cleanND, maSP, qty],
        );
      } catch {
        // Bỏ qua item không hợp lệ khi merge
      }
    }

    return this.getCartByUser(cleanND);
  }
}

module.exports = CartModel;
