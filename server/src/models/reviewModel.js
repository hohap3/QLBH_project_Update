const { pool } = require("../config/database");

let reviewTableInitPromise = null;

class ReviewModel {
  // Tự động tạo bảng danhgia 1 lần duy nhất (khớp VARCHAR(20) của sanpham & nguoidung)
  static async ensureReviewTable() {
    if (!reviewTableInitPromise) {
      reviewTableInitPromise = (async () => {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS danhgia (
            madanhgia     SERIAL PRIMARY KEY,
            masp          VARCHAR(20) NOT NULL REFERENCES sanpham(masp) ON DELETE CASCADE,
            mand          VARCHAR(20) NOT NULL REFERENCES nguoidung(mand) ON DELETE CASCADE,
            tennguoidung  VARCHAR(100),
            sosao         INTEGER NOT NULL CHECK (sosao BETWEEN 1 AND 5),
            noidung       TEXT NOT NULL,
            damuahang     BOOLEAN NOT NULL DEFAULT FALSE,
            phanhoi_admin TEXT,
            ten_admin     VARCHAR(100),
            ngayphanhoi   TIMESTAMP WITHOUT TIME ZONE,
            ngaytao       TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
            UNIQUE (masp, mand)
          );
        `);
        await pool.query(`
          CREATE INDEX IF NOT EXISTS idx_danhgia_masp_ngaytao
            ON danhgia (masp, ngaytao DESC);
        `);
      })().catch((err) => {
        reviewTableInitPromise = null;
        throw err;
      });
    }
    return reviewTableInitPromise;
  }

  // Kiểm tra người dùng đã từng mua sản phẩm này thành công / đã giao chưa (Verified Purchase)
  static async hasPurchasedProduct(maND, maSP) {
    try {
      const res = await pool.query(
        `
        SELECT 1
        FROM donhang dh
        JOIN chitiet_donhang ct ON dh.madonhang = ct.madonhang
        LEFT JOIN khachhang kh ON dh.makh = kh.makh
        WHERE ct.masp = $1
          AND (dh.manguoidung = $2 OR kh.mand = $2)
          AND dh.trangthai IN ('Đã giao', 'Thành công')
        LIMIT 1
        `,
        [String(maSP).trim(), String(maND).trim()],
      );
      return res.rows.length > 0;
    } catch {
      return false;
    }
  }

  // Lấy tên người dùng từ bảng nguoidung
  static async getUserDisplayName(maND) {
    try {
      const res = await pool.query(
        "SELECT hoten, tendangnhap FROM nguoidung WHERE mand = $1 LIMIT 1",
        [String(maND).trim()],
      );
      if (res.rows.length > 0) {
        return res.rows[0].hoten || res.rows[0].tendangnhap || "Thành viên HP STORE";
      }
    } catch {
      // ignore
    }
    return "Thành viên HP STORE";
  }

  // Lấy danh sách đánh giá + thống kê tổng quan 1-5 sao cho 1 sản phẩm
  static async getReviewsByProduct(maSP, { star = null, verifiedOnly = false } = {}) {
    await this.ensureReviewTable();
    const cleanSP = String(maSP).trim();

    const statsRes = await pool.query(
      `
      SELECT
        COUNT(*)::int AS total,
        COALESCE(ROUND(AVG(sosao)::numeric, 1), 0)::float AS avg_rating,
        COUNT(*) FILTER (WHERE sosao = 5)::int AS star_5,
        COUNT(*) FILTER (WHERE sosao = 4)::int AS star_4,
        COUNT(*) FILTER (WHERE sosao = 3)::int AS star_3,
        COUNT(*) FILTER (WHERE sosao = 2)::int AS star_2,
        COUNT(*) FILTER (WHERE sosao = 1)::int AS star_1,
        COUNT(*) FILTER (WHERE damuahang = TRUE)::int AS verified_count
      FROM danhgia
      WHERE masp = $1
      `,
      [cleanSP],
    );

    const conditions = ["masp = $1"];
    const params = [cleanSP];

    if (star && [1, 2, 3, 4, 5].includes(Number(star))) {
      params.push(Number(star));
      conditions.push(`sosao = $${params.length}`);
    }

    if (verifiedOnly) {
      conditions.push("damuahang = TRUE");
    }

    const listRes = await pool.query(
      `
      SELECT
        madanhgia, masp, mand, tennguoidung, sosao, noidung,
        damuahang, phanhoi_admin, ten_admin, ngayphanhoi, ngaytao
      FROM danhgia
      WHERE ${conditions.join(" AND ")}
      ORDER BY damuahang DESC, ngaytao DESC
      LIMIT 100
      `,
      params,
    );

    const stats = statsRes.rows[0] || {
      total: 0,
      avg_rating: 0,
      star_5: 0,
      star_4: 0,
      star_3: 0,
      star_2: 0,
      star_1: 0,
      verified_count: 0,
    };

    return {
      stats,
      reviews: listRes.rows,
    };
  }

  // Tạo mới hoặc cập nhật đánh giá của chính user cho sản phẩm (UNIQUE masp, mand)
  static async upsertReview({ maSP, maND, soSao, noiDung }) {
    await this.ensureReviewTable();
    const cleanSP = String(maSP).trim();
    const cleanND = String(maND).trim();

    const spCheck = await pool.query(
      "SELECT masp FROM sanpham WHERE masp = $1 LIMIT 1",
      [cleanSP],
    );
    if (spCheck.rows.length === 0) {
      const err = new Error("Sản phẩm không tồn tại!");
      err.statusCode = 404;
      throw err;
    }

    const [daMuaHang, tenNguoiDung] = await Promise.all([
      this.hasPurchasedProduct(cleanND, cleanSP),
      this.getUserDisplayName(cleanND),
    ]);

    const res = await pool.query(
      `
      INSERT INTO danhgia (masp, mand, tennguoidung, sosao, noidung, damuahang, ngaytao)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (masp, mand)
      DO UPDATE SET
        tennguoidung = EXCLUDED.tennguoidung,
        sosao = EXCLUDED.sosao,
        noidung = EXCLUDED.noidung,
        damuahang = (danhgia.damuahang OR EXCLUDED.damuahang),
        ngaytao = NOW()
      RETURNING *
      `,
      [cleanSP, cleanND, tenNguoiDung, Number(soSao), String(noiDung).trim(), daMuaHang],
    );

    return res.rows[0];
  }

  // Admin / Manager / Staff phản hồi đánh giá
  static async replyReview({ maDanhGia, adminId, phanHoi }) {
    await this.ensureReviewTable();
    const tenAdmin = await this.getUserDisplayName(adminId);

    const res = await pool.query(
      `
      UPDATE danhgia
      SET phanhoi_admin = $1, ten_admin = $2, ngayphanhoi = NOW()
      WHERE madanhgia = $3
      RETURNING *
      `,
      [String(phanHoi).trim(), tenAdmin, parseInt(maDanhGia, 10)],
    );

    if (res.rows.length === 0) {
      const err = new Error("Không tìm thấy đánh giá này!");
      err.statusCode = 404;
      throw err;
    }
    return res.rows[0];
  }

  // Xóa đánh giá (chính chủ hoặc Admin/Manager/Staff)
  static async deleteReview({ maDanhGia, requesterId, isStaffOrAdmin }) {
    await this.ensureReviewTable();
    const id = parseInt(maDanhGia, 10);

    const check = await pool.query(
      "SELECT madanhgia, mand FROM danhgia WHERE madanhgia = $1",
      [id],
    );
    if (check.rows.length === 0) {
      const err = new Error("Không tìm thấy đánh giá để xóa!");
      err.statusCode = 404;
      throw err;
    }

    if (!isStaffOrAdmin && String(check.rows[0].mand) !== String(requesterId)) {
      const err = new Error("Bạn không có quyền xóa đánh giá của người khác!");
      err.statusCode = 403;
      throw err;
    }

    await pool.query("DELETE FROM danhgia WHERE madanhgia = $1", [id]);
    return true;
  }
}

module.exports = ReviewModel;
