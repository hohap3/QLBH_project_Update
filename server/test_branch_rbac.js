// server/test_branch_rbac.js
const axios = require("axios");

const BASE_URL = "http://localhost:5000/api";

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  bright: "\x1b[1m",
};

let testCount = 0;
let passedCount = 0;
let failedCount = 0;

function report(step, name, passed, detail = "") {
  testCount++;
  if (passed) {
    passedCount++;
    console.log(`  ${colors.green}[✔ PASS]${colors.reset} Bước ${step}: ${name}`);
    if (detail) console.log(`         ${colors.cyan}↳ ${detail}${colors.reset}`);
  } else {
    failedCount++;
    console.log(`  ${colors.red}[✖ FAIL]${colors.reset} Bước ${step}: ${name}`);
    if (detail) console.log(`         ${colors.red}↳ Lỗi: ${detail}${colors.reset}`);
  }
}

async function runRbacTests() {
  console.log(`\n${colors.bright}${colors.blue}================================================================${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}    KIỂM THỬ TÍCH HỢP PHÂN QUYỀN QUẢN LÝ CHI NHÁNH & ADMIN (RBAC)  ${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}    Target API: ${BASE_URL}${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}================================================================\n${colors.reset}`);

  let adminToken = null;
  let managerCn1Token = null;
  let managerCn2Token = null;
  let staffUser = null;

  try {
    // -------------------------------------------------------------------------
    // BƯỚC 1: ĐĂNG NHẬP ADMIN & NHẬN DIỆN TOKEN QUẢN LÝ TỔNG
    // -------------------------------------------------------------------------
    console.log(`${colors.bright}▶ 1. Kiểm thử Đăng nhập Quản lý Tổng (Super Admin)...${colors.reset}`);
    try {
      const res = await axios.post(`${BASE_URL}/auth/login`, {
        identifier: "admin",
        password: "password123",
      }).catch(() => axios.post(`${BASE_URL}/auth/login`, {
        identifier: "admin",
        password: "123456",
      }));

      adminToken = res.data.token;
      const user = res.data.user;
      const ok = adminToken && user.role === "ADMIN" && user.machinhanh === null;
      report(1, "Đăng nhập Super Admin nhận token hợp lệ và machinhanh = NULL", ok, `User: ${user.username} | Role: ${user.role} | Chi nhánh: ${user.machinhanh}`);
    } catch (e) {
      report(1, "Đăng nhập Super Admin", false, e.response?.data?.message || e.message);
    }

    // -------------------------------------------------------------------------
    // BƯỚC 2: SUPER ADMIN XEM TOÀN BỘ VÀ XEM TỪNG CHI NHÁNH
    // -------------------------------------------------------------------------
    console.log(`\n${colors.bright}▶ 2. Kiểm thử Super Admin xem dữ liệu Dashboard các chi nhánh...${colors.reset}`);
    try {
      const headers = { headers: { Authorization: `Bearer ${adminToken}` } };
      const [resAll, resCn1, resCn2] = await Promise.all([
        axios.get(`${BASE_URL}/thongke/overview?branch=ALL`, headers),
        axios.get(`${BASE_URL}/thongke/overview?branch=KHO_CN1`, headers),
        axios.get(`${BASE_URL}/thongke/overview?branch=KHO_CN2`, headers),
      ]);

      const tonAll = resAll.data.data.TongTonKho.SoLuongTon;
      const tonCn1 = resCn1.data.data.TongTonKho.SoLuongTon;
      const tonCn2 = resCn2.data.data.TongTonKho.SoLuongTon;

      const ok = tonAll === 301 && tonCn1 === 130 && tonCn2 === 38;
      report(2, "Super Admin xem full tất cả chi nhánh (301 SP) và lọc từng kho (CN1: 130, CN2: 38)", ok, `Toàn chuỗi: ${tonAll} SP | CN1: ${tonCn1} SP | CN2: ${tonCn2} SP`);
    } catch (e) {
      report(2, "Super Admin xem Dashboard", false, e.response?.data?.message || e.message);
    }

    // -------------------------------------------------------------------------
    // BƯỚC 3: ĐĂNG NHẬP QUẢN LÝ CHI NHÁNH 1 (MANAGER CN1)
    // -------------------------------------------------------------------------
    console.log(`\n${colors.bright}▶ 3. Kiểm thử Đăng nhập Quản lý Chi nhánh 1 (manager_cn1)...${colors.reset}`);
    try {
      const res = await axios.post(`${BASE_URL}/auth/login`, {
        identifier: "manager_cn1",
        password: "123456",
      });
      managerCn1Token = res.data.token;
      const user = res.data.user;
      const ok = managerCn1Token && user.role === "MANAGER" && user.machinhanh === "CN_1";
      report(3, "Đăng nhập Manager CN1 nhận token có machinhanh = 'CN_1'", ok, `User: ${user.username} | Role: ${user.role} | Chi nhánh: ${user.machinhanh}`);
    } catch (e) {
      report(3, "Đăng nhập Manager CN1", false, e.response?.data?.message || e.message);
    }

    // -------------------------------------------------------------------------
    // BƯỚC 4: QUẢN LÝ CN1 BỊ ÉP BUỘC XEM ĐÚNG CHI NHÁNH 1 (SCOPED ACCESS)
    // -------------------------------------------------------------------------
    console.log(`\n${colors.bright}▶ 4. Kiểm thử Scoped Access của Quản lý Chi nhánh 1...${colors.reset}`);
    try {
      const headers = { headers: { Authorization: `Bearer ${managerCn1Token}` } };
      // Manager CN1 gọi không truyền param hoặc truyền 'ALL' -> Backend tự động ép về CN_1
      const res = await axios.get(`${BASE_URL}/thongke/overview`, headers);
      const tonKho = res.data.data.TongTonKho.SoLuongTon;
      const ok = tonKho === 130; // Đúng số tồn kho CN1
      report(4, "Backend tự động ép buộc Manager CN1 chỉ xem tồn kho của CN1 (130 SP)", ok, `Số tồn trả về: ${tonKho} SP (Khớp đúng Kho CN1)`);
    } catch (e) {
      report(4, "Scoped Access CN1", false, e.response?.data?.message || e.message);
    }

    // -------------------------------------------------------------------------
    // BƯỚC 5: QUẢN LÝ CN1 CỐ TÌNH TRUY CẬP CHI NHÁNH 2 -> BỊ CHẶN 403
    // -------------------------------------------------------------------------
    console.log(`\n${colors.bright}▶ 5. Kiểm thử Chặn Quản lý CN1 xem trộm dữ liệu Chi nhánh 2...${colors.reset}`);
    try {
      const headers = { headers: { Authorization: `Bearer ${managerCn1Token}` } };
      let blocked = false;
      let status = 0;
      let errMsg = "";
      try {
        await axios.get(`${BASE_URL}/thongke/overview?branch=KHO_CN2`, headers);
      } catch (err) {
        status = err.response?.status;
        errMsg = err.response?.data?.message;
        blocked = status === 403;
      }
      report(5, "Chặn truy cập trái phép chi nhánh khác trả về mã 403 Forbidden", blocked, `HTTP Status: ${status} | Thông báo: ${errMsg}`);
    } catch (e) {
      report(5, "Kiểm tra chặn trái phép", false, e.message);
    }

    // -------------------------------------------------------------------------
    // BƯỚC 6: QUẢN LÝ CHI NHÁNH CỐ TÌNH GỌI API PHÂN QUYỀN -> BỊ CHẶN 403
    // -------------------------------------------------------------------------
    console.log(`\n${colors.bright}▶ 6. Kiểm thử Chặn Quản lý Chi nhánh tự cấp quyền...${colors.reset}`);
    try {
      const headers = { headers: { Authorization: `Bearer ${managerCn1Token}` } };
      let blocked = false;
      let status = 0;
      let errMsg = "";
      try {
        await axios.put(`${BASE_URL}/employees/dummy-id/role`, { newRole: "ADMIN" }, headers);
      } catch (err) {
        status = err.response?.status;
        errMsg = err.response?.data?.message;
        blocked = status === 403;
      }
      report(6, "Chỉ Quản lý Tổng mới có quyền gọi API phân quyền (Manager gọi bị 403)", blocked, `HTTP Status: ${status} | Thông báo: ${errMsg}`);
    } catch (e) {
      report(6, "Chặn Manager cấp quyền", false, e.message);
    }

    // -------------------------------------------------------------------------
    // BƯỚC 7: SUPER ADMIN ỦY QUYỀN / NÂNG CẤP TÀI KHOẢN
    // -------------------------------------------------------------------------
    console.log(`\n${colors.bright}▶ 7. Kiểm thử Super Admin ủy quyền / phân quyền nhân sự...${colors.reset}`);
    try {
      const adminHeaders = { headers: { Authorization: `Bearer ${adminToken}` } };
      // Tìm 1 nhân viên STAFF để test phân quyền
      const empListRes = await axios.get(`${BASE_URL}/employees`, adminHeaders);
      const staffList = empListRes.data.data.filter((u) => u.mavaitro === "STAFF");
      staffUser = staffList[0];

      if (!staffUser) {
        report(7, "Tìm nhân viên STAFF để test", false, "Không tìm thấy nhân viên STAFF nào");
      } else {
        // Nâng cấp nhân viên này lên MANAGER Chi nhánh 2
        const promoteRes = await axios.put(
          `${BASE_URL}/employees/${staffUser.mand}/role`,
          { newRole: "MANAGER", newBranch: "CN_2" },
          adminHeaders
        );

        const okPromote = promoteRes.data.success === true;

        // Hoàn trả lại quyền STAFF cho nhân viên
        await axios.put(
          `${BASE_URL}/employees/${staffUser.mand}/role`,
          { newRole: "STAFF", newBranch: "CN_1" },
          adminHeaders
        );

        report(7, "Super Admin cấp quyền MANAGER cho nhân viên thành công", okPromote, `Tài khoản: ${staffUser.tendangnhap} -> MANAGER (CN_2) -> Đã khôi phục STAFF`);
      }
    } catch (e) {
      report(7, "Super Admin phân quyền", false, e.response?.data?.message || e.message);
    }

    // =========================================================================
    // TỔNG KẾT BÁO CÁO
    // =========================================================================
    console.log(`\n${colors.bright}${colors.blue}================================================================${colors.reset}`);
    console.log(`${colors.bright}${colors.blue}                 BÁO CÁO TỔNG KẾT KIỂM THỬ RBAC                 ${colors.reset}`);
    console.log(`${colors.bright}${colors.blue}================================================================${colors.reset}`);
    console.log(`  Tổng số ca kiểm thử: ${testCount}`);
    console.log(`  ${colors.green}Đạt (PASS): ${passedCount}${colors.reset}`);
    console.log(`  ${colors.red}Thất bại (FAIL): ${failedCount}${colors.reset}`);
    console.log(`----------------------------------------------------------------`);
    if (failedCount === 0) {
      console.log(`  ${colors.bright}${colors.green}🎉 XÁC NHẬN: MÔ HÌNH PHÂN QUYỀN ĐA CHI NHÁNH HOẠT ĐỘNG HOÀN HẢO 100%!${colors.reset}\n`);
    } else {
      console.log(`  ${colors.bright}${colors.red}💥 CẦN ĐIỀU CHỈNH: Có ${failedCount} ca kiểm thử thất bại!${colors.reset}\n`);
      process.exit(1);
    }
  } catch (err) {
    console.error("LỖI NGOẠI LỆ KHI CHẠY TEST:", err);
    process.exit(1);
  }
}

runRbacTests().then(() => process.exit(0)).catch(() => process.exit(1));
