// src/JS/common/header.js
export const BASE_URL =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1")
    ? "http://localhost:5000/api"
    : "https://qlbh-project.onrender.com/api";

import Swal from "sweetalert2";

function injectHeaderCSS() {
  const cssPath = "/src/styles/header.css";
  if (!document.querySelector(`link[href="${cssPath}"]`)) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = cssPath;
    document.head.appendChild(link);
  }
}

// Khởi tạo Header
export function initHeader() {
  renderHeader();
  injectHeaderCSS();
  checkLoginStatus();
  updateCartBadge();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initHeader);
} else {
  initHeader();
}

// Cập nhật số lượng giỏ hàng trên Header
export function updateCartBadge() {
  const savedUser = localStorage.getItem("hpstore_user") || localStorage.getItem("user");
  let totalItems = 0;

  if (savedUser) {
    try {
      const u = JSON.parse(savedUser);
      const uid = u.id || u.maND;
      const userCart = JSON.parse(localStorage.getItem(`hpstore_cart_${uid}`)) || [];
      totalItems = userCart.reduce((sum, item) => sum + (parseInt(item.SoLuong || item.soluong) || 0), 0);
    } catch (e) {}
  } else {
    const guestCart = JSON.parse(localStorage.getItem("hpstore_cart_guest")) || [];
    totalItems = guestCart.reduce((sum, item) => sum + (parseInt(item.SoLuong || item.soluong) || 0), 0);
  }

  const badgeEl = document.getElementById("cart-count");
  if (badgeEl) {
    badgeEl.innerText = totalItems;
  }
}

// Sinh giao diện Header chuẩn HP STORE (Độc quyền, không sợ trùng lặp thương hiệu)
export function renderHeader() {
  const headerElement = document.getElementById("main-header");
  if (!headerElement) return;

  headerElement.innerHTML = `
    <!-- 1. Topbar Tiện ích Siêu khuyến mãi & Hỗ trợ -->
    <div class="hp-topbar py-1 d-none d-lg-block">
      <div class="container d-flex align-items-center justify-content-between">
        <div class="d-flex align-items-center gap-3">
          <span><i class="fa-solid fa-circle-check text-warning me-1"></i> Sản phẩm <b>Chính hãng - Xuất VAT đầy đủ</b></span>
          <span>•</span>
          <span><i class="fa-solid fa-truck-fast text-info me-1"></i> <b>Giao siêu tốc 2h - Miễn phí</b> cho đơn từ 300k</span>
          <span>•</span>
          <span><i class="fa-solid fa-arrows-rotate text-success me-1"></i> <b>Thu cũ đổi mới</b> trợ giá lên đến 5 triệu</span>
        </div>
        <div class="d-flex align-items-center gap-3">
          <a href="#"><i class="fa-solid fa-location-dot me-1"></i> Hệ thống 120 cửa hàng</a>
          <a href="/src/pages/order-history.html"><i class="fa-solid fa-receipt me-1"></i> Tra cứu đơn hàng</a>
          <span><i class="fa-solid fa-phone me-1"></i> Tổng đài <b>1800.6868</b> (Miễn phí)</span>
        </div>
      </div>
    </div>

    <!-- 2. Main Navigation Header HP STORE -->
    <div class="hp-main-header py-2">
      <div class="container">
        <div class="row align-items-center g-2 g-md-3">
          
          <!-- Logo HP STORE độc quyền -->
          <div class="col-auto">
            <a class="hp-brand-logo" href="/" title="HP STORE - Hệ thống Bán lẻ Công nghệ Chính hãng">
              <span class="hp-logo-badge"><i class="fa-solid fa-bolt me-1"></i>HP</span>
              <div class="hp-logo-text d-none d-sm-flex">
                <span class="title">HP <span>STORE</span></span>
                <span class="slogan">Công nghệ chính hãng</span>
              </div>
            </a>
          </div>

          <!-- Nút Danh mục -->
          <div class="col-auto d-none d-xl-block">
            <button class="hp-header-btn" type="button" id="btnHeaderCategory" onclick="document.getElementById('category-filter')?.scrollIntoView({behavior: 'smooth'})">
              <i class="fa-solid fa-grid-2 me-1"></i>
              <i class="fa-solid fa-bars"></i>
              <span>Danh mục SP</span>
            </button>
          </div>

          <!-- Nút Chọn vị trí xem giá -->
          <div class="col-auto d-none d-lg-block">
            <div class="dropdown">
              <button class="hp-header-btn dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                <i class="fa-solid fa-location-dot"></i>
                <div class="text-start" style="line-height: 1.1;">
                  <span style="font-size: 10px; opacity: 0.85; display: block;">Xem kho tại</span>
                  <span id="currentLocationText">TP. Hồ Chí Minh</span>
                </div>
              </button>
              <ul class="dropdown-menu shadow">
                <li><a class="dropdown-item" href="#" onclick="document.getElementById('currentLocationText').innerText='TP. Hồ Chí Minh'; return false;"><i class="fa-solid fa-building me-2 text-danger"></i>Chi nhánh 1: TP. Hồ Chí Minh</a></li>
                <li><a class="dropdown-item" href="#" onclick="document.getElementById('currentLocationText').innerText='Hà Nội'; return false;"><i class="fa-solid fa-landmark me-2 text-primary"></i>Chi nhánh 2: Hà Nội (Cầu Giấy)</a></li>
                <li><a class="dropdown-item" href="#" onclick="document.getElementById('currentLocationText').innerText='Kho Tổng Trung Tâm'; return false;"><i class="fa-solid fa-warehouse me-2 text-warning"></i>Kho Tổng Trung Tâm</a></li>
              </ul>
            </div>
          </div>

          <!-- Thanh tìm kiếm thông minh -->
          <div class="col flex-grow-1 position-relative">
            <div class="hp-search-container">
              <input type="text" id="search-input" class="hp-search-input" placeholder="Bạn cần tìm sản phẩm gì? (iPhone, Laptop Gaming, Smartwatch...)" autocomplete="off">
              <button class="hp-search-btn" id="btnSearchSubmit" type="button" aria-label="Tìm kiếm"><i class="fa-solid fa-magnifying-glass"></i></button>
              <div id="search-suggestions" class="list-group d-none"></div>
            </div>
          </div>

          <!-- Nhóm Action: Đơn hàng, Giỏ hàng, Đăng nhập / HP Member -->
          <div class="col-auto d-flex align-items-center gap-2" id="auth-section">
            <a href="/src/pages/order-history.html" class="hp-header-btn d-none d-md-flex" title="Tra cứu tiến độ giao hàng">
              <i class="fa-solid fa-truck-ramp-box fs-6"></i>
              <span class="d-none d-xxl-inline">Đơn hàng</span>
            </a>

            <!-- Giỏ hàng -->
            <button class="hp-cart-btn" id="btn-header-cart" type="button" aria-label="Xem giỏ hàng">
              <i class="fa-solid fa-cart-shopping fs-6"></i>
              <span class="d-none d-sm-inline">Giỏ hàng</span>
              <span class="hp-cart-badge" id="cart-count">0</span>
            </button>

            <!-- Tài khoản / Đăng nhập mặc định -->
            <a href="/src/pages/login.html" class="hp-auth-btn" id="btn-login-nav">
              <i class="fa-regular fa-circle-user fs-5"></i>
              <span class="d-none d-sm-inline">HP Member</span>
            </a>
          </div>

        </div>
      </div>
    </div>
  `;

  const cartBtn = document.getElementById("btn-header-cart");
  if (cartBtn) {
    cartBtn.addEventListener("click", () => {
      window.location.href = "/src/pages/cart.html";
    });
  }
}

// Kiểm tra trạng thái đăng nhập và hiển thị Menu cá nhân HP Member
export function checkLoginStatus() {
  const authSection = document.getElementById("auth-section");
  if (!authSection) return;

  let userData = null;
  try {
    const raw = localStorage.getItem("hpstore_user") || localStorage.getItem("user");
    if (raw) userData = JSON.parse(raw);
  } catch (e) {}

  if (userData && (userData.token || userData.id)) {
    const displayName = userData.name || userData.fullname || userData.username || "Hội viên";
    const userRole = String(userData.role || "").toUpperCase();

    // Thay thế nút đăng nhập bằng menu Dropdown HP Member cao cấp
    const loginBtn = document.getElementById("btn-login-nav");
    if (loginBtn) {
      const dropdownContainer = document.createElement("div");
      dropdownContainer.className = "dropdown user-dropdown";
      dropdownContainer.innerHTML = `
        <button class="hp-header-btn dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false" style="background: rgba(255,255,255,0.25);">
          <div class="d-flex align-items-center gap-2">
            <div style="width: 26px; height: 26px; background: #ffffff; color: var(--hp-brand-primary); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 11px;">
              ${displayName.substring(0, 1).toUpperCase()}
            </div>
            <div class="text-start d-none d-sm-block" style="line-height: 1.1;">
              <span style="font-size: 10px; opacity: 0.85;">HP Member</span>
              <span class="fw-bold d-block text-truncate" style="max-width: 95px;">${displayName}</span>
            </div>
          </div>
        </button>
        <ul class="dropdown-menu dropdown-menu-end shadow">
          <li class="px-3 py-2 border-bottom">
            <div class="small text-muted">Hội viên HP STORE</div>
            <div class="fw-bold text-danger">${displayName}</div>
            <small class="badge bg-danger-subtle text-danger border border-danger-subtle mt-1">Hạng: HP VIP Member</small>
          </li>
          <li><a class="dropdown-item py-2" href="/src/pages/hoso.html"><i class="fa-solid fa-id-card me-2 text-secondary"></i>Tài khoản của tôi</a></li>
          <li><a class="dropdown-item py-2" href="/src/pages/order-history.html"><i class="fa-solid fa-box-open me-2 text-secondary"></i>Lịch sử mua hàng</a></li>
          
          ${
            ["MANAGER", "ADMIN"].includes(userRole)
              ? `
            <li><hr class="dropdown-divider"></li>
            <li><a class="dropdown-item py-2 text-primary fw-bold" href="/src/pages/dashboard.html" onclick="localStorage.setItem('current_admin_page', 'tong-quan')"><i class="fa-solid fa-gauge-high me-2"></i>Trang Quản trị Hệ thống</a></li>
            `
              : ""
          }

          ${
            ["EMPLOYEE", "STAFF"].includes(userRole)
              ? `
            <li><hr class="dropdown-divider"></li>
            <li><a class="dropdown-item py-2 text-success fw-bold" href="/src/pages/employeeManager.html"><i class="fa-solid fa-user-gear me-2"></i>Giao diện Nhân viên</a></li>
            `
              : ""
          }

          <li><hr class="dropdown-divider"></li>
          <li><a class="dropdown-item py-2 text-danger" id="btnLogout" href="#" style="cursor: pointer;"><i class="fa-solid fa-power-off me-2"></i>Đăng xuất</a></li>
        </ul>
      `;

      loginBtn.replaceWith(dropdownContainer);

      const logoutBtn = dropdownContainer.querySelector("#btnLogout");
      if (logoutBtn) {
        logoutBtn.addEventListener("click", (e) => {
          e.preventDefault();
          Swal.fire({
            title: "Xác nhận đăng xuất?",
            text: "Bạn có chắc chắn muốn rời khỏi tài khoản HP STORE?",
            icon: "question",
            showCancelButton: true,
            confirmButtonColor: "#d90429",
            cancelButtonColor: "#6c757d",
            confirmButtonText: "Đăng xuất",
            cancelButtonText: "Ở lại",
          }).then((res) => {
            if (res.isConfirmed) {
              localStorage.removeItem("hpstore_user");
              localStorage.removeItem("user");
              localStorage.removeItem("token");
              window.location.reload();
            }
          });
        });
      }
    }
  }
}
