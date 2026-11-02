// seed_phase4.js
const { pool } = require("./src/config/database");
const bcrypt = require("bcrypt");

async function seedData() {
  const client = await pool.connect();
  try {
    console.log("🚀 Bắt đầu nạp dữ liệu mẫu cho Phase 4 (Đa chi nhánh & Kho hàng)...");
    await client.query("BEGIN");

    // 1. Vai trò (vaitro)
    await client.query(`
      INSERT INTO vaitro (mavaitro, tenvaitro, mota) VALUES
      ('ADMIN', 'Quản trị viên', 'Toàn quyền quản trị hệ thống'),
      ('MANAGER', 'Quản lý', 'Quản lý cửa hàng và kho hàng'),
      ('STAFF', 'Nhân viên', 'Nhân viên bán hàng và thu ngân')
      ON CONFLICT (mavaitro) DO NOTHING;
    `);

    // 2. Người dùng quản trị (nguoidung)
    const saltRounds = 10;
    const defaultPasswordHash = await bcrypt.hash("123456", saltRounds);

    await client.query(`
      INSERT INTO nguoidung (tendangnhap, matkhauhash, hoten, email, sdt, mavaitro, trangthai) VALUES
      ('admin', $1, 'Quản Trị Viên Hệ Thống', 'admin@hpstore.vn', '0988888888', 'ADMIN', 'HOAT_DONG'),
      ('manager', $1, 'Trần Quản Lý Kho', 'manager@hpstore.vn', '0977777777', 'MANAGER', 'HOAT_DONG'),
      ('nhanvien', $1, 'Nguyễn Văn Nhân Viên', 'staff@hpstore.vn', '0966666666', 'STAFF', 'HOAT_DONG')
      ON CONFLICT (tendangnhap) DO NOTHING;
    `, [defaultPasswordHash]);

    // 3. Chi nhánh (chinhanh)
    await client.query(`
      INSERT INTO chinhanh (machinhanh, tenchinhanh, diachi, trangthai) VALUES
      ('CN_CHINH', 'Chi nhánh Trung Tâm', 'Số 1 Đại Cồ Việt, Hai Bà Trưng, Hà Nội', 'HOAT_DONG'),
      ('CN_1', 'Chi nhánh 1 (TP. Hồ Chí Minh)', 'Số 123 Nguyễn Thị Minh Khai, Quận 1, TP. HCM', 'HOAT_DONG'),
      ('CN_2', 'Chi nhánh 2 (Hà Nội)', 'Số 45 Cầu Giấy, Cầu Giấy, Hà Nội', 'HOAT_DONG')
      ON CONFLICT (machinhanh) DO UPDATE 
      SET tenchinhanh = EXCLUDED.tenchinhanh, diachi = EXCLUDED.diachi;
    `);

    // 4. Kho hàng (khohang)
    await client.query(`
      INSERT INTO khohang (makho, machinhanh, tenkho, loaikho, trangthai) VALUES
      ('KHO_TONG', 'CN_CHINH', 'Kho Tổng Trung Tâm', 'TONG', 'HOAT_DONG'),
      ('KHO_CN1', 'CN_1', 'Kho Chi nhánh 1 (TP. HCM)', 'CHI_NHANH', 'HOAT_DONG'),
      ('KHO_CN2', 'CN_2', 'Kho Chi nhánh 2 (Cầu Giấy)', 'CHI_NHANH', 'HOAT_DONG')
      ON CONFLICT (makho) DO UPDATE 
      SET machinhanh = EXCLUDED.machinhanh, tenkho = EXCLUDED.tenkho;
    `);

    // 5. Nhà cung cấp (nhacungcap)
    await client.query(`
      INSERT INTO nhacungcap (mancc, tenncc, sdt, email, diachi, trangthai) VALUES
      ('NCC01', 'Apple Distribution Asia', '0901234567', 'contact@apple.com', 'Singapore', true),
      ('NCC02', 'Samsung Vina Electronics', '0902345678', 'b2b@samsung.com', 'TP. Hồ Chí Minh', true),
      ('NCC03', 'Sony Electronics Vietnam', '0903456789', 'info@sony.com.vn', 'Hà Nội', true)
      ON CONFLICT (mancc) DO NOTHING;
    `);

    // 6. Danh mục (danhmuc)
    await client.query(`
      INSERT INTO danhmuc (madanhmuc, tendanhmuc, mota) VALUES
      ('DM01', 'Điện thoại thông minh', 'Các dòng smartphone cao cấp và tầm trung'),
      ('DM02', 'Máy tính xách tay (Laptop)', 'Laptop văn phòng, đồ họa, gaming'),
      ('DM03', 'Phụ kiện công nghệ', 'Tai nghe, sạc cáp, pin dự phòng')
      ON CONFLICT (madanhmuc) DO NOTHING;
    `);

    // 7. Sản phẩm (sanpham)
    await client.query(`
      INSERT INTO sanpham (masp, tensp, gianhap, giaban, mota, donvitinh, madanhmuc, mancc, hinhanh) VALUES
      ('SP01', 'iPhone 15 Pro Max 256GB', 25000000, 29990000, 'Titan Tự Nhiên, Chip Apple A17 Pro mạnh mẽ', 'Cái', 'DM01', 'NCC01', 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=500'),
      ('SP02', 'Samsung Galaxy S24 Ultra', 23000000, 27500000, 'Titan Xám, Galaxy AI thông minh thế hệ mới', 'Cái', 'DM01', 'NCC02', 'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=500'),
      ('SP03', 'MacBook Pro 14 M3 512GB', 34000000, 39990000, 'Space Gray, 8-core CPU, 10-core GPU, màn Liquid Retina', 'Máy', 'DM02', 'NCC01', 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=500'),
      ('SP04', 'Tai nghe Sony WH-1000XM5', 6500000, 8490000, 'Chống ồn chủ động cao cấp, thời lượng pin 30h', 'Cái', 'DM03', 'NCC03', 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=500')
      ON CONFLICT (masp) DO UPDATE 
      SET tensp = EXCLUDED.tensp, gianhap = EXCLUDED.gianhap, giaban = EXCLUDED.giaban;
    `);

    // 8. Tồn kho khởi tạo (tonkho)
    await client.query(`
      INSERT INTO tonkho (makho, masp, soluongton, soluongtamgiu) VALUES
      ('KHO_TONG', 'SP01', 50, 0),
      ('KHO_TONG', 'SP02', 40, 0),
      ('KHO_TONG', 'SP03', 20, 0),
      ('KHO_TONG', 'SP04', 80, 0),

      ('KHO_CN1', 'SP01', 15, 0),
      ('KHO_CN1', 'SP02', 10, 0),
      ('KHO_CN1', 'SP03', 5, 0),
      ('KHO_CN1', 'SP04', 25, 0),

      ('KHO_CN2', 'SP01', 10, 0),
      ('KHO_CN2', 'SP02', 8, 0),
      ('KHO_CN2', 'SP03', 4, 0),
      ('KHO_CN2', 'SP04', 20, 0)
      ON CONFLICT (makho, masp) DO UPDATE
      SET soluongton = EXCLUDED.soluongton;
    `);

    // 9. Lịch sử giao dịch kho ban đầu (giaodichkho)
    await client.query(`
      INSERT INTO giaodichkho (magd, masp, makho, loaigd, soluong, tontruoc, tonsau, ngaygd) VALUES
      ('GD_KT_001', 'SP01', 'KHO_TONG', 1, 50, 0, 50, NOW() - INTERVAL '3 day'),
      ('GD_KT_002', 'SP02', 'KHO_TONG', 1, 40, 0, 40, NOW() - INTERVAL '3 day'),
      ('GD_KT_003', 'SP03', 'KHO_TONG', 1, 20, 0, 20, NOW() - INTERVAL '3 day'),
      ('GD_KT_004', 'SP04', 'KHO_TONG', 1, 80, 0, 80, NOW() - INTERVAL '3 day'),

      ('GD_CN1_001', 'SP01', 'KHO_CN1', 1, 15, 0, 15, NOW() - INTERVAL '2 day'),
      ('GD_CN1_002', 'SP02', 'KHO_CN1', 1, 10, 0, 10, NOW() - INTERVAL '2 day'),
      ('GD_CN1_003', 'SP03', 'KHO_CN1', 1, 5, 0, 5, NOW() - INTERVAL '2 day'),
      ('GD_CN1_004', 'SP04', 'KHO_CN1', 1, 25, 0, 25, NOW() - INTERVAL '2 day'),

      ('GD_CN2_001', 'SP01', 'KHO_CN2', 1, 10, 0, 10, NOW() - INTERVAL '1 day'),
      ('GD_CN2_002', 'SP02', 'KHO_CN2', 1, 8, 0, 8, NOW() - INTERVAL '1 day'),
      ('GD_CN2_003', 'SP03', 'KHO_CN2', 1, 4, 0, 4, NOW() - INTERVAL '1 day'),
      ('GD_CN2_004', 'SP04', 'KHO_CN2', 1, 20, 0, 20, NOW() - INTERVAL '1 day')
      ON CONFLICT (magd) DO NOTHING;
    `);

    await client.query("COMMIT");
    console.log("✅ Nạp dữ liệu mẫu Phase 4 THÀNH CÔNG RỰC RỠ!");
    console.log("🔑 Tài khoản mẫu: admin / 123456 (ADMIN) hoặc manager / 123456 (MANAGER)");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Lỗi nạp dữ liệu mẫu:", error);
  } finally {
    client.release();
    process.exit(0);
  }
}

seedData();
