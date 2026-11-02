-- ============================================================
-- HP STORE / QLBH - PostgreSQL FULL SCHEMA (Tiếng Việt)
-- Tích hợp Phase 4 (Multi-Branch Inventory)
-- Dùng để tạo mới hoàn toàn Database từ đầu
-- ============================================================

BEGIN;

-- Bật extension pgcrypto để dùng gen_random_uuid() và hash mật khẩu nếu cần
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. BẢNG PHÂN QUYỀN / VAI TRÒ
CREATE TABLE IF NOT EXISTS vaitro (
  mavaitro VARCHAR(20) PRIMARY KEY,
  tenvaitro VARCHAR(100) NOT NULL,
  mota TEXT
);

-- Dữ liệu mẫu Vai trò
INSERT INTO vaitro (mavaitro, tenvaitro, mota) VALUES
('ADMIN', 'Quản trị viên', 'Toàn quyền hệ thống'),
('MANAGER', 'Quản lý', 'Quản lý cửa hàng/chi nhánh'),
('STAFF', 'Nhân viên', 'Nhân viên bán hàng')
ON CONFLICT (mavaitro) DO NOTHING;

-- 2. BẢNG NGƯỜI DÙNG (Nhân viên / Admin)
CREATE TABLE IF NOT EXISTS nguoidung (
  mand UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tendangnhap VARCHAR(80) UNIQUE NOT NULL,
  matkhauhash TEXT NOT NULL,
  hoten VARCHAR(160) NOT NULL,
  email VARCHAR(254) UNIQUE,
  sdt VARCHAR(30) UNIQUE,
  mavaitro VARCHAR(20) REFERENCES vaitro(mavaitro),
  trangthai VARCHAR(20) DEFAULT 'HOAT_DONG',
  ngaytao TIMESTAMPTZ DEFAULT NOW(),
  otp_code VARCHAR(10),
  otp_expired TIMESTAMPTZ
);

-- 3. BẢNG KHÁCH HÀNG
CREATE TABLE IF NOT EXISTS khachhang (
  makh UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hoten VARCHAR(200) NOT NULL,
  sdt VARCHAR(30) UNIQUE,
  email VARCHAR(254) UNIQUE,
  diachi TEXT,
  diemtichluy INT DEFAULT 0,
  mand UUID REFERENCES nguoidung(mand),
  ngaytao TIMESTAMPTZ DEFAULT NOW()
);

-- 4. BẢNG DANH MỤC SẢN PHẨM
CREATE TABLE IF NOT EXISTS danhmuc (
  madanhmuc VARCHAR(50) PRIMARY KEY,
  tendanhmuc VARCHAR(150) NOT NULL,
  mota TEXT
);

-- 5. BẢNG NHÀ CUNG CẤP
CREATE TABLE IF NOT EXISTS nhacungcap (
  mancc VARCHAR(50) PRIMARY KEY,
  tenncc VARCHAR(200) NOT NULL,
  sdt VARCHAR(30),
  email VARCHAR(254),
  diachi TEXT,
  trangthai BOOLEAN DEFAULT true,
  ngaytao TIMESTAMPTZ DEFAULT NOW()
);

-- 6. BẢNG SẢN PHẨM (Đã bỏ soluongton để dùng bảng tonkho riêng cho hệ thống đa kho)
CREATE TABLE IF NOT EXISTS sanpham (
  masp VARCHAR(50) PRIMARY KEY,
  tensp VARCHAR(250) NOT NULL,
  gianhap NUMERIC(14,2) NOT NULL DEFAULT 0,
  giaban NUMERIC(14,2) NOT NULL DEFAULT 0,
  mota TEXT,
  donvitinh VARCHAR(30) DEFAULT 'Cái',
  madanhmuc VARCHAR(50) REFERENCES danhmuc(madanhmuc),
  mancc VARCHAR(50) REFERENCES nhacungcap(mancc),
  hinhanh TEXT
);

-- 7. BẢNG CHI NHÁNH (Multi-Branch)
CREATE TABLE IF NOT EXISTS chinhanh (
  machinhanh VARCHAR(50) PRIMARY KEY,
  tenchinhanh VARCHAR(200) NOT NULL,
  diachi TEXT,
  sdt VARCHAR(30),
  trangthai VARCHAR(20) DEFAULT 'HOAT_DONG',
  ngaytao TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO chinhanh (machinhanh, tenchinhanh, diachi) 
VALUES ('CN_CHINH', 'Chi nhánh Trung Tâm', 'Trụ sở chính')
ON CONFLICT (machinhanh) DO NOTHING;

-- 8. BẢNG KHO HÀNG (Warehouses)
CREATE TABLE IF NOT EXISTS khohang (
  makho VARCHAR(50) PRIMARY KEY,
  machinhanh VARCHAR(50) REFERENCES chinhanh(machinhanh),
  tenkho VARCHAR(200) NOT NULL,
  loaikho VARCHAR(30) DEFAULT 'TONG',
  trangthai VARCHAR(20) DEFAULT 'HOAT_DONG',
  ngaytao TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO khohang (makho, machinhanh, tenkho, loaikho) 
VALUES ('KHO_TONG', 'CN_CHINH', 'Kho Tổng Trung Tâm', 'TONG')
ON CONFLICT (makho) DO NOTHING;

-- 9. BẢNG TỒN KHO CHI TIẾT THEO KHO (Inventory Balances)
CREATE TABLE IF NOT EXISTS tonkho (
  makho VARCHAR(50) REFERENCES khohang(makho) ON DELETE CASCADE,
  masp VARCHAR(50) REFERENCES sanpham(masp) ON DELETE CASCADE,
  soluongton NUMERIC(14,3) DEFAULT 0 CHECK (soluongton >= 0),
  soluongtamgiu NUMERIC(14,3) DEFAULT 0 CHECK (soluongtamgiu >= 0),
  soluongkha_dung NUMERIC(14,3) GENERATED ALWAYS AS (soluongton - soluongtamgiu) STORED,
  ngaycapnhat TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (makho, masp)
);

-- 10. BẢNG GIAO DỊCH KHO / LỊCH SỬ KHO (Inventory Movements)
CREATE TABLE IF NOT EXISTS giaodichkho (
  magd VARCHAR(50) PRIMARY KEY,
  masp VARCHAR(50) REFERENCES sanpham(masp),
  makho VARCHAR(50) REFERENCES khohang(makho),
  loaigd INT NOT NULL CHECK (loaigd IN (1, 2)), -- 1: Nhập, 2: Xuất
  soluong NUMERIC(14,3) NOT NULL CHECK (soluong > 0),
  tontruoc NUMERIC(14,3) DEFAULT 0,
  tonsau NUMERIC(14,3) DEFAULT 0,
  ngaygd TIMESTAMPTZ DEFAULT NOW()
);

-- 11. BẢNG ĐƠN HÀNG (Sales Orders)
CREATE TABLE IF NOT EXISTS donhang (
  madonhang VARCHAR(50) PRIMARY KEY,
  makh UUID REFERENCES khachhang(makh),
  manguoidung UUID REFERENCES nguoidung(mand),
  makho VARCHAR(50) REFERENCES khohang(makho) DEFAULT 'KHO_TONG',
  machinhanh VARCHAR(50) REFERENCES chinhanh(machinhanh) DEFAULT 'CN_CHINH',
  ngaydat TIMESTAMPTZ DEFAULT NOW(),
  trangthai VARCHAR(50) DEFAULT 'Chờ xử lý',
  tongtien NUMERIC(14,2) DEFAULT 0,
  ghichu TEXT
);

-- 12. BẢNG CHI TIẾT ĐƠN HÀNG (Order Items)
CREATE TABLE IF NOT EXISTS chitiet_donhang (
  madonhang VARCHAR(50) REFERENCES donhang(madonhang) ON DELETE CASCADE,
  masp VARCHAR(50) REFERENCES sanpham(masp),
  soluong INT NOT NULL CHECK (soluong > 0),
  giaban NUMERIC(14,2) NOT NULL,
  giamgia NUMERIC(14,2) DEFAULT 0,
  PRIMARY KEY (madonhang, masp)
);

-- 13. BẢNG THANH TOÁN (Payments)
CREATE TABLE IF NOT EXISTS thanhtoan (
  mathanhtoan VARCHAR(50) PRIMARY KEY,
  madonhang VARCHAR(50) REFERENCES donhang(madonhang) ON DELETE CASCADE,
  ngaythanhtoan TIMESTAMPTZ DEFAULT NOW(),
  sotien NUMERIC(14,2) NOT NULL,
  phuongthuc VARCHAR(50) NOT NULL,
  magiaodich VARCHAR(100),
  trangthai VARCHAR(50) DEFAULT 'Thành công'
);

-- 14. BẢNG PHIẾU GIAO HÀNG (Shipments)
CREATE TABLE IF NOT EXISTS phieugiaohang (
  magiaohang VARCHAR(50) PRIMARY KEY,
  madonhang VARCHAR(50) REFERENCES donhang(madonhang) ON DELETE CASCADE,
  diachi TEXT NOT NULL,
  ngaygiao TIMESTAMPTZ,
  trangthai VARCHAR(50) DEFAULT 'Đang xử lý',
  nguoinhan VARCHAR(200),
  sdtnguoinhan VARCHAR(30)
);

COMMIT;
