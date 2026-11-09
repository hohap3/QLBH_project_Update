import axios from "axios";
import Swal from "sweetalert2";
import { BASE_URL } from "/src/JS/common/header";

const DEFAULT_IMAGE = "/img/default.jpg";

// Biến toàn cục lưu trữ trạng thái giảm giá và điểm tích lũy của khách hàng
let userPoints = 0;
let currentDiscountPercent = 0;
let currentDiscountAmount = 0;
let baseSubTotal = 0; // Lưu tổng tiền của CÁC SẢN PHẨM ĐƯỢC TÍCH CHỌN trước giảm giá

document.addEventListener("DOMContentLoaded", async () => {
  // 1. Tải thông tin điểm tích lũy của khách hàng trước
  await fetchUserPoints();

  // 2. Kích hoạt vẽ giỏ hàng
  renderCartPage();

  const checkoutBtn = document.getElementById("btn-trigger-checkout");
  if (checkoutBtn) {
    checkoutBtn.addEventListener("click", handleCheckoutRedirect);
  }
});

function getCartKey() {
  const userData = JSON.parse(localStorage.getItem("hpstore_user"));
  if (
    userData &&
    (userData.maND || userData.mand || userData.id || userData.MaND)
  ) {
    return `hpstore_cart_${userData.maND || userData.mand || userData.id || userData.MaND}`;
  }
  return "hpstore_cart_guest";
}

function updateCartBadgeCount() {
  const cartKey = getCartKey();
  const cart = JSON.parse(localStorage.getItem(cartKey)) || [];
  const totalItems = cart.reduce(
    (sum, item) => sum + (parseInt(item.SoLuong || item.soluong) || 0),
    0,
  );

  const badge = document.getElementById("cart-count");
  if (badge) {
    badge.innerText = totalItems;
  }
}

function getProductImageUrl(hinhanh) {
  if (
    !hinhanh ||
    hinhanh === "NULL" ||
    hinhanh === "null" ||
    hinhanh === "undefined" ||
    hinhanh.trim() === ""
  ) {
    return DEFAULT_IMAGE;
  }
  if (hinhanh.startsWith("http://") || hinhanh.startsWith("https://")) {
    return hinhanh;
  }
  const rootUrl = BASE_URL.replace("/api", "");
  return `${rootUrl}/uploads/products/${hinhanh}`;
}

async function fetchUserPoints() {
  const userData = JSON.parse(localStorage.getItem("hpstore_user"));
  const maND =
    userData?.maND || userData?.mand || userData?.id || userData?.MaND;

  if (!maND) return;

  try {
    const response = await axios.get(`${BASE_URL}/user/profile?id=${maND}`);
    userPoints =
      parseInt(response.data.diemtichluy || response.data.DiemTichLuy) || 0;

    const pointsEl = document.getElementById("user-current-points");
    if (pointsEl) {
      pointsEl.innerText = `${userPoints} điểm`;
    }
  } catch (error) {
    console.error("Không lấy được điểm tích lũy của khách hàng:", error);
  }
}

// 🟢 HÀM KHỞI TẠO HOẶC LẤY DANH SÁCH CHECKBOX SẢN PHẨM ĐƯỢC CHỌN TỪ LOCALSTORAGE
function getCheckedItemsKey() {
  return getCartKey() + "_checked_items";
}

function renderCartPage() {
  const tableBody = document.getElementById("cart-table-body");
  if (!tableBody) return;

  const cartKey = getCartKey();
  const cart = JSON.parse(localStorage.getItem(cartKey)) || [];

  if (cart.length === 0) {
    tableBody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-5">
                    <i class="fa-solid fa-bag-shopping text-muted mb-3" style="font-size: 3rem; opacity:0.3;"></i>
                    <h6 class="text-secondary fw-semibold">Giỏ hàng của bạn đang trống!</h6>
                    <a href="/index.html" class="btn btn-sm btn-outline-primary mt-2 px-3" style="border-radius:8px;">Quay lại mua sắm</a>
                </td>
            </tr>
        `;
    // Xóa bộ nhớ tích chọn cũ nếu giỏ hàng trống
    localStorage.removeItem(getCheckedItemsKey());
    updateSelectAllCheckbox(false);
    updateSummary(0);
    return;
  }

  // Lấy danh sách các mã sản phẩm được tích chọn trước đó (nếu có)
  const checkedItems =
    JSON.parse(localStorage.getItem(getCheckedItemsKey())) ||
    cart.map((item) => item.MaSP || item.masp);

  baseSubTotal = 0;

  const htmlRows = cart
    .map((item) => {
      const giaBan = parseFloat(item.GiaBan || item.giaban) || 0;
      const soLuong = parseInt(item.SoLuong || item.soluong) || 0;
      const itemTotal = giaBan * soLuong;
      const maSP = item.MaSP || item.masp;

      // Kiểm tra xem sản phẩm này có đang được tích chọn hay không
      const isChecked = checkedItems.includes(maSP) ? "checked" : "";

      // 🟢 CHỈ CỘNG VÀO TỔNG TIỀN NẾU SẢN PHẨM ĐƯỢC TÍCH CHỌN MUA
      if (checkedItems.includes(maSP)) {
        baseSubTotal += itemTotal;
      }

      const rawImg = item.hinhanh || item.hinhAnh || item.HinhAnh;
      const imgPath = getProductImageUrl(rawImg);

      return `
    <tr data-masp="${maSP}">
        <td class="text-center align-middle">
            <input type="checkbox" class="form-check-input cart-item-checkbox" style="width: 22px; height: 22px; cursor: pointer;" data-masp="${maSP}" ${isChecked} onchange="handleSingleCheck()">
        </td>
        <td>
            <div class="d-flex align-items-center gap-3">
                <img src="${imgPath}" class="product-cart-img" alt="${item.tensp || item.TenSP || "Sản phẩm"}" style="width:70px; height:70px; object-fit:contain;" onerror="this.onerror=null; this.src='${DEFAULT_IMAGE}'">
                <div>
                    <h6 class="fw-bold text-dark mb-1 text-truncate" style="max-width: 220px;">${item.tensp || item.TenSP || item.tensanpham || "Không rõ tên"}</h6>
                    <small class="text-muted d-block">Đơn giá: ${giaBan.toLocaleString("vi-VN")} đ</small>
                </div>
            </div>
        </td>
        <td>
            <div class="d-flex justify-content-center">
                <div class="quantity-input-group d-flex align-items-center">
                    <button type="button" class="btn btn-qty-minus" onclick="changeQty('${maSP}', -1)" aria-label="Giảm số lượng">-</button>
                    <input type="text" value="${soLuong}" class="text-center border-0 fw-bold" readonly aria-label="Số lượng">
                    <button type="button" class="btn btn-qty-plus" onclick="changeQty('${maSP}', 1)" aria-label="Tăng số lượng">+</button>
                </div>
            </div>
        </td>
        <td class="text-end fw-bold text-dark vertical-align-middle">${itemTotal.toLocaleString("vi-VN")} đ</td>
        <td class="text-center">
            <button class="btn btn-delete text-danger" onclick="removeCartItem('${maSP}')" title="Xóa sản phẩm" aria-label="Xóa sản phẩm">
                <i class="fa-regular fa-trash-can fs-5"></i>
            </button>
        </td>
    </tr>
`;
    })
    .join("");

  tableBody.innerHTML = htmlRows;

  // Đồng bộ trạng thái của nút "Chọn tất cả" trên tiêu đề bảng
  const allCheckboxes = document.querySelectorAll(".cart-item-checkbox");
  const allChecked =
    allCheckboxes.length > 0 &&
    Array.from(allCheckboxes).every((cb) => cb.checked);
  updateSelectAllCheckbox(allChecked);

  renderDiscountSection();
  calculateDiscount();
}

// 🟢 HÀM XỬ LÝ KHI TÍCH/BỎ TÍCH MỘT SẢN PHẨM LẺ
window.handleSingleCheck = function () {
  const checkboxes = document.querySelectorAll(".cart-item-checkbox");
  const checkedMaspList = [];

  checkboxes.forEach((cb) => {
    if (cb.checked) {
      checkedMaspList.push(cb.getAttribute("data-masp"));
    }
  });

  // Lưu lại danh sách được chọn sang LocalStorage
  localStorage.setItem(getCheckedItemsKey(), JSON.stringify(checkedMaspList));

  // Vẽ lại giao diện tiền tệ và trạng thái
  renderCartPage();
};

// 🟢 HÀM XỬ LÝ KHI BẤM NÚT "CHỌN TẤT CẢ" (SELECT ALL)
window.handleSelectAll = function (selectAllCheckbox) {
  const cartKey = getCartKey();
  const cart = JSON.parse(localStorage.getItem(cartKey)) || [];

  if (selectAllCheckbox.checked) {
    // Tích hết -> Lấy toàn bộ mã sản phẩm
    const allMasp = cart.map((item) => item.MaSP || item.masp);
    localStorage.setItem(getCheckedItemsKey(), JSON.stringify(allMasp));
  } else {
    // Bỏ tích hết -> Mảng rỗng
    localStorage.setItem(getCheckedItemsKey(), JSON.stringify([]));
  }
  renderCartPage();
};

function updateSelectAllCheckbox(status) {
  const selectAllBtn = document.getElementById("select-all-cart");
  if (selectAllBtn) {
    selectAllBtn.checked = status;
  }
}

function renderDiscountSection() {
  const discountContainer = document.getElementById("discount-reward-section");
  if (!discountContainer) return;

  const rewards = [
    { percent: 5, points: 75, label: "Giảm giá 5%" },
    { percent: 10, points: 150, label: "Giảm giá 10%" },
    { percent: 15, points: 225, label: "Giảm giá 15%" },
  ];

  let htmlOptions = `
    <div class="p-3 bg-light rounded border mb-3">
      <div class="d-flex justify-content-between align-items-center mb-2">
        <span class="fw-bold text-secondary small"><i class="fa-solid fa-star text-warning me-1"></i> Đổi điểm tích lũy (Hiện có: <strong class="text-dark">${userPoints}</strong> điểm)</span>
      </div>
      <div class="d-flex flex-column gap-2">
  `;

  rewards.forEach((r) => {
    const isEligible = userPoints >= r.points;
    const isChecked = currentDiscountPercent === r.percent ? "checked" : "";
    const isDisabled =
      (!isEligible && currentDiscountPercent === 0) ||
      (currentDiscountPercent !== 0 && currentDiscountPercent !== r.percent) ||
      baseSubTotal === 0 // Bổ sung: Nếu không tích mặt hàng nào thì block không cho đổi điểm
        ? "disabled"
        : "";

    htmlOptions += `
      <div class="form-check p-2 rounded border bg-white d-flex align-items-center justify-content-between" style="padding-left: 2.5rem !important;">
        <div>
          <input class="form-check-input discount-radio-option" type="radio" name="discountReward" id="reward-${r.percent}" value="${r.percent}" data-points="${r.points}" ${isChecked} ${isDisabled} onchange="handleSelectDiscount(this)">
          <label class="form-check-label fw-bold text-dark" for="reward-${r.percent}">
            ${r.label}
          </label>
        </div>
        <span class="badge ${isEligible ? "bg-primary" : "bg-secondary"} rounded-pill">${r.points} điểm</span>
      </div>
    `;
  });

  htmlOptions += `
      </div>
      ${currentDiscountPercent > 0 ? `<button class="btn btn-sm btn-link text-danger p-0 mt-2 text-decoration-none small" onclick="cancelSelectedDiscount()"><i class="fa-solid fa-arrow-rotate-left me-1"></i> Hủy chọn (Hoàn lại điểm)</button>` : ""}
    </div>
  `;

  discountContainer.innerHTML = htmlOptions;
}

window.handleSelectDiscount = function (radioElement) {
  const percent = parseInt(radioElement.value);
  const requiredPoints = parseInt(radioElement.getAttribute("data-points"));

  if (baseSubTotal === 0) {
    Swal.fire(
      "Thông báo",
      "Vui lòng chọn ít nhất 1 sản phẩm để áp dụng giảm giá!",
      "warning",
    );
    radioElement.checked = false;
    return;
  }

  if (userPoints < requiredPoints) {
    Swal.fire(
      "Thông báo",
      "Bạn không đủ điểm tích lũy để đổi mốc giảm giá này!",
      "warning",
    );
    radioElement.checked = false;
    return;
  }

  Swal.fire({
    title: "Xác nhận đổi điểm?",
    text: `Bạn sẽ dùng ${requiredPoints} điểm để đổi lấy voucher giảm giá ${percent}% cho đơn hàng này. Chỉ được chọn 1 lần duy nhất!`,
    icon: "question",
    showCancelButton: true,
    confirmButtonColor: "#6366f1",
    cancelButtonColor: "#6c757d",
    confirmButtonText: "Đồng ý đổi",
    cancelButtonText: "Hủy",
  }).then((result) => {
    if (result.isConfirmed) {
      currentDiscountPercent = percent;
      calculateDiscount();
      renderDiscountSection();
    } else {
      radioElement.checked = false;
    }
  });
};

window.cancelSelectedDiscount = function () {
  currentDiscountPercent = 0;
  currentDiscountAmount = 0;
  calculateDiscount();
  renderDiscountSection();
};

function calculateDiscount() {
  if (currentDiscountPercent > 0) {
    currentDiscountAmount = Math.round(
      baseSubTotal * (currentDiscountPercent / 100),
    );
  } else {
    currentDiscountAmount = 0;
  }
  updateSummary(baseSubTotal);
}

function updateSummary(subTotal) {
  const subtotalEl = document.getElementById("cart-subtotal");
  const discountRowEl = document.getElementById("cart-discount-row");
  const discountEl = document.getElementById("cart-discount-amount");
  const totalEl = document.getElementById("cart-total");

  if (subtotalEl)
    subtotalEl.innerText = `${subTotal.toLocaleString("vi-VN")} đ`;

  if (discountRowEl && discountEl) {
    if (currentDiscountPercent > 0 && subTotal > 0) {
      discountRowEl.classList.remove("d-none");
      discountEl.innerText = `-${currentDiscountAmount.toLocaleString("vi-VN")} đ (${currentDiscountPercent}%)`;
    } else {
      discountRowEl.classList.add("d-none");
    }
  }

  const finalTotal = Math.max(0, subTotal - currentDiscountAmount);
  if (totalEl) totalEl.innerText = `${finalTotal.toLocaleString("vi-VN")} đ`;

  updateCartBadgeCount();
}

window.changeQty = async function (maSP, delta) {
  const cartKey = getCartKey();
  let cart = JSON.parse(localStorage.getItem(cartKey)) || [];
  const itemIndex = cart.findIndex((item) => (item.MaSP || item.masp) === maSP);

  if (itemIndex > -1) {
    let currentQty =
      parseInt(cart[itemIndex].SoLuong || cart[itemIndex].soluong) || 1;
    let targetQty = currentQty + delta;

    if (targetQty <= 0) {
      Swal.fire({
        title: "Xóa sản phẩm?",
        text: "Bạn có chắc muốn xóa sản phẩm này khỏi giỏ hàng?",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#6366f1",
        cancelButtonColor: "#6c757d",
        confirmButtonText: "Đúng, xóa đi!",
        cancelButtonText: "Hủy",
      }).then((result) => {
        if (result.isConfirmed) {
          cart.splice(itemIndex, 1);
          localStorage.setItem(cartKey, JSON.stringify(cart));

          // Xóa luôn khỏi danh sách tích chọn nếu có
          let checkedItems =
            JSON.parse(localStorage.getItem(getCheckedItemsKey())) || [];
          checkedItems = checkedItems.filter((id) => id !== maSP);
          localStorage.setItem(
            getCheckedItemsKey(),
            JSON.stringify(checkedItems),
          );

          renderCartPage();

          Swal.fire({
            icon: "success",
            title: "Đã xóa sản phẩm",
            toast: true,
            position: "top-end",
            showConfirmButton: false,
            timer: 2000,
          });
        }
      });
      return;
    }

    if (delta > 0) {
      try {
        const response = await axios.get(`${BASE_URL}/products/${maSP}`);
        const productData = response.data.data || response.data;

        const stockQty =
          parseInt(
            productData.soluongton ||
              productData.SoLuongTon ||
              productData.soluong ||
              productData.SoLuong,
          ) || 0;

        if (targetQty > stockQty) {
          Swal.fire({
            icon: "warning",
            title: "Rất tiếc, không đủ hàng!",
            text: `Sản phẩm này chỉ còn tối đa ${stockQty} sản phẩm trong kho.`,
            confirmButtonColor: "#6366f1",
          });
          return;
        }
      } catch (error) {
        console.error(
          "Không thể kiểm tra số lượng tồn kho của sản phẩm:",
          error,
        );
      }
    }

    cart[itemIndex].SoLuong = targetQty;
    localStorage.setItem(cartKey, JSON.stringify(cart));
    renderCartPage();
  }
};

window.removeCartItem = function (maSP) {
  const cartKey = getCartKey();
  let cart = JSON.parse(localStorage.getItem(cartKey)) || [];

  Swal.fire({
    title: "Bỏ sản phẩm này?",
    text: "Sản phẩm sẽ được xóa khỏi danh sách giỏ hàng của bạn.",
    icon: "question",
    showCancelButton: true,
    confirmButtonColor: "#d33",
    cancelButtonColor: "#6c757d",
    confirmButtonText: "Xóa ngay",
    cancelButtonText: "Giữ lại",
  }).then((result) => {
    if (result.isConfirmed) {
      cart = cart.filter((item) => (item.MaSP || item.masp) !== maSP);
      localStorage.setItem(cartKey, JSON.stringify(cart));

      // Xóa khỏi danh sách tích chọn nếu có
      let checkedItems =
        JSON.parse(localStorage.getItem(getCheckedItemsKey())) || [];
      checkedItems = checkedItems.filter((id) => id !== maSP);
      localStorage.setItem(getCheckedItemsKey(), JSON.stringify(checkedItems));

      renderCartPage();

      Swal.fire({
        icon: "success",
        title: "Đã cập nhật giỏ hàng",
        toast: true,
        position: "top-end",
        showConfirmButton: false,
        timer: 1500,
      });
    }
  });
};

function handleCheckoutRedirect() {
  const userData = JSON.parse(localStorage.getItem("hpstore_user"));
  if (!userData || !userData.token) {
    Swal.fire({
      icon: "info",
      title: "Yêu cầu đăng nhập",
      text: "Vui lòng đăng nhập tài khoản của bạn để tiến hành thanh toán đơn hàng!",
      showCancelButton: true,
      confirmButtonColor: "#6366f1",
      cancelButtonColor: "#6c757d",
      confirmButtonText: "Đăng nhập ngay",
      cancelButtonText: "Hủy",
    }).then((result) => {
      if (result.isConfirmed) {
        window.location.href = "/src/pages/login.html";
      }
    });
    return;
  }

  // 🟢 CẬP NHẬT: Lấy danh sách sản phẩm thực sự được tích chọn để mua đi thanh toán
  const cartKey = getCartKey();
  const fullCart = JSON.parse(localStorage.getItem(cartKey)) || [];
  const checkedItems =
    JSON.parse(localStorage.getItem(getCheckedItemsKey())) || [];

  // Lọc ra các sản phẩm nằm trong danh sách checked
  const checkoutCart = fullCart.filter((item) =>
    checkedItems.includes(item.MaSP || item.masp),
  );

  if (checkoutCart.length === 0) {
    Swal.fire({
      icon: "warning",
      title: "Chưa chọn sản phẩm",
      text: "Vui lòng tích chọn ít nhất một sản phẩm trong giỏ hàng để tiến hành thanh toán!",
      confirmButtonColor: "#6366f1",
    });
    return;
  }

  // Lưu thông tin giỏ hàng rút gọn (chỉ chứa các món được chọn mua) vào một Key tạm để trang checkout.html đọc dữ liệu độc lập
  localStorage.setItem("hpstore_checkout_cart", JSON.stringify(checkoutCart));

  const checkoutDiscountInfo = {
    percent: currentDiscountPercent,
    amount: currentDiscountAmount,
    pointsToDeduct:
      currentDiscountPercent === 5
        ? 75
        : currentDiscountPercent === 10
          ? 150
          : currentDiscountPercent === 15
            ? 225
            : 0,
  };
  localStorage.setItem(
    "hpstore_checkout_discount",
    JSON.stringify(checkoutDiscountInfo),
  );
  window.location.href = "/src/pages/checkout.html";
}
