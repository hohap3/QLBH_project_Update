const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

async function testManagerAccess(username, password, expectedBranch) {
  console.log(`\n======================================================`);
  console.log(`🔍 KIỂM THỬ TÀI KHOẢN: ${username} (Kỳ vọng: ${expectedBranch})`);
  console.log(`======================================================`);

  // 1. Đăng nhập
  try {
    const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
      identifier: username,
      password: password
    });
    console.log(`✅ [1] Đăng nhập: THÀNH CÔNG (HTTP ${loginRes.status})`);
    const { token, user } = loginRes.data;
    console.log(`    - Vai trò trả về: ${user.role}`);
    console.log(`    - Chi nhánh: ${user.machinhanh}`);
    console.log(`    - Họ tên: ${user.fullname}`);

    if (user.role.toUpperCase() !== 'MANAGER') {
      console.error(`❌ LỖI: Vai trò không phải là MANAGER`);
      return false;
    }
    if (user.machinhanh !== expectedBranch) {
      console.error(`❌ LỖI: Chi nhánh ${user.machinhanh} khác kỳ vọng ${expectedBranch}`);
      return false;
    }

    const headers = { Authorization: `Bearer ${token}` };

    // 2. Kiểm tra thẩm định vai trò (Auth-guard)
    const verifyRes = await axios.get(`${BASE_URL}/auth/verify-role`, { headers });
    console.log(`✅ [2] Xác thực Auth-Guard (/auth/verify-role): THÀNH CÔNG`);
    console.log(`    - Vai trò giải mã từ Token: ${verifyRes.data.role}`);
    console.log(`    - Chi nhánh gắn với Token: ${verifyRes.data.machinhanh}`);

    // 3. Kiểm tra các API Thống kê Dashboard Tổng quan
    const endpoints = [
      { name: 'Overview Stats', url: `${BASE_URL}/thongke/overview` },
      { name: 'Customer Analytics', url: `${BASE_URL}/thongke/customer-analytics` },
      { name: 'Inventory Analytics', url: `${BASE_URL}/thongke/inventory-analytics` },
      { name: 'Sản phẩm theo Danh mục', url: `${BASE_URL}/thongke/san-pham-danh-muc` },
      { name: 'Top 5 Sản phẩm', url: `${BASE_URL}/thongke/top-products` },
      { name: 'Doanh thu theo Tháng', url: `${BASE_URL}/thongke/monthly-revenue` },
      { name: 'Đơn hàng theo Tháng', url: `${BASE_URL}/thongke/monthly-orders` },
    ];

    for (const ep of endpoints) {
      const res = await axios.get(ep.url, { headers });
      console.log(`✅ [3] API ${ep.name}: OK (HTTP ${res.status}) - Data count/status: ${res.data.success !== false}`);
    }

    return true;
  } catch (err) {
    console.error(`❌ LỖI KIỂM THỬ:`, err.response ? err.response.data : err.message);
    return false;
  }
}

async function run() {
  const result1 = await testManagerAccess('manager_cn1', '123456', 'CN_1');
  const result2 = await testManagerAccess('manager_cn2', '123456', 'CN_2');
  
  console.log(`\n======================================================`);
  if (result1 && result2) {
    console.log(`🎉 TẤT CẢ TÀI KHOẢN QUẢN LÝ CHI NHÁNH 1 VÀ 2 ĐỀU TRUY CẬP DASHBOARD HOÀN TOÀN THÀNH CÔNG!`);
  } else {
    console.log(`❌ CÓ LỖI XẢY RA TRONG QUÁ TRÌNH KIỂM THỬ!`);
  }
  console.log(`======================================================\n`);
}

run();
