require("dotenv").config();
const { poolPromise } = require("./src/config/database");
const bcrypt = require("bcrypt");

async function createDemoCustomer() {
  const pool = await poolPromise;
  
  // 1. Đảm bảo role CLIENT tồn tại trong vaitro
  await pool.query(`
    INSERT INTO vaitro (mavaitro, tenvaitro, mota)
    VALUES ('CLIENT', 'Khách hàng', 'Tài khoản người dùng mua sắm trực tuyến')
    ON CONFLICT (mavaitro) DO NOTHING;
  `);

  const hash = await bcrypt.hash("123456", 10);
  
  await pool.query(`
    INSERT INTO nguoidung (mand, tendangnhap, matkhauhash, hoten, email, sdt, mavaitro, trangthai, ngaytao)
    VALUES ('c0000000-0000-0000-0000-000000000001', 'khachhang', $1, 'Nguyễn Khách Hàng (Demo)', 'khachhang@gmail.com', '0987654321', 'CLIENT', true, NOW())
    ON CONFLICT (tendangnhap) DO UPDATE SET matkhauhash = EXCLUDED.matkhauhash, trangthai = true, mavaitro = 'CLIENT';
  `, [hash]);

  await pool.query(`
    INSERT INTO khachhang (makh, hoten, sdt, email, diachi, mand, ngaytao, diemtichluy)
    VALUES ('c0000000-0000-0000-0000-000000000001', 'Nguyễn Khách Hàng (Demo)', '0987654321', 'khachhang@gmail.com', 'Số 10 Nguyễn Huệ, Quận 1, TP. HCM', 'c0000000-0000-0000-0000-000000000001', NOW(), 150)
    ON CONFLICT (makh) DO UPDATE SET hoten = EXCLUDED.hoten;
  `);

  console.log("✅ Tài khoản demo và vai trò CLIENT đã được khởi tạo thành công!");
  process.exit(0);
}

createDemoCustomer().catch(err => {
  console.error("Lỗi:", err.message);
  process.exit(1);
});
