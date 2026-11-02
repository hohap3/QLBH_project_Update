// server/seed_massive_data.js
const { poolPromise } = require("./src/config/database");

async function seedMassiveData() {
  const pool = await poolPromise;
  const client = await pool.connect();

  try {
    console.log("🚀 Bắt đầu quá trình nạp dữ liệu quy mô lớn (Massive Seeding)...");
    await client.query("BEGIN");

    // =========================================================================
    // 1. BỔ SUNG CÁC DANH MỤC SẢN PHẨM MỚI (Categories)
    // =========================================================================
    console.log("📦 1. Nạp danh mục sản phẩm...");
    await client.query(`
      INSERT INTO danhmuc (madanhmuc, tendanhmuc, mota) VALUES
      ('DM01', 'Điện thoại thông minh', 'Các dòng smartphone cao cấp, cận cao cấp và phổ thông'),
      ('DM02', 'Máy tính xách tay (Laptop)', 'Laptop văn phòng, đồ họa chuyên nghiệp và gaming'),
      ('DM03', 'Phụ kiện công nghệ', 'Cáp sạc, pin dự phòng, ốp lưng và phụ kiện tiện ích'),
      ('DM04', 'Đồng hồ thông minh (Smartwatch)', 'Đồng hồ theo dõi sức khỏe, thể thao chuyên nghiệp'),
      ('DM05', 'Máy tính bảng (Tablet)', 'Máy tính bảng phục vụ học tập, giải trí và sáng tạo'),
      ('DM06', 'Thiết bị Âm thanh & Loa', 'Loa Bluetooth, tai nghe chụp tai, loa để bàn cao cấp'),
      ('DM07', 'Thiết bị Gaming & Gear', 'Bàn phím cơ, chuột gaming, tai nghe gaming cao cấp')
      ON CONFLICT (madanhmuc) DO UPDATE SET
        tendanhmuc = EXCLUDED.tendanhmuc,
        mota = EXCLUDED.mota;
    `);

    // =========================================================================
    // 2. BỔ SUNG NHÀ CUNG CẤP MỚI (Suppliers)
    // =========================================================================
    console.log("🏢 2. Nạp nhà cung cấp...");
    await client.query(`
      INSERT INTO nhacungcap (mancc, tenncc, sdt, email, diachi, trangthai) VALUES
      ('NCC01', 'Apple Authorized Distribution', '0281234567', 'contact@apple.com.vn', 'Tầng 12, Bitexco, Q.1, TP. HCM', true),
      ('NCC02', 'Samsung Vina Electronics', '0282345678', 'b2b@samsung.com.vn', 'Số 2 Hải Triều, Q.1, TP. HCM', true),
      ('NCC03', 'Sony Electronics Vietnam', '0283456789', 'sales@sony.com.vn', 'Tòa nhà Landmark 81, Bình Thạnh, TP. HCM', true),
      ('NCC04', 'ASUS Global Vietnam', '0243123987', 'partner@asus.com.vn', 'Tầng 8, Tháp Charmvit, Cầu Giấy, Hà Nội', true),
      ('NCC05', 'Xiaomi Vietnam Official', '0285556667', 'sales@xiaomi.com.vn', 'Tầng 15, Times Square, Q.1, TP. HCM', true),
      ('NCC06', 'JBL & Harman Kardon VN', '0248889990', 'distro@jblharman.vn', 'Tầng 5, Vincom Bà Triệu, Hà Nội', true),
      ('NCC07', 'Dell Technologies Vietnam', '0289991112', 'enterprise@dell.com.vn', 'Số 33 Lê Duẩn, Q.1, TP. HCM', true)
      ON CONFLICT (mancc) DO UPDATE SET
        tenncc = EXCLUDED.tenncc,
        sdt = EXCLUDED.sdt,
        email = EXCLUDED.email,
        diachi = EXCLUDED.diachi;
    `);

    // =========================================================================
    // 3. BỔ SUNG SẢN PHẨM ĐA DẠNG (SP01 -> SP30) VỚI HÌNH ẢNH ĐẸP
    // =========================================================================
    console.log("📱 3. Nạp 30 sản phẩm công nghệ cao cấp...");
    const products = [
      // DM01: Điện thoại thông minh
      { masp: 'SP01', tensp: 'iPhone 15 Pro Max 256GB', gianhap: 25000000, giaban: 29990000, madanhmuc: 'DM01', mancc: 'NCC01', hinhanh: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=500' },
      { masp: 'SP02', tensp: 'Samsung Galaxy S24 Ultra 256GB', gianhap: 23000000, giaban: 27500000, madanhmuc: 'DM01', mancc: 'NCC02', hinhanh: 'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=500' },
      { masp: 'SP07', tensp: 'iPhone 15 128GB Bản Tiêu Chuẩn', gianhap: 16500000, giaban: 19490000, madanhmuc: 'DM01', mancc: 'NCC01', hinhanh: 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=500' },
      { masp: 'SP08', tensp: 'Samsung Galaxy Z Fold 5 512GB', gianhap: 29000000, giaban: 34990000, madanhmuc: 'DM01', mancc: 'NCC02', hinhanh: 'https://images.unsplash.com/photo-1580910051074-3eb694886505?w=500' },
      { masp: 'SP09', tensp: 'Xiaomi 14 Ultra Leica Camera', gianhap: 24000000, giaban: 28990000, madanhmuc: 'DM01', mancc: 'NCC05', hinhanh: 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=500' },
      { masp: 'SP10', tensp: 'Google Pixel 8 Pro 128GB', gianhap: 18000000, giaban: 22490000, madanhmuc: 'DM01', mancc: 'NCC05', hinhanh: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=500' },

      // DM02: Máy tính xách tay (Laptop)
      { masp: 'SP03', tensp: 'MacBook Pro 14 M3 512GB (Space Black)', gianhap: 34000000, giaban: 39990000, madanhmuc: 'DM02', mancc: 'NCC01', hinhanh: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=500' },
      { masp: 'SP12', tensp: 'MacBook Air 13 M2 256GB', gianhap: 21000000, giaban: 24890000, madanhmuc: 'DM02', mancc: 'NCC01', hinhanh: 'https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?w=500' },
      { masp: 'SP13', tensp: 'Dell XPS 13 Plus 9320 Core i7', gianhap: 32000000, giaban: 37900000, madanhmuc: 'DM02', mancc: 'NCC07', hinhanh: 'https://images.unsplash.com/photo-1593642632823-8f785ba67e45?w=500' },
      { masp: 'SP14', tensp: 'ASUS ROG Zephyrus G14 Gaming OLED', gianhap: 36000000, giaban: 42990000, madanhmuc: 'DM02', mancc: 'NCC04', hinhanh: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=500' },
      { masp: 'SP15', tensp: 'Lenovo Legion Pro 5 RTX 4070', gianhap: 33000000, giaban: 38500000, madanhmuc: 'DM02', mancc: 'NCC04', hinhanh: 'https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=500' },
      { masp: 'SP16', tensp: 'Dell Inspiron 14 5430 Core i5', gianhap: 14000000, giaban: 16990000, madanhmuc: 'DM02', mancc: 'NCC07', hinhanh: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=500' },

      // DM04: Đồng hồ thông minh (Smartwatch)
      { masp: 'SP20', tensp: 'Apple Watch Series 9 GPS 45mm', gianhap: 8500000, giaban: 10490000, madanhmuc: 'DM04', mancc: 'NCC01', hinhanh: 'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=500' },
      { masp: 'SP21', tensp: 'Apple Watch Ultra 2 Titanium 49mm', gianhap: 18000000, giaban: 21990000, madanhmuc: 'DM04', mancc: 'NCC01', hinhanh: 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=500' },
      { masp: 'SP22', tensp: 'Samsung Galaxy Watch 6 Classic LTE', gianhap: 6800000, giaban: 8490000, madanhmuc: 'DM04', mancc: 'NCC02', hinhanh: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500' },
      { masp: 'SP23', tensp: 'Garmin Fenix 7 Pro Sapphire Solar', gianhap: 17500000, giaban: 21490000, madanhmuc: 'DM04', mancc: 'NCC03', hinhanh: 'https://images.unsplash.com/photo-1510017803434-a899398421b3?w=500' },

      // DM05: Máy tính bảng (Tablet)
      { masp: 'SP17', tensp: 'iPad Pro 11 M4 Wi-Fi 256GB', gianhap: 24000000, giaban: 28490000, madanhmuc: 'DM05', mancc: 'NCC01', hinhanh: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=500' },
      { masp: 'SP18', tensp: 'iPad Air 5 M1 Wi-Fi 64GB', gianhap: 12500000, giaban: 14990000, madanhmuc: 'DM05', mancc: 'NCC01', hinhanh: 'https://images.unsplash.com/photo-1561154464-82e9adf32764?w=500' },
      { masp: 'SP19', tensp: 'Samsung Galaxy Tab S9 FE Plus', gianhap: 11000000, giaban: 13490000, madanhmuc: 'DM05', mancc: 'NCC02', hinhanh: 'https://images.unsplash.com/photo-1589739900243-4b52cd9b104e?w=500' },

      // DM06: Thiết bị Âm thanh & Loa
      { masp: 'SP04', tensp: 'Tai nghe Chống ồn Sony WH-1000XM5', gianhap: 6500000, giaban: 8490000, madanhmuc: 'DM06', mancc: 'NCC03', hinhanh: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=500' },
      { masp: 'SP06', tensp: 'Tai nghe Apple AirPods Pro 2 Type-C', gianhap: 4600000, giaban: 5790000, madanhmuc: 'DM06', mancc: 'NCC01', hinhanh: 'https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?w=500' },
      { masp: 'SP24', tensp: 'Loa Bluetooth Marshall Stanmore III', gianhap: 8200000, giaban: 9990000, madanhmuc: 'DM06', mancc: 'NCC06', hinhanh: 'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=500' },
      { masp: 'SP25', tensp: 'Loa Di Động Chống Nước JBL Charge 5', gianhap: 2900000, giaban: 3790000, madanhmuc: 'DM06', mancc: 'NCC06', hinhanh: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500' },
      { masp: 'SP29', tensp: 'Tai nghe Bluetooth Marshall Major IV', gianhap: 2800000, giaban: 3690000, madanhmuc: 'DM06', mancc: 'NCC06', hinhanh: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500' },

      // DM07: Thiết bị Gaming & Gear
      { masp: 'SP05', tensp: 'Bàn phím cơ Logitech MX Mechanical', gianhap: 2800000, giaban: 3690000, madanhmuc: 'DM07', mancc: 'NCC03', hinhanh: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=500' },
      { masp: 'SP26', tensp: 'Chuột Không Dây Logitech MX Master 3S', gianhap: 1800000, giaban: 2390000, madanhmuc: 'DM07', mancc: 'NCC03', hinhanh: 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=500' },
      { masp: 'SP30', tensp: 'Bàn phím cơ Keychron K2 Pro QMK/VIA', gianhap: 1900000, giaban: 2490000, madanhmuc: 'DM07', mancc: 'NCC04', hinhanh: 'https://images.unsplash.com/photo-1595225476474-87563907a212?w=500' },

      // DM03: Phụ kiện công nghệ
      { masp: 'SP27', tensp: 'Củ sạc nhanh Anker 735 GaNPrime 65W', gianhap: 750000, giaban: 1090000, madanhmuc: 'DM03', mancc: 'NCC05', hinhanh: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=500' },
      { masp: 'SP28', tensp: 'Pin sạc dự phòng Baseus Blade 100W 20000mAh', gianhap: 950000, giaban: 1390000, madanhmuc: 'DM03', mancc: 'NCC05', hinhanh: 'https://images.unsplash.com/photo-1609592424855-827c1969a5a3?w=500' },
    ];

    for (const p of products) {
      await client.query(`
        INSERT INTO sanpham (masp, tensp, gianhap, giaban, madanhmuc, mancc, donvitinh, hinhanh)
        VALUES ($1, $2, $3, $4, $5, $6, 'Cái', $7)
        ON CONFLICT (masp) DO UPDATE SET
          tensp = EXCLUDED.tensp,
          gianhap = EXCLUDED.gianhap,
          giaban = EXCLUDED.giaban,
          madanhmuc = EXCLUDED.madanhmuc,
          mancc = EXCLUDED.mancc,
          hinhanh = EXCLUDED.hinhanh;
      `, [p.masp, p.tensp, p.gianhap, p.giaban, p.madanhmuc, p.mancc, p.hinhanh]);
    }

    // =========================================================================
    // 4. PHÂN BỔ TỒN KHO CẢ 3 KHO (KHO_TONG, KHO_CN1, KHO_CN2)
    // Đảm bảo đủ các tiêu chí: Sắp hết (<=5), Tồn cao (>=50), An toàn (6-49), Bán chậm
    // =========================================================================
    console.log("🏭 4. Nạp tồn kho chiến lược cho 3 kho...");
    const warehouseStocks = [
      // KHO TỔNG (KHO_TONG)
      { makho: 'KHO_TONG', masp: 'SP01', soluongton: 65 },  // Tồn cao
      { makho: 'KHO_TONG', masp: 'SP02', soluongton: 35 },  // An toàn
      { makho: 'KHO_TONG', masp: 'SP03', soluongton: 4 },   // Sắp hết
      { makho: 'KHO_TONG', masp: 'SP04', soluongton: 28 },  // An toàn
      { makho: 'KHO_TONG', masp: 'SP05', soluongton: 19 },  // Bán chậm
      { makho: 'KHO_TONG', masp: 'SP06', soluongton: 45 },  // An toàn
      { makho: 'KHO_TONG', masp: 'SP07', soluongton: 80 },  // Tồn cao
      { makho: 'KHO_TONG', masp: 'SP08', soluongton: 3 },   // Sắp hết
      { makho: 'KHO_TONG', masp: 'SP09', soluongton: 22 },  // An toàn
      { makho: 'KHO_TONG', masp: 'SP10', soluongton: 15 },  // Bán chậm
      { makho: 'KHO_TONG', masp: 'SP12', soluongton: 55 },  // Tồn cao
      { makho: 'KHO_TONG', masp: 'SP13', soluongton: 14 },  // An toàn
      { makho: 'KHO_TONG', masp: 'SP14', soluongton: 12 },  // An toàn
      { makho: 'KHO_TONG', masp: 'SP15', soluongton: 16 },  // Bán chậm
      { makho: 'KHO_TONG', masp: 'SP17', soluongton: 25 },  // An toàn
      { makho: 'KHO_TONG', masp: 'SP18', soluongton: 30 },  // An toàn
      { makho: 'KHO_TONG', masp: 'SP20', soluongton: 40 },  // An toàn
      { makho: 'KHO_TONG', masp: 'SP21', soluongton: 5 },   // Sắp hết
      { makho: 'KHO_TONG', masp: 'SP24', soluongton: 8 },   // An toàn
      { makho: 'KHO_TONG', masp: 'SP25', soluongton: 50 },  // Tồn cao
      { makho: 'KHO_TONG', masp: 'SP26', soluongton: 60 },  // Tồn cao
      { makho: 'KHO_TONG', masp: 'SP27', soluongton: 120 }, // Tồn cao
      { makho: 'KHO_TONG', masp: 'SP28', soluongton: 90 },  // Tồn cao
      { makho: 'KHO_TONG', masp: 'SP30', soluongton: 35 },  // An toàn

      // KHO CHI NHÁNH 1 - TP. HCM (KHO_CN1)
      { makho: 'KHO_CN1', masp: 'SP01', soluongton: 24 },
      { makho: 'KHO_CN1', masp: 'SP02', soluongton: 18 },
      { makho: 'KHO_CN1', masp: 'SP03', soluongton: 2 },   // Sắp hết tại CN1
      { makho: 'KHO_CN1', masp: 'SP04', soluongton: 15 },
      { makho: 'KHO_CN1', masp: 'SP06', soluongton: 52 },  // Tồn cao tại CN1
      { makho: 'KHO_CN1', masp: 'SP07', soluongton: 30 },
      { makho: 'KHO_CN1', masp: 'SP08', soluongton: 5 },   // Sắp hết tại CN1
      { makho: 'KHO_CN1', masp: 'SP12', soluongton: 16 },
      { makho: 'KHO_CN1', masp: 'SP14', soluongton: 8 },
      { makho: 'KHO_CN1', masp: 'SP17', soluongton: 14 },
      { makho: 'KHO_CN1', masp: 'SP20', soluongton: 22 },
      { makho: 'KHO_CN1', masp: 'SP21', soluongton: 3 },   // Sắp hết tại CN1
      { makho: 'KHO_CN1', masp: 'SP25', soluongton: 20 },
      { makho: 'KHO_CN1', masp: 'SP26', soluongton: 25 },
      { makho: 'KHO_CN1', masp: 'SP27', soluongton: 65 },  // Tồn cao tại CN1
      { makho: 'KHO_CN1', masp: 'SP28', soluongton: 55 },  // Tồn cao tại CN1
      { makho: 'KHO_CN1', masp: 'SP30', soluongton: 12 },

      // KHO CHI NHÁNH 2 - HÀ NỘI (KHO_CN2)
      { makho: 'KHO_CN2', masp: 'SP01', soluongton: 18 },
      { makho: 'KHO_CN2', masp: 'SP02', soluongton: 20 },
      { makho: 'KHO_CN2', masp: 'SP03', soluongton: 3 },   // Sắp hết tại CN2
      { makho: 'KHO_CN2', masp: 'SP04', soluongton: 14 },
      { makho: 'KHO_CN2', masp: 'SP06', soluongton: 28 },
      { makho: 'KHO_CN2', masp: 'SP07', soluongton: 25 },
      { makho: 'KHO_CN2', masp: 'SP09', soluongton: 12 },
      { makho: 'KHO_CN2', masp: 'SP12', soluongton: 14 },
      { makho: 'KHO_CN2', masp: 'SP13', soluongton: 10 },
      { makho: 'KHO_CN2', masp: 'SP17', soluongton: 11 },
      { makho: 'KHO_CN2', masp: 'SP20', soluongton: 18 },
      { makho: 'KHO_CN2', masp: 'SP22', soluongton: 4 },   // Sắp hết tại CN2
      { makho: 'KHO_CN2', masp: 'SP24', soluongton: 5 },   // Sắp hết tại CN2
      { makho: 'KHO_CN2', masp: 'SP26', soluongton: 55 },  // Tồn cao tại CN2
      { makho: 'KHO_CN2', masp: 'SP27', soluongton: 70 },  // Tồn cao tại CN2
      { makho: 'KHO_CN2', masp: 'SP30', soluongton: 15 },
    ];

    for (const ws of warehouseStocks) {
      await client.query(`
        INSERT INTO tonkho (makho, masp, soluongton, soluongtamgiu, ngaycapnhat)
        VALUES ($1, $2, $3, 0, NOW())
        ON CONFLICT (makho, masp) DO UPDATE SET
          soluongton = EXCLUDED.soluongton,
          soluongtamgiu = 0,
          ngaycapnhat = NOW();
      `, [ws.makho, ws.masp, ws.soluongton]);
    }

    // =========================================================================
    // 5. NẠP KHÁCH HÀNG MẪU (25 KHÁCH HÀNG: VIP, THÂN THIẾT, KHÁCH MỚI)
    // =========================================================================
    console.log("👥 5. Nạp danh sách 25 khách hàng chất lượng...");
    const customers = [
      // 4 Khách hàng hiện hữu trong hệ thống (Đồng bộ ID và SĐT chính xác)
      { makh: 'a1111111-1111-1111-1111-111111111111', hoten: 'Lê Hoàng Khôi (VIP)', sdt: '0912345678', email: 'khoi.le@gmail.com', diachi: '123 Hai Bà Trưng, Quận 1, TP. HCM', diemtichluy: 350 },
      { makh: 'a2222222-2222-2222-2222-222222222222', hoten: 'Phạm Thị Mai (Thân thiết)', sdt: '0923456789', email: 'mai.pham@gmail.com', diachi: '45 Cầu Giấy, Cầu Giấy, Hà Nội', diemtichluy: 140 },
      { makh: 'a3333333-3333-3333-3333-333333333333', hoten: 'Trần Anh Tuấn (Khách mới)', sdt: '0934567890', email: 'tuan.tran@gmail.com', diachi: '88 Xã Đàn, Đống Đa, Hà Nội', diemtichluy: 30 },
      { makh: 'a4444444-4444-4444-4444-444444444444', hoten: 'Đỗ Minh Châu (Khách mới)', sdt: '0945678901', email: 'chau.do@gmail.com', diachi: '15 Lê Lợi, Quận Hải Châu, Đà Nẵng', diemtichluy: 20 },

      // Bổ sung Khách VIP mới
      { makh: 'c1111111-1111-1111-1111-222222222222', hoten: 'Hoàng Minh Thắng (VIP)', sdt: '0981112233', email: 'thang.hoang@techcorp.vn', diachi: '88 Láng Hạ, Đống Đa, Hà Nội', diemtichluy: 420 },
      { makh: 'c1111111-1111-1111-1111-333333333333', hoten: 'Vũ Ngọc Diệp (VIP)', sdt: '0981223344', email: 'diep.vu@investvn.com', diachi: 'Villa 12 Chateau, Phú Mỹ Hưng, Q.7, TP. HCM', diemtichluy: 280 },
      { makh: 'c1111111-1111-1111-1111-444444444444', hoten: 'Đặng Quốc Tuấn (VIP)', sdt: '0981334455', email: 'tuan.dang@innovate.vn', diachi: 'Tòa Landmark Plus, Bình Thạnh, TP. HCM', diemtichluy: 310 },
      { makh: 'c1111111-1111-1111-1111-555555555555', hoten: 'Trịnh Lan Anh (VIP)', sdt: '0981445566', email: 'lananh.trinh@capital.vn', diachi: '24 Tràng Tiền, Hoàn Kiếm, Hà Nội', diemtichluy: 260 },

      // Bổ sung Khách Thân thiết mới
      { makh: 'c2222222-2222-2222-2222-222222222222', hoten: 'Nguyễn Thị Thu Hà (Thân thiết)', sdt: '0982111222', email: 'thuha.nguyen@fpt.com.vn', diachi: 'Số 10 Quang Trung, Gò Vấp, TP. HCM', diemtichluy: 165 },
      { makh: 'c2222222-2222-2222-2222-333333333333', hoten: 'Bùi Công Minh (Thân thiết)', sdt: '0982222333', email: 'minh.bui@viettel.com.vn', diachi: '15 Trần Phú, Ba Đình, Hà Nội', diemtichluy: 120 },
      { makh: 'c2222222-2222-2222-2222-444444444444', hoten: 'Lưu Đức Trọng (Thân thiết)', sdt: '0982333444', email: 'trong.luu@gmail.com', diachi: '102 Nguyễn Văn Cừ, Long Biên, Hà Nội', diemtichluy: 110 },
      { makh: 'c2222222-2222-2222-2222-555555555555', hoten: 'Hoàng Thị Bích (Thân thiết)', sdt: '0982444555', email: 'bich.hoang@vnu.edu.vn', diachi: '78 Xuân Thủy, Cầu Giấy, Hà Nội', diemtichluy: 95 },
      { makh: 'c2222222-2222-2222-2222-666666666666', hoten: 'Phan Quốc Bảo (Thân thiết)', sdt: '0982555666', email: 'bao.phan@hcmut.edu.vn', diachi: '268 Lý Thường Kiệt, Q.10, TP. HCM', diemtichluy: 85 },
      { makh: 'c2222222-2222-2222-2222-777777777777', hoten: 'Ngô Thanh Vân (Thân thiết)', sdt: '0982666777', email: 'van.ngo@agency.vn', diachi: '54 Pasteur, Bến Nghé, Q.1, TP. HCM', diemtichluy: 130 },

      // Bổ sung Khách Mới khác
      { makh: 'c3333333-3333-3333-3333-333333333333', hoten: 'Đinh Văn Lâm (Khách mới)', sdt: '0983123456', email: 'lam.dinh@gmail.com', diachi: '22 Võ Văn Ngân, Thủ Đức, TP. HCM', diemtichluy: 40 },
      { makh: 'c3333333-3333-3333-3333-444444444444', hoten: 'Cao Thanh Tùng (Khách mới)', sdt: '0983234567', email: 'tung.cao@outlook.com', diachi: '30 Đại lộ Hòa Bình, Ninh Kiều, Cần Thơ', diemtichluy: 15 },
      { makh: 'c3333333-3333-3333-3333-555555555555', hoten: 'Phan Mỹ Linh (Khách mới)', sdt: '0983345678', email: 'linh.phan@vng.com.vn', diachi: 'Khu Công Nghệ Cao, TP. Thủ Đức, TP. HCM', diemtichluy: 25 },
      { makh: 'c3333333-3333-3333-3333-666666666666', hoten: 'Tô Vĩnh Diện (Khách mới)', sdt: '0983456789', email: 'dien.to@gmail.com', diachi: '9 Bạch Đằng, Quận Hồng Bàng, Hải Phòng', diemtichluy: 10 },
      { makh: 'c3333333-3333-3333-3333-777777777777', hoten: 'Lý Nhã Phương (Khách mới)', sdt: '0983567890', email: 'phuong.ly@yahoo.com', diachi: '66 Hoàng Diệu, Quận 4, TP. HCM', diemtichluy: 35 },
      { makh: 'c3333333-3333-3333-3333-888888888888', hoten: 'Dương Kiến Quốc (Khách mới)', sdt: '0983678901', email: 'quoc.duong@gmail.com', diachi: '112 Trần Hưng Đạo, Hoàn Kiếm, Hà Nội', diemtichluy: 15 },
      { makh: 'c3333333-3333-3333-3333-999999999999', hoten: 'Hà Thị Bích Ngọc (Khách mới)', sdt: '0983789012', email: 'ngoc.ha@gmail.com', diachi: '43 Nguyễn Thị Thập, Quận 7, TP. HCM', diemtichluy: 20 },
      { makh: 'c4444444-4444-4444-4444-111111111111', hoten: 'Thái Bá Hưng (Khách mới)', sdt: '0984890123', email: 'hung.thai@gmail.com', diachi: '17 Bà Triệu, TP. Huế', diemtichluy: 0 },
      { makh: 'c4444444-4444-4444-4444-222222222222', hoten: 'Vương Đình Trí (Khách mới)', sdt: '0984901234', email: 'tri.vuong@gmail.com', diachi: '88 Trần Phú, Nha Trang, Khánh Hòa', diemtichluy: 0 },
      { makh: 'c4444444-4444-4444-4444-333333333333', hoten: 'Lâm Hải Yến (Khách mới)', sdt: '0984012345', email: 'yen.lam@gmail.com', diachi: '12 Nguyễn Huệ, TP. Quy Nhơn', diemtichluy: 0 },
      { makh: 'c4444444-4444-4444-4444-444444444444', hoten: 'Tống Khánh Linh (Khách mới)', sdt: '0984123456', email: 'linh.tong@gmail.com', diachi: '5 Lê Hồng Phong, TP. Vũng Tàu', diemtichluy: 0 }
    ];

    for (const c of customers) {
      await client.query(`
        INSERT INTO khachhang (makh, hoten, sdt, email, diachi, diemtichluy, ngaytao)
        VALUES ($1, $2, $3, $4, $5, $6, NOW() - INTERVAL '90 day')
        ON CONFLICT (makh) DO UPDATE SET
          hoten = EXCLUDED.hoten,
          sdt = EXCLUDED.sdt,
          email = EXCLUDED.email,
          diachi = EXCLUDED.diachi,
          diemtichluy = EXCLUDED.diemtichluy;
      `, [c.makh, c.hoten, c.sdt, c.email, c.diachi, c.diemtichluy]);
    }

    // =========================================================================
    // 6. NẠP ĐƠN HÀNG MẪU ĐỒNG ĐỀU (80+ ĐƠN HÀNG TRẢI DÀI TỪ T5 -> T10 NĂM 2026)
    // Phân bổ đều cho cả 3 kho / chi nhánh
    // =========================================================================
    console.log("🛒 6. Nạp 90 đơn hàng và chi tiết đơn hàng mẫu...");

    // Helper tạo danh sách đơn hàng
    const orderTemplates = [];
    let orderIndex = 1;

    // Phân bổ tháng: T5, T6, T7, T8, T9, T10 (năm 2026)
    const months = [
      { m: '05', intervalDays: [155, 150, 145, 140, 138, 135, 132, 130] }, // Tháng 5: ~8 đơn
      { m: '06', intervalDays: [125, 120, 118, 115, 112, 110, 108, 105, 102, 100] }, // Tháng 6: ~10 đơn
      { m: '07', intervalDays: [95, 92, 90, 88, 85, 82, 80, 78, 76, 74, 72, 70] }, // Tháng 7: ~12 đơn
      { m: '08', intervalDays: [68, 65, 63, 61, 59, 57, 55, 53, 51, 49, 47, 45, 43, 41] }, // Tháng 8: ~14 đơn
      { m: '09', intervalDays: [39, 37, 35, 33, 31, 29, 27, 25, 23, 21, 19, 17, 16, 15, 14, 13] }, // Tháng 9: ~16 đơn
      { m: '10', intervalDays: [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0] }, // Tháng 10: ~26 đơn (nhiều đơn tháng này)
    ];

    const branchConfigs = [
      { makho: 'KHO_TONG', machinhanh: 'CN_CHINH' },
      { makho: 'KHO_CN1', machinhanh: 'CN_1' },
      { makho: 'KHO_CN2', machinhanh: 'CN_2' },
    ];

    const productPool = [
      { masp: 'SP01', giaban: 29990000 },
      { masp: 'SP02', giaban: 27500000 },
      { masp: 'SP03', giaban: 39990000 },
      { masp: 'SP04', giaban: 8490000 },
      { masp: 'SP06', giaban: 5790000 },
      { masp: 'SP07', giaban: 19490000 },
      { masp: 'SP08', giaban: 34990000 },
      { masp: 'SP12', giaban: 24890000 },
      { masp: 'SP13', giaban: 37900000 },
      { masp: 'SP14', giaban: 42990000 },
      { masp: 'SP17', giaban: 28490000 },
      { masp: 'SP18', giaban: 14990000 },
      { masp: 'SP20', giaban: 10490000 },
      { masp: 'SP21', giaban: 21990000 },
      { masp: 'SP25', giaban: 3790000 },
      { masp: 'SP26', giaban: 2390000 },
      { masp: 'SP27', giaban: 1090000 },
      { masp: 'SP28', giaban: 1390000 },
      { masp: 'SP30', giaban: 2490000 }
    ];

    for (const mObj of months) {
      for (let i = 0; i < mObj.intervalDays.length; i++) {
        const daysAgo = mObj.intervalDays[i];
        const br = branchConfigs[(orderIndex + i) % branchConfigs.length];
        const cust = customers[(orderIndex * 3 + i) % customers.length];

        // Chọn 1-2 sản phẩm
        const p1 = productPool[(orderIndex * 2 + i) % productPool.length];
        const p2 = (orderIndex % 3 === 0) ? productPool[(orderIndex * 5 + i + 1) % productPool.length] : null;

        const items = [{ masp: p1.masp, soluong: 1, giaban: p1.giaban }];
        let total = p1.giaban;
        if (p2 && p2.masp !== p1.masp) {
          items.push({ masp: p2.masp, soluong: 1, giaban: p2.giaban });
          total += p2.giaban;
        }

        // Tỷ lệ trạng thái: 90% Thành công, vài đơn Chờ xử lý / Đang giao / Đã hủy
        let status = "Thành công";
        if (daysAgo <= 2 && orderIndex % 4 === 0) status = "Chờ xử lý";
        else if (daysAgo <= 3 && orderIndex % 7 === 0) status = "Đang giao";
        else if (orderIndex % 15 === 0) status = "Đã hủy";

        orderTemplates.push({
          madonhang: `DH_2026${mObj.m}_${String(orderIndex).padStart(3, '0')}`,
          makh: cust.makh,
          makho: br.makho,
          machinhanh: br.machinhanh,
          ngaydatSql: `NOW() - INTERVAL '${daysAgo} day' - INTERVAL '${(i * 37) % 1440} minute'`,
          trangthai: status,
          tongtien: total,
          ghichu: `Đơn hàng tự động nạp tháng ${mObj.m}`,
          items: items
        });

        orderIndex++;
      }
    }

    // Thực hiện chèn từng đơn hàng vào database
    for (const od of orderTemplates) {
      await client.query(`
        INSERT INTO donhang (madonhang, makh, makho, machinhanh, ngaydat, trangthai, tongtien, ghichu)
        VALUES ($1, $2, $3, $4, ${od.ngaydatSql}, $5, $6, $7)
        ON CONFLICT (madonhang) DO UPDATE SET
          makh = EXCLUDED.makh,
          makho = EXCLUDED.makho,
          machinhanh = EXCLUDED.machinhanh,
          ngaydat = ${od.ngaydatSql},
          trangthai = EXCLUDED.trangthai,
          tongtien = EXCLUDED.tongtien,
          ghichu = EXCLUDED.ghichu;
      `, [od.madonhang, od.makh, od.makho, od.machinhanh, od.trangthai, od.tongtien, od.ghichu]);

      // Chi tiết đơn hàng
      for (const it of od.items) {
        await client.query(`
          INSERT INTO chitiet_donhang (madonhang, masp, soluong, giaban, giamgia)
          VALUES ($1, $2, $3, $4, 0)
          ON CONFLICT (madonhang, masp) DO UPDATE SET
            soluong = EXCLUDED.soluong,
            giaban = EXCLUDED.giaban;
        `, [od.madonhang, it.masp, it.soluong, it.giaban]);
      }

      // Thanh toán
      const maThanhToan = "TT_" + od.madonhang;
      const phuongThuc = (orderIndex % 2 === 0) ? 'Chuyển khoản' : (orderIndex % 3 === 0 ? 'VNPAY' : 'COD');
      const ttStatus = od.trangthai === 'Đã hủy' ? 'Thất bại' : 'Thành công';

      await client.query(`
        INSERT INTO thanhtoan (mathanhtoan, madonhang, ngaythanhtoan, sotien, phuongthuc, trangthai)
        VALUES ($1, $2, ${od.ngaydatSql}, $3, $4, $5)
        ON CONFLICT (mathanhtoan) DO UPDATE SET
          sotien = EXCLUDED.sotien,
          ngaythanhtoan = ${od.ngaydatSql},
          phuongthuc = EXCLUDED.phuongthuc,
          trangthai = EXCLUDED.trangthai;
      `, [maThanhToan, od.madonhang, od.tongtien, phuongThuc, ttStatus]);

      // Phiếu giao hàng
      const maGiaoHang = "GH_" + od.madonhang;
      const ghStatus = od.trangthai === 'Thành công' ? 'Đã giao hàng' : (od.trangthai === 'Đã hủy' ? 'Đã hủy' : 'Đang xử lý');
      await client.query(`
        INSERT INTO phieugiaohang (magiaohang, madonhang, diachi, ngaygiao, trangthai, nguoinhan, sdtnguoinhan)
        VALUES ($1, $2, 'Địa chỉ giao hàng chuẩn', ${od.ngaydatSql}, $3, 'Khách hàng HP STORE', '0912345678')
        ON CONFLICT (magiaohang) DO UPDATE SET
          ngaygiao = ${od.ngaydatSql},
          trangthai = EXCLUDED.trangthai;
      `, [maGiaoHang, od.madonhang, ghStatus]);
    }

    // =========================================================================
    // 7. BỔ SUNG LỊCH SỬ GIAO DỊCH KHO (Inventory Movements)
    // =========================================================================
    console.log("📋 7. Ghi nhận giao dịch nhập kho ban đầu...");
    for (const ws of warehouseStocks) {
      const magd = `GD_${ws.makho}_${ws.masp}`;
      await client.query(`
        INSERT INTO giaodichkho (magd, masp, makho, loaigd, soluong, tontruoc, tonsau, ngaygd)
        VALUES ($1, $2, $3, 1, $4, 0, $4, NOW() - INTERVAL '60 day')
        ON CONFLICT (magd) DO NOTHING;
      `, [magd, ws.masp, ws.makho, ws.soluongton]);
    }

    await client.query("COMMIT");
    console.log("🎉 ĐÃ HOÀN TẤT NẠP DỮ LIỆU KHỦNG (MASSIVE SEEDING) THÀNH CÔNG RỰC RỠ!");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Lỗi trong quá trình nạp dữ liệu:", error);
    throw error;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  seedMassiveData()
    .then(() => {
      console.log("✅ Kết thúc kịch bản nạp dữ liệu!");
      process.exit(0);
    })
    .catch((err) => {
      console.error("💥 Thất bại:", err);
      process.exit(1);
    });
}

module.exports = { seedMassiveData };
