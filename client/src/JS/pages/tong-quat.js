import axios from "axios";
import Chart from "chart.js/auto";
import { BASE_URL } from "/src/JS/common/header";

function getAuthHeaders() {
  let token = localStorage.getItem("token");
  if (!token) {
    try {
      const user = JSON.parse(localStorage.getItem("user") || localStorage.getItem("hpstore_user") || "{}");
      token = user?.token;
    } catch (e) {}
  }
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
}

function getEnterpriseColors() {
  return [
    "#3b82f6", // Blue
    "#8b5cf6", // Purple
    "#10b981", // Green
    "#f59e0b", // Orange
    "#6366f1", // Indigo
    "#14b8a6", // Teal
    "#ec4899", // Pink
    "#f43f5e"  // Rose
  ];
}

// 1. Biểu đồ hình tròn: Phân bổ sản phẩm theo danh mục
async function renderCategoryChart(branch = "ALL") {
  try {
    const response = await axios.get(`${BASE_URL}/thongke/san-pham-danh-muc`, {
      params: { branch },
      ...getAuthHeaders(),
    });
    const stats = response.data.data;

    const labels = stats.map((item) => item.label || item.tendanhmuc);
    const dataValues = stats.map((item) => parseInt(item.value) || 0);

    const enterpriseColors = getEnterpriseColors();
    const dynamicColors = stats.map((_, i) => enterpriseColors[i % enterpriseColors.length]);
    const canvasElement = document.getElementById("categoryPieChart");
    if (!canvasElement) return;

    const ctx = canvasElement.getContext("2d");
    const existingChart = Chart.getChart(canvasElement);
    if (existingChart) existingChart.destroy();

    new Chart(ctx, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Số lượng",
            data: dataValues,
            backgroundColor: dynamicColors,
            borderRadius: 4,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "rgba(26, 28, 46, 0.9)",
            padding: 12,
            cornerRadius: 8,
            titleFont: { size: 14, weight: "bold" },
            bodyFont: { size: 13 },
          },
        },
        scales: {
          x: { grid: { color: "#eef0f3", borderDash: [5, 5] } },
          y: { grid: { display: false } }
        }
      },
    });
  } catch (err) {
    console.error("Lỗi khi vẽ biểu đồ danh mục:", err);
  }
}

// 2. Biểu đồ Horizontal Bar: Top 5 sản phẩm bán chạy
async function renderTopProductsChart(branch = "ALL") {
  try {
    const response = await axios.get(`${BASE_URL}/thongke/top-products`, {
      params: { branch },
      ...getAuthHeaders(),
    });
    const products = response.data.data.slice(0, 5);

    const labels = products.map((item) => {
        let label = item.label || item.tendanhmuc || "Sản phẩm";
        if (label.length > 20) label = label.substring(0, 20) + '...';
        return label;
    });
    const dataValues = products.map((item) => parseFloat(item.totalRevenue || item.totalrevenue) || 0);

    const canvasElement = document.getElementById("topProductsChart");
    if (!canvasElement) return;

    const ctx = canvasElement.getContext("2d");
    const existingChart = Chart.getChart(canvasElement);
    if (existingChart) existingChart.destroy();

    new Chart(ctx, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Doanh thu",
            data: dataValues,
            backgroundColor: "#2563eb",
            borderRadius: 4,
            barThickness: 20,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "rgba(26, 28, 46, 0.9)",
            callbacks: {
              label: function(context) {
                return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(context.parsed.x);
              }
            }
          }
        },
        scales: {
          x: { 
            grid: { color: "#eef0f3", borderDash: [5, 5] },
            ticks: {
              callback: function(value) {
                return value >= 1000000 ? (value / 1000000) + "M" : value;
              }
            }
          },
          y: { grid: { display: false } }
        }
      },
    });
  } catch (err) {
    console.error("Lỗi vẽ biểu đồ Top Products:", err);
  }
}

// 3. GRAPH 1: Biểu đồ ĐƯỜNG - Doanh thu theo tháng
async function renderMonthlyRevenueChart(branch = "ALL") {
  try {
    const response = await axios.get(`${BASE_URL}/thongke/monthly-revenue`, {
      params: { branch },
      ...getAuthHeaders(),
    });
    const stats = response.data.data;

    const labels = stats.map((item) => item.label);
    const dataValues = stats.map((item) => parseFloat(item.value) || 0);

    const canvasElement = document.getElementById("monthlyRevenueChart");
    if (!canvasElement) return;

    const ctx = canvasElement.getContext("2d");
    const existingChart = Chart.getChart(canvasElement);
    if (existingChart) existingChart.destroy();

    new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Doanh thu",
            data: dataValues,
            borderColor: "#3b82f6",
            backgroundColor: "rgba(59, 130, 246, 0.04)",
            borderWidth: 3,
            tension: 0.4,
            pointBackgroundColor: "#ffffff",
            pointBorderColor: "#3b82f6",
            pointBorderWidth: 2,
            pointRadius: 5,
            pointHoverRadius: 7,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: "#eef0f3", drawBorder: false, borderDash: [5, 5] },
            ticks: {
              font: { size: 12 },
              color: "#64748b",
              callback: function (value) {
                if (value === 0) return "0";
                return value >= 1000000
                  ? value / 1000000 + "M"
                  : value.toLocaleString("vi-VN");
              },
            },
          },
          x: {
            grid: { display: false },
            ticks: { font: { size: 12, weight: "500" }, color: "#64748b" },
          },
        },
        plugins: {
          legend: {
            position: "bottom",
            labels: { usePointStyle: true, pointStyle: "circle", padding: 20 },
          },
        },
      },
    });

    const skeleton = document.getElementById("skeletonRev");
    if (skeleton) skeleton.classList.add("d-none");
  } catch (err) {
    console.error("Lỗi vẽ biểu đồ đường doanh thu tháng:", err);
  }
}

// 4. GRAPH 2: Biểu đồ CỘT - Số lượng đơn hàng theo tháng
async function renderMonthlyOrdersChart(branch = "ALL") {
  try {
    const response = await axios.get(`${BASE_URL}/thongke/monthly-orders`, {
      params: { branch },
      ...getAuthHeaders(),
    });
    const stats = response.data.data;

    const labels = stats.map((item) => item.label);
    const dataValues = stats.map((item) => parseInt(item.value) || 0);

    const canvasElement = document.getElementById("monthlyOrdersChart");
    if (!canvasElement) return;

    const ctx = canvasElement.getContext("2d");
    const existingChart = Chart.getChart(canvasElement);
    if (existingChart) existingChart.destroy();

    new Chart(ctx, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Số đơn",
            data: dataValues,
            backgroundColor: "#9333ea",
            borderRadius: 5,
            barThickness: 30,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            grid: { drawBorder: false, color: "#f0f0f0" },
            ticks: { color: "#64748b" },
          },
          x: {
            grid: { display: false },
            ticks: { color: "#64748b" },
          },
        },
        plugins: {
          legend: {
            position: "bottom",
            labels: { usePointStyle: true, padding: 20 },
          },
        },
      },
    });

    const skeleton = document.getElementById("skeletonOrd");
    if (skeleton) skeleton.classList.add("d-none");
  } catch (err) {
    console.error("Lỗi vẽ biểu đồ cột số đơn:", err);
  }
}

// 5. Phân tích khách hàng (Customer Analytics)
async function renderCustomerAnalytics(branch = "ALL") {
  try {
    const response = await axios.get(`${BASE_URL}/thongke/customer-analytics`, {
      params: { branch },
      ...getAuthHeaders(),
    });
    const data = response.data?.data;
    if (!data) return;

    const retEl = document.getElementById("returningCustomers");
    const vipEl = document.getElementById("vipCustomers");
    if (retEl) retEl.innerText = (data.khachQuayLai || 0).toLocaleString("vi-VN");
    if (vipEl) vipEl.innerText = (data.khachVIP || 0).toLocaleString("vi-VN");

    const canvasElement = document.getElementById("customerChart");
    if (!canvasElement) return;

    const ctx = canvasElement.getContext("2d");
    const existingChart = Chart.getChart(canvasElement);
    if (existingChart) existingChart.destroy();

    const segments = data.segments || [];
    const labels = segments.map((s) => s.label);
    const dataValues = segments.map((s) => s.value);
    const total = dataValues.reduce((a, b) => a + b, 0);

    new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: labels,
        datasets: [
          {
            data: total === 0 ? [1] : dataValues,
            backgroundColor: total === 0 ? ["#e2e8f0"] : ["#3b82f6", "#10b981", "#8b5cf6"],
            borderWidth: 3,
            borderColor: "#ffffff",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "right",
            labels: {
              boxWidth: 12,
              padding: 16,
              font: { size: 12, weight: "500" },
            },
          },
          tooltip: {
            backgroundColor: "rgba(26, 28, 46, 0.9)",
            padding: 10,
            cornerRadius: 8,
          },
        },
        cutout: "65%",
      },
    });
  } catch (err) {
    console.error("Lỗi vẽ biểu đồ Customer Analytics:", err);
  }
}

// 6. Phân tích kho hàng (Inventory Analytics)
async function renderInventoryAnalytics(branch = "ALL") {
  try {
    const response = await axios.get(`${BASE_URL}/thongke/inventory-analytics`, {
      params: { branch },
      ...getAuthHeaders(),
    });
    const data = response.data?.data;
    if (!data) return;

    const lowEl = document.getElementById("lowStockCount");
    const slowEl = document.getElementById("slowStockCount");
    const highEl = document.getElementById("highStockCount");
    if (lowEl) lowEl.innerText = (data.sapHet || 0).toLocaleString("vi-VN");
    if (slowEl) slowEl.innerText = (data.banCham || 0).toLocaleString("vi-VN");
    if (highEl) highEl.innerText = (data.tonNhieu || 0).toLocaleString("vi-VN");

    const canvasElement = document.getElementById("inventoryChart");
    if (!canvasElement) return;

    const ctx = canvasElement.getContext("2d");
    const existingChart = Chart.getChart(canvasElement);
    if (existingChart) existingChart.destroy();

    const dist = data.distribution || [];
    const labels = dist.map((d) => d.label);
    const dataValues = dist.map((d) => d.value);
    const total = dataValues.reduce((a, b) => a + b, 0);

    new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: labels,
        datasets: [
          {
            data: total === 0 ? [1] : dataValues,
            backgroundColor: total === 0 ? ["#e2e8f0"] : ["#ef4444", "#10b981", "#f59e0b"],
            borderWidth: 3,
            borderColor: "#ffffff",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "right",
            labels: {
              boxWidth: 12,
              padding: 16,
              font: { size: 12, weight: "500" },
            },
          },
          tooltip: {
            backgroundColor: "rgba(26, 28, 46, 0.9)",
            padding: 10,
            cornerRadius: 8,
          },
        },
        cutout: "65%",
      },
    });
  } catch (err) {
    console.error("Lỗi vẽ biểu đồ Inventory Analytics:", err);
  }
}

function updateBadgeTrend(badgeEl, trendTextEl, percentage) {
  if (!badgeEl || !trendTextEl) return;

  if (percentage >= 0) {
    badgeEl.className =
      "badge bg-success-light text-success rounded-pill px-3 py-2";
    trendTextEl.innerHTML = `<i class="fa-solid fa-arrow-up me-1"></i> +${percentage}%`;
  } else {
    badgeEl.className = "badge bg-danger text-white rounded-pill px-3 py-2";
    trendTextEl.innerHTML = `<i class="fa-solid fa-arrow-down me-1"></i> ${percentage}%`;
  }
}

// Áp dụng quyền hạn chi nhánh lên thanh Topbar Filter
export function applyBranchPermissions() {
  let user = null;
  try {
    const userStr = localStorage.getItem("user") || localStorage.getItem("hpstore_user");
    if (userStr) {
      user = JSON.parse(userStr);
    }
  } catch (e) {
    console.error("Lỗi parse thông tin user:", e);
  }
  if (!user) return;

  try {
    const role = String(user.role || "").toUpperCase();
    const branch = user.machinhanh;
    const branchSelect = document.getElementById("branchFilter");
    if (!branchSelect) return;

    if (role === "MANAGER" && branch) {
      // Map mã chi nhánh sang option tương ứng
      const branchValue =
        branch === "CN_CHINH" ? "KHO_TONG" : branch === "CN_1" ? "KHO_CN1" : "KHO_CN2";
      branchSelect.value = branchValue;
      branchSelect.disabled = true;
      branchSelect.title = "Bạn chỉ có quyền xem dữ liệu tại chi nhánh được phân công";
    } else if (role === "ADMIN") {
      branchSelect.disabled = false;
      branchSelect.title = "Quản lý Tổng: Xem toàn bộ chi nhánh";
    }
  } catch (e) {
    console.error("Lỗi áp dụng quyền chi nhánh:", e);
  }
}

// Hàm khởi tạo tổng hợp toàn bộ Dashboard Admin
export async function initTongQuan() {
  applyBranchPermissions();

  const skelRev = document.getElementById("skeletonRev");
  const skelOrd = document.getElementById("skeletonOrd");
  if (skelRev) skelRev.classList.remove("d-none");
  if (skelOrd) skelOrd.classList.remove("d-none");

  const branchFilter = document.getElementById("branchFilter")?.value || "ALL";
  const channelFilter = document.getElementById("channelFilter")?.value || "ALL";
  const startDate = document.getElementById("startDate")?.value || "";
  const endDate = document.getElementById("endDate")?.value || "";
  const params = { branch: branchFilter, channel: channelFilter };
  if (startDate) params.startDate = startDate;
  if (endDate) params.endDate = endDate;

  try {
    const resStats = await axios.get(`${BASE_URL}/thongke/overview`, {
      params,
      ...getAuthHeaders(),
    });
    const stats = resStats.data.data;

    const doanhThuObj = stats.DoanhThu || { ThangNay: 0, PhanTram: 0 };
    const donHangObj = stats.TongDonHang || { ThangNay: 0, PhanTram: 0 };
    const khachHangObj = stats.TongKhachHang || { ThangNay: 0, PhanTram: 0 };
    const loiNhuanObj = stats.LoiNhuanGop || { ThangNay: 0, PhanTram: 0 };

    const revenueEl = document.getElementById("totalRevenue");
    const ordersEl = document.getElementById("totalOrders");
    const customersEl = document.getElementById("totalCustomers");
    const profitEl = document.getElementById("totalProfit");

    if (revenueEl) {
      revenueEl.innerText = new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
      }).format(parseFloat(doanhThuObj.ThangNay) || 0);
    }

    const revSubEl = document.getElementById("revenueSub");
    if (revSubEl) {
      const tamTinh = parseFloat(doanhThuObj.TamTinh) || 0;
      if (tamTinh > 0) {
        revSubEl.innerHTML = `<span class="text-primary fw-medium"><i class="fa-solid fa-clock-rotate-left me-1"></i>+${new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(tamTinh)} tạm tính</span>`;
      } else {
        revSubEl.innerText = "";
      }
    }
    if (ordersEl) ordersEl.innerText = donHangObj.ThangNay.toLocaleString("vi-VN");
    if (customersEl) customersEl.innerText = khachHangObj.ThangNay.toLocaleString("vi-VN");
    if (profitEl) {
      profitEl.innerText = new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
      }).format(parseFloat(loiNhuanObj.ThangNay) || 0);
    }

    const aovEl = document.getElementById("totalAOV");
    if (aovEl) {
      const rev = parseFloat(doanhThuObj.ThangNay) || 0;
      const ord = parseInt(donHangObj.ThangNay) || 0;
      const aov = ord > 0 ? rev / ord : 0;
      aovEl.innerText = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(aov);
    }

    const inventoryEl = document.getElementById("totalInventory");
    if (inventoryEl) {
      const tonKhoObj = stats.TongTonKho;
      const totalStock = typeof tonKhoObj === "object" ? tonKhoObj.SoLuongTon : tonKhoObj;
      const countSp = tonKhoObj?.SoSPConHang;
      inventoryEl.innerText = `${(parseInt(totalStock, 10) || 0).toLocaleString("vi-VN")} SP`;
      
      const subEl = document.getElementById("inventorySub");
      if (subEl) {
        if (branchFilter === "KHO_TONG" || branchFilter === "CN_CHINH") {
          subEl.innerText = countSp !== undefined ? `${countSp} mặt hàng • Kho Tổng` : "Kho Tổng Trung Tâm";
        } else if (branchFilter === "KHO_CN1" || branchFilter === "CN_1") {
          subEl.innerText = countSp !== undefined ? `${countSp} mặt hàng • Kho CN 1` : "Kho Chi nhánh 1 (TP. HCM)";
        } else if (branchFilter === "KHO_CN2" || branchFilter === "CN_2") {
          subEl.innerText = countSp !== undefined ? `${countSp} mặt hàng • Kho CN 2` : "Kho Chi nhánh 2 (Hà Nội)";
        } else {
          subEl.innerText = countSp !== undefined ? `${countSp} mặt hàng • Toàn bộ 3 kho` : "Toàn bộ 3 kho";
        }
      }
    }

    updateBadgeTrend(
      document.getElementById("revenueBadge"),
      document.getElementById("revenueTrend"),
      doanhThuObj.PhanTram,
    );
    updateBadgeTrend(
      document.getElementById("ordersBadge"),
      document.getElementById("ordersTrend"),
      donHangObj.PhanTram,
    );
    updateBadgeTrend(
      document.getElementById("customersBadge"),
      document.getElementById("customersTrend"),
      khachHangObj.PhanTram,
    );
    updateBadgeTrend(
      document.getElementById("profitBadge"),
      document.getElementById("profitTrend"),
      loiNhuanObj.PhanTram,
    );

    await Promise.all([
      renderCategoryChart(branchFilter),
      renderTopProductsChart(branchFilter),
      renderMonthlyRevenueChart(branchFilter),
      renderMonthlyOrdersChart(branchFilter),
      renderCustomerAnalytics(branchFilter),
      renderInventoryAnalytics(branchFilter),
    ]);
  } catch (err) {
    console.error("Lỗi cập nhật Dashboard tổng quan:", err);
  }
}

// Lắng nghe sự kiện click nút Cập nhật
document.addEventListener("click", async function(e) {
  const btn = e.target.closest("#btnUpdateDashboard");
  if (btn) {
    e.preventDefault();
    const originalHtml = btn.innerHTML;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Đang tải...`;
    btn.disabled = true;

    try {
      await initTongQuan();
    } finally {
      btn.innerHTML = originalHtml;
      btn.disabled = false;
    }
  }
});

// Lắng nghe sự kiện thay đổi chi nhánh hoặc khoảng ngày
document.addEventListener("change", async function(e) {
  if (e.target && (e.target.id === "branchFilter" || e.target.id === "channelFilter" || e.target.id === "startDate" || e.target.id === "endDate")) {
    await initTongQuan();
  }
});


// ─── LẮNG NGHE SỰ KIỆN CLICK TRÊN CÁC THẺ KPI LIÊN KẾT (HÌNH 2) ───
document.addEventListener("click", function(e) {
  const kpiCard = e.target.closest(".kpi-card-interactive");
  if (!kpiCard) return;

  const targetPage = kpiCard.dataset.kpiPage;
  const action = kpiCard.dataset.kpiAction;

  if (targetPage) {
    const topMenuLink = document.querySelector(`.menu-page-link[data-page="${targetPage}"]`);
    if (topMenuLink) {
      topMenuLink.click();
    } else if (typeof window.switchPage === "function") {
      window.switchPage(targetPage);
    }
  } else if (action === "scroll-revenue") {
    const chartSection = document.getElementById("monthlyRevenueChart") || document.getElementById("categoryPieChart");
    if (chartSection) {
      chartSection.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }
});
