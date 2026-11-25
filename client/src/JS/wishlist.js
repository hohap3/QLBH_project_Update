import axios from "axios";
import { BASE_URL, updateCartBadge } from "/src/JS/common/header";
import { loadFooter } from "/src/JS/common/footer";
import { toastSuccess, toastInfo, toastWarning, toastError } from "/src/JS/common/notify";

const GUEST_WISHLIST_KEY = "hpstore_wishlist_guest";
const DEFAULT_IMAGE =
  "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=500";

let wishlistProducts = [];

function getLoggedInUser() {
  try {
    const raw =
      localStorage.getItem("hpstore_user") || localStorage.getItem("user");
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && (parsed.token || localStorage.getItem("token"))) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function getCartKey() {
  const user = getLoggedInUser();
  const maND = user?.maND || user?.mand || user?.id || user?.MaND;
  return maND ? `hpstore_cart_${maND}` : "hpstore_cart_guest";
}

function resolveProductImg(hinhanh) {
  if (
    !hinhanh ||
    hinhanh === "NULL" ||
    hinhanh === "null" ||
    !String(hinhanh).trim()
  ) {
    return DEFAULT_IMAGE;
  }
  if (
    String(hinhanh).startsWith("http://") ||
    String(hinhanh).startsWith("https://")
  ) {
    return hinhanh;
  }
  const rootUrl = BASE_URL.replace("/api", "");
  return `${rootUrl}/uploads/products/${hinhanh}`;
}

function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function updateHeaderStatus(isLoggedIn) {
  const statusEl = document.getElementById("wishlistSyncStatus");
  const countEl = document.getElementById("wishlistPageCount");
  if (countEl) countEl.textContent = String(wishlistProducts.length);

  if (!statusEl) return;
  if (isLoggedIn) {
    statusEl.innerHTML =
      '<i class="fa-solid fa-cloud-check text-success me-1"></i>Đã đồng bộ trực tiếp với tài khoản HP STORE của bạn trên mọi thiết bị.';
  } else {
    statusEl.innerHTML =
      '<i class="fa-solid fa-circle-info text-warning me-1"></i>Đang lưu tạm trên trình duyệt này. <a href="/src/pages/login.html" class="fw-semibold text-danger text-decoration-none">Đăng nhập</a> để đồng bộ trên mọi thiết bị!';
  }
}

async function loadWishlistPage() {
  const grid = document.getElementById("wishlist-grid");
  if (!grid) return;

  const user = getLoggedInUser();
  let guestIds = [];
  try {
    const raw = localStorage.getItem(GUEST_WISHLIST_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) guestIds = parsed.map(String).filter(Boolean);
    }
  } catch {
    guestIds = [];
  }

  try {
    if (user) {
      let res;
      if (guestIds.length > 0) {
        res = await axios.post(`${BASE_URL}/wishlist/merge`, {
          maSPs: guestIds,
        });
        localStorage.removeItem(GUEST_WISHLIST_KEY);
      } else {
        res = await axios.get(`${BASE_URL}/wishlist`);
      }
      wishlistProducts = Array.isArray(res.data?.products)
        ? res.data.products
        : [];
    } else if (guestIds.length > 0) {
      const res = await fetch(`${BASE_URL}/productsClient?page=1&limit=100`);
      const data = await res.json();
      const all = data.products || data.data || [];
      const idSet = new Set(guestIds);
      wishlistProducts = all.filter((sp) => idSet.has(String(sp.masp)));
    } else {
      wishlistProducts = [];
    }

    updateHeaderStatus(Boolean(user));
    renderWishlistGrid();
  } catch (err) {
    console.error("Lỗi tải trang yêu thích:", err);
    grid.innerHTML = `
      <div class="col-12">
        <div class="bg-white rounded-4 border p-5 text-center text-danger">
          <i class="fa-solid fa-triangle-exclamation fs-1 mb-3 d-block"></i>
          <p class="fw-bold mb-1">Không thể tải danh sách sản phẩm yêu thích.</p>
          <button type="button" class="btn btn-sm btn-outline-danger rounded-pill mt-2 px-3" onclick="window.location.reload()">
            Thử lại
          </button>
        </div>
      </div>
    `;
  }
}

function renderWishlistGrid() {
  const grid = document.getElementById("wishlist-grid");
  const countEl = document.getElementById("wishlistPageCount");
  if (countEl) countEl.textContent = String(wishlistProducts.length);
  if (!grid) return;

  if (wishlistProducts.length === 0) {
    grid.innerHTML = `
      <div class="col-12">
        <div class="bg-white rounded-4 shadow-sm border p-5 text-center">
          <i class="fa-regular fa-heart text-danger opacity-50 mb-3 d-block" style="font-size: 3.5rem;"></i>
          <h5 class="fw-bold text-dark mb-2">Danh sách yêu thích đang trống</h5>
          <p class="text-muted small mb-4">
            Hãy bấm vào biểu tượng trái tim ❤️ trên những sản phẩm bạn quan tâm để lưu lại và so sánh dễ dàng hơn.
          </p>
          <a href="/index.html" class="btn btn-danger rounded-pill px-4 py-2 fw-semibold">
            <i class="fa-solid fa-bag-shopping me-2"></i>Khám phá sản phẩm ngay
          </a>
        </div>
      </div>
    `;
    return;
  }

  grid.innerHTML = wishlistProducts
    .map((sp) => {
      const imgPath = resolveProductImg(sp.hinhanh);
      const price = Number(sp.giaban) || 0;
      const originalPrice = Math.round(price * 1.18);
      const stock = Number(sp.soluongton) || 0;
      const isOutOfStock = stock <= 0;
      const safeName = escapeHtml(sp.tensp || "Sản phẩm");
      const safeCat = escapeHtml(sp.tendanhmuc || "Chính hãng");
      const safeId = escapeHtml(sp.masp);

      return `
        <div class="col-6 col-md-4 col-lg-3">
          <div class="wishlist-card">
            <div class="wishlist-img-box">
              <a href="/src/pages/product-detail.html?id=${encodeURIComponent(sp.masp)}" class="w-100 h-100 d-flex align-items-center justify-content-center">
                <img src="${imgPath}" alt="${safeName}" loading="lazy" onerror="this.onerror=null; this.src='${DEFAULT_IMAGE}';" />
              </a>
              <button
                type="button"
                class="wishlist-remove-btn"
                data-remove-id="${safeId}"
                title="Bỏ khỏi yêu thích"
                aria-label="Bỏ khỏi yêu thích"
              >
                <i class="fa-solid fa-heart-crack"></i>
              </button>
              <span class="badge bg-white text-secondary border position-absolute bottom-0 start-0 m-2" style="font-size: 10px;">
                ${safeCat}
              </span>
            </div>

            <div class="p-3 d-flex flex-column flex-grow-1">
              <a href="/src/pages/product-detail.html?id=${encodeURIComponent(sp.masp)}" class="text-decoration-none">
                <h2 class="wishlist-title mb-2">${safeName}</h2>
              </a>

              <div class="d-flex align-items-baseline gap-2 flex-wrap mb-2">
                <span class="fw-bold text-danger fs-6">${price.toLocaleString("vi-VN")}₫</span>
                <span class="text-muted text-decoration-line-through small">${originalPrice.toLocaleString("vi-VN")}₫</span>
              </div>

              <div class="small mb-3">
                ${
                  isOutOfStock
                    ? '<span class="badge bg-secondary-subtle text-secondary border">Tạm hết hàng</span>'
                    : `<span class="badge bg-success-subtle text-success border border-success-subtle"><i class="fa-solid fa-check me-1"></i>Còn ${stock} sản phẩm</span>`
                }
              </div>

              <div class="mt-auto d-flex gap-2">
                <button
                  type="button"
                  class="btn btn-danger btn-sm flex-grow-1 fw-semibold rounded-3 btn-wishlist-add-cart"
                  data-add-id="${safeId}"
                  ${isOutOfStock ? "disabled" : ""}
                >
                  <i class="fa-solid fa-cart-plus me-1"></i>${isOutOfStock ? "Hết hàng" : "Thêm vào giỏ"}
                </button>
                <a
                  href="/src/pages/product-detail.html?id=${encodeURIComponent(sp.masp)}"
                  class="btn btn-outline-secondary btn-sm rounded-3"
                  title="Xem chi tiết"
                >
                  <i class="fa-regular fa-eye"></i>
                </a>
              </div>
            </div>
          </div>
        </div>
      `;
    })
    .join("");
}

async function handleRemoveFromWishlist(maSP) {
  const user = getLoggedInUser();
  const idStr = String(maSP);

  try {
    if (user) {
      await axios.post(`${BASE_URL}/wishlist/toggle`, { maSP: idStr });
    } else {
      const remainingIds = wishlistProducts
        .map((p) => String(p.masp))
        .filter((id) => id !== idStr);
      localStorage.setItem(GUEST_WISHLIST_KEY, JSON.stringify(remainingIds));
    }

    wishlistProducts = wishlistProducts.filter(
      (p) => String(p.masp) !== idStr,
    );
    renderWishlistGrid();
    toastInfo("Đã bỏ khỏi yêu thích", "", 1600);
  } catch (err) {
    toastError(
      "Lỗi cập nhật",
      err.response?.data?.message || "Không thể bỏ sản phẩm khỏi yêu thích!",
    );
  }
}

function handleAddToCart(maSP) {
  const sp = wishlistProducts.find((p) => String(p.masp) === String(maSP));
  if (!sp) return;

  const stock = Number(sp.soluongton) || 0;
  if (stock <= 0) {
    toastWarning("Tạm hết hàng", "Sản phẩm này hiện đã hết hàng trong kho.");
    return;
  }

  const cartKey = getCartKey();
  const cart = JSON.parse(localStorage.getItem(cartKey) || "[]");
  const idx = cart.findIndex(
    (item) => String(item.MaSP || item.masp) === String(sp.masp),
  );

  if (idx > -1) {
    const currentQty = parseInt(cart[idx].SoLuong || cart[idx].soluong, 10) || 1;
    if (currentQty + 1 > stock) {
      toastWarning(
        "Vượt quá tồn kho",
        `Trong kho chỉ còn tối đa ${stock} sản phẩm.`,
      );
      return;
    }
    cart[idx].SoLuong = currentQty + 1;
  } else {
    cart.push({
      MaSP: sp.masp,
      TenSP: sp.tensp,
      GiaBan: Number(sp.giaban) || 0,
      HinhAnh: sp.hinhanh,
      SoLuong: 1,
    });
  }

  localStorage.setItem(cartKey, JSON.stringify(cart));
  updateCartBadge();
  toastSuccess("Đã thêm vào giỏ hàng!", `${sp.tensp}`, 1800);
}

document.addEventListener("DOMContentLoaded", () => {
  loadFooter();
  loadWishlistPage();

  const grid = document.getElementById("wishlist-grid");
  if (grid) {
    grid.addEventListener("click", (e) => {
      const removeBtn = e.target.closest("[data-remove-id]");
      if (removeBtn) {
        handleRemoveFromWishlist(removeBtn.getAttribute("data-remove-id"));
        return;
      }
      const addCartBtn = e.target.closest("[data-add-id]");
      if (addCartBtn) {
        handleAddToCart(addCartBtn.getAttribute("data-add-id"));
      }
    });
  }
});
