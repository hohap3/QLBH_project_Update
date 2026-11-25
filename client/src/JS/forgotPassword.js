import axios from "axios";
import Swal from "sweetalert2";
import { BASE_URL } from "/src/JS/common/header";

document.addEventListener("DOMContentLoaded", () => {
  const forgotPasswordForm = document.getElementById("forgotPasswordForm");
  const resetPasswordForm = document.getElementById("resetPasswordForm");
  const toggleNewPasswordBtn = document.getElementById("toggleNewPassword");
  const toggleConfirmPasswordBtn = document.getElementById(
    "toggleConfirmNewPassword",
  );
  const newPasswordInput = document.getElementById("newPassword");
  const confirmNewPasswordInput = document.getElementById("confirmNewPassword");

  // DOM các phần tử phục vụ hiển thị lỗi inline
  const emailInput = document.getElementById("email");
  const otpInput = document.getElementById("otp");
  const resetTargetEmailEl = document.getElementById("resetTargetEmail");
  const btnChangeEmail = document.getElementById("btnChangeEmail");
  const btnResendOtp = document.getElementById("btnResendOtp");

  const emailError = document.getElementById("emailError");
  const otpError = document.getElementById("otpError");
  const newPasswordError = document.getElementById("newPasswordError");
  const confirmNewPasswordError = document.getElementById(
    "confirmNewPasswordError",
  );

  let savedEmail = "";
  let resendCountdown = 0;
  let resendTimer = null;

  const showInputError = (formElement, errorElement, inputElement, message) => {
    if (errorElement) {
      errorElement.innerText = message;
      errorElement.classList.remove("d-none");
    }
    if (inputElement) inputElement.classList.add("is-invalid");

    if (formElement) {
      formElement.classList.add("animate-shake");
      setTimeout(() => formElement.classList.remove("animate-shake"), 500);
    }
  };

  const clearErrors = () => {
    [emailError, otpError, newPasswordError, confirmNewPasswordError].forEach(
      (el) => {
        if (el) {
          el.classList.add("d-none");
          el.innerText = "";
        }
      },
    );
    [emailInput, otpInput, newPasswordInput, confirmNewPasswordInput].forEach(
      (input) => {
        if (input) input.classList.remove("is-invalid");
      },
    );
  };

  const startResendCooldown = (seconds = 60) => {
    if (!btnResendOtp) return;
    clearInterval(resendTimer);
    resendCountdown = seconds;
    btnResendOtp.disabled = true;
    btnResendOtp.innerHTML = `<i class="fa-regular fa-clock me-1"></i> Gửi lại mã sau ${resendCountdown}s`;

    resendTimer = setInterval(() => {
      resendCountdown--;
      if (resendCountdown <= 0) {
        clearInterval(resendTimer);
        btnResendOtp.disabled = false;
        btnResendOtp.innerHTML =
          '<i class="fa-solid fa-rotate-right me-1"></i> Gửi lại mã OTP';
      } else {
        btnResendOtp.innerHTML = `<i class="fa-regular fa-clock me-1"></i> Gửi lại mã sau ${resendCountdown}s`;
      }
    }, 1000);
  };

  if (emailInput) emailInput.addEventListener("input", clearErrors);
  if (otpInput) {
    otpInput.addEventListener("input", () => {
      otpInput.value = otpInput.value.replace(/\D/g, "").slice(0, 6);
      clearErrors();
    });
  }
  if (newPasswordInput) newPasswordInput.addEventListener("input", clearErrors);
  if (confirmNewPasswordInput) {
    confirmNewPasswordInput.addEventListener("input", clearErrors);
  }

  // Quay lại nhập email khác
  if (btnChangeEmail) {
    btnChangeEmail.onclick = () => {
      clearErrors();
      clearInterval(resendTimer);
      resetPasswordForm.classList.add("d-none");
      forgotPasswordForm.classList.remove("d-none");
      emailInput.focus();
    };
  }

  // Gửi lại mã OTP
  if (btnResendOtp) {
    btnResendOtp.onclick = async () => {
      if (!savedEmail || resendCountdown > 0) return;
      btnResendOtp.disabled = true;
      btnResendOtp.innerHTML =
        '<span class="spinner-border spinner-border-sm me-1"></span> Đang gửi lại...';

      try {
        const res = await axios.post(
          `${BASE_URL}/auth/forgot-password`,
          { email: savedEmail },
          { timeout: 25000 },
        );
        await Swal.fire({
          icon: "success",
          title: "Đã gửi lại mã OTP!",
          text:
            res.data?.message ||
            "Mã OTP mới đã được gửi về email của bạn (hiệu lực 5 phút).",
          confirmButtonColor: "#6138ff",
        });
        startResendCooldown(60);
      } catch (error) {
        btnResendOtp.disabled = false;
        btnResendOtp.innerHTML =
          '<i class="fa-solid fa-rotate-right me-1"></i> Gửi lại mã OTP';
        Swal.fire(
          "Thất bại",
          error.response?.data?.message || "Không thể gửi lại mã OTP!",
          "error",
        );
      }
    };
  }

  // =================================================================================
  // BƯỚC 1: GỬI EMAIL ĐỂ NHẬN MÃ OTP
  // =================================================================================
  if (forgotPasswordForm) {
    forgotPasswordForm.onsubmit = async (e) => {
      e.preventDefault();
      clearErrors();

      const email = emailInput.value.trim();

      if (!email) {
        showInputError(
          forgotPasswordForm,
          emailError,
          emailInput,
          "Vui lòng nhập địa chỉ Email đăng ký!",
        );
        emailInput.focus();
        return;
      }

      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!emailRegex.test(email)) {
        showInputError(
          forgotPasswordForm,
          emailError,
          emailInput,
          "Cấu trúc Email không hợp lệ (Ví dụ: abc@gmail.com)!",
        );
        emailInput.focus();
        return;
      }

      const btnSubmitEmail = document.getElementById("btnSubmitEmail");
      const originalBtnHtml = btnSubmitEmail.innerHTML;
      btnSubmitEmail.disabled = true;
      btnSubmitEmail.innerHTML =
        '<span class="spinner-border spinner-border-sm me-2"></span> Đang gửi mã...';

      try {
        const response = await axios.post(
          `${BASE_URL}/auth/forgot-password`,
          { email },
          { timeout: 25000 },
        );

        await Swal.fire({
          icon: "success",
          title: "Đã gửi mã OTP!",
          text:
            response.data.message ||
            "Mã xác thực đã được gửi vào Email của bạn. Vui lòng kiểm tra hộp thư!",
          confirmButtonColor: "#6138ff",
        });

        savedEmail = email;
        if (resetTargetEmailEl) {
          resetTargetEmailEl.textContent = response.data.maskedEmail || email;
        }

        forgotPasswordForm.classList.add("d-none");
        resetPasswordForm.classList.remove("d-none");
        startResendCooldown(60);
        if (otpInput) otpInput.focus();
      } catch (error) {
        console.error("FORGOT PASSWORD ERROR:", error);
        const errorMsg =
          error.response?.data?.message ||
          "Email không tồn tại hoặc lỗi hệ thống!";
        showInputError(forgotPasswordForm, emailError, emailInput, errorMsg);
      } finally {
        btnSubmitEmail.disabled = false;
        btnSubmitEmail.innerHTML = originalBtnHtml;
      }
    };
  }

  // =================================================================================
  // BƯỚC 2: XÁC THỰC OTP & CẬP NHẬT MẬT KHẨU MỚI
  // =================================================================================
  if (resetPasswordForm) {
    resetPasswordForm.onsubmit = async (e) => {
      e.preventDefault();
      clearErrors();

      const otp = otpInput.value.trim();
      const newPassword = newPasswordInput.value;
      const confirmNewPassword = confirmNewPasswordInput
        ? confirmNewPasswordInput.value
        : newPassword;

      if (!otp) {
        showInputError(
          resetPasswordForm,
          otpError,
          otpInput,
          "Vui lòng cung cấp mã xác thực OTP!",
        );
        otpInput.focus();
        return;
      }

      if (!/^\d{6}$/.test(otp)) {
        showInputError(
          resetPasswordForm,
          otpError,
          otpInput,
          "Mã xác thực OTP phải chứa đủ 6 ký tự số!",
        );
        otpInput.focus();
        return;
      }

      if (!newPassword) {
        showInputError(
          resetPasswordForm,
          newPasswordError,
          newPasswordInput,
          "Vui lòng nhập mật khẩu mới!",
        );
        newPasswordInput.focus();
        return;
      }

      const passwordRegex =
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*(),.?":{}|<>]).{6,}$/;
      if (!passwordRegex.test(newPassword)) {
        showInputError(
          resetPasswordForm,
          newPasswordError,
          newPasswordInput,
          "Mật khẩu phải từ 6 ký tự, bao gồm ít nhất 1 chữ hoa, 1 chữ thường và 1 ký tự đặc biệt (!@#$...).",
        );
        newPasswordInput.focus();
        return;
      }

      if (confirmNewPasswordInput && !confirmNewPassword) {
        showInputError(
          resetPasswordForm,
          confirmNewPasswordError,
          confirmNewPasswordInput,
          "Vui lòng nhập lại mật khẩu mới để xác nhận!",
        );
        confirmNewPasswordInput.focus();
        return;
      }

      if (newPassword !== confirmNewPassword) {
        showInputError(
          resetPasswordForm,
          confirmNewPasswordError,
          confirmNewPasswordInput,
          "Mật khẩu xác nhận không khớp!",
        );
        confirmNewPasswordInput?.focus();
        return;
      }

      const btnResetPass = document.getElementById("btnResetPass");
      const originalResetHtml = btnResetPass.innerHTML;
      btnResetPass.disabled = true;
      btnResetPass.innerHTML =
        '<span class="spinner-border spinner-border-sm me-2"></span> Đang xử lý...';

      try {
        const response = await axios.post(
          `${BASE_URL}/auth/reset-password`,
          {
            email: savedEmail,
            otp,
            newPassword,
          },
          { timeout: 25000 },
        );

        await Swal.fire({
          icon: "success",
          title: "Khôi phục thành công!",
          text:
            response.data.message ||
            "Đổi mật khẩu thành công! Hãy đăng nhập bằng mật khẩu mới.",
          confirmButtonColor: "#6138ff",
          allowOutsideClick: false,
        });

        window.location.href = "/src/pages/login.html";
      } catch (error) {
        console.error("RESET PASSWORD ERROR:", error);
        const errorMsg =
          error.response?.data?.message ||
          "Mã OTP không đúng hoặc đã hết hiệu lực!";

        if (
          errorMsg.toLowerCase().includes("mật khẩu") ||
          errorMsg.toLowerCase().includes("password")
        ) {
          showInputError(
            resetPasswordForm,
            newPasswordError,
            newPasswordInput,
            errorMsg,
          );
        } else {
          showInputError(resetPasswordForm, otpError, otpInput, errorMsg);
        }
      } finally {
        btnResetPass.disabled = false;
        btnResetPass.innerHTML = originalResetHtml;
      }
    };
  }

  // Bật/tắt ẩn hiện mật khẩu cho cả 2 ô
  const bindPasswordToggle = (btn, input) => {
    if (!btn || !input) return;
    btn.onclick = () => {
      const isPassword = input.type === "password";
      input.type = isPassword ? "text" : "password";
      const icon = btn.querySelector("i");
      if (icon) {
        icon.classList.toggle("fa-regular", !isPassword);
        icon.classList.toggle("fa-eye", !isPassword);
        icon.classList.toggle("fa-solid", isPassword);
        icon.classList.toggle("fa-eye-slash", isPassword);
      }
    };
  };

  bindPasswordToggle(toggleNewPasswordBtn, newPasswordInput);
  bindPasswordToggle(toggleConfirmPasswordBtn, confirmNewPasswordInput);
});
