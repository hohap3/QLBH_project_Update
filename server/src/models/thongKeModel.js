// src/models/thongKeModel.js
const { poolPromise } = require("../config/database");

/**
 * Chuẩn hóa tham số branch thành { machinhanh, makho } tương ứng
 */
function parseBranchFilter(branch) {
  if (!branch || branch === "ALL") return null;
  const b = String(branch).toUpperCase();
  if (b === "KHO_TONG" || b === "CN_CHINH" || b === "MAIN_BRANCH") {
    return { machinhanh: "CN_CHINH", makho: "KHO_TONG" };
  }
  if (b === "KHO_CN1" || b === "CN_1") {
    return { machinhanh: "CN_1", makho: "KHO_CN1" };
  }
  if (b === "KHO_CN2" || b === "CN_2") {
    return { machinhanh: "CN_2", makho: "KHO_CN2" };
  }
  return null;
}

const ThongKeModel = {
  // Lấy số lượng sản phẩm phân bổ theo từng danh mục (có hỗ trợ lọc theo kho/chi nhánh)
  getSanPhamTheoDanhMuc: async (branch) => {
    try {
      const pool = await poolPromise;
      const f = parseBranchFilter(branch);
      let query;
      let params = [];

      if (f) {
        query = `
          SELECT 
              d.tendanhmuc AS label, 
              COUNT(DISTINCT s.masp)::int AS value
          FROM danhmuc d
          LEFT JOIN sanpham s ON d.madanhmuc = s.madanhmuc
          LEFT JOIN tonkho t ON s.masp = t.masp AND t.makho = $1 AND t.soluongton > 0
          WHERE t.masp IS NOT NULL
          GROUP BY d.madanhmuc, d.tendanhmuc
        `;
        params = [f.makho];
      } else {
        query = `
          SELECT 
              d.tendanhmuc AS label, 
              COUNT(s.masp)::int AS value
          FROM danhmuc d
          LEFT JOIN sanpham s ON d.madanhmuc = s.madanhmuc
          GROUP BY d.madanhmuc, d.tendanhmuc
        `;
      }
      const result = await pool.query(query, params);
      return result.rows;
    } catch (error) {
      throw error;
    }
  },

  // Số liệu thẻ tổng quan KPI (Doanh thu, Đơn hàng, Khách hàng, Lợi nhuận gộp, Tồn kho)
  getQuickStats: async (branch) => {
    try {
      const pool = await poolPromise;
      const f = parseBranchFilter(branch);

      let query;
      let params = [];

      if (f) {
        query = `
        WITH mốc_thời_gian AS (
          SELECT 
            DATE_TRUNC('month', CURRENT_DATE) AS dau_thang_nay,
            DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 second' AS cuoi_thang_nay,
            DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month') AS dau_thang_truoc,
            DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 second' AS cuoi_thang_truoc
        )
        SELECT 
          -- 1. Thống kê Doanh Thu theo Chi nhánh / Kho (Tính cả Thành công & Đã giao)
          COALESCE(SUM(dh.tongtien) FILTER (WHERE dh.ngaydat BETWEEN t.dau_thang_nay AND t.cuoi_thang_nay AND dh.trangthai IN ('Thành công', 'Đã giao') AND (dh.machinhanh = $1 OR dh.makho = $2)), 0)::float AS doanhthu_nay,
          COALESCE(SUM(dh.tongtien) FILTER (WHERE dh.ngaydat BETWEEN t.dau_thang_truoc AND t.cuoi_thang_truoc AND dh.trangthai IN ('Thành công', 'Đã giao') AND (dh.machinhanh = $1 OR dh.makho = $2)), 0)::float AS doanhthu_truoc,
          COALESCE(SUM(dh.tongtien) FILTER (WHERE dh.ngaydat BETWEEN t.dau_thang_nay AND t.cuoi_thang_nay AND dh.trangthai IN ('Chờ xử lý', 'Chờ xác nhận', 'Đang giao') AND (dh.machinhanh = $1 OR dh.makho = $2)), 0)::float AS doanhthu_tamtinh,

          -- 2. Thống kê Số Đơn Hàng theo Chi nhánh / Kho (Loại trừ Đã hủy)
          COUNT(dh.madonhang) FILTER (WHERE dh.ngaydat BETWEEN t.dau_thang_nay AND t.cuoi_thang_nay AND dh.trangthai != 'Đã hủy' AND (dh.machinhanh = $1 OR dh.makho = $2))::int AS donhang_nay,
          COUNT(dh.madonhang) FILTER (WHERE dh.ngaydat BETWEEN t.dau_thang_truoc AND t.cuoi_thang_truoc AND dh.trangthai != 'Đã hủy' AND (dh.machinhanh = $1 OR dh.makho = $2))::int AS donhang_truoc,

          -- 3. Thống kê Khách Hàng có đơn phát sinh tại Chi nhánh / Kho (Hỗ trợ cả khách vãng lai)
          (SELECT COUNT(DISTINCT COALESCE(d.makh::text, d.manguoidung::text, pg.sdtnguoinhan))::int FROM donhang d LEFT JOIN phieugiaohang pg ON d.madonhang = pg.madonhang WHERE (d.machinhanh = $1 OR d.makho = $2) AND d.ngaydat BETWEEN t.dau_thang_nay AND t.cuoi_thang_nay AND d.trangthai != 'Đã hủy') AS khachhang_nay,
          (SELECT COUNT(DISTINCT COALESCE(d.makh::text, d.manguoidung::text, pg.sdtnguoinhan))::int FROM donhang d LEFT JOIN phieugiaohang pg ON d.madonhang = pg.madonhang WHERE (d.machinhanh = $1 OR d.makho = $2) AND d.ngaydat BETWEEN t.dau_thang_truoc AND t.cuoi_thang_truoc AND d.trangthai != 'Đã hủy') AS khachhang_truoc,

          -- 4. Thống kê Lợi Nhuận Gộp theo Chi nhánh / Kho
          (SELECT COALESCE(SUM(ct.soluong * (ct.giaban - s.gianhap)), 0)::float 
           FROM donhang d2 
           JOIN chitiet_donhang ct ON d2.madonhang = ct.madonhang 
           JOIN sanpham s ON ct.masp = s.masp 
           WHERE d2.ngaydat BETWEEN t.dau_thang_nay AND t.cuoi_thang_nay AND d2.trangthai IN ('Thành công', 'Đã giao') AND (d2.machinhanh = $1 OR d2.makho = $2)) AS loinhuangop_nay,
           
          (SELECT COALESCE(SUM(ct.soluong * (ct.giaban - s.gianhap)), 0)::float 
           FROM donhang d2 
           JOIN chitiet_donhang ct ON d2.madonhang = ct.madonhang 
           JOIN sanpham s ON ct.masp = s.masp 
           WHERE d2.ngaydat BETWEEN t.dau_thang_truoc AND t.cuoi_thang_truoc AND d2.trangthai IN ('Thành công', 'Đã giao') AND (d2.machinhanh = $1 OR d2.makho = $2)) AS loinhuangop_truoc,

          -- 5. Thống kê Tồn Kho theo Kho được chọn
          (SELECT COALESCE(SUM(soluongton), 0)::int FROM tonkho WHERE makho = $2) AS tong_tonkho,
          (SELECT COUNT(DISTINCT masp)::int FROM tonkho WHERE makho = $2 AND soluongton > 0) AS sosp_conhang
        FROM mốc_thời_gian t
        LEFT JOIN donhang dh ON true
        GROUP BY t.dau_thang_nay, t.cuoi_thang_nay, t.dau_thang_truoc, t.cuoi_thang_truoc;
        `;
        params = [f.machinhanh, f.makho];
      } else {
        query = `
        WITH mốc_thời_gian AS (
          SELECT 
            DATE_TRUNC('month', CURRENT_DATE) AS dau_thang_nay,
            DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 second' AS cuoi_thang_nay,
            DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month') AS dau_thang_truoc,
            DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 second' AS cuoi_thang_truoc
        )
        SELECT 
          -- 1. Thống kê Doanh Thu toàn hệ thống (Tính cả Thành công & Đã giao)
          COALESCE(SUM(dh.tongtien) FILTER (WHERE dh.ngaydat BETWEEN t.dau_thang_nay AND t.cuoi_thang_nay AND dh.trangthai IN ('Thành công', 'Đã giao')), 0)::float AS doanhthu_nay,
          COALESCE(SUM(dh.tongtien) FILTER (WHERE dh.ngaydat BETWEEN t.dau_thang_truoc AND t.cuoi_thang_truoc AND dh.trangthai IN ('Thành công', 'Đã giao')), 0)::float AS doanhthu_truoc,
          COALESCE(SUM(dh.tongtien) FILTER (WHERE dh.ngaydat BETWEEN t.dau_thang_nay AND t.cuoi_thang_nay AND dh.trangthai IN ('Chờ xử lý', 'Chờ xác nhận', 'Đang giao')), 0)::float AS doanhthu_tamtinh,

          -- 2. Thống kê Số Đơn Hàng toàn hệ thống (Loại trừ Đã hủy)
          COUNT(dh.madonhang) FILTER (WHERE dh.ngaydat BETWEEN t.dau_thang_nay AND t.cuoi_thang_nay AND dh.trangthai != 'Đã hủy')::int AS donhang_nay,
          COUNT(dh.madonhang) FILTER (WHERE dh.ngaydat BETWEEN t.dau_thang_truoc AND t.cuoi_thang_truoc AND dh.trangthai != 'Đã hủy')::int AS donhang_truoc,

          -- 3. Thống kê Khách Hàng có đơn phát sinh (Hỗ trợ cả khách vãng lai)
          (SELECT COUNT(DISTINCT COALESCE(d.makh::text, d.manguoidung::text, pg.sdtnguoinhan))::int FROM donhang d LEFT JOIN phieugiaohang pg ON d.madonhang = pg.madonhang WHERE d.ngaydat BETWEEN t.dau_thang_nay AND t.cuoi_thang_nay AND d.trangthai != 'Đã hủy') AS khachhang_nay,
          (SELECT COUNT(DISTINCT COALESCE(d.makh::text, d.manguoidung::text, pg.sdtnguoinhan))::int FROM donhang d LEFT JOIN phieugiaohang pg ON d.madonhang = pg.madonhang WHERE d.ngaydat BETWEEN t.dau_thang_truoc AND t.cuoi_thang_truoc AND d.trangthai != 'Đã hủy') AS khachhang_truoc,

          -- 4. Thống kê Lợi Nhuận Gộp toàn hệ thống
          (SELECT COALESCE(SUM(ct.soluong * (ct.giaban - s.gianhap)), 0)::float 
           FROM donhang d2 
           JOIN chitiet_donhang ct ON d2.madonhang = ct.madonhang 
           JOIN sanpham s ON ct.masp = s.masp 
           WHERE d2.ngaydat BETWEEN t.dau_thang_nay AND t.cuoi_thang_nay AND d2.trangthai IN ('Thành công', 'Đã giao')) AS loinhuangop_nay,
           
          (SELECT COALESCE(SUM(ct.soluong * (ct.giaban - s.gianhap)), 0)::float 
           FROM donhang d2 
           JOIN chitiet_donhang ct ON d2.madonhang = ct.madonhang 
           JOIN sanpham s ON ct.masp = s.masp 
           WHERE d2.ngaydat BETWEEN t.dau_thang_truoc AND t.cuoi_thang_truoc AND d2.trangthai IN ('Thành công', 'Đã giao')) AS loinhuangop_truoc,

          -- 5. Thống kê Tồn Kho Tổng thời gian thực
          (SELECT COALESCE(SUM(soluongton), 0)::int FROM tonkho) AS tong_tonkho,
          (SELECT COUNT(DISTINCT masp)::int FROM tonkho WHERE soluongton > 0) AS sosp_conhang
        FROM mốc_thời_gian t
        LEFT JOIN donhang dh ON true
        GROUP BY t.dau_thang_nay, t.cuoi_thang_nay, t.dau_thang_truoc, t.cuoi_thang_truoc;
        `;
      }

      const result = await pool.query(query, params);

      // Fallback object nếu cơ sở dữ liệu trống hoàn toàn
      const row = result.rows[0] || {
        doanhthu_nay: 0,
        doanhthu_truoc: 0,
        doanhthu_tamtinh: 0,
        donhang_nay: 0,
        donhang_truoc: 0,
        khachhang_nay: 0,
        khachhang_truoc: 0,
        tong_tonkho: 0,
        sosp_conhang: 0,
      };

      // Hàm nội bộ xử lý tỷ lệ phần trăm an toàn (Tránh lỗi toán học chia cho số 0)
      const tinhPhanTram = (nay, truoc) => {
        const n = parseFloat(nay) || 0;
        const t = parseFloat(truoc) || 0;
        if (!t || t === 0) return n > 0 ? 100 : 0;
        return parseFloat((((n - t) / t) * 100).toFixed(1));
      };

      return {
        DoanhThu: {
          ThangNay: row.doanhthu_nay,
          ThangTruoc: row.doanhthu_truoc,
          TamTinh: row.doanhthu_tamtinh || 0,
          PhanTram: tinhPhanTram(row.doanhthu_nay, row.doanhthu_truoc),
        },
        TongDonHang: {
          ThangNay: row.donhang_nay,
          ThangTruoc: row.donhang_truoc,
          PhanTram: tinhPhanTram(row.donhang_nay, row.donhang_truoc),
        },
        TongKhachHang: {
          ThangNay: row.khachhang_nay,
          ThangTruoc: row.khachhang_truoc,
          PhanTram: tinhPhanTram(row.khachhang_nay, row.khachhang_truoc),
        },
        LoiNhuanGop: {
          ThangNay: row.loinhuangop_nay,
          ThangTruoc: row.loinhuangop_truoc,
          PhanTram: tinhPhanTram(row.loinhuangop_nay, row.loinhuangop_truoc),
        },
        TongTonKho: {
          SoLuongTon: parseInt(row.tong_tonkho, 10) || 0,
          SoSPConHang: parseInt(row.sosp_conhang, 10) || 0,
        },
      };
    } catch (error) {
      throw error;
    }
  },

  // Top 5 sản phẩm bán chạy nhất
  getTopSellingProducts: async (branch) => {
    try {
      const pool = await poolPromise;
      const f = parseBranchFilter(branch);
      let query;
      let params = [];

      if (f) {
        query = `
          SELECT 
              s.tensp AS label, 
              SUM(ct.soluong)::int AS totalqty,
              SUM(ct.soluong * ct.giaban)::float AS totalrevenue
          FROM chitiet_donhang ct
          JOIN sanpham s ON ct.masp = s.masp
          JOIN donhang dh ON ct.madonhang = dh.madonhang
          WHERE dh.trangthai = 'Thành công' AND (dh.machinhanh = $1 OR dh.makho = $2)
          GROUP BY s.masp, s.tensp
          ORDER BY totalrevenue DESC
          LIMIT 5
        `;
        params = [f.machinhanh, f.makho];
      } else {
        query = `
          SELECT 
              s.tensp AS label, 
              SUM(ct.soluong)::int AS totalqty,
              SUM(ct.soluong * ct.giaban)::float AS totalrevenue
          FROM chitiet_donhang ct
          JOIN sanpham s ON ct.masp = s.masp
          JOIN donhang dh ON ct.madonhang = dh.madonhang
          WHERE dh.trangthai = 'Thành công'
          GROUP BY s.masp, s.tensp
          ORDER BY totalrevenue DESC
          LIMIT 5
        `;
      }
      const result = await pool.query(query, params);
      return result.rows;
    } catch (error) {
      throw error;
    }
  },

  // Thống kê số đơn hàng theo tháng (Đầy đủ từ T1 đến tháng hiện tại, mặc định value: 0)
  getOrdersByMonth: async (branch) => {
    try {
      const pool = await poolPromise;
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1;
      const f = parseBranchFilter(branch);

      let query;
      let params;

      if (f) {
        query = `
          SELECT 
              EXTRACT(MONTH FROM ngaydat)::int AS month, 
              COUNT(madonhang)::int AS ordercount
          FROM donhang
          WHERE EXTRACT(YEAR FROM ngaydat) = $1 
            AND EXTRACT(MONTH FROM ngaydat) <= $2 
            AND trangthai != 'Đã hủy'
            AND (machinhanh = $3 OR makho = $4)
          GROUP BY EXTRACT(MONTH FROM ngaydat)
          ORDER BY month ASC
        `;
        params = [currentYear, currentMonth, f.machinhanh, f.makho];
      } else {
        query = `
          SELECT 
              EXTRACT(MONTH FROM ngaydat)::int AS month, 
              COUNT(madonhang)::int AS ordercount
          FROM donhang
          WHERE EXTRACT(YEAR FROM ngaydat) = $1 AND EXTRACT(MONTH FROM ngaydat) <= $2 AND trangthai != 'Đã hủy'
          GROUP BY EXTRACT(MONTH FROM ngaydat)
          ORDER BY month ASC
        `;
        params = [currentYear, currentMonth];
      }

      const result = await pool.query(query, params);

      // Đảm bảo trả về mảng đầy đủ từ T1 đến tháng hiện tại, các tháng không có dữ liệu gán mặc định value: 0
      const fullList = Array.from({ length: currentMonth }, (_, index) => {
        const monthNum = index + 1;
        const matched = result.rows.find((item) => Number(item.month) === monthNum);
        const ordercount = matched ? parseInt(matched.ordercount, 10) : 0;
        return {
          month: monthNum,
          label: `T${monthNum}`,
          ordercount: ordercount,
          value: ordercount,
        };
      });

      return fullList;
    } catch (error) {
      throw error;
    }
  },

  // Thống kê doanh thu theo tháng từ hóa đơn (Đầy đủ từ T1 đến tháng hiện tại, mặc định value: 0)
  getRevenueByMonth: async (branch) => {
    try {
      const pool = await poolPromise;
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1;
      const f = parseBranchFilter(branch);

      let query;
      let params;

      if (f) {
        query = `
          SELECT 
              EXTRACT(MONTH FROM ngaydat)::int AS month, 
              SUM(tongtien)::float AS totalrevenue
          FROM donhang
          WHERE EXTRACT(YEAR FROM ngaydat) = $1 
            AND EXTRACT(MONTH FROM ngaydat) <= $2 
            AND trangthai = 'Thành công'
            AND (machinhanh = $3 OR makho = $4)
          GROUP BY EXTRACT(MONTH FROM ngaydat)
          ORDER BY month ASC
        `;
        params = [currentYear, currentMonth, f.machinhanh, f.makho];
      } else {
        query = `
          SELECT 
              EXTRACT(MONTH FROM ngaydat)::int AS month, 
              SUM(tongtien)::float AS totalrevenue
          FROM donhang
          WHERE EXTRACT(YEAR FROM ngaydat) = $1 AND EXTRACT(MONTH FROM ngaydat) <= $2 AND trangthai = 'Thành công'
          GROUP BY EXTRACT(MONTH FROM ngaydat)
          ORDER BY month ASC
        `;
        params = [currentYear, currentMonth];
      }

      const result = await pool.query(query, params);

      // Đảm bảo trả về mảng đầy đủ từ T1 đến tháng hiện tại, các tháng không có dữ liệu gán mặc định value: 0
      const fullList = Array.from({ length: currentMonth }, (_, index) => {
        const monthNum = index + 1;
        const matched = result.rows.find((item) => Number(item.month) === monthNum);
        const totalrevenue = matched ? parseFloat(matched.totalrevenue) : 0;
        return {
          month: monthNum,
          label: `T${monthNum}`,
          totalrevenue: totalrevenue,
          value: totalrevenue,
        };
      });

      return fullList;
    } catch (error) {
      throw error;
    }
  },

  // 5. Thống kê phân tích khách hàng chuyên sâu (Customer Analytics)
  getCustomerAnalytics: async (branch) => {
    try {
      const pool = await poolPromise;
      const f = parseBranchFilter(branch);

      let query;
      let params = [];

      if (f) {
        query = `
        WITH customer_stats AS (
          SELECT 
            k.makh,
            k.hoten,
            COALESCE(k.diemtichluy, 0) AS diemtichluy,
            COUNT(d.madonhang) FILTER (WHERE d.trangthai = 'Thành công' AND (d.machinhanh = $1 OR d.makho = $2))::int AS so_don_thanhcong,
            COALESCE(SUM(d.tongtien) FILTER (WHERE d.trangthai = 'Thành công' AND (d.machinhanh = $1 OR d.makho = $2)), 0)::float AS tong_chitieu
          FROM khachhang k
          JOIN donhang d ON k.makh = d.makh AND (d.machinhanh = $1 OR d.makho = $2)
          GROUP BY k.makh, k.hoten, k.diemtichluy
        )
        SELECT 
          COUNT(*) FILTER (WHERE so_don_thanhcong >= 2)::int AS khach_quaylai,
          COUNT(*) FILTER (WHERE tong_chitieu >= 50000000 OR diemtichluy >= 200)::int AS khach_vip,
          COUNT(*) FILTER (WHERE tong_chitieu >= 50000000 OR diemtichluy >= 200)::int AS segment_vip,
          COUNT(*) FILTER (WHERE (tong_chitieu < 50000000 AND diemtichluy < 200) AND so_don_thanhcong >= 2)::int AS segment_thanthiet,
          COUNT(*) FILTER (WHERE (tong_chitieu < 50000000 AND diemtichluy < 200) AND so_don_thanhcong < 2)::int AS segment_moi
        FROM customer_stats;
        `;
        params = [f.machinhanh, f.makho];
      } else {
        query = `
        WITH customer_stats AS (
          SELECT 
            k.makh,
            k.hoten,
            COALESCE(k.diemtichluy, 0) AS diemtichluy,
            COUNT(d.madonhang) FILTER (WHERE d.trangthai = 'Thành công')::int AS so_don_thanhcong,
            COALESCE(SUM(d.tongtien) FILTER (WHERE d.trangthai = 'Thành công'), 0)::float AS tong_chitieu
          FROM khachhang k
          LEFT JOIN donhang d ON k.makh = d.makh
          GROUP BY k.makh, k.hoten, k.diemtichluy
        )
        SELECT 
          COUNT(*) FILTER (WHERE so_don_thanhcong >= 2)::int AS khach_quaylai,
          COUNT(*) FILTER (WHERE tong_chitieu >= 50000000 OR diemtichluy >= 200)::int AS khach_vip,
          COUNT(*) FILTER (WHERE tong_chitieu >= 50000000 OR diemtichluy >= 200)::int AS segment_vip,
          COUNT(*) FILTER (WHERE (tong_chitieu < 50000000 AND diemtichluy < 200) AND so_don_thanhcong >= 2)::int AS segment_thanthiet,
          COUNT(*) FILTER (WHERE (tong_chitieu < 50000000 AND diemtichluy < 200) AND so_don_thanhcong < 2)::int AS segment_moi
        FROM customer_stats;
        `;
      }

      const result = await pool.query(query, params);
      const row = result.rows[0] || {};

      return {
        khachQuayLai: row.khach_quaylai || 0,
        khachVIP: row.khach_vip || 0,
        segments: [
          { label: "Khách mới", value: row.segment_moi || 0 },
          { label: "Khách thân thiết", value: row.segment_thanthiet || 0 },
          { label: "Khách VIP", value: row.segment_vip || 0 },
        ],
      };
    } catch (error) {
      throw error;
    }
  },

  // 6. Thống kê phân tích kho hàng chuyên sâu (Inventory Analytics)
  getInventoryAnalytics: async (branch) => {
    try {
      const pool = await poolPromise;
      const f = parseBranchFilter(branch);

      let query;
      let params = [];

      if (f) {
        query = `
        WITH product_stocks AS (
          SELECT 
            s.masp,
            s.tensp,
            COALESCE(SUM(t.soluongton) FILTER (WHERE t.makho = $1), 0)::float AS tong_ton,
            COALESCE(
              (SELECT SUM(ct.soluong)::int 
               FROM chitiet_donhang ct 
               JOIN donhang d ON ct.madonhang = d.madonhang 
               WHERE ct.masp = s.masp 
                 AND d.trangthai = 'Thành công' 
                 AND (d.machinhanh = $2 OR d.makho = $1)
                 AND d.ngaydat >= (NOW() - INTERVAL '30 day')), 
              0
            ) AS ban_30_ngay
          FROM sanpham s
          LEFT JOIN tonkho t ON s.masp = t.masp AND t.makho = $1
          GROUP BY s.masp, s.tensp
        )
        SELECT 
          COUNT(*) FILTER (WHERE tong_ton <= 5)::int AS sap_het,
          COUNT(*) FILTER (WHERE tong_ton > 10 AND ban_30_ngay = 0)::int AS ban_cham,
          COUNT(*) FILTER (WHERE tong_ton >= 50)::int AS ton_nhieu,
          COUNT(*) FILTER (WHERE tong_ton <= 5)::int AS dist_sap_het,
          COUNT(*) FILTER (WHERE tong_ton > 5 AND tong_ton < 50)::int AS dist_an_toan,
          COUNT(*) FILTER (WHERE tong_ton >= 50)::int AS dist_ton_cao
        FROM product_stocks;
        `;
        params = [f.makho, f.machinhanh];
      } else {
        query = `
        WITH product_stocks AS (
          SELECT 
            s.masp,
            s.tensp,
            COALESCE(SUM(t.soluongton), 0)::float AS tong_ton,
            COALESCE(
              (SELECT SUM(ct.soluong)::int 
               FROM chitiet_donhang ct 
               JOIN donhang d ON ct.madonhang = d.madonhang 
               WHERE ct.masp = s.masp 
                 AND d.trangthai = 'Thành công' 
                 AND d.ngaydat >= (NOW() - INTERVAL '30 day')), 
              0
            ) AS ban_30_ngay
          FROM sanpham s
          LEFT JOIN tonkho t ON s.masp = t.masp
          GROUP BY s.masp, s.tensp
        )
        SELECT 
          COUNT(*) FILTER (WHERE tong_ton <= 5)::int AS sap_het,
          COUNT(*) FILTER (WHERE tong_ton > 10 AND ban_30_ngay = 0)::int AS ban_cham,
          COUNT(*) FILTER (WHERE tong_ton >= 50)::int AS ton_nhieu,
          COUNT(*) FILTER (WHERE tong_ton <= 5)::int AS dist_sap_het,
          COUNT(*) FILTER (WHERE tong_ton > 5 AND tong_ton < 50)::int AS dist_an_toan,
          COUNT(*) FILTER (WHERE tong_ton >= 50)::int AS dist_ton_cao
        FROM product_stocks;
        `;
      }

      const result = await pool.query(query, params);
      const row = result.rows[0] || {};

      return {
        sapHet: row.sap_het || 0,
        banCham: row.ban_cham || 0,
        tonNhieu: row.ton_nhieu || 0,
        distribution: [
          { label: "Sắp hết (≤5)", value: row.dist_sap_het || 0 },
          { label: "An toàn (6-49)", value: row.dist_an_toan || 0 },
          { label: "Tồn cao (≥50)", value: row.dist_ton_cao || 0 },
        ],
      };
    } catch (error) {
      throw error;
    }
  },
};

module.exports = ThongKeModel;
