const { pool } = require("../config/database");

let wishlistTableInitPromise = null;

class WishlistModel {
  // Tự động tạo bảng yeuthich 1 lần duy nhất (khớp VARCHAR(20) của nguoidung & sanpham)
  static async ensureWishlistTable() {
    if (!wishlistTableInitPromise) {
      wishlistTableInitPromise = (async () => {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS yeuthich (
            mand     VARCHAR(20) NOT NULL REFERENCES nguoidung(mand) ON DELETE CASCADE,
            masp     VARCHAR(20) NOT NULL REFERENCES sanpham(masp) ON DELETE CASCADE,
            ngaythem TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
            PRIMARY KEY (mand, masp)
          );
        `);
        await pool.query(`
          CREATE INDEX IF NOT EXISTS idx_yeuthich_mand_ngaythem
            ON yeuthich (mand, ngaythem DESC);
        `);
      })().catch((err) => {
        wishlistTableInitPromise = null;
        throw err;
      });
    }
    return wishlistTableInitPromise;
  }

  // Lấy toàn bộ sản phẩm yêu thích của người dùng (JOIN sanpham để luôn có giá & ảnh mới nhất)
  static async getWishlistByUser(maND) {
    await this.ensureWishlistTable();
    const res = await pool.query(
      `
      SELECT
        sp.*,
        dm.tendanhmuc,
        yt.ngaythem,
        COALESCE((SELECT SUM(soluongton) FROM tonkho WHERE masp = sp.masp), 0) AS soluongton,
        COALESCE((SELECT SUM(soluong) FROM chitiet_donhang WHERE masp = sp.masp), 0)::int AS tongdaban
      FROM yeuthich yt
      JOIN sanpham sp ON yt.masp = sp.masp
      LEFT JOIN danhmuc dm ON sp.madanhmuc = dm.madanhmuc
      WHERE yt.mand = $1
      ORDER BY yt.ngaythem DESC
      `,
      [String(maND).trim()],
    );
    return res.rows;
  }

  // Bật / tắt yêu thích 1 sản phẩm
  static async toggleWishlist(maND, maSP) {
    await this.ensureWishlistTable();
    const cleanND = String(maND).trim();
    const cleanSP = String(maSP).trim();

    const spCheck = await pool.query(
      "SELECT masp FROM sanpham WHERE masp = $1 LIMIT 1",
      [cleanSP],
    );
    if (spCheck.rows.length === 0) {
      const err = new Error("Sản phẩm không tồn tại trong hệ thống!");
      err.statusCode = 404;
      throw err;
    }

    const delRes = await pool.query(
      "DELETE FROM yeuthich WHERE mand = $1 AND masp = $2 RETURNING masp",
      [cleanND, cleanSP],
    );

    let liked = false;
    if (delRes.rows.length === 0) {
      await pool.query(
        "INSERT INTO yeuthich (mand, masp, ngaythem) VALUES ($1, $2, NOW()) ON CONFLICT (mand, masp) DO NOTHING",
        [cleanND, cleanSP],
      );
      liked = true;
    }

    const countRes = await pool.query(
      "SELECT COUNT(*)::int AS total FROM yeuthich WHERE mand = $1",
      [cleanND],
    );

    return {
      liked,
      maSP: cleanSP,
      total: countRes.rows[0]?.total || 0,
    };
  }

  // Gộp danh sách yêu thích từ chế độ khách (localStorage) lên DB khi đăng nhập
  static async mergeGuestWishlist(maND, maSPList = []) {
    await this.ensureWishlistTable();
    const cleanND = String(maND).trim();
    const uniqueIds = [
      ...new Set(
        (Array.isArray(maSPList) ? maSPList : [])
          .map((id) => String(id || "").trim())
          .filter(Boolean),
      ),
    ].slice(0, 50);

    if (uniqueIds.length > 0) {
      await pool.query(
        `
        INSERT INTO yeuthich (mand, masp, ngaythem)
        SELECT $1, sp.masp, NOW()
        FROM sanpham sp
        WHERE sp.masp = ANY($2::varchar[])
        ON CONFLICT (mand, masp) DO NOTHING
        `,
        [cleanND, uniqueIds],
      );
    }

    return this.getWishlistByUser(cleanND);
  }
}

module.exports = WishlistModel;
