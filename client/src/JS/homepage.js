// src/JS/homepage.js
import axios from "axios";
import Swal from "sweetalert2";
import { BASE_URL } from "/src/JS/common/header";

const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=500";

let currentProductPage = 1;
let currentCategory = "all";
let currentFilters = {
  search: null,
  minPrice: null,
  maxPrice: null,
  label: null,
};
const LIMIT = 10;

// Chuẩn hóa đường dẫn hình ảnh sản phẩm
function getProductImageUrl(hinhanh) {
  if (!hinhanh || hinhanh === "NULL" || hinhanh === "null" || hinhanh.trim() === "") {
    return DEFAULT_IMAGE;
  }
  if (hinhanh.startsWith("http://") || hinhanh.startsWith("https://")) {
    return hinhanh;
  }
  const rootUrl = BASE_URL.replace("/api", "");
  return `${rootUrl}/uploads/products/${hinhanh}`;
}

// Hàm render thẻ sản phẩm HP STORE chuẩn
function renderHPStoreProductCard(sp) {
  const imgPath = getProductImageUrl(sp.hinhanh);
  const price = parseFloat(sp.giaban) || 0;
  const originalPrice = Math.round(price * 1.18); // Giả lập giá niêm yết ban đầu
  const discountPercent = Math.round(((originalPrice - price) / originalPrice) * 100);

  return `
    <div class="hp-product-card" data-masp="${sp.masp}">
      <!-- Badge góc trái -->
      <div class="hp-card-badges">
        <span class="hp-badge-discount">Giảm ${discountPercent}%</span>
        <span class="hp-badge-installment">Trả góp 0%</span>
      </div>

      <!-- Nút Yêu thích -->
      <button class="hp-btn-wishlist" type="button" aria-label="Thêm vào yêu thích" onclick="event.preventDefault(); this.querySelector('i').classList.toggle('fa-solid'); this.querySelector('i').classList.toggle('text-danger');">
        <i class="fa-regular fa-heart"></i>
      </button>

      <!-- Ảnh sản phẩm -->
      <a href="/src/pages/product-detail.html?id=${sp.masp}" class="text-decoration-none">
        <div class="hp-card-img-wrap">
          <img src="${imgPath}" alt="${sp.tensp || 'Sản phẩm'}" loading="lazy" onerror="this.onerror=null; this.src='${DEFAULT_IMAGE}';">
        </div>
      </a>

      <!-- Tiêu đề sản phẩm (2 dòng clamp) -->
      <a href="/src/pages/product-detail.html?id=${sp.masp}" class="text-decoration-none">
        <h3 class="hp-card-title">${sp.tensp}</h3>
      </a>

      <!-- Khối Giá -->
      <div class="hp-card-price-row">
        <span class="hp-price-sale">${new Intl.NumberFormat("vi-VN").format(price)}₫</span>
        <span class="hp-price-original">${new Intl.NumberFormat("vi-VN").format(originalPrice)}₫</span>
      </div>

      <!-- Khối Ưu đãi HP Member -->
      <div class="hp-card-perks">
        <span>HP Member giảm thêm đến <span class="highlight">2%</span></span>
      </div>

      <!-- Footer thẻ: Đánh giá sao & lượt bán -->
      <div class="hp-card-footer">
        <span class="hp-rating-stars">
          <i class="fa-solid fa-star"></i> 4.9
        </span>
        <span>Đã bán ${sp.tongdaban || Math.floor(Math.random() * 50) + 10}</span>
      </div>
    </div>
  `;
}

// ─── 1. HÀM TÌM KIẾM GỢI Ý THÔNG MINH ───
async function initSearchSuggestions() {
  const searchInput = document.getElementById("search-input");
  const suggestionsBox = document.getElementById("search-suggestions");
  if (!searchInput || !suggestionsBox) return;

  searchInput.addEventListener("input", async (e) => {
    const keyword = e.target.value.trim();
    if (keyword.length < 1) {
      suggestionsBox.classList.add("d-none");
      return;
    }
    try {
      const res = await fetch(`${BASE_URL}/productsClient/search?q=${encodeURIComponent(keyword)}`);
      const result = await res.json();
      const products = result.data || (Array.isArray(result) ? result : []);

      if (products && products.length > 0) {
        suggestionsBox.innerHTML = products.slice(0, 6).map((sp) => {
          const imgPath = getProductImageUrl(sp.hinhanh);
          return `
            <a href="/src/pages/product-detail.html?id=${sp.masp}" class="list-group-item list-group-item-action d-flex align-items-center gap-3">
              <img src="${imgPath}" alt="${sp.tensp}" style="width: 44px; height: 44px; object-fit: contain; border-radius: 6px;" onerror="this.onerror=null; this.src='${DEFAULT_IMAGE}';">
              <div class="overflow-hidden flex-grow-1">
                <div class="fw-bold text-dark text-truncate" style="font-size: 13px;">${sp.tensp}</div>
                <div class="d-flex align-items-center justify-content-between mt-1">
                  <span class="text-danger fw-bold small">${new Intl.NumberFormat("vi-VN").format(sp.giaban)}₫</span>
                  <span class="badge bg-light text-secondary border" style="font-size: 10px;">${sp.tendanhmuc || "Chính hãng"}</span>
                </div>
              </div>
            </a>
          `;
        }).join("");
        suggestionsBox.classList.remove("d-none");
      } else {
        suggestionsBox.innerHTML = `<div class="p-3 text-center text-muted small">Không tìm thấy sản phẩm phù hợp.</div>`;
        suggestionsBox.classList.remove("d-none");
      }
    } catch (err) {
      console.error("Lỗi tìm kiếm gợi ý:", err);
    }
  });

  document.addEventListener("click", (e) => {
    if (!searchInput.contains(e.target) && !suggestionsBox.contains(e.target)) {
      suggestionsBox.classList.add("d-none");
    }
  });
}

// ─── 2. HÀM TẢI SẢN PHẨM CHÍNH CÓ PHÂN TRANG VÀ BỘ LỌC ĐA CẤP ───
export async function loadProducts(maDM = "all", page = 1, options = {}) {
  const productContainer = document.getElementById("product-list");
  const paginationContainer = document.getElementById("products-pagination");
  if (!productContainer) return;

  currentCategory = maDM;
  currentProductPage = page;
  currentFilters = { ...currentFilters, ...options };

  productContainer.innerHTML = '<div class="text-center w-100 py-5"><div class="spinner-border text-danger"></div><div class="small text-muted mt-2">Đang tải sản phẩm HP STORE...</div></div>';

  try {
    const params = new URLSearchParams();
    if (maDM && maDM !== "all") params.append("category", maDM);
    params.append("page", page);
    params.append("limit", LIMIT);

    if (currentFilters.search) params.append("search", currentFilters.search);
    if (currentFilters.minPrice !== null && currentFilters.minPrice !== undefined) params.append("minPrice", currentFilters.minPrice);
    if (currentFilters.maxPrice !== null && currentFilters.maxPrice !== undefined) params.append("maxPrice", currentFilters.maxPrice);

    const res = await fetch(`${BASE_URL}/productsClient?${params.toString()}`);
    const data = await res.json();
    const products = data.products || data.data || (Array.isArray(data) ? data : []);
    const totalPages = data.totalPages || (data.totalItems ? Math.ceil(data.totalItems / LIMIT) : 1);

    // Cập nhật Banner thông tin đang lọc nếu có
    renderActiveFilterNotice(currentFilters);

    if (products.length === 0) {
      productContainer.innerHTML = `
        <div class="col-12 text-center py-5 text-muted">
          <i class="fa-solid fa-box-open fs-1 text-secondary mb-3 d-block"></i>
          <p class="fw-bold mb-1">Không tìm thấy sản phẩm phù hợp.</p>
          <small class="text-secondary">Vui lòng thử tìm từ khóa khác hoặc chọn danh mục khác.</small>
          <div class="mt-3">
            <button class="btn btn-sm btn-outline-danger px-3 rounded-pill" onclick="window.clearProductFilters()">
              <i class="fa-solid fa-rotate-left me-1"></i> Xem tất cả sản phẩm
            </button>
          </div>
        </div>
      `;
      if (paginationContainer) paginationContainer.innerHTML = "";
      return;
    }

    productContainer.innerHTML = products.map((sp) => renderHPStoreProductCard(sp)).join("");

    if (paginationContainer) {
      renderPaginationUI(paginationContainer, totalPages, currentProductPage, async (targetPage) => {
        await loadProducts(currentCategory, targetPage, currentFilters);
        productContainer.scrollIntoView({ behavior: "smooth" });
      });
    }
  } catch (err) {
    console.error("Lỗi tải sản phẩm chính:", err);
    productContainer.innerHTML = `<p class="text-center text-danger py-4">Không thể kết nối đến máy chủ.</p>`;
  }
}

// Hiển thị thanh thông báo bộ lọc đang áp dụng
function renderActiveFilterNotice(filters) {
  let noticeEl = document.getElementById("activeFilterNotice");
  if (!noticeEl) {
    const prodSection = document.querySelector(".hp-product-section");
    if (prodSection) {
      noticeEl = document.createElement("div");
      noticeEl.id = "activeFilterNotice";
      noticeEl.className = "mb-3 d-none";
      prodSection.insertBefore(noticeEl, document.getElementById("product-list"));
    }
  }
  if (!noticeEl) return;

  const hasFilter = filters.search || (filters.minPrice !== null && filters.minPrice !== undefined) || filters.label;

  if (hasFilter) {
    const labelText = filters.label || filters.search || (filters.minPrice ? `Từ ${new Intl.NumberFormat('vi-VN').format(filters.minPrice)}₫` : "");
    noticeEl.className = "mb-3 d-flex align-items-center justify-content-between p-2 px-3 bg-white border border-danger border-opacity-25 rounded-3 shadow-sm";
    noticeEl.innerHTML = `
      <div class="d-flex align-items-center gap-2">
        <span class="badge bg-danger"><i class="fa-solid fa-filter me-1"></i> Đang lọc:</span>
        <span class="fw-bold text-dark fs-6">${labelText}</span>
      </div>
      <button class="btn btn-sm btn-outline-secondary rounded-pill py-1 px-3 text-dark fw-medium" onclick="window.clearProductFilters()">
        <i class="fa-solid fa-xmark me-1 text-danger"></i> Xóa lọc
      </button>
    `;
  } else {
    noticeEl.className = "mb-3 d-none";
    noticeEl.innerHTML = "";
  }
}

// Xóa toàn bộ bộ lọc về trạng thái ban đầu
window.clearProductFilters = function () {
  currentFilters = { search: null, minPrice: null, maxPrice: null, label: null };
  const allBtn = document.querySelector('#category-filter button[data-id="all"]');
  if (allBtn) updateCategoryActiveState(allBtn);
  loadProducts("all", 1, {});
};

// ─── 3. HÀM TẢI SẢN PHẨM FLASH SALE / DEAL SỐC ───
export async function loadBestSellers(category = "all") {
  const container = document.getElementById("best-sellers-container");
  if (!container) return;

  container.innerHTML = '<div class="text-center w-100 py-4"><div class="spinner-border text-danger spinner-border-sm"></div></div>';

  try {
    const res = await fetch(`${BASE_URL}/productsClient/best-sellers?page=1&limit=5&category=${category}`);
    const data = await res.json();
    const products = data.products || data.data || (Array.isArray(data) ? data : []);

    if (products.length === 0) {
      container.innerHTML = `<div class="col-12 text-center text-muted py-4">Đang cập nhật danh sách Deal sốc...</div>`;
      return;
    }

    container.innerHTML = products.slice(0, 5).map((sp) => renderHPStoreProductCard(sp)).join("");
  } catch (err) {
    console.error("Lỗi tải deal sốc:", err);
    container.innerHTML = `<div class="col-12 text-center text-danger py-3">Lỗi tải dữ liệu Flash Sale.</div>`;
  }
}

// ─── 4. RENDER THANH PHÂN TRANG BO TRÒN HIỆN ĐẠI ───
function renderPaginationUI(container, totalPages, currentPage, onPageChange) {
  if (totalPages <= 1) {
    container.innerHTML = "";
    return;
  }

  let html = `<div class="d-flex align-items-center justify-content-center gap-1">`;
  html += `
    <button class="btn btn-sm btn-light border rounded-circle ${currentPage === 1 ? "disabled" : ""}" 
            data-page="${currentPage - 1}" style="width: 32px; height: 32px;"><i class="fa-solid fa-chevron-left"></i></button>
  `;

  for (let i = 1; i <= totalPages; i++) {
    const isActive = currentPage === i;
    html += `
      <button class="btn btn-sm ${isActive ? "btn-danger fw-bold shadow-sm" : "btn-light border text-secondary"} rounded-circle mx-1" 
              data-page="${i}" style="width: 32px; height: 32px; font-size: 13px;">${i}</button>
    `;
  }

  html += `
    <button class="btn btn-sm btn-light border rounded-circle ${currentPage === totalPages ? "disabled" : ""}" 
            data-page="${currentPage + 1}" style="width: 32px; height: 32px;"><i class="fa-solid fa-chevron-right"></i></button>
  `;
  html += `</div>`;

  container.innerHTML = html;
  container.querySelectorAll("button[data-page]").forEach((btn) => {
    btn.onclick = function (e) {
      e.preventDefault();
      const targetPage = parseInt(this.getAttribute("data-page"));
      if (!isNaN(targetPage) && targetPage !== currentPage && targetPage > 0 && targetPage <= totalPages) {
        onPageChange(targetPage);
      }
    };
  });
}

// ─── 5. HÀM TẢI DANH MỤC LỌC ĐỘNG ───
async function initCategoryFilters() {
  const filterContainer = document.getElementById("category-filter");
  if (!filterContainer) return;

  try {
    const res = await fetch(`${BASE_URL}/categories`);
    const categories = await res.json();

    filterContainer.innerHTML = "";
    
    // Nút Tất cả
    const btnAll = document.createElement("button");
    btnAll.className = "btn btn-sm btn-danger rounded-pill px-3 fw-bold";
    btnAll.innerText = "Tất cả";
    btnAll.dataset.id = "all";
    btnAll.onclick = function () {
      updateCategoryActiveState(this);
      window.clearProductFilters();
    };
    filterContainer.appendChild(btnAll);

    if (categories && Array.isArray(categories)) {
      categories.forEach((dm) => {
        const btn = document.createElement("button");
        btn.className = "btn btn-sm btn-outline-secondary rounded-pill px-3 fw-semibold";
        btn.innerText = dm.tendanhmuc;
        btn.dataset.id = dm.madanhmuc;
        btn.onclick = function () {
          updateCategoryActiveState(this);
          currentFilters = { search: null, minPrice: null, maxPrice: null, label: dm.tendanhmuc };
          loadProducts(this.dataset.id, 1, currentFilters);
        };
        filterContainer.appendChild(btn);
      });
    }
  } catch (err) {
    console.error("Lỗi tải danh mục:", err);
  }
}

function updateCategoryActiveState(activeBtn) {
  const container = document.getElementById("category-filter");
  if (!container) return;
  container.querySelectorAll("button").forEach((b) => {
    b.className = "btn btn-sm btn-outline-secondary rounded-pill px-3 fw-semibold";
  });
  activeBtn.className = "btn btn-sm btn-danger rounded-pill px-3 fw-bold";
}

// ─── 6. DỮ LIỆU VÀ LOGIC MEGA MENU FLYOUT ĐA CẤP CELLPHONES (Hình 4 & Hình 5) ───
const MEGA_MENU_DATA = {
  DM01: {
    title: "Điện thoại thông minh",
    col1Title: "Hãng điện thoại",
    col1Chips: [
      { name: "iPhone (Apple)", query: "iPhone" },
      { name: "SAMSUNG", query: "Samsung" },
      { name: "OPPO", query: "OPPO" },
      { name: "Xiaomi", query: "Xiaomi" },
      { name: "vivo", query: "vivo" },
      { name: "realme", query: "realme" },
      { name: "Google Pixel", query: "Pixel" },
      { name: "ASUS ROG", query: "ROG" }
    ],
    priceTitle: "Mức giá điện thoại",
    priceChips: [
      { label: "Dưới 5 triệu", min: 0, max: 5000000 },
      { label: "Từ 5 - 10 triệu", min: 5000000, max: 10000000 },
      { label: "Từ 10 - 15 triệu", min: 10000000, max: 15000000 },
      { label: "Từ 15 - 25 triệu", min: 15000000, max: 25000000 },
      { label: "Trên 25 triệu", min: 25000000, max: 100000000 }
    ],
    hotTitle: "Điện thoại HOT 🔥",
    hotChips: [
      { name: "iPhone 16 Pro Max", isHot: true, query: "iPhone 16" },
      { name: "iPhone 15 Pro Max", isHot: true, query: "iPhone 15 Pro Max" },
      { name: "Galaxy S24 Ultra", isHot: true, query: "Galaxy S24 Ultra" },
      { name: "Galaxy Z Fold 5", isHot: true, query: "Galaxy Z Fold" },
      { name: "Xiaomi 14 Ultra", isHot: true, query: "Xiaomi 14" },
      { name: "OPPO Find N3 Flip", isHot: true, query: "Find N3" },
      { name: "Google Pixel 8 Pro", isHot: false, query: "Pixel 8" }
    ],
    col3Title: "Đặc quyền mua sắm HP STORE",
    promoText: "<strong>THU CŨ TRỢ GIÁ LÊN ĐẾN 4 TRIỆU</strong><br>Thu mọi tình trạng máy, định giá trực tuyến 30 giây, trả góp 0% lãi suất qua 28 ngân hàng lớn."
  },

  DM02: {
    title: "Laptop & MacBook",
    col1Title: "Hãng Laptop & Mac",
    col1Chips: [
      { name: "MacBook (Apple)", query: "MacBook" },
      { name: "Dell", query: "Dell" },
      { name: "ASUS ROG", query: "ASUS" },
      { name: "Lenovo Legion", query: "Lenovo" },
      { name: "HP", query: "HP" },
      { name: "Acer", query: "Acer" }
    ],
    priceTitle: "Mức giá Laptop",
    priceChips: [
      { label: "Dưới 15 triệu", min: 0, max: 15000000 },
      { label: "Từ 15 - 25 triệu", min: 15000000, max: 25000000 },
      { label: "Từ 25 - 35 triệu", min: 25000000, max: 35000000 },
      { label: "Trên 35 triệu", min: 35000000, max: 100000000 }
    ],
    hotTitle: "Laptop Bán Chạy 🔥",
    hotChips: [
      { name: "MacBook Pro 14 M3", isHot: true, query: "MacBook Pro 14 M3" },
      { name: "MacBook Air 13 M2", isHot: true, query: "MacBook Air" },
      { name: "Dell XPS 13 Plus", isHot: true, query: "Dell XPS" },
      { name: "ASUS ROG Zephyrus G14", isHot: true, query: "ROG Zephyrus" },
      { name: "Lenovo Legion Pro 5", isHot: true, query: "Legion" },
      { name: "Dell Inspiron 14", isHot: false, query: "Inspiron" }
    ],
    col3Title: "Ưu đãi S-Student & Văn phòng",
    promoText: "<strong>GIẢM THÊM ĐẾN 1.000.000₫ CHO SINH VIÊN</strong><br>Tặng Balo chống sốc thời trang, chuột không dây và gói cân màu màn hình chuẩn chuyên nghiệp trọn đời."
  },

  DM05: {
    title: "Máy tính bảng (Tablet)",
    col1Title: "Hãng máy tính bảng",
    col1Chips: [
      { name: "iPad (Apple)", query: "iPad" },
      { name: "Samsung Galaxy Tab", query: "Tab" },
      { name: "Xiaomi Pad", query: "Pad" },
      { name: "Lenovo Tab", query: "Lenovo" }
    ],
    priceTitle: "Mức giá Tablet",
    priceChips: [
      { label: "Dưới 8 triệu", min: 0, max: 8000000 },
      { label: "Từ 8 - 15 triệu", min: 8000000, max: 15000000 },
      { label: "Trên 15 triệu", min: 15000000, max: 100000000 }
    ],
    hotTitle: "Tablet Nổi Bật 🔥",
    hotChips: [
      { name: "iPad Pro 11 M4 OLED", isHot: true, query: "iPad Pro 11 M4" },
      { name: "iPad Air 5 M1", isHot: true, query: "iPad Air 5" },
      { name: "Galaxy Tab S9 FE Plus", isHot: true, query: "Tab S9" },
      { name: "Xiaomi Pad 6 Pro 8/256", isHot: true, query: "Pad 6" }
    ],
    col3Title: "Phụ kiện đi kèm",
    promoText: "<strong>COMBO BÚT & BÀN PHÍM GIẢM 30%</strong><br>Tương thích hoàn hảo cho ghi chú, học tập online và thiết kế đồ họa Procreate chuyên nghiệp."
  },

  DM06: {
    title: "Âm thanh & Loa Bluetooth",
    col1Title: "Thương hiệu Âm thanh",
    col1Chips: [
      { name: "Marshall", query: "Marshall" },
      { name: "Sony", query: "Sony" },
      { name: "JBL", query: "JBL" },
      { name: "Apple AirPods", query: "AirPods" },
      { name: "Bose", query: "Bose" },
      { name: "Harman Kardon", query: "Harman" }
    ],
    priceTitle: "Mức giá Âm thanh",
    priceChips: [
      { label: "Dưới 2 triệu", min: 0, max: 2000000 },
      { label: "Từ 2 - 5 triệu", min: 2000000, max: 5000000 },
      { label: "Từ 5 - 10 triệu", min: 5000000, max: 10000000 },
      { label: "Trên 10 triệu", min: 10000000, max: 100000000 }
    ],
    hotTitle: "Tai nghe & Loa Bán Chạy 🔥",
    hotChips: [
      { name: "AirPods Pro 2 Type-C", isHot: true, query: "AirPods Pro 2" },
      { name: "Sony WH-1000XM5 Chống Ồn", isHot: true, query: "WH-1000XM5" },
      { name: "Marshall Stanmore III", isHot: true, query: "Stanmore III" },
      { name: "Loa JBL Charge 5 IP67", isHot: true, query: "Charge 5" },
      { name: "Marshall Major IV Pin 80H", isHot: false, query: "Major IV" }
    ],
    col3Title: "Trải nghiệm âm thanh",
    promoText: "<strong>PHÒNG THỬ ÂM HI-RES ĐẲNG CẤP</strong><br>Thử tai nghe chống ồn và loa Bluetooth trực tiếp tại chuỗi cửa hàng HP STORE trên toàn quốc."
  },

  DM04: {
    title: "Đồng hồ thông minh",
    col1Title: "Hãng Đồng hồ",
    col1Chips: [
      { name: "Apple Watch", query: "Apple Watch" },
      { name: "Samsung Galaxy Watch", query: "Galaxy Watch" },
      { name: "Garmin", query: "Garmin" },
      { name: "Huawei Watch", query: "Huawei" }
    ],
    priceTitle: "Mức giá Đồng hồ",
    priceChips: [
      { label: "Dưới 5 triệu", min: 0, max: 5000000 },
      { label: "Từ 5 - 12 triệu", min: 5000000, max: 12000000 },
      { label: "Trên 12 triệu", min: 12000000, max: 100000000 }
    ],
    hotTitle: "Smartwatch Bán Chạy 🔥",
    hotChips: [
      { name: "Apple Watch Ultra 2 Titanium", isHot: true, query: "Ultra 2" },
      { name: "Apple Watch Series 9", isHot: true, query: "Series 9" },
      { name: "Galaxy Watch 6 Classic", isHot: true, query: "Watch 6" },
      { name: "Garmin Fenix 7 Pro Sapphire", isHot: true, query: "Fenix 7" }
    ],
    col3Title: "Theo dõi sức khỏe",
    promoText: "<strong>THEO DÕI SỨC KHỎE VÀ THỂ THAO 24/7</strong><br>Đo điện tâm đồ ECG, SpO2, chuẩn chống nước 100M lặn biển, kết nối định vị GPS băng tần kép."
  },

  DM07: {
    title: "Gaming Gear & Bàn phím",
    col1Title: "Thương hiệu Gaming",
    col1Chips: [
      { name: "Logitech G", query: "Logitech" },
      { name: "Keychron", query: "Keychron" },
      { name: "Razer", query: "Razer" },
      { name: "Corsair", query: "Corsair" },
      { name: "Akko", query: "Akko" }
    ],
    priceTitle: "Mức giá Gear",
    priceChips: [
      { label: "Dưới 1 triệu", min: 0, max: 1000000 },
      { label: "Từ 1 - 3 triệu", min: 1000000, max: 3000000 },
      { label: "Trên 3 triệu", min: 3000000, max: 100000000 }
    ],
    hotTitle: "Gaming Gear HOT 🔥",
    hotChips: [
      { name: "Bàn phím cơ MX Mechanical", isHot: true, query: "MX Mechanical" },
      { name: "Chuột Logitech MX Master 3S", isHot: true, query: "MX Master" },
      { name: "Keychron K2 Pro QMK/VIA", isHot: true, query: "Keychron" },
      { name: "Chuột Gaming Logitech G304", isHot: true, query: "G304" }
    ],
    col3Title: "Chế độ bảo hành",
    promoText: "<strong>BẢO HÀNH CHÍNH HÃNG 1 ĐỔI 1</strong><br>Hỗ trợ mod phím cơ, thay switch lubed phím tại quầy kỹ thuật HP STORE."
  },

  DM03: {
    title: "Phụ kiện, Pin sạc",
    col1Title: "Hãng Phụ kiện",
    col1Chips: [
      { name: "Anker GaN", query: "Anker" },
      { name: "Baseus", query: "Baseus" },
      { name: "Apple MFi", query: "Apple" },
      { name: "Belkin", query: "Belkin" }
    ],
    priceTitle: "Mức giá",
    priceChips: [
      { label: "Dưới 500.000₫", min: 0, max: 500000 },
      { label: "Từ 500.000₫ - 1.5 triệu", min: 500000, max: 1500000 },
      { label: "Trên 1.5 triệu", min: 1500000, max: 100000000 }
    ],
    hotTitle: "Phụ kiện Bán Chạy 🔥",
    hotChips: [
      { name: "Củ sạc Anker 735 65W GaN", isHot: true, query: "Anker 735" },
      { name: "Pin dự phòng Baseus Blade 100W", isHot: true, query: "Baseus Blade" },
      { name: "Combo Sạc Anker 30W + Cáp C-C", isHot: true, query: "Combo Củ sạc" }
    ],
    col3Title: "Bảo hành phụ kiện",
    promoText: "<strong>SẠC NHANH AN TOÀN CHUẨN MỸ</strong><br>Bảo hành 1 đổi 1 trong 18 tháng đối với toàn bộ phụ kiện củ sạc, cáp sạc và pin dự phòng."
  },

  DM08: {
    title: "Thu cũ đổi mới (Trade-in)",
    col1Title: "Dòng máy trợ giá cao",
    col1Chips: [
      { name: "iPhone 14 Pro Max Trade-in", query: "iPhone 14 Pro Max" },
      { name: "Galaxy S23 Ultra Trade-in", query: "S23 Ultra" },
      { name: "MacBook Pro M1 Trade-in", query: "MacBook Pro 14 M1" },
      { name: "iPad Air Trade-in", query: "iPad" }
    ],
    priceTitle: "Cam kết chương trình",
    priceChips: [
      { label: "Dưới 15 triệu", min: 0, max: 15000000 },
      { label: "Từ 15 - 25 triệu", min: 15000000, max: 25000000 },
      { label: "Trên 25 triệu", min: 25000000, max: 100000000 }
    ],
    hotTitle: "Chương Trình Trợ Giá Độc Quyền 🔥",
    hotChips: [
      { name: "Trợ giá 3 triệu iPhone 14 Pro Max", isHot: true, query: "SP_TC01" },
      { name: "Trợ giá 4 triệu Galaxy S23 Ultra", isHot: true, query: "SP_TC02" },
      { name: "Lên đời MacBook Pro M3 Max", isHot: true, query: "SP_TC03" }
    ],
    col3Title: "Quy trình siêu tốc",
    promoText: "<strong>THỦ TỤC TRADE-IN CHỈ 15 PHÚT</strong><br>1. Định giá online không cần mở máy.<br>2. Trợ giá tiền mặt trực tiếp trừ vào hóa đơn.<br>3. Chuyển dữ liệu trọn vẹn miễn phí."
  },

  DM09: {
    title: "Hàng Outlet giá sốc",
    col1Title: "Phân loại Hàng Outlet",
    col1Chips: [
      { name: "Tai nghe Outlet", query: "Sony WH-CH720N" },
      { name: "Loa Bluetooth Outlet", query: "JBL Clip 4" },
      { name: "Đồng hồ Outlet", query: "Apple Watch SE" },
      { name: "Máy trưng bày 99%", query: "Outlet" }
    ],
    priceTitle: "Khoảng giá Outlet",
    priceChips: [
      { label: "Dưới 1 triệu", min: 0, max: 1000000 },
      { label: "Từ 1 - 3 triệu", min: 1000000, max: 3000000 },
      { label: "Trên 3 triệu", min: 3000000, max: 100000000 }
    ],
    hotTitle: "Hàng Outlet Giảm Sâu 🔥",
    hotChips: [
      { name: "Sony WH-CH720N Outlet (-45%)", isHot: true, query: "SP_OT01" },
      { name: "Loa JBL Clip 4 Outlet (-50%)", isHot: true, query: "SP_OT02" },
      { name: "Apple Watch SE 2 Outlet", isHot: true, query: "SP_OT03" }
    ],
    col3Title: "Cam kết chất lượng Outlet",
    promoText: "<strong>TIẾT KIỆM ĐẾN 50% SO VỚI GIÁ MỚI</strong><br>Cam kết máy chính hãng 100%, bảo hành 1 đổi 1 trong 30 ngày, đầy đủ phụ kiện theo máy."
  },

  DM10: {
    title: "Khuyến mãi Hot",
    col1Title: "Chương trình nổi bật",
    col1Chips: [
      { name: "Flash Sale cuối tuần", query: "Flash Sale" },
      { name: "Deal Sốc Học sinh - Sinh viên", query: "S-Student" },
      { name: "Xả kho phụ kiện", query: "Combo" },
      { name: "Ưu đãi HP Member", query: "Hot" }
    ],
    priceTitle: "Mức giá ưu đãi",
    priceChips: [
      { label: "Dưới 500.000₫", min: 0, max: 500000 },
      { label: "Từ 500.000₫ - 2 triệu", min: 500000, max: 2000000 },
      { label: "Trên 2 triệu", min: 2000000, max: 100000000 }
    ],
    hotTitle: "Deal Hot Hôm Nay 🔥",
    hotChips: [
      { name: "Combo Sạc Anker 30W Giảm 40%", isHot: true, query: "SP_KM01" },
      { name: "Chuột Logitech G304 Deal Hot", isHot: true, query: "SP_KM02" },
      { name: "Tai nghe Marshall Minor III KM", isHot: true, query: "SP_KM03" }
    ],
    col3Title: "Voucher nhân đôi",
    promoText: "<strong>SĂN DEAL HỜI - VẬN CHUYỂN 0 ĐỒNG</strong><br>Áp dụng đồng thời voucher tích lũy thành viên HP Member, miễn phí giao siêu tốc trong 2 giờ."
  },

  DM11: {
    title: "Tin tức công nghệ",
    col1Title: "Dịch vụ & Tiện ích",
    col1Chips: [
      { name: "Gói Care Plus VIP", query: "SP_TT01" },
      { name: "Dịch vụ tản nhiệt Laptop", query: "SP_TT02" },
      { name: "Đánh giá công nghệ AI", query: "AI" },
      { name: "Mẹo hay smartphone", query: "iPhone" }
    ],
    priceTitle: "Bảng giá dịch vụ",
    priceChips: [
      { label: "Dưới 500.000₫", min: 0, max: 500000 },
      { label: "Trên 1 triệu", min: 1000000, max: 100000000 }
    ],
    hotTitle: "Dịch Vụ Chuyên Sâu 🔥",
    hotChips: [
      { name: "Gói VIP 1 Đổi 1 Toàn Diện 12 Tháng", isHot: true, query: "SP_TT01" },
      { name: "Vệ sinh Tra keo kim loại lỏng Gaming", isHot: true, query: "SP_TT02" }
    ],
    col3Title: "Kỹ thuật chuyên môn cao",
    promoText: "<strong>XỬ LÝ TẠI CHỖ - MINH BẠCH 100%</strong><br>Khách hàng trực tiếp theo dõi quá trình kiểm tra và bảo dưỡng máy tính, điện thoại bởi chuyên viên cao cấp."
  }
};

// ─── 7. HÀM KHỞI TẠO MEGA MENU FLYOUT ───
function initMegaMenu() {
  const sidebar = document.querySelector(".hp-category-sidebar");
  const flyout = document.getElementById("hpMegaFlyout");
  if (!sidebar || !flyout) return;

  let closeTimer = null;

  function renderFlyout(catId) {
    const data = MEGA_MENU_DATA[catId] || MEGA_MENU_DATA["DM01"];

    flyout.innerHTML = `
      <div class="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom">
        <div class="d-flex align-items-center gap-2">
          <span class="badge bg-danger rounded-pill px-3 py-1 fw-bold fs-6">${data.title}</span>
          <span class="text-secondary small">Xem toàn bộ ưu đãi công nghệ chính hãng</span>
        </div>
        <button class="btn btn-sm btn-light border rounded-pill px-3 fw-bold text-danger flyout-view-all-btn" data-cat="${catId}">
          Xem tất cả <i class="fa-solid fa-arrow-right ms-1"></i>
        </button>
      </div>

      <div class="hp-flyout-content">
        <!-- Cột 1: Hãng sản xuất + Mức giá -->
        <div class="hp-flyout-col">
          <div>
            <div class="hp-flyout-title"><i class="fa-solid fa-industry text-danger"></i> ${data.col1Title}</div>
            <div class="hp-flyout-chips-grid">
              ${data.col1Chips.map((c) => `
                <span class="hp-flyout-chip brand-chip" data-cat="${catId}" data-query="${c.query}" data-label="${c.name}">${c.name}</span>
              `).join("")}
            </div>
          </div>

          <div class="mt-2">
            <div class="hp-flyout-title"><i class="fa-solid fa-coins text-warning"></i> ${data.priceTitle}</div>
            <div class="hp-flyout-chips-grid">
              ${data.priceChips.map((p) => `
                <span class="hp-flyout-chip price-chip" data-cat="${catId}" data-min="${p.min ?? ''}" data-max="${p.max ?? ''}" data-label="${p.label}">
                  ${p.label}
                </span>
              `).join("")}
            </div>
          </div>
        </div>

        <!-- Cột 2: Sản phẩm HOT -->
        <div class="hp-flyout-col">
          <div>
            <div class="hp-flyout-title"><i class="fa-solid fa-fire-flame-curved text-danger"></i> ${data.hotTitle}</div>
            <div class="hp-flyout-chips-grid">
              ${data.hotChips.map((h) => `
                <span class="hp-flyout-chip hot-chip" data-cat="${catId}" data-query="${h.query}" data-label="${h.name}">
                  ${h.name}
                  ${h.isHot ? '<span class="hp-flyout-badge-hot">HOT</span>' : ''}
                </span>
              `).join("")}
            </div>
          </div>
        </div>

        <!-- Cột 3: Banner ưu đãi & Cam kết HP STORE -->
        <div class="hp-flyout-col">
          <div class="hp-flyout-title"><i class="fa-solid fa-shield-halved text-success"></i> ${data.col3Title}</div>
          <div class="hp-flyout-promo-box shadow-sm">
            ${data.promoText}
          </div>
          <div class="p-3 bg-light rounded-3 border text-secondary small">
            <div class="fw-bold text-dark mb-1"><i class="fa-solid fa-truck-fast text-info me-1"></i> Giao hàng siêu tốc:</div>
            <div>Miễn phí giao hàng toàn quốc đơn từ 300k, nhận hàng trong 2h tại TP.HCM & Hà Nội.</div>
          </div>
        </div>
      </div>
    `;

    // Gắn sự kiện click cho các chips trong Flyout
    flyout.querySelectorAll(".brand-chip, .hot-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        const query = chip.getAttribute("data-query");
        const cat = chip.getAttribute("data-cat");
        const label = chip.getAttribute("data-label");
        flyout.classList.add("d-none");
        clearCatActive();
        currentFilters = { search: query, minPrice: null, maxPrice: null, label: `${label}` };
        loadProducts(cat, 1, currentFilters);
        document.getElementById("product-list")?.scrollIntoView({ behavior: "smooth" });
      });
    });

    flyout.querySelectorAll(".price-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        const cat = chip.getAttribute("data-cat");
        const min = chip.getAttribute("data-min") !== "" ? parseFloat(chip.getAttribute("data-min")) : null;
        const max = chip.getAttribute("data-max") !== "" ? parseFloat(chip.getAttribute("data-max")) : null;
        const label = chip.getAttribute("data-label");
        flyout.classList.add("d-none");
        clearCatActive();
        currentFilters = { search: null, minPrice: min, maxPrice: max, label: `${label}` };
        loadProducts(cat, 1, currentFilters);
        document.getElementById("product-list")?.scrollIntoView({ behavior: "smooth" });
      });
    });

    flyout.querySelector(".flyout-view-all-btn")?.addEventListener("click", () => {
      flyout.classList.add("d-none");
      clearCatActive();
      currentFilters = { search: null, minPrice: null, maxPrice: null, label: null };
      loadProducts(catId, 1, currentFilters);
      document.getElementById("product-list")?.scrollIntoView({ behavior: "smooth" });
    });
  }

  function clearCatActive() {
    sidebar.querySelectorAll(".hp-cat-link").forEach((l) => l.classList.remove("active-flyout"));
  }

  // Khi hover chuột vào từng danh mục sidebar
  sidebar.querySelectorAll(".hp-cat-link").forEach((link) => {
    link.addEventListener("mouseenter", () => {
      clearTimeout(closeTimer);
      clearCatActive();
      link.classList.add("active-flyout");

      const catId = link.getAttribute("data-cat");
      renderFlyout(catId);
      flyout.classList.remove("d-none");
    });
  });

  // Khi rê chuột ra khỏi sidebar
  sidebar.addEventListener("mouseleave", () => {
    closeTimer = setTimeout(() => {
      flyout.classList.add("d-none");
      clearCatActive();
    }, 200);
  });

  // Giữ flyout mở khi chuột di chuyển vào trong flyout
  flyout.addEventListener("mouseenter", () => {
    clearTimeout(closeTimer);
  });

  flyout.addEventListener("mouseleave", () => {
    closeTimer = setTimeout(() => {
      flyout.classList.add("d-none");
      clearCatActive();
    }, 200);
  });
}

// ─── 8. BẮT SỰ KIỆN CLICK FLASH SALE PILLS VÀ DANH MỤC SIDEBAR ───
function initInteractionEvents() {
  // Sidebar danh mục (click trực tiếp)
  document.querySelectorAll(".hp-cat-link, .cp-cat-link").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const catId = link.getAttribute("data-cat");
      if (catId) {
        currentFilters = { search: null, minPrice: null, maxPrice: null, label: null };
        loadProducts(catId, 1, currentFilters);
        document.getElementById("product-list")?.scrollIntoView({ behavior: "smooth" });
      }
    });
  });

  // Flash sale category pills
  document.querySelectorAll(".hp-pill-btn, .cp-pill-btn").forEach((pill) => {
    pill.addEventListener("click", () => {
      document.querySelectorAll(".hp-pill-btn, .cp-pill-btn").forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
      const cat = pill.getAttribute("data-cat") || "all";
      loadBestSellers(cat);
    });
  });
}

// Khởi chạy khi DOM tải xong
document.addEventListener("DOMContentLoaded", () => {
  initSearchSuggestions();
  initCategoryFilters();
  initMegaMenu();
  loadBestSellers("all");
  loadProducts("all", 1);
  initInteractionEvents();
});
