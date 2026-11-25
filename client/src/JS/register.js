import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap";
import Swal from "sweetalert2";
import axios from "axios";

import { BASE_URL } from "/src/JS/common/header";

const checkLoggedIn = () => {
  try {
    const raw =
      localStorage.getItem("hpstore_user") || localStorage.getItem("user");
    const userData = raw ? JSON.parse(raw) : null;
    if (userData && userData.token) {
      window.location.href = "/index.html";
    }
  } catch {
    // Bỏ qua nếu dữ liệu localStorage không hợp lệ
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

    // Lưu pendingToken tạm trong bộ nhớ trang để gửi kèm khi xác thực OTP
    if (!window.__hpPendingReg) {
      window.__hpPendingReg = { token: null, email: null, expiresAt: 0 };
    }

    const requestRegisterOtp = async () => {
      const regRes = await axios.post(
        `${BASE_URL}/auth/register`,
        { fullname, username, email, phone, password },
        { timeout: 25000 },
      );

      window.__hpPendingReg = {
        token: regRes.data?.pendingToken || null,
        email: email.toLowerCase(),
        expiresAt: Date.now() + 5 * 60 * 1000,
      };

      if (submitBtn) {
        submitBtn.setAttribute("data-state", "pending-otp");
        submitBtn.innerHTML = `<i class="fa-solid fa-key me-2"></i> Nhập mã OTP xác thực`;
        submitBtn.classList.remove("btn-primary");
        submitBtn.classList.add("btn-warning", "text-dark");
      }

      return regRes.data;
    };

    // 🟢 HÀM XỬ LÝ HIỂN THỊ MODAL NHẬP OTP (Có nút Gửi lại mã OTP đếm ngược 60s)
    const openOtpModal = () => {
      let resendTimer = null;

      Swal.fire({
        icon: "info",
        title: "Xác thực Email đăng ký",
        html: `
          <p class="small text-muted mb-1">
            Mã OTP gồm 6 chữ số đã được gửi đến <strong>${email}</strong> (hiệu lực 5 phút).
            Vui lòng kiểm tra cả mục <em>Spam / Thư rác</em> nếu chưa thấy.
          </p>
        `,
        input: "text",
        inputPlaceholder: "Nhập mã OTP 6 chữ số...",
        confirmButtonColor: "#d70018",
        confirmButtonText: "Xác nhận & Tạo tài khoản",
        showCancelButton: true,
        cancelButtonText: "Đóng",
        allowOutsideClick: false,
        showLoaderOnConfirm: true,
        footer: `
          <button type="button" id="swal-resend-reg-otp" class="btn btn-link btn-sm text-decoration-none fw-semibold" style="color: #d70018;" disabled>
            <i class="fa-regular fa-clock me-1"></i> Gửi lại mã sau 60s
          </button>
        `,
        inputAttributes: {
          maxlength: "6",
          inputmode: "numeric",
          autocomplete: "one-time-code",
          autocapitalize: "off",
          autocorrect: "off",
          style: "text-align:center; letter-spacing:6px; font-weight:700; font-size:20px;",
        },
        didOpen: () => {
          const inputEl = Swal.getInput();
          if (inputEl) {
            inputEl.addEventListener("input", () => {
              inputEl.value = inputEl.value.replace(/\D/g, "").slice(0, 6);
            });
          }

          const resendBtn = document.getElementById("swal-resend-reg-otp");
          const startCooldown = (sec = 60) => {
            if (!resendBtn) return;
            clearInterval(resendTimer);
            let left = sec;
            resendBtn.disabled = true;
            resendBtn.innerHTML = `<i class="fa-regular fa-clock me-1"></i> Gửi lại mã sau ${left}s`;
            resendTimer = setInterval(() => {
              left--;
              if (left <= 0) {
                clearInterval(resendTimer);
                resendBtn.disabled = false;
                resendBtn.innerHTML =
                  '<i class="fa-solid fa-rotate-right me-1"></i> Gửi lại mã OTP mới';
              } else {
                resendBtn.innerHTML = `<i class="fa-regular fa-clock me-1"></i> Gửi lại mã sau ${left}s`;
              }
            }, 1000);
          };

          startCooldown(60);

          if (resendBtn) {
            resendBtn.addEventListener("click", async () => {
              if (resendBtn.disabled) return;
              resendBtn.disabled = true;
              resendBtn.innerHTML =
                '<span class="spinner-border spinner-border-sm me-1"></span> Đang gửi lại mã...';
              try {
                await requestRegisterOtp();
                Swal.resetValidationMessage();
                startCooldown(60);
              } catch (err) {
                resendBtn.disabled = false;
                resendBtn.innerHTML =
                  '<i class="fa-solid fa-rotate-right me-1"></i> Gửi lại mã OTP mới';
                Swal.showValidationMessage(
                  err.response?.data?.message ||
                    "Không thể gửi lại mã OTP. Vui lòng thử lại!",
                );
              }
            });
          }
        },
        willClose: () => {
          clearInterval(resendTimer);
        },
        inputValidator: (value) => {
          if (!value) return "Vui lòng nhập mã OTP để hoàn tất đăng ký!";
          if (!/^[0-9]{6}$/.test(value.trim()))
            return "Mã OTP phải bao gồm 6 chữ số!";
        },
        preConfirm: async (otpValue) => {
          try {
            const verifyResponse = await axios.post(
              `${BASE_URL}/auth/verify-activation`,
              {
                email: email,
                otp: otpValue.trim(),
                pendingToken: window.__hpPendingReg.token,
              },
              { timeout: 20000 },
            );
            return verifyResponse.data;
          } catch (verifyError) {
            console.error("Lỗi xác thực kích hoạt:", verifyError);
            const serverMsg =
              verifyError.response?.data?.message ||
              (verifyError.code === "ECONNABORTED"
                ? "Hết thời gian kết nối máy chủ. Vui lòng thử lại!"
                : "Mã OTP sai hoặc đã hết hạn!");
            Swal.showValidationMessage(`Lỗi: ${serverMsg}`);
            return false;
          }
        },
      }).then((result) => {
        if (result.isConfirmed && result.value) {
          window.__hpPendingReg = { token: null, email: null, expiresAt: 0 };
          Swal.fire({
            icon: "success",
            title: "Đăng ký thành công!",
            text:
              result.value.message ||
              "Tài khoản của bạn đã được tạo và kích hoạt thành công.",
            confirmButtonColor: "#d70018",
          }).then(() => {
            window.location.href = "/src/pages/login.html";
          });
        }
      });
    };

    // 🟢 Nếu đang chờ nhập OTP cho đúng email này VÀ token chưa hết hạn 5 phút → mở lại modal ngay
    if (
      submitBtn &&
      submitBtn.getAttribute("data-state") === "pending-otp" &&
      window.__hpPendingReg.token &&
      window.__hpPendingReg.email === email.toLowerCase() &&
      Date.now() < window.__hpPendingReg.expiresAt
    ) {
      openOtpModal();
      return;
    }

    // --- LUỒNG ĐĂNG KÝ BƯỚC 1: GỬI YÊU CẦU TẠO MÃ OTP LÊN SERVER (CHƯA LƯU DB) ---
    try {
      Swal.fire({
        title: "Đang gửi mã OTP...",
        text: "Hệ thống đang kiểm tra thông tin và gửi mã xác thực đến Email của bạn.",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      await requestRegisterOtp();

      // Khởi động hiển thị hộp thoại OTP lần đầu tiên
      openOtpModal();
    } catch (error) {
      console.error("Lỗi đăng ký:", error);
      Swal.close();

      let errorMessage =
        error.code === "ECONNABORTED"
          ? "Máy chủ phản hồi quá lâu khi gửi Email OTP. Vui lòng kiểm tra lại cấu hình gửi mail trên Render!"
          : "Không thể kết nối đến máy chủ!";
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
