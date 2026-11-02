const { pool } = require('./server/src/config/database');

async function runMigration() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('Bắt đầu migration Phase 4: Multi-Branch Inventory (Tiếng Việt)...');

    // 1. Tạo bảng Chi Nhánh
    await client.query(`
      CREATE TABLE IF NOT EXISTS chinhanh (
        machinhanh VARCHAR(50) PRIMARY KEY,
        tenchinhanh VARCHAR(200) NOT NULL,
        diachi TEXT,
        sdt VARCHAR(30),
        trangthai VARCHAR(20) DEFAULT 'HOAT_DONG',
        ngaytao TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    
    // Tạo 1 chi nhánh mặc định
    await client.query(`
      INSERT INTO chinhanh (machinhanh, tenchinhanh, diachi)
      VALUES ('CN_CHINH', 'Chi nhánh Trung Tâm', 'Hà Nội')
      ON CONFLICT (machinhanh) DO NOTHING;
    `);

    // 2. Tạo bảng Kho Hàng
    await client.query(`
      CREATE TABLE IF NOT EXISTS khohang (
        makho VARCHAR(50) PRIMARY KEY,
        machinhanh VARCHAR(50) REFERENCES chinhanh(machinhanh),
        tenkho VARCHAR(200) NOT NULL,
        loaikho VARCHAR(30) DEFAULT 'TONG',
        trangthai VARCHAR(20) DEFAULT 'HOAT_DONG',
        ngaytao TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Tạo 1 kho tổng mặc định
    await client.query(`
      INSERT INTO khohang (makho, machinhanh, tenkho, loaikho)
      VALUES ('KHO_TONG', 'CN_CHINH', 'Kho Tổng Trung Tâm', 'TONG')
      ON CONFLICT (makho) DO NOTHING;
    `);

    // 3. Tạo bảng Tồn Kho (Multi-Warehouse Balance)
    await client.query(`
      CREATE TABLE IF NOT EXISTS tonkho (
        makho VARCHAR(50) REFERENCES khohang(makho),
        masp VARCHAR(50) REFERENCES sanpham(masp),
        soluongton NUMERIC(14,3) DEFAULT 0 CHECK (soluongton >= 0),
        soluongtamgiu NUMERIC(14,3) DEFAULT 0 CHECK (soluongtamgiu >= 0),
        soluongkha_dung NUMERIC(14,3) GENERATED ALWAYS AS (soluongton - soluongtamgiu) STORED,
        ngaycapnhat TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (makho, masp)
      );
    `);

    // 4. Migrate dữ liệu tồn kho hiện tại từ bảng sanpham sang bảng tonkho
    await client.query(`
      INSERT INTO tonkho (makho, masp, soluongton)
      SELECT 'KHO_TONG', masp, soluongton
      FROM sanpham
      ON CONFLICT (makho, masp) DO NOTHING;
    `);

    // 5. Cập nhật bảng Giao Dịch Kho (Lịch sử kho)
    // Thêm cột makho vào bảng giaodichkho nếu chưa có
    await client.query(`
      ALTER TABLE giaodichkho 
      ADD COLUMN IF NOT EXISTS makho VARCHAR(50);
    `);

    // Cập nhật lại những dòng giaodichkho cũ thành KHO_TONG và gán khóa ngoại
    await client.query(`
      UPDATE giaodichkho SET makho = 'KHO_TONG' WHERE makho IS NULL;
    `);
    
    // Thay đổi cấu trúc makho không cho phép NULL (optional, nhưng giúp strict data hơn)
    await client.query(`
      ALTER TABLE giaodichkho ALTER COLUMN makho SET NOT NULL;
    `);

    // THAY ĐỔI CỘT Ở BẢNG chitiet_donhang (nếu muốn khóa hàng khi đặt hàng)
    // Optional: Thêm makho xuất hàng cho đơn hàng
    await client.query(`
      ALTER TABLE donhang ADD COLUMN IF NOT EXISTS makho VARCHAR(50) DEFAULT 'KHO_TONG';
    `);
    await client.query(`
      ALTER TABLE donhang ADD COLUMN IF NOT EXISTS machinhanh VARCHAR(50) DEFAULT 'CN_CHINH';
    `);

    await client.query('COMMIT');
    console.log('✅ Migration Phase 4 (Vietnamese Schema) thành công!');
    console.log('✅ Đã sao chép toàn bộ số lượng tồn từ [sanpham] sang [tonkho]!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Lỗi Migration Phase 4:', error);
  } finally {
    client.release();
    pool.end();
  }
}

runMigration();
