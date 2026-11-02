// server/test_full_system.js
const axios = require("axios");
const { poolPromise } = require("./src/config/database");

const BASE_URL = process.env.API_BASE_URL || "http://localhost:5000/api";

// Bảng màu console ANSI
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  blue: "\x1b[34m",
};

const results = [];

function recordTest(stepNumber, title, passed, details = "") {
  results.push({ stepNumber, title, passed, details });
  const status = passed
    ? `${colors.green}[PASS]${colors.reset}`
    : `${colors.red}[FAIL]${colors.reset}`;
  console.log(`  ${status} Bước ${stepNumber}: ${title}`);
  if (details) {
    console.log(`         ${colors.cyan}↳ ${details}${colors.reset}`);
  }
}

async function runFullSystemTest() {
  console.log(
    `\n${colors.bright}${colors.blue}=====================================================${colors.reset}`
  );
  console.log(
    `${colors.bright}${colors.blue}   BẮT ĐẦU KIỂM THỬ TÍCH HỢP TOÀN DIỆN HỆ THỐNG (E2E)  ${colors.reset}`
  );
  console.log(
    `${colors.bright}${colors.blue}   Target API: ${BASE_URL}${colors.reset}`
  );
  console.log(
    `${colors.bright}${colors.blue}=====================================================${colors.reset}\n`
  );

  let authToken = null;
  let adminUserId = null;
  const testProduct = "SP01";
  const testWarehouse = "KHO_TONG";

  try {
    // -------------------------------------------------------------------------
    // BƯỚC 1: ĐĂNG NHẬP VỚI TÀI KHOẢN ADMIN / 123456
    // -------------------------------------------------------------------------
    console.log(`${colors.bright}▶ 1. Kiểm thử Đăng nhập (Auth Login)...${colors.reset}`);
    try {
      const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
        identifier: "admin",
        password: "password123", // thử password sai trước hoặc trực tiếp 123456
      }).catch(async () => {
        // fallback đăng nhập chuẩn 123456
        return await axios.post(`${BASE_URL}/auth/login`, {
          identifier: "admin",
          password: "123456",
        });
      });

      authToken = loginRes.data.token;
      adminUserId = loginRes.data.user?.maND || loginRes.data.user?.mand;

      const hasValidToken = Boolean(
        authToken && typeof authToken === "string" && authToken.length > 20
      );

      recordTest(
        1,
        "Đăng nhập tài khoản Admin và sinh JWT Token",
        hasValidToken,
        `User: ${loginRes.data.user?.username} (Role: ${loginRes.data.user?.role}) | Token: ${authToken.slice(0, 25)}...`
      );
    } catch (err) {
      recordTest(1, "Đăng nhập tài khoản Admin", false, err.response?.data?.message || err.message);
    }

    const authHeaders = {
      headers: { Authorization: `Bearer ${authToken}` },
    };

    // -------------------------------------------------------------------------
    // BƯỚC 2: KIỂM TRA THỐNG KÊ TỔNG QUAN (OVERVIEW)
    // -------------------------------------------------------------------------
    console.log(`\n${colors.bright}▶ 2. Kiểm thử Thống kê Tổng quan (/thongke/overview)...${colors.reset}`);
    try {
      const overviewRes = await axios.get(`${BASE_URL}/thongke/overview`);
      const data = overviewRes.data?.data;

      const isValidDoanhThu =
        data?.DoanhThu &&
        !isNaN(data.DoanhThu.ThangNay) &&
        !isNaN(data.DoanhThu.PhanTram);
      const isValidDonHang =
        data?.TongDonHang &&
        !isNaN(data.TongDonHang.ThangNay) &&
        !isNaN(data.TongDonHang.PhanTram);
      const isValidLoiNhuan =
        data?.LoiNhuanGop &&
        !isNaN(data.LoiNhuanGop.ThangNay) &&
        !isNaN(data.LoiNhuanGop.PhanTram);

      const passed = isValidDoanhThu && isValidDonHang && isValidLoiNhuan;

      recordTest(
        2,
        "Thống kê tổng quan không bị null/NaN và có so sánh % hợp lệ",
        passed,
        `Doanh thu: ${data?.DoanhThu?.ThangNay?.toLocaleString()}đ (${data?.DoanhThu?.PhanTram}%) | Đơn: ${data?.TongDonHang?.ThangNay} (${data?.TongDonHang?.PhanTram}%) | Lợi nhuận gộp: ${data?.LoiNhuanGop?.ThangNay?.toLocaleString()}đ`
      );
    } catch (err) {
      recordTest(2, "Thống kê tổng quan", false, err.response?.data?.message || err.message);
    }

    // -------------------------------------------------------------------------
    // BƯỚC 3: KIỂM TRA BIỂU ĐỒ DOANH THU & ĐƠN HÀNG THEO THÁNG
    // -------------------------------------------------------------------------
    console.log(`\n${colors.bright}▶ 3. Kiểm thử Dữ liệu Biểu đồ Tháng (/thongke/monthly-revenue & /monthly-orders)...${colors.reset}`);
    try {
      const currentMonth = new Date().getMonth() + 1;
      const [revRes, ordRes] = await Promise.all([
        axios.get(`${BASE_URL}/thongke/monthly-revenue`),
        axios.get(`${BASE_URL}/thongke/monthly-orders`),
      ]);

      const revList = revRes.data?.data || [];
      const ordList = ordRes.data?.data || [];

      const revMatchesMonth = revList.length === currentMonth;
      const ordMatchesMonth = ordList.length === currentMonth;
      const hasLabelsAndValues =
        revList.every((item) => item.label && typeof item.value === "number") &&
        ordList.every((item) => item.label && typeof item.value === "number");

      const passed = revMatchesMonth && ordMatchesMonth && hasLabelsAndValues;

      recordTest(
        3,
        "Độ dài mảng biểu đồ tháng khớp với tháng hiện tại (T1 -> T" + currentMonth + ")",
        passed,
        `Doanh thu: ${revList.length} tháng (T${currentMonth}: ${revList[currentMonth - 1]?.value?.toLocaleString()}đ) | Đơn hàng: ${ordList.length} tháng (T${currentMonth}: ${ordList[currentMonth - 1]?.value} đơn)`
      );
    } catch (err) {
      recordTest(3, "Dữ liệu biểu đồ theo tháng", false, err.response?.data?.message || err.message);
    }

    // -------------------------------------------------------------------------
    // BƯỚC 4: KIỂM TRA KHO HÀNG (NHẬP 5 CÁI, XUẤT 2 CÁI)
    // -------------------------------------------------------------------------
    console.log(`\n${colors.bright}▶ 4. Kiểm thử Quản lý Kho Hàng (/warehouse/transaction)...${colors.reset}`);
    try {
      // 4a. Giao dịch Nhập kho 5 cái
      const importRes = await axios.post(
        `${BASE_URL}/warehouse/transaction`,
        {
          maSP: testProduct,
          makho: testWarehouse,
          loaiGD: 1, // Nhập kho
          soLuong: 5,
        },
        authHeaders
      );

      const importData = importRes.data.data;
      const importOk =
        importData.tonSau === importData.tonTruoc + 5 &&
        importRes.data.success === true;

      // 4b. Giao dịch Xuất kho 2 cái
      const exportRes = await axios.post(
        `${BASE_URL}/warehouse/transaction`,
        {
          maSP: testProduct,
          makho: testWarehouse,
          loaiGD: 2, // Xuất kho
          soLuong: 2,
        },
        authHeaders
      );

      const exportData = exportRes.data.data;
      const exportOk =
        exportData.tonSau === exportData.tonTruoc - 2 &&
        exportData.tonTruoc === importData.tonSau &&
        exportRes.data.success === true;

      const passed = importOk && exportOk;

      recordTest(
        4,
        "Giao dịch Nhập 5 cái và Xuất 2 cái tính toán tồn kho chính xác",
        passed,
        `Nhập: ${importData.tonTruoc} -> ${importData.tonSau} | Xuất: ${exportData.tonTruoc} -> ${exportData.tonSau} (Tồn cuối: ${exportData.tonSau})`
      );
    } catch (err) {
      recordTest(4, "Giao dịch kho hàng", false, err.response?.data?.message || err.message);
    }

    // -------------------------------------------------------------------------
    // BƯỚC 5: KIỂM TRA ĐẶT HÀNG & TRỪ TỒN KHO TỰ ĐỘNG
    // -------------------------------------------------------------------------
    console.log(`\n${colors.bright}▶ 5. Kiểm thử Đặt hàng & Khóa dòng Trừ tồn kho (/checkout/process)...${colors.reset}`);
    try {
      const pool = await poolPromise;

      // Lấy tồn kho hiện tại trước khi checkout
      const stockBeforeQuery = await pool.query(
        "SELECT soluongton FROM tonkho WHERE masp = $1 AND makho = $2",
        [testProduct, testWarehouse]
      );
      const stockBefore = parseFloat(stockBeforeQuery.rows[0]?.soluongton) || 0;

      // Thực hiện đặt hàng 1 sản phẩm
      const checkoutRes = await axios.post(`${BASE_URL}/checkout/process`, {
        MaNguoiDung: adminUserId,
        NguoiNhan: "Tester Hệ Thống",
        SDTNguoiNhan: "0988776655",
        DiaChi: "Tòa nhà Bitexco, Quận 1, TP. HCM",
        PhuongThucThanhToan: "COD",
        MaKho: testWarehouse,
        ChiTiet: [
          {
            MaSP: testProduct,
            SoLuong: 1,
            GiaBan: 29990000,
            GiamGia: 0,
          },
        ],
      });

      const maDonHang = checkoutRes.data?.maDonHang;
      const orderOk = Boolean(checkoutRes.data?.success && maDonHang);

      // Lấy tồn kho sau khi checkout
      const stockAfterQuery = await pool.query(
        "SELECT soluongton FROM tonkho WHERE masp = $1 AND makho = $2",
        [testProduct, testWarehouse]
      );
      const stockAfter = parseFloat(stockAfterQuery.rows[0]?.soluongton) || 0;

      const stockDeductedCorrectly = stockAfter === stockBefore - 1;
      const passed = orderOk && stockDeductedCorrectly;

      recordTest(
        5,
        "Tạo đơn hàng thành công và trừ tồn kho chính xác",
        passed,
        `Mã đơn: ${maDonHang} | Tồn kho '${testWarehouse}': ${stockBefore} -> ${stockAfter} (-1 cái)`
      );
    } catch (err) {
      recordTest(5, "Đặt hàng và trừ kho", false, err.response?.data?.message || err.message);
    }

    // -------------------------------------------------------------------------
    // BÁO CÁO TỔNG KẾT TOÀN DIỆN
    // -------------------------------------------------------------------------
    console.log(
      `\n${colors.bright}${colors.blue}=====================================================${colors.reset}`
    );
    console.log(
      `${colors.bright}${colors.blue}             BÁO CÁO TỔNG KẾT KIỂM THỬ               ${colors.reset}`
    );
    console.log(
      `${colors.bright}${colors.blue}=====================================================${colors.reset}`
    );

    const totalTests = results.length;
    const passedTests = results.filter((r) => r.passed).length;
    const failedTests = totalTests - passedTests;

    results.forEach((r) => {
      const badge = r.passed
        ? `${colors.green}✔ PASS${colors.reset}`
        : `${colors.red}✖ FAIL${colors.reset}`;
      console.log(`[${badge}] Bước ${r.stepNumber}: ${r.title}`);
    });

    console.log("-----------------------------------------------------");
    console.log(
      `Tổng số bước: ${totalTests} | ${colors.green}Đạt: ${passedTests}${colors.reset} | ${
        failedTests > 0 ? colors.red : colors.green
      }Lỗi: ${failedTests}${colors.reset}`
    );

    if (failedTests === 0) {
      console.log(
        `\n${colors.bright}${colors.green}🎉 XÁC NHẬN: TOÀN BỘ HỆ THỐNG VẬN HÀNH CHÍNH XÁC 100%!${colors.reset}\n`
      );
      process.exit(0);
    } else {
      console.log(
        `\n${colors.bright}${colors.red}❌ CẢNH BÁO: CÓ ${failedTests} BƯỚC KIỂM THỬ KHÔNG ĐẠT!${colors.reset}\n`
      );
      process.exit(1);
    }
  } catch (globalError) {
    console.error("💥 Lỗi ngoài dự kiến trong quá trình kiểm thử:", globalError);
    process.exit(1);
  }
}

runFullSystemTest();
