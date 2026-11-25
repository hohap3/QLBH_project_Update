import axios from "axios";
import Swal from "sweetalert2";
import { BASE_URL } from "/src/JS/common/header";

export async function initUpdatePass() {
  const passwordForm = document.getElementById("passwordForm");
  const rawUser =
    localStorage.getItem("hpstore_user") || localStorage.getItem("user");
  const userStorage = rawUser ? JSON.parse(rawUser) : null;

  // Kiểm tra xem người dùng đã đăng nhập chưa, nếu chưa có thông tin thì chặn thao tác
  if (!userStorage) {
    console.warn("Không tìm thấy thông tin đăng nhập trong localStorage.");
    return;
  }

  if (passwordForm) {
    passwordForm.onsubmit = async (e) => {
      e.preventDefault();

      const oldPass = document.getElementById("txtOldPassword").value;
      const newPass = document.getElementById("txtNewPassword").value;
      const confirmPass = document.getElementById("txtConfirmPassword").value;

      // --- BIỂU THỨC CHÍNH QUY (REGEX) ---
      const passwordRegex =
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{6,}$/;

      // 1. Kiểm tra định dạng mật khẩu mới
      if (!passwordRegex.test(newPass)) {
        Swal.fire({
          icon: "warning",
          title: "Mật khẩu yếu",
          html: `Mật khẩu mới phải bao gồm:
                <ul class="text-start mt-2 small">
                    <li>Ít nhất 6 ký tự</li>
                    <li>Ít nhất 1 chữ cái viết hoa</li>
                    <li>Ít nhất 1 chữ cái viết thường</li>
                    <li>Ít nhất 1 ký tự đặc biệt (@$!%*?&)</li>
                </ul>`,
        });
        return;
      }

      // 2. Kiểm tra khớp mật khẩu
      if (newPass !== confirmPass) {
        Swal.fire("Lỗi", "Xác nhận mật khẩu mới không khớp!", "error");
        return;
      }

      // 3. Kiểm tra mật khẩu mới không được trùng mật khẩu cũ
      if (oldPass === newPass) {
        Swal.fire(
          "Thông báo",
          "Mật khẩu mới không được giống mật khẩu cũ!",
          "info",
        );
        return;
      }

      try {
        // Lấy mã người dùng linh hoạt từ bộ nhớ tạm và ép kiểu sang chuỗi nguyên bản
        const maND = String(
          userStorage.id || userStorage.mand || userStorage.MaND || "",
        );

        if (!maND || maND === "undefined") {
          Swal.fire(
            "Lỗi hệ thống",
            "Không thể xác định danh tính tài khoản. Vui lòng đăng nhập lại!",
            "error",
          );
          return;
        }

        // Bước 1: Kiểm tra mật khẩu cũ & gửi mã OTP về email chính chủ
        Swal.fire({
          title: "Đang gửi mã OTP...",
          text: "Vui lòng chờ hệ thống gửi mã xác thực về email của bạn.",
          allowOutsideClick: false,
          didOpen: () => Swal.showLoading(),
        });

        const otpRes = await axios.post(
          `${BASE_URL}/user/request-password-otp`,
          {
            MaND: maND,
            OldPassword: oldPass,
            NewPassword: newPass,
          },
          { timeout: 25000 },
        );

        const { maskedEmail, otpToken } = otpRes.data;

        // Bước 2: Hiển thị modal nhập mã OTP 6 chữ số
        const otpModal = await Swal.fire({
          title: "Xác thực OTP đổi mật khẩu",
          html: `
            <p class="small text-muted mb-2">
              Mã xác thực 6 chữ số đã được gửi tới email <strong>${maskedEmail || "của bạn"}</strong>
              (hiệu lực 5 phút). Vui lòng kiểm tra cả mục <em>Spam / Thư rác</em> nếu chưa thấy.
            </p>
            <input
              id="swal-admin-otp"
              type="text"
              inputmode="numeric"
              maxlength="6"
              autocomplete="one-time-code"
              class="swal2-input text-center fw-bold"
              style="letter-spacing: 8px; font-size: 22px; max-width: 240px;"
              placeholder="000000"
            />
          `,
          icon: "info",
          showCancelButton: true,
          confirmButtonText: "Xác nhận đổi mật khẩu",
          cancelButtonText: "Hủy",
          confirmButtonColor: "#6f42c1",
          showLoaderOnConfirm: true,
          allowOutsideClick: () => !Swal.isLoading(),
          didOpen: () => {
            const input = document.getElementById("swal-admin-otp");
            if (input) {
              input.focus();
              input.addEventListener("input", () => {
                input.value = input.value.replace(/\D/g, "").slice(0, 6);
              });
            }
          },
          preConfirm: async () => {
            const otpVal = (
              document.getElementById("swal-admin-otp")?.value || ""
            ).trim();
            if (!/^\d{6}$/.test(otpVal)) {
              Swal.showValidationMessage("Vui lòng nhập đủ 6 chữ số mã OTP!");
              return false;
            }
            try {
              const res = await axios.put(
                `${BASE_URL}/user/change-password`,
                {
                  MaND: maND,
                  OldPassword: oldPass,
                  NewPassword: newPass,
                  Otp: otpVal,
                  OtpToken: otpToken,
                },
                { timeout: 25000 },
              );
              return res.data;
            } catch (err) {
              const msg =
                err.response?.data?.message ||
                "Xác thực OTP thất bại. Vui lòng thử lại!";
              Swal.showValidationMessage(msg);
              return false;
            }
          },
        });

        // 🟢 Kiểm tra nếu Backend phản hồi thành công
        if (otpModal.isConfirmed && otpModal.value?.success) {
          await Swal.fire({
            icon: "success",
            title: "Đổi mật khẩu thành công!",
            text:
              otpModal.value.message ||
              "Mật khẩu đã được cập nhật và email thông báo bảo mật đã gửi về hộp thư của bạn. Vui lòng đăng nhập lại.",
            confirmButtonColor: "#6f42c1",
            allowOutsideClick: false,
          });

          // 1. Xóa thông tin phiên làm việc cũ khỏi localStorage của HP STORE
          localStorage.removeItem("hpstore_user");
          localStorage.removeItem("user");
          localStorage.removeItem("token");
          localStorage.removeItem("current_admin_page");

          // 2. Làm mới form nhập liệu
          passwordForm.reset();

          // 3. Đẩy người dùng quay trở lại trang đăng nhập (login)
          window.location.href = "/src/pages/login.html";
        }
      } catch (error) {
        console.error("Lỗi khi đổi mật khẩu:", error);
        const msg =
          error.response?.data?.message ||
          "Mật khẩu cũ không chính xác hoặc không thể thực hiện giao tiếp Server!";
        Swal.fire("Thất bại", msg, "error");
      }
    };
  }
}
