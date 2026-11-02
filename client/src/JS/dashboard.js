import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import * as bootstrap from "bootstrap";
import axios from "axios";
import Swal from "sweetalert2";
import { checkAuth } from "./auth-guard.js";

// Đưa bootstrap vào window scope để các thành phần và plugin khác sử dụng mượt mà
window.bootstrap = bootstrap;

// Cập nhật thông tin Quản trị viên trên Header
function updateUserSection() {
  const savedUser = localStorage.getItem("hpstore_user") || localStorage.getItem("user");
  if (!savedUser) return;

  try {
    const adminData = JSON.parse(savedUser);
    if (!adminData) return;

    const avatarEl = document.getElementById("empAvatar");
    const nameEl = document.getElementById("empName");
    const emailEl = document.getElementById("empEmail");
    const roleBadgeEl = document.getElementById("empRoleBadge");

    const displayName =
      adminData.fullName ||
      adminData.name ||
      adminData.fullname ||
      adminData.username ||
      "Quản trị viên";
    const displayEmail =
      adminData.email ||
      (adminData.username ? `${adminData.username}@hpstore.vn` : "admin@hpstore.vn");

    if (nameEl) nameEl.innerText = displayName;
    if (emailEl) emailEl.innerText = displayEmail;

    if (avatarEl) {
      const initials = displayName
        .trim()
        .split(/\s+/)
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .substring(0, 2);
      avatarEl.innerText = initials || "AD";
    }

    // Hiển thị Actor rõ ràng: ADMIN, QUẢN LÝ CHI NHÁNH, SALES, USER (Hình 3)
    if (roleBadgeEl) {
      const roleUpper = String(adminData.role || adminData.mavaitro || "").toUpperCase();
      const branch = adminData.machinhanh;

      if (roleUpper === "ADMIN") {
        roleBadgeEl.innerText = "👑 ADMIN TỔNG";
        roleBadgeEl.className = "badge bg-warning text-dark fw-bold rounded-pill px-2 py-1 shadow-sm";
        roleBadgeEl.title = "Quản trị viên toàn hệ thống (Toàn bộ 3 chi nhánh)";
      } else if (roleUpper === "MANAGER") {
        const branchLabel = branch === "CN_1" ? "CN1 TP.HCM" : branch === "CN_2" ? "CN2 Hà Nội" : (branch || "Chi nhánh");
        roleBadgeEl.innerText = `🏢 QUẢN LÝ (${branchLabel})`;
        roleBadgeEl.className = "badge bg-danger text-white fw-bold rounded-pill px-2 py-1 shadow-sm";
        roleBadgeEl.title = `Quản lý kho & vận hành ${branchLabel}`;
      } else if (roleUpper === "STAFF" || roleUpper === "EMPLOYEE") {
        roleBadgeEl.innerText = "💼 SALES / THU NGÂN";
        roleBadgeEl.className = "badge bg-light text-dark fw-bold rounded-pill px-2 py-1 shadow-sm";
      } else {
        roleBadgeEl.innerText = "👤 USER / KHÁCH HÀNG";
        roleBadgeEl.className = "badge bg-light text-secondary fw-bold rounded-pill px-2 py-1 shadow-sm";
      }
    }

    // Đồng bộ chi nhánh vào dropdown bộ lọc chi nhánh
    const branchSelect = document.getElementById("branchFilter");
    if (branchSelect) {
      const savedBranch = localStorage.getItem("selected_branch");
      const roleUpper = String(adminData.role || adminData.mavaitro || "").toUpperCase();
      if (roleUpper === "MANAGER" && adminData.machinhanh) {
        branchSelect.value = adminData.machinhanh;
        branchSelect.disabled = true;
        branchSelect.title = `Bạn đang quản lý chi nhánh ${adminData.machinhanh}`;
      } else {
        branchSelect.disabled = false;
        if (savedBranch && branchSelect.querySelector(`option[value="${savedBranch}"]`)) {
          branchSelect.value = savedBranch;
        }
      }
    }
  } catch (e) {
    console.error("Lỗi parse thông tin admin:", e);
  }
}

// 1. Cấu hình đường dẫn đến các file HTML con
const pageUrls = {
  "tong-quan": "/src/pages/tong-quan.html",
  "san-pham": "/src/pages/san-pham.html",
  "don-hang": "/src/pages/don-hang.html",
  "khach-hang": "/src/pages/khach-hang.html",
  "cai-dat": "/src/pages/cai-dat.html",
  "update-pass": "/src/pages/update-pass.html",
  "nha-cung-cap": "/src/pages/nha-cung-cap.html",
  "danh-muc": "/src/pages/danh-muc.html",
  "quanly-nhanvien": "/src/pages/quanly-nhanvien.html",
  "quanly-khohang": "/src/pages/quanly-khohang.html",
};

// 2. Hàm chuyển trang sử dụng Fetch API
window.switchPage = switchPage;
async function switchPage(pageKey, title) {
  const contentArea = document.getElementById("dynamic-content");
  const pageUrl = pageUrls[pageKey] || `/src/pages/${pageKey}.html`;

  try {
    const response = await fetch(pageUrl);
    if (!response.ok) throw new Error(`Không thể tải trang: ${pageKey}`);

    const html = await response.text();
    contentArea.innerHTML = html;
    localStorage.setItem("current_admin_page", pageKey);

    // KÍCH HOẠT LOGIC JS RIÊNG CHO TỪNG TRANG (Import động an toàn)
    switch (pageKey) {
      case "cai-dat": {
        const { initCaiDat } = await import("./pages/cai-dat.js");
        initCaiDat();
        break;
      }
      case "update-pass": {
        const { initUpdatePass } = await import("./pages/update-pass.js");
        initUpdatePass();
        break;
      }
      case "san-pham": {
        const { initProductManager } = await import("./pages/san-pham.js");
        initProductManager();
        break;
      }
      case "danh-muc": {
        const { initCategoryManager } = await import("./pages/danh-muc.js");
        initCategoryManager();
        break;
      }
      case "nha-cung-cap": {
        const { initSupplierManager } = await import("./pages/nha-cung-cap.js");
        initSupplierManager();
        break;
      }
      case "khach-hang": {
        const { initCustomerManager } = await import("./pages/khach-hang.js");
        initCustomerManager();
        break;
      }
      case "don-hang": {
        const { initOrderManager } = await import("./pages/don-hang.js");
        initOrderManager();
        break;
      }
      case "tong-quan": {
        const { initTongQuan } = await import("./pages/tong-quat.js");
        initTongQuan();
        break;
      }
      case "quanly-nhanvien": {
        const { initEmployeeManager } =
          await import("./pages/quanly-nhanvien.js");
        initEmployeeManager();
        break;
      }
      case "quanly-khohang": {
        const { initWarehouseManager } = await import("./pages/warehouse.js");
        initWarehouseManager();
        break;
      }
    }
  } catch (error) {
    console.error("Lỗi khi chuyển trang:", error);
    contentArea.innerHTML = `<div class="alert alert-danger m-4">Lỗi tải nội dung trang hoặc kịch bản đi kèm: ${error.message}</div>`;
  }
}

// 3. Đóng toàn bộ Dropdown Menu đang mở
function closeAllDropdowns() {
  document.querySelectorAll(".dropdown-menu.show").forEach((m) => {
    m.classList.remove("show");
  });
  document.querySelectorAll(".dropdown-toggle.show").forEach((t) => {
    t.classList.remove("show");
    t.setAttribute("aria-expanded", "false");
  });
}

// 4. Highlight Menu và Dropdown Cha
function clearActiveClasses() {
  document.querySelectorAll(".menu-page-link").forEach((l) => l.classList.remove("active"));
  document.querySelectorAll(".dropdown-toggle").forEach((t) => {
    t.classList.remove("active");
  });
}

function highlightMenuLink(pageKey) {
  clearActiveClasses();
  const targetLink = document.querySelector(`.menu-page-link[data-page="${pageKey}"]`);
  if (targetLink) {
    targetLink.classList.add("active");
    const parentDropdown = targetLink.closest(".dropdown");
    if (parentDropdown) {
      const toggle = parentDropdown.querySelector(".dropdown-toggle");
      if (toggle) toggle.classList.add("active");
    }
    const title = targetLink.innerText.trim();
    const titleEl = document.getElementById("pageTitleDisplay");
    if (titleEl) titleEl.innerText = title;
  }
}

// 5. GLOBAL EVENT DELEGATION: BẮT SỰ KIỆN CLICK TOPBAR 100% TIN CẬY KHÔNG XUNG ĐỘT
document.addEventListener("click", (e) => {
  // A. Toggle Dropdown Menu
  const toggle = e.target.closest(".dropdown-toggle");
  if (toggle) {
    e.preventDefault();
    e.stopPropagation();

    const parentDropdown = toggle.closest(".dropdown");
    const menu = parentDropdown ? parentDropdown.querySelector(".dropdown-menu") : null;
    const wasOpen = menu && menu.classList.contains("show");

    closeAllDropdowns();

    if (!wasOpen && menu) {
      menu.classList.add("show");
      toggle.classList.add("show");
      toggle.setAttribute("aria-expanded", "true");
    }
    return;
  }

  // B. Click chuyển trang trong Menu
  const menuLink = e.target.closest(".menu-page-link");
  if (menuLink) {
    e.preventDefault();
    closeAllDropdowns();

    // Đóng mobile offcanvas nếu đang mở
    const mobileMenuEl = document.getElementById("mobileMenu");
    if (mobileMenuEl && typeof bootstrap !== "undefined" && bootstrap.Offcanvas) {
      const offcanvas = bootstrap.Offcanvas.getInstance(mobileMenuEl);
      if (offcanvas) offcanvas.hide();
    }

    const pageKey = menuLink.getAttribute("data-page");
    if (pageKey) {
      highlightMenuLink(pageKey);
      const title = menuLink.innerText.trim();
      switchPage(pageKey, title);
    }
    return;
  }

  // C. Click ra ngoài: Tự động đóng dropdown
  if (!e.target.closest(".dropdown")) {
    closeAllDropdowns();
  }
});

// Lắng nghe thay đổi chọn chi nhánh trên Topbar
document.addEventListener("change", (e) => {
  if (e.target && e.target.id === "branchFilter") {
    localStorage.setItem("selected_branch", e.target.value);
    // Kích hoạt sự kiện để các trang con tự động cập nhật
    window.dispatchEvent(new CustomEvent("branchChanged", { detail: { branch: e.target.value } }));
  }
});

// Khởi chạy khi DOM sẵn sàng
async function initDashboard() {
  await checkAuth(["MANAGER", "ADMIN", "Manager", "Admin"]);
  updateUserSection();

  let lastPage = localStorage.getItem("current_admin_page");
  if (!lastPage || !pageUrls[lastPage]) {
    lastPage = "tong-quan";
    localStorage.setItem("current_admin_page", "tong-quan");
  }
  highlightMenuLink(lastPage);

  const activeLink = document.querySelector(`.menu-page-link[data-page="${lastPage}"]`);
  const title = activeLink ? activeLink.innerText.trim() : "Tổng quan";
  await switchPage(lastPage, title);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initDashboard);
} else {
  initDashboard();
}

