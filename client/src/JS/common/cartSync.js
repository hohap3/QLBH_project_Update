import axios from "axios";

const GUEST_CART_KEY = "hpstore_cart_guest";

function getApiBaseUrl() {
  return (
    import.meta.env.VITE_API_URL ||
    (typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1")
      ? "http://localhost:5000/api"
      : "https://qlbh-project.onrender.com/api")
  );
}

export function getLoggedInCartUser() {
  try {
    const raw =
      localStorage.getItem("hpstore_user") || localStorage.getItem("user");
    const parsed = raw ? JSON.parse(raw) : null;
    const maND = parsed?.maND || parsed?.mand || parsed?.id || parsed?.MaND;
    const token = parsed?.token || localStorage.getItem("token");
    if (maND && token) {
      return { maND: String(maND).trim(), token };
    }
    return null;
  } catch {
    return null;
  }
}

export function getActiveCartKey() {
  const user = getLoggedInCartUser();
  return user ? `hpstore_cart_${user.maND}` : GUEST_CART_KEY;
}

function writeCartCacheAndBadge(cartKey, items) {
  const safeItems = Array.isArray(items) ? items : [];
  localStorage.setItem(cartKey, JSON.stringify(safeItems));

  const totalItems = safeItems.reduce(
    (sum, item) => sum + (parseInt(item.SoLuong || item.soluong, 10) || 0),
    0,
  );

  const badge = document.getElementById("cart-count");
  if (badge) badge.innerText = totalItems;
  const mobileBadge = document.getElementById("mobile-cart-count");
  if (mobileBadge) {
    mobileBadge.innerText = totalItems;
    mobileBadge.style.display = totalItems > 0 ? "flex" : "none";
  }
}

/**
 * Đồng bộ giỏ hàng từ PostgreSQL về localStorage (tự động gộp giỏ khách nếu có).
 * Gọi khi tải Header hoặc vào trang Giỏ hàng.
 */
export async function syncCartFromServer() {
  const user = getLoggedInCartUser();
  if (!user) {
    try {
      return JSON.parse(localStorage.getItem(GUEST_CART_KEY) || "[]");
    } catch {
      return [];
    }
  }

  const baseUrl = getApiBaseUrl();
  const userCartKey = `hpstore_cart_${user.maND}`;
  const headers = { Authorization: `Bearer ${user.token}` };

  let guestItems = [];
  try {
    const rawGuest = localStorage.getItem(GUEST_CART_KEY);
    if (rawGuest) {
      const parsed = JSON.parse(rawGuest);
      if (Array.isArray(parsed) && parsed.length > 0) {
        guestItems = parsed;
      }
    }
  } catch {
    guestItems = [];
  }

  try {
    let res;
    if (guestItems.length > 0) {
      res = await axios.post(
        `${baseUrl}/cart/merge`,
        { items: guestItems },
        { headers },
      );
      localStorage.removeItem(GUEST_CART_KEY);
    } else {
      res = await axios.get(`${baseUrl}/cart`, { headers });
    }

    const items = Array.isArray(res.data?.items) ? res.data.items : [];
    writeCartCacheAndBadge(userCartKey, items);
    return items;
  } catch (err) {
    console.warn("Không đồng bộ được giỏ hàng từ server, dùng cache cục bộ:", err?.message);
    try {
      return JSON.parse(localStorage.getItem(userCartKey) || "[]");
    } catch {
      return [];
    }
  }
}

export async function syncAddCartItem(maSP, soLuong = 1) {
  const user = getLoggedInCartUser();
  if (!user) return null;

  try {
    const baseUrl = getApiBaseUrl();
    const res = await axios.post(
      `${baseUrl}/cart/add`,
      { maSP, soLuong },
      { headers: { Authorization: `Bearer ${user.token}` } },
    );
    if (res.data?.success && Array.isArray(res.data.items)) {
      writeCartCacheAndBadge(`hpstore_cart_${user.maND}`, res.data.items);
      return res.data.items;
    }
  } catch (err) {
    console.warn("Lỗi đồng bộ thêm giỏ hàng lên DB:", err?.response?.data?.message || err?.message);
  }
  return null;
}

export async function syncUpdateCartItemQty(maSP, soLuong) {
  const user = getLoggedInCartUser();
  if (!user) return null;

  try {
    const baseUrl = getApiBaseUrl();
    const res = await axios.put(
      `${baseUrl}/cart/item/${encodeURIComponent(maSP)}`,
      { soLuong },
      { headers: { Authorization: `Bearer ${user.token}` } },
    );
    if (res.data?.success && Array.isArray(res.data.items)) {
      writeCartCacheAndBadge(`hpstore_cart_${user.maND}`, res.data.items);
      return res.data.items;
    }
  } catch (err) {
    console.warn("Lỗi đồng bộ cập nhật số lượng giỏ hàng lên DB:", err?.response?.data?.message || err?.message);
  }
  return null;
}

export async function syncRemoveCartItem(maSP) {
  const user = getLoggedInCartUser();
  if (!user) return null;

  try {
    const baseUrl = getApiBaseUrl();
    const res = await axios.delete(
      `${baseUrl}/cart/item/${encodeURIComponent(maSP)}`,
      { headers: { Authorization: `Bearer ${user.token}` } },
    );
    if (res.data?.success && Array.isArray(res.data.items)) {
      writeCartCacheAndBadge(`hpstore_cart_${user.maND}`, res.data.items);
      return res.data.items;
    }
  } catch (err) {
    console.warn("Lỗi đồng bộ xóa sản phẩm giỏ hàng lên DB:", err?.response?.data?.message || err?.message);
  }
  return null;
}
