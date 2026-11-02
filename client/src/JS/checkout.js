import axios from "axios"; // Đồng bộ sử dụng axios giống cart.js nếu cần, hoặc dùng fetch chuẩn hóa
import Swal from "sweetalert2";
import { BASE_URL } from "/src/JS/common/header";

const MY_ACCOUNT = "0934135205";
const DEFAULT_IMAGE = "/img/default.jpg";
let baseTotalMoney = 0; // Tổng tiền sản phẩm gốc
let voucherDiscountAmount = 0; // Số tiền được giảm từ đổi điểm

const BANK_CONFIG = {
  bankId: "mbbank",
  accountNo: MY_ACCOUNT,
  accountName: "CONG TY HP STORE",
};

document.addEventListener("DOMContentLoaded", async () => {
  // 🟢 ĐÃ CẬP NHẬT: Đảm bảo dropdown địa chính được nạp danh sách Tỉnh trước khi fill dữ liệu người dùng
  await initLocationDropdowns();
  autofillUserInfo();
  renderCheckoutSummary();

  const shippingOptions = document.querySelectorAll(
    'input[name="shippingMethod"]',
  );
  shippingOptions.forEach((option) => {
    option.addEventListener("change", updateFinalTotalDisplay);
  });

  const checkoutForm = document.getElementById("checkout-form");
  if (checkoutForm) {
    checkoutForm.addEventListener("submit", handleCheckoutSubmit);
  }
});

function getCartKey() {
  const userData = JSON.parse(localStorage.getItem("hpstore_user"));
  if (
    userData &&
    (userData.maND || userData.id || userData.MaND || userData.mand)
  ) {
    return `hpstore_cart_${userData.maND || userData.id || userData.MaND || userData.mand}`;
  }
  return "hpstore_cart_guest";
}

// 🟢 HÀM LẤY KEY CỦA CÁC MÓN ĐƯỢC TÍCH CHỌN SANG ĐỂ ĐỒNG BỘ
function getCheckedItemsKey() {
  return getCartKey() + "_checked_items";
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

// 🟢 ĐÃ CẬP NHẬT: Tự động điền thông tin và bóc tách chuỗi địa chỉ 4 cấp an toàn chống null
async function autofillUserInfo() {
  const userData = JSON.parse(localStorage.getItem("hpstore_user"));
  const maND =
    userData?.maND || userData?.id || userData?.MaND || userData?.mand;

  if (!maND) {
    resetPlaceholdersToGuest();
    return;
  }

  try {
    const res = await fetch(`${BASE_URL}/user/profile?id=${maND}`);
    const result = await res.json();

    const user = result.data || result;

    if (user) {
      if (user.hoten || user.HoTen) {
        document.getElementById("checkout-fullname").value =
          user.hoten || user.HoTen;
      }
      if (user.sdt || user.SDT) {
        document.getElementById("checkout-phone").value = user.sdt || user.SDT;
      }

      // 🟢 XỬ LÝ ĐỔ DỮ LIỆU ĐỊA CHỈ LÊN DROPDOWN 3 CẤP
      const rawAddress = user.diachi || user.DiaChi;
      if (
        rawAddress &&
        rawAddress.trim() !== "" &&
        rawAddress !== "null" &&
        rawAddress !== "undefined"
      ) {
        const parts = rawAddress.split(",").map((p) => p.trim());

        // Nếu chuỗi chuẩn cấu trúc: [Số nhà], [Phường/Xã], [Quận/Huyện], [Tỉnh/Thành]
        if (parts.length >= 4) {
          const provinceText = parts.pop();
          const districtText = parts.pop();
          const wardText = parts.pop();
          const streetText = parts.join(", "); // Phần còn lại là số nhà, tên đường

          document.getElementById("checkout-street").value = streetText;

          // Khớp chọn Tỉnh/Thành
          const provinceSel = document.getElementById("checkout-province");
          for (let i = 0; i < provinceSel.options.length; i++) {
            if (provinceSel.options[i].text === provinceText) {
              provinceSel.selectedIndex = i;
              provinceSel.dispatchEvent(new Event("change")); // Kích hoạt sự kiện để load danh sách Huyện
              break;
            }
          }

          // Đợi API nạp danh sách Huyện rồi tiếp tục khớp dữ liệu
          setTimeout(async () => {
            const districtSel = document.getElementById("checkout-district");
            for (let i = 0; i < districtSel.options.length; i++) {
              if (districtSel.options[i].text === districtText) {
                districtSel.selectedIndex = i;
                districtSel.dispatchEvent(new Event("change")); // Kích hoạt sự kiện để load danh sách Xã
                break;
              }
            }

            // Đợi API nạp danh sách Xã rồi khớp nốt giá trị cuối cùng
            setTimeout(() => {
              const wardSel = document.getElementById("checkout-ward");
              for (let i = 0; i < wardSel.options.length; i++) {
                if (wardSel.options[i].text === wardText) {
                  wardSel.selectedIndex = i;
                  break;
                }
              }
            }, 600);
          }, 600);
        } else {
          // Fallback nếu địa chỉ cũ lưu tự do thì đẩy hết vào ô số nhà
          document.getElementById("checkout-street").value = rawAddress;
        }
      } else {
        // Địa chỉ là null/rỗng: Reset sạch các ô để khách tự chọn mới
        document.getElementById("checkout-street").value = "";
        document.getElementById("checkout-province").selectedIndex = 0;
        document.getElementById("checkout-district").innerHTML =
          '<option value="">-- Chọn Quận/Huyện --</option>';
        document.getElementById("checkout-ward").innerHTML =
          '<option value="">-- Chọn Phường/Xã --</option>';
        document.getElementById("checkout-district").disabled = true;
        document.getElementById("checkout-ward").disabled = true;
      }

      if (user.diemtichluy !== undefined) {
        localStorage.setItem("hpstore_user_points", user.diemtichluy);
      }
    } else {
      resetPlaceholdersToGuest();
    }
  } catch (error) {
    console.error("Không thể kết nối API lấy thông tin tài khoản:", error);
    resetPlaceholdersToGuest();
  }
}

// 🟢 HÀM KHỞI TẠO ĐỊA CHỈ 3 CẤP TỪ API PUBLIC
async function initLocationDropdowns() {
  const provinceSel = document.getElementById("checkout-province");
  const districtSel = document.getElementById("checkout-district");
  const wardSel = document.getElementById("checkout-ward");

  if (!provinceSel) return;

  try {
    // Đảm bảo trạng thái ban đầu sạch sẽ
    provinceSel.innerHTML =
      '<option value="">-- Chọn Tỉnh/Thành phố --</option>';

    // 1. Tải danh sách Tỉnh/Thành phố (dùng API public không cần Token)
    const res = await axios.get("https://provinces.open-api.vn/api/p/");
    res.data.forEach((p) => {
      provinceSel.options[provinceSel.options.length] = new Option(
        p.name,
        p.code,
      );
    });

    // 2. Lắng nghe thay đổi ở ô Tỉnh -> Tải Huyện
    provinceSel.addEventListener("change", async () => {
      districtSel.innerHTML = '<option value="">-- Chọn Quận/Huyện --</option>';
      wardSel.innerHTML = '<option value="">-- Chọn Phường/Xã --</option>';
      districtSel.disabled = true;
      wardSel.disabled = true;

      if (provinceSel.value) {
        const dRes = await axios.get(
          `https://provinces.open-api.vn/api/p/${provinceSel.value}?depth=2`,
        );
        dRes.data.districts.forEach((d) => {
          districtSel.options[districtSel.options.length] = new Option(
            d.name,
            d.code,
          );
        });
        districtSel.disabled = false;
      }
    });

    // 3. Lắng nghe thay đổi ở ô Huyện -> Tải Xã
    districtSel.addEventListener("change", async () => {
      wardSel.innerHTML = '<option value="">-- Chọn Phường/Xã --</option>';
      wardSel.disabled = true;

      if (districtSel.value) {
        const wRes = await axios.get(
          `https://provinces.open-api.vn/api/d/${districtSel.value}?depth=2`,
        );
        wRes.data.wards.forEach((w) => {
          wardSel.options[wardSel.options.length] = new Option(w.name, w.code);
        });
        wardSel.disabled = false;
      }
    });
  } catch (error) {
    console.error("Không thể tải API địa chính:", error);
  }
}

function resetPlaceholdersToGuest() {
  const nameEl = document.getElementById("checkout-fullname");
  const phoneEl = document.getElementById("checkout-phone");
  if (nameEl) nameEl.placeholder = "Nhập họ tên người nhận...";
  if (phoneEl) phoneEl.placeholder = "Nhập số điện thoại nhận hàng...";
}

function renderCheckoutSummary() {
  const container = document.getElementById("checkout-items-list");
  if (!container) return;

  const checkoutCart =
    JSON.parse(localStorage.getItem("hpstore_checkout_cart")) || [];

  if (checkoutCart.length === 0) {
    Swal.fire({
      icon: "warning",
      title: "Chưa chọn sản phẩm!",
      text: "Không tìm thấy dữ liệu mặt hàng được chọn để thanh toán. Quay lại giỏ hàng nhé!",
      confirmButtonColor: "#6366f1",
    }).then(() => {
      window.location.href = "/src/pages/cart.html";
    });
    return;
  }

  baseTotalMoney = checkoutCart.reduce((sum, item) => {
    const gia = parseFloat(item.GiaBan || item.giaban) || 0;
    const qty = parseInt(item.SoLuong || item.soluong) || 0;
    return sum + gia * qty;
  }, 0);

  container.innerHTML = checkoutCart
    .map((item) => {
      const gia = parseFloat(item.GiaBan || item.giaban) || 0;
      const qty = parseInt(item.SoLuong || item.soluong) || 0;
      const rawImg = item.hinhanh || item.hinhAnh || item.HinhAnh;
      const tenSP = item.tensp || item.TenSP || "Sản phẩm";
      const imgPath = getProductImageUrl(rawImg);

      return `
            <div class="d-flex align-items-center gap-3 mb-3">
                <img src="${imgPath}" class="product-checkout-img border" alt="${tenSP}" onerror="this.onerror=null; this.src='${DEFAULT_IMAGE}';" style="width:50px; height:50px; object-fit:contain; border-radius: 6px;">
                <div class="flex-grow-1 min-w-0">
                    <h6 class="small fw-bold text-dark mb-0 text-truncate" style="max-width: 220px;">${tenSP}</h6>
                    <small class="text-muted">SL: ${qty} x ${gia.toLocaleString("vi-VN")} đ</small>
                </div>
                <span class="small fw-bold text-dark text-end">${(gia * qty).toLocaleString("vi-VN")} đ</span>
            </div>
        `;
    })
    .join("");

  document.getElementById("checkout-subtotal").innerText =
    `${baseTotalMoney.toLocaleString("vi-VN")} đ`;

  const discountInfo = JSON.parse(
    localStorage.getItem("hpstore_checkout_discount"),
  );
  const discountLabelEl = document.getElementById("checkout-discount-fee");

  if (discountInfo && discountInfo.amount > 0) {
    voucherDiscountAmount = discountInfo.amount;
    if (discountLabelEl) {
      discountLabelEl.innerText = `-${voucherDiscountAmount.toLocaleString("vi-VN")} đ (${discountInfo.percent}%)`;
      discountLabelEl.className = "fw-bold text-danger";
    }
  } else {
    voucherDiscountAmount = 0;
    if (discountLabelEl) discountLabelEl.innerText = "0 đ";
  }

  updateFinalTotalDisplay();
}

function updateFinalTotalDisplay() {
  const selectedShipElement = document.querySelector(
    'input[name="shippingMethod"]:checked',
  );
  const shipFee = selectedShipElement ? parseInt(selectedShipElement.value) : 0;

  const feeLabel = document.getElementById("checkout-shipping-fee");
  if (feeLabel) {
    if (shipFee === 0) {
      feeLabel.innerText = "Miễn phí";
      feeLabel.className = "fw-bold text-success";
    } else {
      feeLabel.innerText = `${shipFee.toLocaleString("vi-VN")} đ`;
      feeLabel.className = "fw-bold text-dark";
    }
  }

  const finalTotal = Math.max(
    0,
    baseTotalMoney + shipFee - voucherDiscountAmount,
  );

  const totalEl = document.getElementById("checkout-total");
  if (totalEl) {
    totalEl.innerText = `${finalTotal.toLocaleString("vi-VN")} đ`;
  }
  return finalTotal;
}

async function handleCheckoutSubmit(e) {
  e.preventDefault();

  const name = document.getElementById("checkout-fullname").value.trim();
  const phone = document.getElementById("checkout-phone").value.trim();

  // 🟢 ĐÃ CẬP NHẬT: Gom dữ liệu từ bộ chọn địa chỉ mới để tạo chuỗi gán cho payload gửi lên API
  const pEl = document.getElementById("checkout-province");
  const dEl = document.getElementById("checkout-district");
  const wEl = document.getElementById("checkout-ward");
  const streetText = document.getElementById("checkout-street").value.trim();

  const provinceText = pEl.options[pEl.selectedIndex]?.value
    ? pEl.options[pEl.selectedIndex].text
    : "";
  const districtText = dEl.options[dEl.selectedIndex]?.value
    ? dEl.options[dEl.selectedIndex].text
    : "";
  const wardText = wEl.options[wEl.selectedIndex]?.value
    ? wEl.options[wEl.selectedIndex].text
    : "";

  // Validate nghiêm ngặt nếu nhập thiếu các tầng cấp hành chính
  if (!streetText || !provinceText || !districtText || !wardText) {
    Swal.fire({
      icon: "warning",
      title: "Thiếu thông tin địa chỉ",
      text: "Vui lòng nhập số nhà/tên đường và chọn đầy đủ Tỉnh thành, Quận huyện, Phường xã nhận hàng!",
      confirmButtonColor: "#6366f1",
    });
    return;
  }

  const address = `${streetText}, ${wardText}, ${districtText}, ${provinceText}`;
  const note = document.getElementById("checkout-note").value.trim();
  const paymentElement = document.querySelector(
    'input[name="paymentMethod"]:checked',
  );

  if (!paymentElement) {
    Swal.fire("Thông báo", "Vui lòng chọn phương thức thanh toán!", "warning");
    return;
  }
  const paymentMethod = paymentElement.value;

  if (!name || !phone) {
    Swal.fire({
      icon: "warning",
      title: "Thiếu thông tin nhận hàng",
      text: "Vui lòng cung cấp đầy đủ Tên và Số điện thoại nhận hàng chính xác!",
      confirmButtonColor: "#6366f1",
    });
    return;
  }

  const checkoutCart =
    JSON.parse(localStorage.getItem("hpstore_checkout_cart")) || [];
  const userData = JSON.parse(localStorage.getItem("hpstore_user")) || {};
  const finalTotalMoney = updateFinalTotalDisplay();

  const discountInfo = JSON.parse(
    localStorage.getItem("hpstore_checkout_discount"),
  ) || { percent: 0, amount: 0, pointsToDeduct: 0 };

  const selectedBranchEl = document.querySelector('input[name="checkoutBranch"]:checked');
  const selectedMakho = selectedBranchEl ? selectedBranchEl.value : "KHO_TONG";
  const selectedMachinhanh = selectedMakho === "KHO_CN1" ? "CN_1" : selectedMakho === "KHO_CN2" ? "CN_2" : "CN_CHINH";

  const checkoutPayload = {
    MaNguoiDung:
      userData.maND || userData.id || userData.MaND || userData.mand || null,
    MaKho: selectedMakho,
    MaChiNhanh: selectedMachinhanh,
    GhiChu: note || null,
    NguoiNhan: name,
    SDTNguoiNhan: phone,
    DiaChi: address,
    PhuongThucThanhToan: paymentMethod,
    PointsToDeduct: discountInfo.pointsToDeduct,
    TongGiamGia: discountInfo.amount,
    ChiTiet: checkoutCart.map((item) => {
      const giaBan = parseFloat(item.GiaBan || item.giaban) || 0;
      const soLuong = parseInt(item.SoLuong || item.soluong) || 0;

      let itemDiscount = 0;
      if (discountInfo.percent > 0) {
        itemDiscount = Math.round(giaBan * (discountInfo.percent / 100));
      }

      return {
        MaSP: item.MaSP || item.masp,
        SoLuong: soLuong,
        GiaBan: giaBan,
        GiamGia: itemDiscount,
      };
    }),
  };

  try {
    Swal.fire({
      title: "Đang xử lý đơn hàng...",
      text: "Vui lòng không tắt trình duyệt hoặc tải lại trang.",
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    const response = await fetch(`${BASE_URL}/checkout/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(checkoutPayload),
    });

    const result = await response.json();

    if (response.ok && result.success) {
      const createdOrderId = result.maDonHang || result.MaDonHang;

      localStorage.removeItem("hpstore_checkout_discount");

      const methodCheck = paymentMethod.toUpperCase();
      if (
        methodCheck === "CHUYEN_KHOAN" ||
        methodCheck === "BANK_TRANSFER" ||
        methodCheck === "CHUYENKHOAN"
      ) {
        const memo = `HPSTORE DH${createdOrderId}`;
        const qrUrl = `https://img.vietqr.io/image/${BANK_CONFIG.bankId}-${BANK_CONFIG.accountNo}-compact2.jpg?amount=${finalTotalMoney}&addInfo=${encodeURIComponent(memo)}&accountName=${encodeURIComponent(BANK_CONFIG.accountName)}`;

        Swal.fire({
          title: "Thanh Toán Chuyển Khoản QR",
          html: `
            <div class="text-center">
              <p class="text-muted small mb-2">Vui lòng quét mã QR dưới đây bằng ứng dụng Ngân hàng để thanh toán.</p>
              <div class="p-2 border rounded bg-light d-inline-block mb-3">
                <img src="${qrUrl}" alt="Mã QR Thanh Toán" style="max-width: 240px; width: 100%; height: auto;">
              </div>
              <div class="text-start px-3 py-2 border rounded bg-light" style="font-size: 0.9rem;">
                <div class="mb-1"><b>Ngân hàng:</b> ${BANK_CONFIG.bankId.toUpperCase()}</div>
                <div class="mb-1"><b>Số tài khoản:</b> <span class="text-primary fw-bold">${BANK_CONFIG.accountNo}</span></div>
                <div class="mb-1"><b>Số tiền:</b> <span class="text-danger fw-bold">${finalTotalMoney.toLocaleString("vi-VN")} đ</span></div>
                <div><b>Nội dung chuyển:</b> <span class="text-success fw-bold">${memo}</span></div>
              </div>
              <p class="text-warning small mt-2 mb-0"><i class="fa fa-info-circle"></i> Hệ thống sẽ duyệt đơn tự động khi nhận được tiền.</p>
            </div>
          `,
          showCancelButton: false,
          confirmButtonColor: "#10b981",
          confirmButtonText: "Tôi đã chuyển khoản thành công",
          allowOutsideClick: false,
        }).then((invoiceResult) => {
          if (invoiceResult.isConfirmed) {
            clearPurchasedItems();
          }
        });
      } else {
        Swal.fire({
          icon: "success",
          title: "Đặt hàng thành công!",
          html: `Cảm ơn bạn đã mua sắm tại HP STORE.<br>Mã đơn hàng của bạn là: <b>${createdOrderId}</b>`,
          confirmButtonColor: "#6366f1",
          confirmButtonText: "Quay lại trang chủ",
        }).then(() => {
          clearPurchasedItems();
        });
      }
    } else {
      Swal.fire({
        icon: "error",
        title: "Quá trình đặt hàng thất bại",
        text: result.message || "Có lỗi ngoài ý muốn xảy ra, vui lòng thử lại.",
        confirmButtonColor: "#ef4444",
      });
    }
  } catch (error) {
    console.error("Lỗi API Gửi dữ liệu Checkout:", error);
    Swal.fire({
      icon: "error",
      title: "Lỗi kết nối máy chủ",
      text: "Đường truyền mạng bị gián đoạn, vui lòng thử lại sau!",
      confirmButtonColor: "#ef4444",
    });
  }
}

function clearPurchasedItems() {
  const cartKey = getCartKey();
  const fullCart = JSON.parse(localStorage.getItem(cartKey)) || [];
  const checkoutCart =
    JSON.parse(localStorage.getItem("hpstore_checkout_cart")) || [];

  const purchasedIds = checkoutCart.map((item) => item.MaSP || item.masp);

  const remainingCart = fullCart.filter(
    (item) => !purchasedIds.includes(item.MaSP || item.masp),
  );

  localStorage.setItem(cartKey, JSON.stringify(remainingCart));

  localStorage.removeItem("hpstore_checkout_cart");
  localStorage.removeItem(getCheckedItemsKey());

  const totalItems = remainingCart.reduce(
    (sum, item) => sum + (parseInt(item.SoLuong || item.soluong) || 0),
    0,
  );
  const badge = document.getElementById("cart-count");
  if (badge) badge.innerText = totalItems;

  window.location.href = "/";
}
