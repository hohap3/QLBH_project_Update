// server/seed_orders_customers.js
const { poolPromise } = require("./src/config/database");

async function seedOrdersAndCustomers() {
  const pool = await poolPromise;
  const client = await pool.connect();

  try {
    console.log("🚀 Bắt đầu nạp dữ liệu khách hàng, sản phẩm và đơn hàng đa dạng...");
    await client.query("BEGIN");

    // 1. Đảm bảo danh mục và nhà cung cấp tồn tại
    await client.query(`
      INSERT INTO danhmuc (madanhmuc, tendanhmuc) VALUES
      ('DM01', 'Điện thoại thông minh'),
      ('DM02', 'Máy tính xách tay (Laptop)'),
      ('DM03', 'Phụ kiện công nghệ')
      ON CONFLICT (madanhmuc) DO NOTHING;

      INSERT INTO nhacungcap (mancc, tenncc, sdt, email) VALUES
      ('NCC01', 'Apple Authorized Reseller', '0281234567', 'contact@apple.vn'),
      ('NCC02', 'Samsung Vina Electronics', '0282345678', 'b2b@samsung.vn'),
      ('NCC03', 'Sony Electronics VN', '0283456789', 'sales@sony.vn')
      ON CONFLICT (mancc) DO NOTHING;
    `);

    // 2. Đảm bảo sản phẩm SP01 -> SP05 tồn tại
    await client.query(`
      INSERT INTO sanpham (masp, tensp, gianhap, giaban, donvitinh, madanhmuc, mancc) VALUES
      ('SP01', 'iPhone 15 Pro Max 256GB', 25000000, 29990000, 'Cái', 'DM01', 'NCC01'),
      ('SP02', 'Samsung Galaxy S24 Ultra', 23000000, 27500000, 'Cái', 'DM01', 'NCC02'),
      ('SP03', 'MacBook Pro 14 M3 512GB', 34000000, 39990000, 'Cái', 'DM02', 'NCC01'),
      ('SP04', 'Tai nghe Sony WH-1000XM5', 6500000, 8490000, 'Cái', 'DM03', 'NCC03'),
      ('SP05', 'Bàn phím cơ Logitech MX Mechanical', 2800000, 3690000, 'Cái', 'DM03', 'NCC03')
      ON CONFLICT (masp) DO UPDATE SET
        tensp = EXCLUDED.tensp,
        gianhap = EXCLUDED.gianhap,
        giaban = EXCLUDED.giaban;
    `);

    // 3. Thiết lập Tồn kho chuẩn hóa đa dạng mức tồn: Sắp hết (<=5), An toàn (6-49), Tồn cao (>=50)
    await client.query(`
      INSERT INTO tonkho (makho, masp, soluongton, soluongtamgiu) VALUES
      ('KHO_TONG', 'SP01', 55, 0), -- Tồn cao (>= 50)
      ('KHO_TONG', 'SP02', 25, 0), -- An toàn (6 - 49)
      ('KHO_TONG', 'SP03', 3, 0),  -- Sắp hết (<= 5)
      ('KHO_TONG', 'SP04', 30, 0), -- An toàn (6 - 49)
      ('KHO_TONG', 'SP05', 18, 0)  -- Bán chậm (tồn 18 > 10, không bán 30 ngày)
      ON CONFLICT (makho, masp) DO UPDATE SET
        soluongton = EXCLUDED.soluongton,
        soluongtamgiu = 0,
        ngaycapnhat = NOW();

      -- Đảm bảo SP03 các kho khác không làm đội tổng tồn vượt quá 5
      UPDATE tonkho SET soluongton = 0 WHERE masp = 'SP03' AND makho != 'KHO_TONG';
    `);
    console.log("✅ Đã chuẩn hóa tồn kho các mức: Sắp hết (SP03), Bán chậm (SP05), Tồn cao (SP01).");

    // 4. Dọn dẹp ràng buộc Unique nếu có dữ liệu trùng lặp trước đó
    await client.query(`
      DELETE FROM khachhang 
      WHERE email IN ('khoi.le@gmail.com', 'mai.pham@gmail.com', 'tuan.tran@gmail.com', 'chau.do@gmail.com') 
        AND makh NOT IN (
          'a1111111-1111-1111-1111-111111111111', 
          'a2222222-2222-2222-2222-222222222222', 
          'a3333333-3333-3333-3333-333333333333',
          'a4444444-4444-4444-4444-444444444444'
        );
    `);

    // 5. Thêm 4 khách hàng mẫu đại diện cho 3 phân khúc: VIP, Thân thiết, Khách mới
    await client.query(`
      INSERT INTO khachhang (makh, hoten, sdt, email, diachi, diemtichluy, ngaytao) VALUES
      -- KH 1: VIP (Chi tiêu cao > 50M, điểm tích lũy 320)
      ('a1111111-1111-1111-1111-111111111111', 'Lê Hoàng Khôi (VIP)', '0912345678', 'khoi.le@gmail.com', '123 Hai Bà Trưng, Quận 1, TP. HCM', 320, NOW() - INTERVAL '60 day'),
      -- KH 2: Thân thiết (2 đơn hàng, chi tiêu 38M, điểm tích lũy 120)
      ('a2222222-2222-2222-2222-222222222222', 'Phạm Thị Mai (Thân thiết)', '0923456789', 'mai.pham@gmail.com', '45 Cầu Giấy, Cầu Giấy, Hà Nội', 120, NOW() - INTERVAL '40 day'),
      -- KH 3: Khách mới (1 đơn hàng, điểm tích lũy 30)
      ('a3333333-3333-3333-3333-333333333333', 'Trần Anh Tuấn (Khách mới)', '0934567890', 'tuan.tran@gmail.com', '88 Xã Đàn, Đống Đa, Hà Nội', 30, NOW() - INTERVAL '10 day'),
      -- KH 4: Khách mới tiềm năng (Chưa có đơn hàng nào)
      ('a4444444-4444-4444-4444-444444444444', 'Đỗ Minh Châu (Khách mới)', '0945678901', 'chau.do@gmail.com', '15 Lê Lợi, Quận Hải Châu, Đà Nẵng', 0, NOW() - INTERVAL '2 day')
      ON CONFLICT (makh) DO UPDATE SET
        hoten = EXCLUDED.hoten,
        sdt = EXCLUDED.sdt,
        email = EXCLUDED.email,
        diachi = EXCLUDED.diachi,
        diemtichluy = EXCLUDED.diemtichluy,
        ngaytao = EXCLUDED.ngaytao;
    `);
    console.log("✅ Đã nạp 4 khách hàng mẫu (1 VIP, 1 Thân thiết, 2 Khách mới).");

    // 6. Danh sách đơn hàng mẫu trải dài các tháng
    const orders = [
      // ĐƠN THÁNG HIỆN TẠI (T10)
      {
        madonhang: "DH_202610_01",
        makh: "a1111111-1111-1111-1111-111111111111", // VIP
        makho: "KHO_TONG",
        machinhanh: "CN_CHINH",
        ngaydatSql: "NOW() - INTERVAL '2 day'",
        trangthai: "Thành công",
        tongtien: 29990000,
        ghichu: "Giao giờ hành chính",
        items: [{ masp: "SP01", soluong: 1, giaban: 29990000 }],
      },
      {
        madonhang: "DH_202610_02",
        makh: "a1111111-1111-1111-1111-111111111111", // VIP (tổng 2 đơn > 50M)
        makho: "KHO_TONG",
        machinhanh: "CN_CHINH",
        ngaydatSql: "NOW() - INTERVAL '4 day'",
        trangthai: "Thành công",
        tongtien: 39990000,
        ghichu: "Hàng giá trị cao",
        items: [{ masp: "SP03", soluong: 1, giaban: 39990000 }],
      },
      {
        madonhang: "DH_202610_03",
        makh: "a2222222-2222-2222-2222-222222222222", // Thân thiết (Đơn 1)
        makho: "KHO_TONG",
        machinhanh: "CN_CHINH",
        ngaydatSql: "NOW() - INTERVAL '6 day'",
        trangthai: "Thành công",
        tongtien: 27500000,
        ghichu: "Khách gọi xác nhận trước",
        items: [{ masp: "SP02", soluong: 1, giaban: 27500000 }],
      },
      {
        madonhang: "DH_202610_04",
        makh: "a3333333-3333-3333-3333-333333333333", // Khách mới (1 đơn duy nhất)
        makho: "KHO_TONG",
        machinhanh: "CN_CHINH",
        ngaydatSql: "NOW() - INTERVAL '1 day'",
        trangthai: "Thành công",
        tongtien: 8490000,
        ghichu: "Khách mới mua lần đầu",
        items: [{ masp: "SP04", soluong: 1, giaban: 8490000 }],
      },

      // ĐƠN THÁNG TRƯỚC (T9)
      {
        madonhang: "DH_202609_01",
        makh: "a2222222-2222-2222-2222-222222222222", // Thân thiết (Đơn 2 -> >= 2 đơn)
        makho: "KHO_TONG",
        machinhanh: "CN_CHINH",
        ngaydatSql: "NOW() - INTERVAL '35 day'",
        trangthai: "Thành công",
        tongtien: 8490000,
        ghichu: "Đơn tháng 9",
        items: [{ masp: "SP04", soluong: 1, giaban: 8490000 }],
      },
      {
        madonhang: "DH_202609_02",
        makh: "a1111111-1111-1111-1111-111111111111", // VIP
        makho: "KHO_TONG",
        machinhanh: "CN_CHINH",
        ngaydatSql: "NOW() - INTERVAL '40 day'",
        trangthai: "Thành công",
        tongtien: 29990000,
        ghichu: "Giao hỏa tốc",
        items: [{ masp: "SP01", soluong: 1, giaban: 29990000 }],
      },

      // ĐƠN THÁNG TRƯỚC NỮA (T8)
      {
        madonhang: "DH_202608_01",
        makh: "a1111111-1111-1111-1111-111111111111",
        makho: "KHO_TONG",
        machinhanh: "CN_CHINH",
        ngaydatSql: "NOW() - INTERVAL '65 day'",
        trangthai: "Thành công",
        tongtien: 39990000,
        ghichu: "Đơn tháng 8",
        items: [{ masp: "SP03", soluong: 1, giaban: 39990000 }],
      },

      // ĐƠN THUỘC KHO CHI NHÁNH 2 (Hà Nội)
      {
        madonhang: "DH_CN2_202610_01",
        makh: "a2222222-2222-2222-2222-222222222222",
        makho: "KHO_CN2",
        machinhanh: "CN_2",
        ngaydatSql: "NOW() - INTERVAL '3 day'",
        trangthai: "Thành công",
        tongtien: 27500000,
        ghichu: "Đơn giao từ Kho Chi nhánh 2",
        items: [{ masp: "SP02", soluong: 1, giaban: 27500000 }],
      },
      {
        madonhang: "DH_CN2_202609_01",
        makh: "a3333333-3333-3333-3333-333333333333",
        makho: "KHO_CN2",
        machinhanh: "CN_2",
        ngaydatSql: "NOW() - INTERVAL '38 day'",
        trangthai: "Thành công",
        tongtien: 8490000,
        ghichu: "Đơn tháng trước Kho Chi nhánh 2",
        items: [{ masp: "SP04", soluong: 1, giaban: 8490000 }],
      },
    ];

    for (const od of orders) {
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

      for (const it of od.items) {
        await client.query(`
          INSERT INTO chitiet_donhang (madonhang, masp, soluong, giaban, giamgia)
          VALUES ($1, $2, $3, $4, 0)
          ON CONFLICT (madonhang, masp) DO UPDATE SET
            soluong = EXCLUDED.soluong,
            giaban = EXCLUDED.giaban;
        `, [od.madonhang, it.masp, it.soluong, it.giaban]);
      }

      const maThanhToan = "TT_" + od.madonhang;
      await client.query(`
        INSERT INTO thanhtoan (mathanhtoan, madonhang, ngaythanhtoan, sotien, phuongthuc, trangthai)
        VALUES ($1, $2, ${od.ngaydatSql}, $3, 'Chuyển khoản', 'Thành công')
        ON CONFLICT (mathanhtoan) DO UPDATE SET
          sotien = EXCLUDED.sotien,
          ngaythanhtoan = ${od.ngaydatSql},
          trangthai = EXCLUDED.trangthai;
      `, [maThanhToan, od.madonhang, od.tongtien]);

      const maGiaoHang = "GH_" + od.madonhang;
      await client.query(`
        INSERT INTO phieugiaohang (magiaohang, madonhang, diachi, ngaygiao, trangthai, nguoinhan, sdtnguoinhan)
        VALUES ($1, $2, 'Địa chỉ mẫu', ${od.ngaydatSql}, 'Đã giao hàng', 'Người nhận', '0912345678')
        ON CONFLICT (magiaohang) DO UPDATE SET
          ngaygiao = ${od.ngaydatSql},
          trangthai = EXCLUDED.trangthai;
      `, [maGiaoHang, od.madonhang]);
    }

    await client.query("COMMIT");
    console.log("✅ Nạp dữ liệu hoàn tất thành công!");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Lỗi nạp dữ liệu mẫu:", error);
    throw error;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  seedOrdersAndCustomers()
    .then(() => {
      console.log("🎉 Hoàn tất quá trình seed!");
      process.exit(0);
    })
    .catch((err) => {
      console.error("💥 Thất bại:", err);
      process.exit(1);
    });
}

module.exports = { seedOrdersAndCustomers };
