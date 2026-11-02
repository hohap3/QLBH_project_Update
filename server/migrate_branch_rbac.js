// server/migrate_branch_rbac.js
require("dotenv").config();
const { poolPromise } = require("./src/config/database");
const bcrypt = require("bcrypt");

async function runMigration() {
  const pool = await poolPromise;
  const client = await pool.connect();

  try {
    console.log("🚀 Bắt đầu migration: Thêm cột machinhanh vào bảng nguoidung...");
    await client.query("BEGIN");

    // 1. Thêm cột machinhanh nếu chưa có
    await client.query(`
      ALTER TABLE nguoidung 
      ADD COLUMN IF NOT EXISTS machinhanh VARCHAR(20) REFERENCES chinhanh(machinhanh);
    `);
    console.log("✅ Đã kiểm tra/thêm cột machinhanh vào bảng nguoidung");

    // 2. Cập nhật tài khoản admin thành Quản lý Tổng (machinhanh = NULL)
    await client.query(`
      UPDATE nguoidung 
      SET machinhanh = NULL, mavaitro = 'ADMIN' 
      WHERE tendangnhap = 'admin';
    `);

    // 3. Tạo / Cập nhật tài khoản Quản lý Chi nhánh 1 và Chi nhánh 2
    const hash = await bcrypt.hash("123456", 10);

    await client.query(`
      INSERT INTO nguoidung (mand, tendangnhap, matkhauhash, hoten, email, sdt, mavaitro, machinhanh, trangthai)
      VALUES 
        ('b1111111-1111-1111-1111-111111111111', 'manager_cn1', $1, 'Nguyễn Văn Quản Lý (CN1)', 'manager.cn1@hpstore.vn', '0911111111', 'MANAGER', 'CN_1', 'HOAT_DONG'),
        ('b2222222-2222-2222-2222-222222222222', 'manager_cn2', $1, 'Trần Thị Quản Lý (CN2)', 'manager.cn2@hpstore.vn', '0922222222', 'MANAGER', 'CN_2', 'HOAT_DONG')
      ON CONFLICT (tendangnhap) DO UPDATE SET
        matkhauhash = EXCLUDED.matkhauhash,
        mavaitro = EXCLUDED.mavaitro,
        machinhanh = EXCLUDED.machinhanh,
        trangthai = 'HOAT_DONG';
    `, [hash]);

    // 4. Gán chi nhánh mẫu cho các nhân viên STAFF
    await client.query(`UPDATE nguoidung SET machinhanh = 'CN_1' WHERE tendangnhap = 'nhanvien' AND machinhanh IS NULL;`);
    await client.query(`UPDATE nguoidung SET machinhanh = 'CN_2' WHERE tendangnhap = 'hang.le' AND machinhanh IS NULL;`);
    await client.query(`UPDATE nguoidung SET machinhanh = 'CN_CHINH' WHERE tendangnhap = 'duc.vu' AND machinhanh IS NULL;`);

    await client.query("COMMIT");

    const users = await client.query(`
      SELECT mand, tendangnhap, hoten, mavaitro, machinhanh 
      FROM nguoidung 
      WHERE tendangnhap IN ('admin', 'manager_cn1', 'manager_cn2', 'nhanvien', 'hang.le', 'duc.vu')
      ORDER BY mavaitro, tendangnhap;
    `);

    console.log("🎉 Migration hoàn tất thành công! Danh sách tài khoản đã chuẩn hóa:");
    console.table(users.rows);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Lỗi migration:", err);
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  runMigration()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { runMigration };
