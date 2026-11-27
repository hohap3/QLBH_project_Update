import axios from "axios";
import { BASE_URL } from "/src/JS/common/header";
import { loadFooter } from "/src/JS/common/footer";
import { renderAdminPagination } from "/src/JS/common/pagination";
import { toastSuccess, toastInfo, toastError } from "/src/JS/common/notify";

const DEFAULT_IMAGE =
  "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=500";
const GUEST_WISHLIST_KEY = "hpstore_wishlist_guest";
const LIMIT = 12;

let state = {
  q: "",
  category: "all",
  minPrice: "",
  maxPrice: "",
  sort: "default",
  page: 1,
};

let wishlistSet = new Set();

function esc(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function resolveImg(hinhanh) {
  if (!hinhanh || hinhanh === "NULL" || hinhanh === "null" || !String(hinhanh).trim()) {
    return DEFAULT_IMAGE;
  }
  if (String(hinhanh).startsWith("http://") || String(hinhanh).startsWith("https://")) {
    return hinhanh;
  }
  return `${BASE_URL.replace("/api", "")}/uploads/products/${hinhanh}`;
}

function getLoggedInUser() {
  try {
    const raw =
      localStorage.getItem("hpstore_user") || localStorage.getItem("user");
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && (parsed.token || localStorage.getItem("token"))) return parsed;
    return null;
  } catch {
    return null;
  }
}

function syncUrlWithState() {
  const params = new URLSearchParams();
  if (state.q) params.set("q", state.q);
  if (state.category && state.category !== "all") params.set("category", state.category);
  if (state.minPrice !== "") params.set("minPrice", state.minPrice);
  if (state.maxPrice !== "") params.set("maxPrice", state.maxPrice);
  if (state.sort && state.sort !== "default") params.set("sort", state.sort);
  if (state.page > 1) params.set("page", String(state.page));

  const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
  window.history.replaceState({}, "", newUrl);
}

function syncFilterButtonsUI() {
  // Categories
  const catContainer = document.getElementById("searchCategoryFilter");
  if (catContainer) {
    catContainer.querySelectorAll("button[data-cat]").forEach((btn) => {
      const active = btn.getAttribute("data-cat") === state.category;
      btn.classList.toggle("btn-danger", active);
      btn.classList.toggle("fw-semibold", active);
      btn.classList.toggle("btn-outline-secondary", !active);
    });
  }

  // Price
  const priceContainer = document.getElementById("searchPriceFilter");
  if (priceContainer) {
    priceContainer.querySelectorAll(".price-filter-btn").forEach((btn) => {
      const min = btn.getAttribute("data-min") || "";
      const max = btn.getAttribute("data-max") || "";
      const active = min === String(state.minPrice) && max === String(state.maxPrice);
      btn.classList.toggle("active", active);
      btn.classList.toggle("btn-danger", active);
      btn.classList.toggle("fw-semibold", active);
      btn.classList.toggle("btn-outline-secondary", !active);
    });
  }

  // Sort
  const sortContainer = document.getElementById("searchSortBar");
  if (sortContainer) {
    sortContainer.querySelectorAll(".sort-filter-btn").forEach((btn) => {
      const active = btn.getAttribute("data-sort") === state.sort;
      btn.classList.toggle("active", active);
      btn.classList.toggle("btn-danger", active);
      btn.classList.toggle("fw-semibold", active);
      btn.classList.toggle("btn-outline-secondary", !active);
    });
  }
}

async function initWishlistState() {
  const user = getLoggedInUser();
  if (user) {
    try {
      const res = await axios.get(`${BASE_URL}/wishlist`);
      wishlistSet = new Set((res.data?.ids || []).map(String));
      return;
    } catch {
      // fallback
    }
  }
  try {
    const raw = localStorage.getItem(GUEST_WISHLIST_KEY);
    if (raw) wishlistSet = new Set(JSON.parse(raw).map(String));
  } catch {
    wishlistSet = new Set();
  }
}

async function toggleWishlist(maSP, btnEl) {
  const idStr = String(maSP);
  const wasLiked = wishlistSet.has(idStr);
  if (wasLiked) wishlistSet.delete(idStr);
  else wishlistSet.add(idStr);

  const paintBtn = (liked) => {
    const icon = btnEl?.querySelector("i");
    if (!icon) return;
    icon.classList.toggle("fa-solid", liked);
    icon.classList.toggle("text-danger", liked);
    icon.classList.toggle("fa-regular", !liked);
  };
  paintBtn(!wasLiked);

  const user = getLoggedInUser();
  if (user) {
    try {
      const res = await axios.post(`${BASE_URL}/wishlist/toggle`, { maSP: idStr });
      const liked = Boolean(res.data?.liked);
      if (liked) wishlistSet.add(idStr);
      else wishlistSet.delete(idStr);
      paintBtn(liked);
      if (liked) toastSuccess("Đã thêm vào yêu thích", "", 1600);
      else toastInfo("Đã bỏ yêu thích", "", 1600);
    } catch (err) {
      if (wasLiked) wishlistSet.add(idStr);
      else wishlistSet.delete(idStr);
      paintBtn(wasLiked);
      toastError("Lỗi cập nhật yêu thích", err.response?.data?.message || "");
    }
  } else {
    localStorage.setItem(GUEST_WISHLIST_KEY, JSON.stringify(Array.from(wishlistSet)));
    if (!wasLiked) toastSuccess("Đã thêm vào yêu thích", "Đăng nhập để đồng bộ nhiều thiết bị!", 1800);
    else toastInfo("Đã bỏ yêu thích", "", 1500);
  }
}

async function loadCategories() {
  const container = document.getElementById("searchCategoryFilter");
  if (!container) return;
  try {
    const res = await fetch(`${BASE_URL}/categories`);
    const payload = await res.json();
    const categories = Array.isArray(payload) ? payload : payload?.data || [];

    const html = [
      `<button type="button" class="btn btn-sm btn-danger rounded-pill px-3 fw-semibold" data-cat="all">Tất cả</button>`,
      ...categories.map(
        (dm) =>
          `<button type="button" class="btn btn-sm btn-outline-secondary rounded-pill px-3" data-cat="${esc(dm.madanhmuc)}">${esc(dm.tendanhmuc)}</button>`,
      ),
    ].join("");
    container.innerHTML = html;
    syncFilterButtonsUI();
  } catch (err) {
    console.error("Lỗi tải danh mục trang tìm kiếm:", err);
  }
}

async function fetchSearchResults() {
  const grid = document.getElementById("searchResultsGrid");
  const paginationEl = document.getElementById("searchPagination");
  const headingEl = document.getElementById("searchHeading");
  const subHeadingEl = document.getElementById("searchSubHeading");
  if (!grid) return;

  syncUrlWithState();
  syncFilterButtonsUI();

  if (headingEl) {
    headingEl.innerHTML = state.q
      ? `<i class="fa-solid fa-magnifying-glass text-danger me-2"></i>Kết quả tìm kiếm cho <span class="text-danger">"${esc(state.q)}"</span>`
      : `<i class="fa-solid fa-grid-2 text-danger me-2"></i>Tất cả sản phẩm HP STORE`;
  }

  grid.innerHTML = `
    <div class="col-12 text-center py-5 text-muted">
      <div class="spinner-border text-danger mb-2" role="status"></div>
      <div>Đang tìm kiếm sản phẩm...</div>
    </div>
  `;

  try {
    const params = new URLSearchParams();
    params.append("page", String(state.page));
    params.append("limit", String(LIMIT));
    if (state.q) params.append("search", state.q);
    if (state.category && state.category !== "all") params.append("category", state.category);
    if (state.minPrice !== "") params.append("minPrice", state.minPrice);
    if (state.maxPrice !== "") params.append("maxPrice", state.maxPrice);
    if (state.sort && state.sort !== "default") params.append("sort", state.sort);

    const res = await fetch(`${BASE_URL}/productsClient?${params.toString()}`);
    const data = await res.json();
    const products = data.products || data.data || [];
    const totalItems = Number(data.totalItems ?? products.length);
    const totalPages = Number(data.totalPages || Math.max(1, Math.ceil(totalItems / LIMIT)));

    if (subHeadingEl) {
      subHeadingEl.textContent =
        totalItems > 0
          ? `Tìm thấy ${totalItems} sản phẩm phù hợp`
          : "Không tìm thấy sản phẩm nào khớp với bộ lọc hiện tại";
    }

    if (products.length === 0) {
      grid.innerHTML = `
        <div class="col-12">
          <div class="bg-white rounded-4 border p-5 text-center text-muted">
            <i class="fa-solid fa-box-open fs-1 opacity-50 mb-3 d-block"></i>
            <h5 class="fw-bold text-dark mb-1">Không tìm thấy sản phẩm phù hợp</h5>
            <p class="small mb-3">Hãy thử nhập từ khóa ngắn hơn (ví dụ: <strong>iPhone</strong>, <strong>Laptop</strong>, <strong>Tai nghe</strong>) hoặc xóa bớt bộ lọc.</p>
            <button type="button" class="btn btn-danger btn-sm rounded-pill px-4 fw-semibold" id="btnEmptyResetSearch">
              <i class="fa-solid fa-rotate-left me-1"></i>Xem tất cả sản phẩm
            </button>
          </div>
        </div>
      `;
      document
        .getElementById("btnEmptyResetSearch")
        ?.addEventListener("click", resetAllFilters);
      if (paginationEl) paginationEl.innerHTML = "";
      return;
    }

    grid.innerHTML = products
      .map((sp) => {
        const img = resolveImg(sp.hinhanh);
        const price = Number(sp.giaban) || 0;
        const origPrice = Math.round(price * 1.18);
        const discountPct = origPrice > 0 ? Math.round(((origPrice - price) / origPrice) * 100) : 0;
        const isLiked = wishlistSet.has(String(sp.masp));
        const safeName = esc(sp.tensp || "Sản phẩm");
        const safeCat = esc(sp.tendanhmuc || "Chính hãng");
        const ratingHtml =
          Number(sp.sodanhgia) > 0
            ? `${Number(sp.diemtrungbinh).toFixed(1)} <span class="text-muted fw-normal">(${sp.sodanhgia})</span>`
            : "5.0";

        return `
          <div class="col-6 col-md-4 col-lg-3">
            <div class="search-product-card">
              <div class="search-card-img-box">
                <span class="badge bg-danger position-absolute top-0 start-0 m-2" style="font-size: 10px;">Giảm ${discountPct}%</span>
                <button type="button" class="search-wishlist-btn" data-wishlist-id="${esc(sp.masp)}" title="Yêu thích">
                  <i class="${isLiked ? "fa-solid text-danger" : "fa-regular"} fa-heart"></i>
                </button>
                <a href="/src/pages/product-detail.html?id=${encodeURIComponent(sp.masp)}" class="w-100 h-100 d-flex align-items-center justify-content-center">
                  <img src="${img}" alt="${safeName}" loading="lazy" onerror="this.onerror=null; this.src='${DEFAULT_IMAGE}';" />
                </a>
                <span class="badge bg-white text-secondary border position-absolute bottom-0 start-0 m-2" style="font-size: 10px;">
                  ${safeCat}
                </span>
              </div>
              <div class="p-3 d-flex flex-column flex-grow-1">
                <a href="/src/pages/product-detail.html?id=${encodeURIComponent(sp.masp)}" class="text-decoration-none">
                  <h2 class="search-card-title mb-2">${safeName}</h2>
                </a>
                <div class="d-flex align-items-baseline gap-2 flex-wrap mb-2">
                  <span class="fw-bold text-danger fs-6">${price.toLocaleString("vi-VN")}₫</span>
                  <span class="text-muted text-decoration-line-through small">${origPrice.toLocaleString("vi-VN")}₫</span>
                </div>
                <div class="mt-auto d-flex align-items-center justify-content-between pt-2 border-top small text-muted">
                  <span class="fw-semibold text-dark">
                    <i class="fa-solid fa-star text-warning me-1"></i>${ratingHtml}
                  </span>
                  <span>Đã bán ${sp.tongdaban ?? 0}</span>
                </div>
              </div>
            </div>
          </div>
        `;
      })
      .join("");

    renderAdminPagination(paginationEl, {
      currentPage: state.page,
      totalPages,
      totalItems,
      pageSize: LIMIT,
      onPageChange: (targetPage) => {
        state.page = targetPage;
        fetchSearchResults();
        window.scrollTo({ top: 0, behavior: "smooth" });
      },
    });
  } catch (err) {
    console.error("Lỗi tìm kiếm sản phẩm:", err);
    grid.innerHTML = `<div class="col-12 text-center text-danger py-5">Không thể tải kết quả tìm kiếm từ máy chủ.</div>`;
  }
}

function resetAllFilters() {
  state = { q: "", category: "all", minPrice: "", maxPrice: "", sort: "default", page: 1 };
  const headerInput = document.getElementById("search-input");
  if (headerInput) headerInput.value = "";
  fetchSearchResults();
}

// Cho phép Header cập nhật từ khóa ngay trên trang search.html không cần reload trang
window.hpUpdateSearchKeyword = function (keyword) {
  state.q = String(keyword || "").trim();
  state.page = 1;
  fetchSearchResults();
};

document.addEventListener("DOMContentLoaded", async () => {
  loadFooter();

  const urlParams = new URLSearchParams(window.location.search);
  state.q = (urlParams.get("q") || urlParams.get("search") || "").trim();
  state.category = urlParams.get("category") || "all";
  state.minPrice = urlParams.get("minPrice") || "";
  state.maxPrice = urlParams.get("maxPrice") || "";
  state.sort = urlParams.get("sort") || "default";
  state.page = Math.max(1, parseInt(urlParams.get("page") || "1", 10) || 1);

  const headerInput = document.getElementById("search-input");
  if (headerInput && state.q) headerInput.value = state.q;

  await Promise.all([loadCategories(), initWishlistState()]);
  await fetchSearchResults();

  document.getElementById("searchCategoryFilter")?.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-cat]");
    if (!btn) return;
    state.category = btn.getAttribute("data-cat") || "all";
    state.page = 1;
    fetchSearchResults();
  });

  document.getElementById("searchPriceFilter")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".price-filter-btn");
    if (!btn) return;
    state.minPrice = btn.getAttribute("data-min") || "";
    state.maxPrice = btn.getAttribute("data-max") || "";
    state.page = 1;
    fetchSearchResults();
  });

  document.getElementById("searchSortBar")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".sort-filter-btn");
    if (!btn) return;
    state.sort = btn.getAttribute("data-sort") || "default";
    state.page = 1;
    fetchSearchResults();
  });

  document
    .getElementById("btnClearSearchFilters")
    ?.addEventListener("click", resetAllFilters);

  document.getElementById("searchResultsGrid")?.addEventListener("click", (e) => {
    const wishBtn = e.target.closest(".search-wishlist-btn[data-wishlist-id]");
    if (!wishBtn) return;
    e.preventDefault();
    e.stopPropagation();
    toggleWishlist(wishBtn.getAttribute("data-wishlist-id"), wishBtn);
  });
});
