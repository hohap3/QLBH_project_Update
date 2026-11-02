import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap";
import Swal from "sweetalert2";
import axios from "axios";

import { BASE_URL } from "/src/JS/common/header";

const checkLoggedIn = () => {
  const userData = JSON.parse(localStorage.getItem("hpstore_user"));
  if (userData && userData.token) {
    window.location.href = "/index.html";
  }
};

checkLoggedIn();

function handleRegisterPage() {
  const registerForm = document.querySelector("#registerForm");
  const toggleButtons = document.querySelectorAll(".toggle-password");
  const termsCheckbox = document.querySelector("#terms");
  const btnAcceptTerms = document.querySelector("#btnAcceptTerms");

  // DOM các phần tử hiển thị lỗi và input tương ứng
  const usernameInput = document.querySelector("#username");
  const fullnameInput = document.querySelector("#fullname");
  const emailInput = document.querySelector("#email");
  const phoneInput = document.querySelector("#phone");
  const passwordInput = document.querySelector("#password");
  const confirmPasswordInput = document.querySelector("#confirmPassword");

  const usernameError = document.querySelector("#usernameError");
  const fullnameError = document.querySelector("#fullnameError");
  const emailError = document.querySelector("#emailError");
  const phoneError = document.querySelector("#phoneError");
  const passwordError = document.querySelector("#passwordError");
  const confirmPasswordError = document.querySelector("#confirmPasswordError");
  const termsError = document.querySelector("#termsError");

  // 1. Xử lý ẩn/hiện mật khẩu
  toggleButtons.forEach((btn) => {
    btn.addEventListener("click", function () {
      const input = this.parentElement.querySelector("input");
      const icon = this.querySelector("i");
      input.type = input.type === "password" ? "text" : "password";
      icon.classList.toggle("fa-eye");
      icon.classList.toggle("fa-eye-slash");
    });
  });

  if (btnAcceptTerms && termsCheckbox) {
    btnAcceptTerms.addEventListener("click", () => {
      termsCheckbox.checked = true;
      termsError.classList.add("d-none");
      termsCheckbox.classList.remove("is-invalid");
    });
  }

  if (!registerForm) return;

  // Hàm hiển thị thông báo lỗi dưới từng Input
  const showInputError = (errorElement, inputElement, message) => {
    errorElement.innerText = message;
    errorElement.classList.remove("d-none");
    inputElement.classList.add("is-invalid");

    registerForm.classList.add("animate-shake");
    setTimeout(() => registerForm.classList.remove("animate-shake"), 500);
  };

  // Hàm xóa sạch trạng thái lỗi cũ
  const clearErrors = () => {
    const errorElements = [
      usernameError,
      fullnameError,
      emailError,
      phoneError,
      passwordError,
      confirmPasswordError,
      termsError,
    ];
    const inputElements = [
      usernameInput,
      fullnameInput,
      emailInput,
      phoneInput,
      passwordInput,
      confirmPasswordInput,
      termsCheckbox,
    ];

    errorElements.forEach((el) => {
      if (el) {
        el.classList.add("d-none");
        el.innerText = "";
      }
    });
    inputElements.forEach((input) => {
      if (input) input.classList.remove("is-invalid");
    });
  };

  // Gắn sự kiện xóa lỗi ngay khi người dùng chỉnh sửa lại dữ liệu
  [
    usernameInput,
    fullnameInput,
    emailInput,
    phoneInput,
    passwordInput,
    confirmPasswordInput,
  ].forEach((input) => {
    input.addEventListener("input", clearErrors);
  });
  termsCheckbox.addEventListener("change", clearErrors);

  // 2. Xử lý gửi form với Axios
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearErrors();

    // Lấy dữ liệu từ form
    const fullname = fullnameInput.value.trim();
    const username = usernameInput.value.trim();
    const email = emailInput.value.trim();
    const phone = phoneInput.value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;
    const terms = termsCheckbox.checked;

    // --- [GIỮ NGUYÊN TOÀN BỘ LOGIC VALIDATION CLIENT CỦA BẠN Ở ĐÂY] ---

    // --- VALIDATION TẠI CLIENT ---
    if (!username) {
      showInputError(
        usernameError,
        usernameInput,
        "Vui lòng nhập tên đăng nhập!",
      );
      usernameInput.focus();
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

    if (!fullname) {
      showInputError(fullnameError, fullnameInput, "Vui lòng điền họ và tên!");
      fullnameInput.focus();
      return;
    }

    const fullnameRegex = /^[\p{L}\s]+$/u;

    if (!fullnameRegex.test(fullname)) {
      showInputError(
        fullnameError,
        fullnameInput,
        "Họ và tên chỉ được chứa chữ cái tiếng Việt và khoảng trắng!",
      );
      fullnameInput.focus();
      return;
    }

    if (!email) {
      showInputError(emailError, emailInput, "Vui lòng nhập địa chỉ Email!");
      emailInput.focus();
      return;
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      showInputError(
        emailError,
        emailInput,
        "Định dạng địa chỉ Email không hợp lệ!",
      );
      emailInput.focus();
      return;
    }

    if (!phone) {
      showInputError(phoneError, phoneInput, "Vui lòng nhập số điện thoại!");
      phoneInput.focus();
      return;
    }

    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(phone)) {
      showInputError(
        phoneError,
        phoneInput,
        "Số điện thoại không hợp lệ (phải gồm 10 chữ số)!",
      );
      phoneInput.focus();
      return;
    }

    if (!password) {
      showInputError(
        passwordError,
        passwordInput,
        "Vui lòng cấu hình mật khẩu an toàn!",
      );
      passwordInput.focus();
      return;
    }

    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*(),.?":{}|<>]).{6,}$/;
    if (!passwordRegex.test(password)) {
      showInputError(
        passwordError,
        passwordInput,
        "Mật khẩu phải từ 6 ký tự, bao gồm chữ hoa, chữ thường và ký tự đặc biệt!",
      );
      passwordInput.focus();
      return;
    }

    if (password !== confirmPassword) {
      showInputError(
        confirmPasswordError,
        confirmPasswordInput,
        "Xác nhận mật khẩu không trùng khớp!",
      );
      confirmPasswordInput.focus();
      return;
    }

    if (!terms) {
      showInputError(
        termsError,
        termsCheckbox,
        "Bạn phải xác nhận đồng ý với điều khoản sử dụng!",
      );
      return;
    }

    // --- [HẾT KHỐI VALIDATION CLIENT] ---

    // Tìm nút submit của form để kiểm tra trạng thái
    const submitBtn = registerForm.querySelector('button[type="submit"]');

    // 🟢 HÀM XỬ LÝ HIỂN THỊ MODAL NHẬP OTP (Tách ra để có thể tái sử dụng)
    const openOtpModal = () => {
      Swal.fire({
        icon: "info",
        title: "Xác thực Email!",
        text: `Mã OTP kích hoạt gồm 6 số đã được gửi đến Email: ${email}.`,
        input: "text",
        inputPlaceholder: "Nhập mã OTP 6 chữ số tại đây...",
        confirmButtonColor: "#6138ff",
        confirmButtonText: "Kích hoạt tài khoản",
        allowOutsideClick: false, // Chống bấm ra ngoài tắt modal
        allowEscapeKey: false, // Chống bấm nút ESC tắt modal
        showLoaderOnConfirm: true,
        inputAttributes: {
          maxlength: "6",
          autocapitalize: "off",
          autocorrect: "off",
        },
        inputValidator: (value) => {
          if (!value) return "Vui lòng nhập mã OTP để kích hoạt tài khoản!";
          if (!/^[0-9]{6}$/.test(value)) return "Mã OTP phải bao gồm 6 chữ số!";
        },
        preConfirm: async (otpValue) => {
          try {
            const verifyResponse = await axios.post(
              `${BASE_URL}/auth/verify-activation`,
              {
                email: email,
                otp: otpValue,
              },
            );
            return verifyResponse.data;
          } catch (verifyError) {
            console.error("Lỗi xác thực kích hoạt:", verifyError);
            const serverMsg =
              verifyError.response?.data?.message ||
              "Mã OTP sai hoặc đã hết hạn!";
            Swal.showValidationMessage(`Lỗi: ${serverMsg}`);
            return false; // Giữ nguyên giao diện không đóng
          }
        },
      }).then((result) => {
        if (result.isConfirmed && result.value) {
          Swal.fire({
            icon: "success",
            title: "Kích hoạt thành công!",
            text:
              result.value.message ||
              "Tài khoản của bạn đã sẵn sàng hoạt động.",
            confirmButtonColor: "#6138ff",
          }).then(() => {
            window.location.href = "login.html";
          });
        }
      });
    };

    // 🟢 KIỂM TRA: Nếu nút đang ở trạng thái chờ kích hoạt, bấm vào mở lại thẳng hộp thoại OTP
    if (submitBtn && submitBtn.getAttribute("data-state") === "pending-otp") {
      openOtpModal();
      return;
    }

    // --- LUỒNG ĐĂNG KÝ BƯỚC 1: GỬI DỮ LIỆU LÊN SERVER ---
    try {
      Swal.fire({
        title: "Đang xử lý...",
        text: "Hệ thống đang khởi tạo tài khoản và gửi mail xác thực.",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      await axios.post(`${BASE_URL}/auth/register`, {
        fullname,
        username,
        email,
        phone,
        password,
      });

      // 🟢 Thay đổi trạng thái nút Submit trên giao diện Form
      if (submitBtn) {
        submitBtn.setAttribute("data-state", "pending-otp");
        submitBtn.innerHTML = `<i class="fa-solid fa-key me-2"></i> Nhập lại mã OTP xác thực`;
        submitBtn.classList.remove("btn-primary"); // Thay đổi màu sắc tùy giao diện bạn dùng
        submitBtn.classList.add("btn-warning", "text-dark");
      }

      // Khởi động hiển thị hộp thoại OTP lần đầu tiên
      openOtpModal();
    } catch (error) {
      console.error("Lỗi đăng ký:", error);
      Swal.close();

      let errorMessage = "Không thể kết nối đến máy chủ!";
      if (error.response) {
        errorMessage = error.response.data.message || "Đăng ký thất bại";
        const lowerMsg = errorMessage.toLowerCase();

        if (
          lowerMsg.includes("tên đăng nhập") ||
          lowerMsg.includes("username")
        ) {
          showInputError(usernameError, usernameInput, errorMessage);
        } else if (lowerMsg.includes("email")) {
          showInputError(emailError, emailInput, errorMessage);
        } else if (
          lowerMsg.includes("số điện thoại") ||
          lowerMsg.includes("phone")
        ) {
          showInputError(phoneError, phoneInput, errorMessage);
        } else {
          showInputError(usernameError, usernameInput, errorMessage);
        }
      } else {
        showInputError(usernameError, usernameInput, errorMessage);
      }
    }
  });
}

document.addEventListener("DOMContentLoaded", handleRegisterPage);
