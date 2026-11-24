import axios from "axios";
import Swal from "sweetalert2";
import { Modal } from "bootstrap";
import { BASE_URL } from "/src/JS/common/header";

document.addEventListener("DOMContentLoaded", () => {
  initCustomerManager();
});

export async function initCustomerManager() {
  const tableBody = document.getElementById("customerTableBody");
  const totalCountSpan = document.getElementById("totalCount");
  const searchInput = document.getElementById("searchKH");

  // 🟢 BỔ SUNG: Biến quản lý trạng thái phân trang cục bộ và dữ liệu trang hiện tại
  let currentPage = 1;
  let totalPages = 1;
  let currentTableData = [];

  const avatarColors = [
    "#7c3aed",
    "#db2777",
    "#2563eb",
    "#059669",
    "#ea580c",
    "#1e293b",
  ];

  /**
   * 1. Tải danh sách khách hàng từ API (Hỗ trợ tham số phân trang page)
   */
  const fetchCustomers = async (page = 1) => {
    try {
      const response = await axios.get(`${BASE_URL}/customers?page=${page}`);

      if (response.data && response.data.success) {
        // 🟢 CẬP NHẬT: Đọc cấu trúc metadata phân trang từ Controller trả về
        const {
          data,
          currentPage: resPage,
          totalPages: resTotalPages,
          totalRecords,
        } = response.data;

        currentPage = resPage;
        totalPages = resTotalPages;
        currentTableData = data; // 10 bản ghi khách hàng của trang này

        renderTable(currentTableData);
        renderPagination(); // Vẽ thanh chuyển trang ra màn hình

        if (totalCountSpan) {
          totalCountSpan.innerText = totalRecords; // Hiển thị tổng số khách hàng toàn hệ thống
        }
      } else {
        // Dự phòng nếu API cũ chưa thay đổi cấu trúc bọc
        const data = response.data.data || response.data;
        currentTableData = Array.isArray(data) ? data : [];
        renderTable(currentTableData);
      }
    } catch (error) {
      console.error("Lỗi fetch:", error);
      Swal.fire("Lỗi", "Không thể tải danh sách khách hàng", "error");
    }
  };

  const escapeHtml = (val) =>
    String(val ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  /**
   * 2. Render dữ liệu ra bảng HTML (Có chống XSS cho toàn bộ dữ liệu người dùng)
   */
  const renderTable = (customers) => {
    if (!customers || customers.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">Không có dữ liệu khách hàng</td></tr>`;
      return;
    }

    tableBody.innerHTML = customers
      .map((kh, index) => {
        const isVip = kh.diemtichluy >= 100;
        const donGanNhat = kh.dongannhat
          ? new Date(kh.dongannhat).toLocaleDateString("vi-VN")
          : "---";
        const bgColor = avatarColors[index % avatarColors.length];
        const rawName = kh.hoten ? String(kh.hoten).trim() : "";
        const firstLetter = escapeHtml(rawName ? rawName.charAt(0).toUpperCase() : "?");
        const safeName = escapeHtml(rawName || "Khách hàng");
        const safeMaKH = escapeHtml(kh.makh);
        const safeEmail = kh.email ? escapeHtml(kh.email) : "<i>Chưa cập nhật</i>";
        const safeSDT = escapeHtml(kh.sdt || "");
        const isActive = kh.trangthai !== false;

        return `
          <tr style="${!isActive ? "opacity: 0.6; background-color: #f8fafc;" : ""}">
            <td>
              <div class="d-flex align-items-center">
                <div class="avatar-circle" style="background-color: ${bgColor}">${firstLetter}</div>
                <div>
                  <div class="fw-bold mb-0">${safeName} ${!isActive ? '<span class="badge bg-danger ms-1" style="font-size: 10px;">Bị khóa</span>' : ""}</div>
                  <small class="text-muted">ID: #${safeMaKH}</small>
                </div>
              </div>
            </td>
            <td>
              <div class="text-muted small">${safeEmail}</div>
              <div class="fw-medium small">${safeSDT}</div>
            </td>
            <td>
              <div class="fw-bold text-dark">${kh.tongdonhang || 0} <small class="text-muted">đơn</small></div>
              <small class="text-success fw-semibold">🪙 ${kh.diemtichluy || 0}đ</small>
            </td>
            <td><span class="text-muted small">${donGanNhat}</span></td>
            <td>
              <span class="badge rounded-pill ${isVip ? "badge-vip" : "badge-normal"}">
                ${isVip ? '<i class="fa-solid fa-crown me-1"></i> VIP' : "Thường"}
              </span>
            </td>
            <td class="text-center">
              <button type="button" class="btn-action btn-view action-view-detail" data-id="${safeMaKH}" title="Xem chi tiết & Lịch sử">
                <i class="fa-regular fa-eye"></i>
              </button>
               
              <button type="button" class="btn-action ${isActive ? "btn-lock text-danger" : "btn-unlock text-success"} action-toggle-status" 
                      data-id="${safeMaKH}" data-active="${isActive}"
                      title="${isActive ? "Khóa tài khoản" : "Mở khóa tài khoản"}">
                <i class="fa-solid ${isActive ? "fa-user-slash" : "fa-user-check"}"></i>
              </button>
            </td>
          </tr>
        `;
      })
      .join("");
  };

  // Lắng nghe sự kiện click trong bảng một cách an toàn
  tableBody.addEventListener("click", (e) => {
    const viewBtn = e.target.closest(".action-view-detail");
    const toggleBtn = e.target.closest(".action-toggle-status");

    if (viewBtn) {
      e.preventDefault();
      e.stopPropagation();
      const maKH = viewBtn.getAttribute("data-id");
      window.viewDetails(maKH);
    }

    if (toggleBtn) {
      e.preventDefault();
      e.stopPropagation();
      const maKH = toggleBtn.getAttribute("data-id");
      const isActive = toggleBtn.getAttribute("data-active") === "true";
      window.toggleCustomerStatus(maKH, isActive);
    }
  });

  /**
   * 🟢 BỔ SUNG: Hàm render thanh điều hướng phân trang bằng CSS Bootstrap
   */
  const renderPagination = () => {
    const paginationContainer = document.getElementById(
      "customerPaginationContainer",
    );
    if (!paginationContainer) return;

    if (totalPages <= 1) {
      paginationContainer.innerHTML = "";
      return;
    }

    let html = `<nav><ul class="pagination pagination-sm mb-0">`;

    // 1. Nút Trước (Previous)
    html += `
      <li class="page-item ${currentPage === 1 ? "disabled" : ""}">
        <button type="button" class="page-link" data-page="${currentPage - 1}" aria-label="Previous">
          <span aria-hidden="true">&laquo;</span>
        </button>
      </li>
    `;

    // 2. Vòng lặp các số trang (Đã sửa: Bổ sung type="button")
    for (let i = 1; i <= totalPages; i++) {
      html += `
        <li class="page-item ${currentPage === i ? "active" : ""}">
          <button type="button" class="page-link" data-page="${i}">${i}</button>
        </li>
      `;
    }

    // 3. Nút Kế tiếp (Next) (Đã sửa: Bổ sung type="button")
    html += `
      <li class="page-item ${currentPage === totalPages ? "disabled" : ""}">
        <button type="button" class="page-link" data-page="${currentPage + 1}" aria-label="Next">
          <span aria-hidden="true">&raquo;</span>
        </button>
      </li>
    `;

    html += `</ul></nav>`;
    paginationContainer.innerHTML = html;

    // Gắn sự kiện click đổi trang cho các nút (Giữ nguyên logic chặn sủi bọt an toàn của bạn)
    paginationContainer.querySelectorAll(".page-link").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        const targetPage = parseInt(
          e.currentTarget.getAttribute("data-page"),
          10,
        );
        if (
          targetPage &&
          targetPage !== currentPage &&
          targetPage >= 1 &&
          targetPage <= totalPages
        ) {
          fetchCustomers(targetPage);
        }
      });
    });
  };

  /**
   * 3. Tìm kiếm khách hàng (Lọc thời gian thực trên 10 dòng của trang hiện hành)
   */
  searchInput.addEventListener("input", (e) => {
    const keyword = e.target.value.toLowerCase().trim();

    // Lọc trực tiếp trên mảng dữ liệu gốc của trang để tránh làm hỏng cấu trúc DOM
    const filtered = currentTableData.filter((kh) => {
      return (
        (kh.hoten && kh.hoten.toLowerCase().includes(keyword)) ||
        (kh.makh && kh.makh.toLowerCase().includes(keyword)) ||
        (kh.sdt && kh.sdt.includes(keyword)) ||
        (kh.email && kh.email.toLowerCase().includes(keyword))
      );
    });

    renderTable(filtered);
  });

  /**
   * 4. Khóa / Mở khóa tài khoản khách hàng
   */
  window.toggleCustomerStatus = async (maKH, isActive) => {
    const actionText = isActive ? "KHÓA" : "MỞ KHÓA";
    const confirmColor = isActive ? "#ef4444" : "#10b981";

    const result = await Swal.fire({
      title: `Xác nhận ${actionText}?`,
      text: isActive
        ? "Khách hàng này sẽ không thể đăng nhập mua hàng!"
        : "Khách hàng sẽ được khôi phục quyền mua hàng.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: confirmColor,
      cancelButtonColor: "#6b7280",
      confirmButtonText: `Đồng ý, ${actionText}!`,
      cancelButtonText: "Hủy",
    });

    if (result.isConfirmed) {
      try {
        await axios.put(`${BASE_URL}/customers/toggle-status/${maKH}`, {
          trangThai: !isActive,
        });
        Swal.fire(
          "Thành công!",
          `Đã ${actionText} tài khoản khách hàng.`,
          "success",
        );
        // Tải lại dữ liệu đúng tại trang đang đứng để giữ vị trí view ổn định
        fetchCustomers(currentPage);
      } catch (error) {
        Swal.fire(
          "Lỗi",
          error.response?.data?.message || "Không thể thực hiện thao tác này",
          "error",
        );
      }
    }
  };

  /**
   * 5. Nghiệp vụ: Điều chỉnh điểm tích lũy cá nhân
   */
  window.adjustPoints = async (maKH) => {
    try {
      const response = await axios.get(`${BASE_URL}/customers/detail/${maKH}`);
      const kh = response.data;

      const { value: newPoints } = await Swal.fire({
        title: "Chỉnh sửa Điểm Tích Lũy",
        text: `Khách hàng: ${kh.hoten} (Điểm hiện tại: ${kh.diemtichluy})`,
        input: "number",
        inputLabel: "Nhập số điểm tích lũy mới",
        inputValue: kh.diemtichluy,
        showCancelButton: true,
        confirmButtonText: "Cập nhật điểm",
        cancelButtonText: "Hủy",
        confirmButtonColor: "#eab308",
        inputValidator: (value) => {
          if (!value || parseInt(value) < 0) {
            return "Điểm tích lũy không được để trống và phải lớn hơn hoặc bằng 0!";
          }
        },
      });

      if (newPoints !== undefined) {
        // Đọc an toàn các trường dữ liệu trả về từ Postgres (viết thường)
        await axios.put(`${BASE_URL}/customers/update/${maKH}`, {
          HoTen: kh.hoten || kh.HoTen,
          SDT: kh.sdt || kh.SDT,
          Email: kh.email || kh.Email,
          DiaChi: kh.diachi || kh.DiaChi,
          DiemTichLuy: parseInt(newPoints),
        });

        Swal.fire(
          "Thành công",
          "Đã cập nhật lại điểm tích lũy cho khách hàng!",
          "success",
        );
        fetchCustomers(currentPage);
      }
    } catch (error) {
      Swal.fire("Lỗi", "Không thể điều chỉnh điểm tích lũy", "error");
    }
  };

  /**
   * 6. Xem chi tiết & Lịch sử mua hàng
   */
  window.viewDetails = async (maKH) => {
    try {
      const response = await axios.get(`${BASE_URL}/customers/history/${maKH}`);
      const { customer, orders } = response.data;

      let orderRows = `<tr><td colspan="4" class="text-center text-muted py-3">Khách hàng chưa có lịch sử mua hàng</td></tr>`;

      if (orders && orders.length > 0) {
        orderRows = orders
          .map(
            (order) => `
          <tr>
            <td class="fw-bold text-primary">#${escapeHtml(order.madonhang)}</td>
            <td>${new Date(order.ngaydat).toLocaleDateString("vi-VN")}</td>
            <td class="text-end fw-bold">${parseFloat(order.tongtien).toLocaleString("vi-VN")} đ</td>
            <td>
              <span class="badge ${order.trangthai === "Thành công" ? "bg-success" : order.trangthai === "Đang giao" ? "bg-warning" : "bg-secondary"}">
                ${escapeHtml(order.trangthai)}
              </span>
            </td>
          </tr>
        `,
          )
          .join("");
      }

      document.getElementById("detailModalContent").innerHTML = `
        <div class="row g-3 mb-4 border-bottom pb-3">
          <div class="col-6">
            <p class="mb-1 text-muted small">Khách hàng</p>
            <h5 class="fw-bold text-dark mb-0">${escapeHtml(customer.hoten)}</h5>
            <small class="text-muted">Mã: KH_${escapeHtml(customer.makh)}</small>
          </div>
          <div class="col-6 text-end">
            <p class="mb-1 text-muted small">Hạng tài khoản</p>
            <span class="badge rounded-pill ${customer.diemtichluy >= 100 ? "bg-warning text-dark" : "bg-light text-dark border"} fw-bold px-3 py-2">
              ${customer.diemtichluy >= 100 ? "👑 THÀNH VIÊN VIP" : "THÀNH VIÊN THƯỜNG"}
            </span>
          </div>
          <div class="col-4"><strong>📞 SĐT:</strong> <br>${escapeHtml(customer.sdt)}</div>
          <div class="col-4"><strong>📧 Email:</strong> <br>${escapeHtml(customer.email || "---")}</div>
          <div class="col-4"><strong>📍 Địa chỉ:</strong> <br>${escapeHtml(customer.diachi || "Chưa cập nhật")}</div>
        </div>
        
        <h6 class="fw-bold text-secondary mb-3"><i class="fa-solid fa-clock-history me-1"></i> LỊCH SỬ ĐƠN HÀNG GẦN ĐÂY</h6>
        <div class="table-responsive" style="max-height: 250px;">
          <table class="table table-sm table-hover align-middle" style="font-size: 0.9rem;">
            <thead class="table-light sticky-top">
              <tr>
                <th>Mã Đơn</th>
                <th>Ngày Đặt</th>
                <th class="text-end">Tổng Tiền</th>
                <th>Trạng Thái</th>
              </tr>
            </thead>
            <tbody>
              ${orderRows}
            </tbody>
          </table>
        </div>
      `;

      const myModal = new Modal(document.getElementById("customerDetailModal"));
      myModal.show();
    } catch (error) {
      Swal.fire("Lỗi", "Không thể nạp lịch sử mua sắm của khách hàng", "error");
    }
  };

  // 🟢 Kích hoạt tải trang 1 lần đầu khởi tạo ứng dụng
  fetchCustomers(1);
}
