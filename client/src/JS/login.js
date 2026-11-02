import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import Swal from "sweetalert2";
import axios from "axios";

import { BASE_URL } from "/src/JS/common/header";

async function handleLoginPage() {
  const savedUser = localStorage.getItem("hpstore_user");
  const passwordInput = document.querySelector("#password");
  const loginForm = document.querySelector("#loginForm");
  const usernameInput = document.querySelector("#username");
  const togglePassword = document.querySelector("#togglePassword");

  // Thêm các phần tử chứa text lỗi vào DOM selector
  const usernameError = document.querySelector("#usernameError");
  const passwordError = document.querySelector("#passwordError");

  // ─── 1. KIỂM TRA ĐĂNG NHẬP SỚM (ANTI-TAMPERING) ───
  if (savedUser) {
    try {
      const userData = JSON.parse(savedUser);

      if (userData && userData.token) {
        Swal.fire({
          title: "Đang tự động đăng nhập...",
          allowOutsideClick: false,
          didOpen: () => {
            Swal.showLoading();
          },
        });

        const response = await axios.get(`${BASE_URL}/auth/verify-role`, {
          headers: { Authorization: `Bearer ${userData.token}` },
        });

        Swal.close();

        const realRole = response.data.role;
        userData.role = realRole;
        userData.machinhanh = response.data.machinhanh || userData.machinhanh || null;
        localStorage.setItem("hpstore_user", JSON.stringify(userData));
        localStorage.setItem("user", JSON.stringify(userData));
        localStorage.setItem("token", userData.token);

        const roleUpper = String(realRole || "").toUpperCase();
        if (roleUpper === "MANAGER" || roleUpper === "ADMIN") {
          localStorage.setItem("current_admin_page", "tong-quan");
          window.location.href = "/src/pages/dashboard.html";
        } else if (roleUpper === "EMPLOYEE" || roleUpper === "STAFF") {
          window.location.href = "/src/pages/employeeManager.html";
        } else {
          window.location.href = window.location.origin;
        }
        return;
      }
    } catch (e) {
      Swal.close();
      localStorage.removeItem("hpstore_user");
    }
  }

  // ─── 2. KHỞI TẠO ĐIỀU KHIỂN GIAO DIỆN FORM ───
  if (
    !togglePassword ||
    !passwordInput ||
    !loginForm ||
    !usernameInput ||
    !usernameError ||
    !passwordError
  ) {
    console.warn(
      "Một số phần tử không tìm thấy trong DOM. Kiểm tra lại ID trong file HTML.",
    );
    return;
  }

  const eyeIcon = togglePassword.querySelector("i");

  // 🟢 CẬP NHẬT: Hàm hiển thị lỗi dưới Input + Hiệu ứng rung Form
  const showInputError = (errorElement, inputElement, message) => {
    errorElement.innerText = message;
    errorElement.classList.remove("d-none");
    inputElement.classList.add("is-invalid"); // Thêm viền đỏ Bootstrap cho input

    loginForm.classList.add("animate-shake");
    setTimeout(() => loginForm.classList.remove("animate-shake"), 500);
  };

  // 🟢 CẬP NHẬT: Hàm xóa toàn bộ thông báo lỗi cũ
  const clearErrors = () => {
    usernameError.classList.add("d-none");
    usernameError.innerText = "";
    usernameInput.classList.remove("is-invalid");

    passwordError.classList.add("d-none");
    passwordError.innerText = "";
    passwordInput.classList.remove("is-invalid");
  };

  // Xóa lỗi cũ khi người dùng tập trung gõ lại dữ liệu
  usernameInput.addEventListener("input", clearErrors);
  passwordInput.addEventListener("input", clearErrors);

  // ─── 2.5 HỘP CHỌN NHANH TÀI KHOẢN DEMO (1-CLICK ĐIỀN TỰ ĐỘNG CHUẨN ACTOR HP STORE) ───
  function setDemoAccount(username, password, roleName) {
    clearErrors();
    usernameInput.value = username;
    passwordInput.value = password;
    usernameInput.classList.add("is-valid");
    passwordInput.classList.add("is-valid");

    setTimeout(() => {
      usernameInput.classList.remove("is-valid");
      passwordInput.classList.remove("is-valid");
    }, 1200);

    const Toast = Swal.mixin({
      toast: true,
      position: "top-end",
      showConfirmButton: false,
      timer: 2200,
      timerProgressBar: true,
    });
    Toast.fire({
      icon: "success",
      title: `Đã điền tài khoản ${roleName}!`,
      text: `${username} / ${password}`,
    });
  }

  document.getElementById("btnDemoAdmin")?.addEventListener("click", () => {
    setDemoAccount("admin", "123456", "👑 Quản trị viên (Super Admin)");
  });

  document.getElementById("btnDemoManager")?.addEventListener("click", () => {
    setDemoAccount("manager", "123456", "🏢 Quản lý chi nhánh (Store Manager)");
  });

  document.getElementById("btnDemoSales")?.addEventListener("click", () => {
    setDemoAccount("nhanvien", "123456", "💼 Nhân viên bán hàng (Sales Staff)");
  });

  document.getElementById("btnDemoCustomer")?.addEventListener("click", () => {
    setDemoAccount("khachhang", "123456", "👤 Khách hàng thành viên (Member)");
  });

  // Hiện/ẩn mật khẩu
  togglePassword.addEventListener("click", function () {
    const type =
      passwordInput.getAttribute("type") === "password" ? "text" : "password";
    passwordInput.setAttribute("type", type);
    if (togglePassword) togglePassword.innerText = (type === "text") ? "Ẩn" : "Hiện";

  });

  // ─── 3. XỬ LÝ SỰ KIỆN XÁC THỰC ĐĂNG NHẬP ───
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearErrors(); // Xóa lỗi cũ trước khi kiểm tra lượt mới

    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    // Kiểm tra dữ liệu rỗng Client-side
    if (!username) {
      showInputError(
        usernameError,
        usernameInput,
        "Vui lòng nhập tên đăng nhập!",
      );
      usernameInput.focus();
      return;
    }

    if (!password) {
      showInputError(passwordError, passwordInput, "Vui lòng nhập mật khẩu!");
      passwordInput.focus();
      return;
    }

    if (username.length < 5) {
      showInputError(
        usernameError,
        usernameInput,
        "Tên đăng nhập phải có ít nhất 5 ký tự!",
      );
      usernameInput.focus();
      return;
    }

    try {
      Swal.fire({
        title: "Đang xác thực...",
        text: "Vui lòng chờ trong giây lát",
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });

      // BACKDOOR ĐỂ TEST UI (KHÔNG DÙNG TRONG PRODUCTION)
      if (username === "admin" && password === "admin") {
        const mockUserData = {
          id: "ADMIN_MOCK",
          username: "admin",
          name: "Administrator (Test)",
          role: "ADMIN",
          token: "mock-token-12345",
          loginAt: new Date().toISOString(),
        };

        localStorage.setItem("hpstore_user", JSON.stringify(mockUserData));

        Swal.fire({
          icon: "success",
          title: "Đăng nhập thử nghiệm!",
          text: `Chào mừng bạn vào Dashboard Test!`,
          timer: 1500,
          showConfirmButton: false,
        }).then(() => {
          window.location.href = "/src/pages/dashboard.html";
        });
        return;
      }

      const response = await axios.post(`${BASE_URL}/auth/login`, {
        identifier: username,
        password: password,
      });

      if (response.status === 200) {
        const { token, user } = response.data;

        const userData = {
          id: user.maND,
          username: user.username,
          name: user.fullname,
          role: user.role,
          machinhanh: user.machinhanh || null,
          token: token,
          loginAt: new Date().toISOString(),
        };

        localStorage.setItem("hpstore_user", JSON.stringify(userData));
        localStorage.setItem("user", JSON.stringify(userData));
        localStorage.setItem("token", token);

        Swal.fire({
          icon: "success",
          title: "Đăng nhập thành công!",
          text: `Chào mừng ${userData.name || "bạn"} đã quay lại HP STORE!`,
          timer: 1500,
          showConfirmButton: false,
        }).then(() => {
          const roleUpper = String(userData.role || "").toUpperCase();
          if (roleUpper === "MANAGER" || roleUpper === "ADMIN") {
            localStorage.setItem("current_admin_page", "tong-quan");
            window.location.href = "/src/pages/dashboard.html";
          } else if (roleUpper === "EMPLOYEE" || roleUpper === "STAFF") {
            window.location.href = "/src/pages/employeeManager.html";
          } else {
            window.location.href = window.location.origin;
          }
        });
      }
    } catch (error) {
      console.error("Lỗi đăng nhập:", error);
      Swal.close();
      passwordInput.value = ""; // Xóa mật khẩu vì lý do bảo mật

      let errorMessage = "Thông tin đăng nhập không chính xác!";

      if (error.response) {
        errorMessage =
          error.response.data.message || "Thông tin đăng nhập không chính xác";

        // Trường hợp tài khoản bị khóa thì hiển thị cảnh báo lớn bằng Swal
        if (error.response.status === 403) {
          Swal.fire({
            icon: "warning",
            title: "Tài khoản bị khóa!",
            text: errorMessage,
            confirmButtonColor: "#dc3545",
            allowOutsideClick: false,
          });
          return;
        }

        // 🟢 CẬP NHẬT: Trích xuất hiển thị lỗi của server xuống dưới input
        if (errorMessage.toLowerCase().includes("mật khẩu")) {
          showInputError(passwordError, passwordInput, errorMessage);
        } else {
          showInputError(usernameError, usernameInput, errorMessage);
        }
      } else {
        // Lỗi kết nối mạng/máy chủ sập
        showInputError(
          usernameError,
          usernameInput,
          "Không thể kết nối đến máy chủ!",
        );
      }
    }
  });
  // ─── 4. KHỞI TẠO BANNER SLIDER TỰ ĐỘNG CHUẨN CELLPHONES (HÌNH 1 & HÌNH USER GỬI) ───
  initLoginBannerSlider();
}

function initLoginBannerSlider() {
  const container = document.getElementById("loginSliderContainer");
  const slides = document.querySelectorAll(".banner-slide-item");
  const dots = document.querySelectorAll(".slide-dot");
  const prevBtn = document.getElementById("sliderPrevBtn");
  const nextBtn = document.getElementById("sliderNextBtn");

  if (!slides || slides.length === 0) return;

  let currentIndex = 0;
  let autoPlayTimer = null;
  const slideCount = slides.length;

  function showSlide(index) {
    currentIndex = (index + slideCount) % slideCount;

    slides.forEach((slide, i) => {
      if (i === currentIndex) {
        slide.classList.add("active");
      } else {
        slide.classList.remove("active");
      }
    });

    dots.forEach((dot, i) => {
      if (i === currentIndex) {
        dot.classList.add("active");
      } else {
        dot.classList.remove("active");
      }
    });
  }

  function nextSlide() {
    showSlide(currentIndex + 1);
  }

  function prevSlide() {
    showSlide(currentIndex - 1);
  }

  function startAutoPlay() {
    stopAutoPlay();
    autoPlayTimer = setInterval(nextSlide, 3800);
  }

  function stopAutoPlay() {
    if (autoPlayTimer) {
      clearInterval(autoPlayTimer);
      autoPlayTimer = null;
    }
  }

  // Lắng nghe click các chấm điều hướng
  dots.forEach((dot) => {
    dot.addEventListener("click", () => {
      const targetIndex = parseInt(dot.getAttribute("data-slide-to"), 10);
      if (!isNaN(targetIndex)) {
        showSlide(targetIndex);
        startAutoPlay();
      }
    });
  });

  // Lắng nghe click nút mũi tên
  prevBtn?.addEventListener("click", () => {
    prevSlide();
    startAutoPlay();
  });

  nextBtn?.addEventListener("click", () => {
    nextSlide();
    startAutoPlay();
  });

  // Tạm dừng khi rê chuột vào để người dùng đọc thông tin ưu đãi
  container?.addEventListener("mouseenter", stopAutoPlay);
  container?.addEventListener("mouseleave", startAutoPlay);

  // Bắt đầu chạy tự động
  startAutoPlay();
}

document.addEventListener("DOMContentLoaded", handleLoginPage);
