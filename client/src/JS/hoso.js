import axios from "axios";
import Swal from "sweetalert2";

import { BASE_URL } from "/src/JS/common/header";

document.addEventListener("DOMContentLoaded", async () => {
  // 1. Kiểm tra trạng thái đăng nhập từ key chung 'hpstore_user'
  const storedData = localStorage.getItem("hpstore_user");

  if (!storedData) {
    showLoginAlert();
    return;
  }

  try {
    const userSession = JSON.parse(storedData);
    const token = userSession.token;
    const maND = userSession.id;

    if (!token || !maND) {
      showLoginAlert();
      return;
    }

    // Khởi tạo bộ chọn địa chỉ trước khi load profile
    await initLocationDropdowns();

    // 2. Tải thông tin tài khoản chi tiết đổ vào Sidebar và Form
    await loadUserProfile(maND, token);

    // 3. Khởi tạo các sự kiện Form & Bắt lỗi Inline
    initUIEvents(maND, token);
  } catch (e) {
    console.error("Lỗi parse cấu trúc dữ liệu session:", e);
    showLoginAlert();
  }
});

// Hàm hiển thị thông báo bắt buộc đăng nhập
function showLoginAlert() {
  Swal.fire({
    icon: "warning",
    title: "Thông báo!",
    text: "Vui lòng đăng nhập để truy cập hồ sơ!",
    confirmButtonColor: "#6138ff",
  }).then(() => {
    window.location.href = "/src/pages/login.html";
  });
}

// 🟢 HÀM KHỞI TẠO ĐỊA CHỈ 3 CẤP TỪ API PUBLIC
async function initLocationDropdowns() {
  const provinceSel = document.getElementById("info-province");
  const districtSel = document.getElementById("info-district");
  const wardSel = document.getElementById("info-ward");

  if (!provinceSel) return;

  try {
    // Reset về trạng thái ban đầu để tránh trùng lặp option
    provinceSel.innerHTML =
      '<option value="">-- Chọn Tỉnh/Thành phố --</option>';

    // Tải danh sách Tỉnh/Thành phố
    const res = await axios.get("https://provinces.open-api.vn/api/p/");
    res.data.forEach((p) => {
      provinceSel.options[provinceSel.options.length] = new Option(
        p.name,
        p.code,
      );
    });

    // Lắng nghe thay đổi ở ô Tỉnh -> Tải Huyện
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

    // Lắng nghe thay đổi ở ô Huyện -> Tải Xã
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
    console.error("Không thể tải API địa chính công cộng:", error);
  }
}

// HÀM LẤY VÀ ĐỔ DỮ LIỆU TỪ BACKEND
async function loadUserProfile(maND, token) {
  try {
    const response = await axios.get(`${BASE_URL}/profile/${maND}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = response.data;
    console.log("Dữ liệu Profile nhận được:", data);

    // Đổ dữ liệu vào vùng Sidebar bên trái
    const sidebarFullname = document.getElementById("sidebar-fullname");
    const sidebarUsername = document.getElementById("sidebar-username");
    const sidebarPoints = document.getElementById("sidebar-points");

    if (sidebarFullname)
      sidebarFullname.innerText = data.hoten || "Chưa cập nhật";
    if (sidebarUsername) sidebarUsername.innerText = `@${data.tendangnhap}`;
    if (sidebarPoints) sidebarPoints.innerText = data.diemtichluy || 0;

    // Điền dữ liệu vào Form thông tin chi tiết
    document.getElementById("info-username").value = data.tendangnhap;
    document.getElementById("info-fullname").value = data.hoten || "";
    document.getElementById("info-phone").value = data.sdt || "";
    document.getElementById("info-email").value = data.email || "";

    // SỬA LỖI ĐỊA CHỈ NULL: Kiểm tra nghiêm ngặt tính hợp lệ của chuỗi
    if (
      data.diachi &&
      data.diachi.trim() !== "" &&
      data.diachi !== "null" &&
      data.diachi !== "undefined"
    ) {
      const parts = data.diachi.split(",").map((p) => p.trim());

      if (parts.length >= 4) {
        const provinceText = parts.pop();
        const districtText = parts.pop();
        const wardText = parts.pop();
        const streetText = parts.join(", "); // Gom các phần còn lại làm số nhà

        document.getElementById("info-street").value = streetText;

        // Kích hoạt khớp chọn Tỉnh
        const provinceSel = document.getElementById("info-province");
        for (let i = 0; i < provinceSel.options.length; i++) {
          if (provinceSel.options[i].text === provinceText) {
            provinceSel.selectedIndex = i;
            provinceSel.dispatchEvent(new Event("change"));
            break;
          }
        }

        // Đợi API tải danh sách Huyện rồi khớp dữ liệu
        setTimeout(async () => {
          const districtSel = document.getElementById("info-district");
          for (let i = 0; i < districtSel.options.length; i++) {
            if (districtSel.options[i].text === districtText) {
              districtSel.selectedIndex = i;
              districtSel.dispatchEvent(new Event("change"));
              break;
            }
          }

          // Đợi API tải danh sách Xã rồi khớp dữ liệu nốt
          setTimeout(() => {
            const wardSel = document.getElementById("info-ward");
            for (let i = 0; i < wardSel.options.length; i++) {
              if (wardSel.options[i].text === wardText) {
                wardSel.selectedIndex = i;
                break;
              }
            }
          }, 600);
        }, 600);
      } else {
        document.getElementById("info-street").value = data.diachi;
      }
    } else {
      // Khi địa chỉ trống, ô Tỉnh vẫn sẵn sàng để chọn lựa
      document.getElementById("info-street").value = "";
      document.getElementById("info-province").selectedIndex = 0;
      document.getElementById("info-district").innerHTML =
        '<option value="">-- Chọn Quận/Huyện --</option>';
      document.getElementById("info-ward").innerHTML =
        '<option value="">-- Chọn Phường/Xã --</option>';
      document.getElementById("info-district").disabled = true;
      document.getElementById("info-ward").disabled = true;
    }

    // Định dạng ngày tạo tài khoản thân thiện
    if (data.ngaytao) {
      const orderDate = new Date(data.ngaytao);
      document.getElementById("info-created-date").value =
        orderDate.toLocaleDateString("vi-VN");
    }
  } catch (err) {
    console.error("Lỗi lấy thông tin profile:", err);
    Swal.fire({
      icon: "error",
      title: "Lỗi!",
      text:
        err.response?.data?.message ||
        "Có lỗi xảy ra khi lấy thông tin từ máy chủ!",
      confirmButtonColor: "#6138ff",
    });
  }
}

// KHỞI TẠO CÁC SỰ KIỆN FORM VÀ THAO TÁC TRÊN TRANG HỒ SƠ
function initUIEvents(maND, token) {
  // Gắn sự kiện Ẩn/Hiện mật khẩu nhanh
  document.querySelectorAll(".toggle-password").forEach((btn) => {
    btn.onclick = function () {
      const input = this.parentElement.querySelector("input");
      if (input.type === "password") {
        input.type = "text";
        this.innerHTML = '<i class="fa fa-eye-slash"></i>';
      } else {
        input.type = "password";
        this.innerHTML = '<i class="fa fa-eye"></i>';
      }
    };
  });

  // 🔴 Hàm tiện ích hiển thị lỗi Inline
  function showInlineError(inputId, errorId, message) {
    const inputField = document.getElementById(inputId);
    const errorContainer = document.getElementById(errorId);
    if (inputField && errorContainer) {
      inputField.classList.add("is-invalid");
      errorContainer.innerText = message;
      errorContainer.classList.remove("d-none");
    }
  }

  // 🔴 Hàm tiện ích xóa toàn bộ lỗi cũ của form mục tiêu
  function clearFormErrors(formId) {
    const form = document.getElementById(formId);
    if (!form) return;
    form.querySelectorAll(".form-control").forEach((input) => {
      input.classList.remove("is-invalid");
    });
    form.querySelectorAll(".error-text").forEach((errDiv) => {
      errDiv.classList.add("d-none");
      errDiv.innerText = "";
    });
  }

  // Khởi tạo cơ chế tự động xóa lỗi khi người dùng nhập/thay đổi ký tự
  const allInputs = [
    "info-fullname",
    "info-phone",
    "info-email",
    "pass-current",
    "pass-new",
    "pass-confirm",
  ];
  allInputs.forEach((id) => {
    const inputEl = document.getElementById(id);
    if (inputEl) {
      inputEl.addEventListener("input", function () {
        this.classList.remove("is-invalid");
        const errDiv = document.getElementById(`${id}-error`);
        if (errDiv) {
          errDiv.classList.add("d-none");
          errDiv.innerText = "";
        }
      });
    }
  });

  // =================================================================================
  // ⚡ SUBMIT FORM 1: CẬP NHẬT THÔNG TIN CÁ NHÂN
  // =================================================================================
  const formInfo = document.getElementById("form-update-profile");
  if (formInfo) {
    formInfo.onsubmit = async (e) => {
      e.preventDefault();
      clearFormErrors("form-update-profile");

      const hoTen = document.getElementById("info-fullname").value.trim();
      const sdt = document.getElementById("info-phone").value.trim();
      const email = document.getElementById("info-email").value.trim();

      // Thu thập thông tin từ bộ dropdown địa chính
      const pEl = document.getElementById("info-province");
      const dEl = document.getElementById("info-district");
      const wEl = document.getElementById("info-ward");
      const streetText = document.getElementById("info-street").value.trim();

      const provinceText = pEl.options[pEl.selectedIndex]?.value
        ? pEl.options[pEl.selectedIndex].text
        : "";
      const districtText = dEl.options[dEl.selectedIndex]?.value
        ? dEl.options[dEl.selectedIndex].text
        : "";
      const wardText = wEl.options[wEl.selectedIndex]?.value
        ? wEl.options[wEl.selectedIndex].text
        : "";

      let hasError = false;

      // Validate Họ và tên
      if (!hoTen) {
        showInlineError(
          "info-fullname",
          "info-fullname-error",
          "Họ và tên không được để trống!",
        );
        hasError = true;
      } else if (hoTen.length < 6) {
        showInlineError(
          "info-fullname",
          "info-fullname-error",
          "Họ và tên phải từ 6 ký tự trở lên!",
        );
        hasError = true;
      }

      // Validate Số điện thoại
      const phoneRegex = /^[0-9]+$/;
      if (!sdt) {
        showInlineError(
          "info-phone",
          "info-phone-error",
          "Số điện thoại không được để trống!",
        );
        hasError = true;
      } else if (!phoneRegex.test(sdt)) {
        showInlineError(
          "info-phone",
          "info-phone-error",
          "Số điện thoại bắt buộc phải nhập số!",
        );
        hasError = true;
      } else if (sdt.length < 10) {
        showInlineError(
          "info-phone",
          "info-phone-error",
          "Số điện thoại phải từ 10 chữ số trở lên!",
        );
        hasError = true;
      }

      // Validate Email (nếu có nhập)
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (email && !emailRegex.test(email)) {
        showInlineError(
          "info-email",
          "info-email-error",
          "Địa chỉ Email không hợp lệ!",
        );
        hasError = true;
      }

      // Validate bắt buộc chọn đầy đủ các cấp địa chỉ nếu đã nhập số nhà hoặc thao tác chọn địa chính
      if (
        (streetText || provinceText || districtText || wardText) &&
        (!provinceText || !districtText || !wardText || !streetText)
      ) {
        // Địa chỉ không ép buộc trong database (null) nên dùng thông báo cảnh báo nhanh dạng Alert để họ biết cần hoàn tất form nếu lỡ gõ dở
        Swal.fire({
          icon: "warning",
          title: "Thiếu thông tin địa chỉ",
          text: "Vui lòng nhập đầy đủ Số nhà kèm chọn Tỉnh, Huyện, Xã để lưu định dạng vị trí!",
          confirmButtonColor: "#6138ff",
        });
        hasError = true;
      }

      if (hasError) return;

      // Ghép chuỗi địa chỉ theo chuẩn quốc gia nếu hợp lệ
      let diaChi = "";
      if (streetText) {
        diaChi = `${streetText}, ${wardText}, ${districtText}, ${provinceText}`;
      }

      const payload = {
        HoTen: hoTen,
        SDT: sdt,
        Email: email || null,
        DiaChi: diaChi || null,
      };

      try {
        await axios.put(`${BASE_URL}/profile/update/${maND}`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });

        Swal.fire({
          icon: "success",
          title: "Thành công!",
          text: "Thông tin cá nhân đã được cập nhật!",
          confirmButtonColor: "#6138ff",
        }).then(() => {
          const userSession = JSON.parse(localStorage.getItem("hpstore_user"));
          if (userSession) {
            userSession.name = payload.HoTen;
            localStorage.setItem("hpstore_user", JSON.stringify(userSession));
          }
          location.reload();
        });
      } catch (error) {
        console.error("Lỗi cập nhật profile:", error);
        const errorDetail = error.response?.data?.error || "";
        const serverMsg = error.response?.data?.message || "";

        // Map lỗi từ server trực tiếp xuống form inline thay vì bắn Alert
        if (
          errorDetail.includes("uq_nd_sdt") ||
          errorDetail.includes("sdt") ||
          serverMsg.includes("Số điện thoại")
        ) {
          showInlineError(
            "info-phone",
            "info-phone-error",
            "Số điện thoại này đã được sử dụng bởi một tài khoản khác!",
          );
        } else if (
          errorDetail.includes("uq_nd_email") ||
          errorDetail.includes("email") ||
          serverMsg.includes("Email")
        ) {
          showInlineError(
            "info-email",
            "info-email-error",
            "Địa chỉ Email này đã được sử dụng bởi một tài khoản khác!",
          );
        } else {
          Swal.fire({
            icon: "error",
            title: "Lỗi hệ thống!",
            text: serverMsg || "Không thể cập nhật thông tin lúc này.",
            confirmButtonColor: "#6138ff",
          });
        }
      }
    };
  }

  // =================================================================================
  // ⚡ SUBMIT FORM 2: THAY ĐỔI MẬT KHẨU
  // =================================================================================
  const formPassword = document.getElementById("form-change-password");
  if (formPassword) {
    formPassword.onsubmit = async (e) => {
      e.preventDefault();
      clearFormErrors("form-change-password");

      const currentPassword = document.getElementById("pass-current").value;
      const newPassword = document.getElementById("pass-new").value;
      const confirmPassword = document.getElementById("pass-confirm").value;

      let hasError = false;

      // Validate mật khẩu hiện tại
      if (!currentPassword) {
        showInlineError(
          "pass-current",
          "pass-current-error",
          "Vui lòng nhập mật khẩu hiện tại!",
        );
        hasError = true;
      }

      // Validate mật khẩu mới
      if (!newPassword) {
        showInlineError(
          "pass-new",
          "pass-new-error",
          "Vui lòng nhập mật khẩu mới!",
        );
        hasError = true;
      } else if (newPassword.length < 6) {
        showInlineError(
          "pass-new",
          "pass-new-error",
          "Mật khẩu mới phải từ 6 ký tự trở lên!",
        );
        hasError = true;
      } else if (currentPassword === newPassword) {
        showInlineError(
          "pass-new",
          "pass-new-error",
          "Mật khẩu mới không được trùng mật khẩu hiện tại!",
        );
        hasError = true;
      }

      // Validate xác nhận lại mật khẩu
      if (!confirmPassword) {
        showInlineError(
          "pass-confirm",
          "pass-confirm-error",
          "Vui lòng xác nhận lại mật khẩu mới!",
        );
        hasError = true;
      } else if (newPassword !== confirmPassword) {
        showInlineError(
          "pass-confirm",
          "pass-confirm-error",
          "Xác nhận mật khẩu mới không khớp!",
        );
        hasError = true;
      }

      if (hasError) return;

      try {
        await axios.put(
          `${BASE_URL}/profile/change-password/${maND}`,
          { currentPassword, newPassword },
          { headers: { Authorization: `Bearer ${token}` } },
        );

        Swal.fire({
          icon: "success",
          title: "Thành công!",
          text: "Mật khẩu đã được thay đổi. Vui lòng đăng nhập lại!",
          confirmButtonColor: "#6138ff",
          allowOutsideClick: false,
        }).then(() => {
          formPassword.reset();
          localStorage.removeItem("hpstore_user");
          window.location.href = "/src/pages/login.html";
        });
      } catch (error) {
        console.error("Lỗi đổi mật khẩu:", error);
        const serverMsg = error.response?.data?.message || "";

        // Map lỗi sai mật khẩu cũ trả về từ server vào ô input hiện tại
        if (
          serverMsg.toLowerCase().includes("hiện tại") ||
          serverMsg.toLowerCase().includes("cũ") ||
          serverMsg.toLowerCase().includes("không chính xác")
        ) {
          showInlineError(
            "pass-current",
            "pass-current-error",
            "Mật khẩu hiện tại không chính xác!",
          );
        } else {
          Swal.fire({
            icon: "error",
            title: "Thất bại!",
            text: serverMsg || "Mật khẩu cũ không chính xác.",
            confirmButtonColor: "#6138ff",
          });
        }
      }
    };
  }
}
