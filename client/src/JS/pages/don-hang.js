import axios from "axios";
import Swal from "sweetalert2";
import { Modal } from "bootstrap";
import ExcelJS from "exceljs/dist/exceljs.min.js";
import { saveAs } from "file-saver";
import { BASE_URL } from "/src/JS/common/header";

document.addEventListener("DOMContentLoaded", () => {
  initOrderManager();
});

export async function initOrderManager() {
  const orderTableBody = document.getElementById("orderTableBody");
  const orderCountSpan = document.getElementById("orderCount");
  const searchInput = document.querySelector(".search-input");
  const filterSelect = document.querySelector(".filter-select");
  const btnExport = document.querySelector(".btn-export");
  const paginationContainer = document.getElementById("paginationContainer");

  // 🟢 BỔ SUNG: DOM Elements cho chức năng duyệt hàng loạt
  const checkAllOrders = document.getElementById("checkAllOrders");
  const bulkActionContainer = document.getElementById("bulkActionContainer");
  const btnBulkApprove = document.getElementById("btnBulkApprove");
  const btnBulkCancel = document.getElementById("btnBulkCancel");

  // Quản lý trạng thái phân trang cục bộ
  let currentPage = 1;
  let totalPages = 1;
  let currentTableData = [];
  let selectedOrderIds = []; // 🟢 Lưu danh sách mã đơn hàng đang được chọn

  /**
   * 1. Tải danh sách đơn hàng từ API
   */
  const fetchOrders = async (page = 1) => {
    try {
      // Mỗi lần fetch lại dữ liệu, reset bộ chọn hàng loạt
      resetBulkSelection();

      const userData = JSON.parse(localStorage.getItem("hpstore_user"));
      const token = userData?.token;
      const selectedStatus = filterSelect?.value || "Tất cả";

      let url = `${BASE_URL}/orders?page=${page}`;
      if (selectedStatus !== "Tất cả") {
        url += `&trangThai=${encodeURIComponent(selectedStatus)}`;
      }

      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const {
        data,
        currentPage: resPage,
        totalPages: resTotalPages,
        totalRecords,
      } = response.data;

      currentPage = resPage;
      totalPages = resTotalPages;
      currentTableData = data;

      applyClientFilter();
      renderPagination();

      if (orderCountSpan) {
        orderCountSpan.innerText = totalRecords;
      }
    } catch (error) {
      console.error("Lỗi tải đơn hàng:", error);
      Swal.fire({
        icon: "error",
        title: "Lỗi kết nối",
        text: "Không thể tải danh sách đơn hàng từ máy chủ.",
        confirmButtonColor: "#0d6efd",
      });
    }
  };

  /**
   * 2. Hàm lọc Client-side kết hợp
   */
  const applyClientFilter = () => {
    resetBulkSelection(); // Reset checkbox khi tìm kiếm tránh lỗi dữ liệu ẩn
    const searchTerm = searchInput?.value.trim().toLowerCase() || "";

    if (!searchTerm) {
      renderTable(currentTableData);
      return;
    }

    const filtered = currentTableData.filter((order) => {
      return (
        order.madonhang.toLowerCase().includes(searchTerm) ||
        (order.tenkhachhang &&
          order.tenkhachhang.toLowerCase().includes(searchTerm)) ||
        (order.emailkhachhang &&
          order.emailkhachhang.toLowerCase().includes(searchTerm))
      );
    });

    renderTable(filtered);
  };

  searchInput.addEventListener("input", applyClientFilter);

  filterSelect.addEventListener("change", () => {
    fetchOrders(1);
  });

  /**
   * 3. Hàm render bảng dữ liệu (Bổ sung Checkbox)
   */
  const renderTable = (orders) => {
    if (!orders || orders.length === 0) {
      orderTableBody.innerHTML = `<tr><td colspan="8" class="text-center py-5 text-muted">Không tìm thấy đơn hàng nào phù hợp</td></tr>`;
      return;
    }

    orderTableBody.innerHTML = orders
      .map((order) => {
        let statusBadge = "";
        switch (order.trangthai) {
          case "Chờ xác nhận":
            statusBadge = `<span class="badge-status badge-status-pending"><i class="fa-regular fa-clock me-1"></i>Chờ xác nhận</span>`;
            break;
          case "Đang xử lý":
            statusBadge = `<span class="badge-status badge-status-processing"><i class="fa-solid fa-arrows-rotate me-1"></i>Đang xử lý</span>`;
            break;
          case "Đang giao":
            statusBadge = `<span class="badge-status badge-status-shipping"><i class="fa-solid fa-truck-fast me-1"></i>Đang giao</span>`;
            break;
          case "Đã giao":
            statusBadge = `<span class="badge-status badge-status-delivered"><i class="fa-solid fa-box-check me-1"></i>Đã giao</span>`;
            break;
          case "Thành công":
            statusBadge = `<span class="badge-status badge-status-success"><i class="fa-solid fa-circle-check me-1"></i>Thành công</span>`;
            break;
          case "Đã hủy":
            statusBadge = `<span class="badge-status badge-status-cancelled"><i class="fa-solid fa-ban me-1"></i>Đã hủy</span>`;
            break;
          default:
            statusBadge = `<span class="badge-status badge-status-pending">${order.trangthai || "Chưa rõ"}</span>`;
        }

        const formattedTotal =
          new Intl.NumberFormat("vi-VN").format(order.tongtien) + "đ";
        const orderDate = order.ngaydat
          ? new Date(order.ngaydat).toISOString().split("T")[0]
          : "---";

        // Chỉ cho phép chọn hàng loạt các đơn chưa hoàn thành/hủy
        const isActionable = [
          "Chờ xác nhận",
          "Đang xử lý",
          "Đang giao",
          "Đã giao",
        ].includes(order.trangthai);
        const checkboxHtml = isActionable
          ? `<input type="checkbox" class="form-check-input order-checkbox" data-id="${order.madonhang}">`
          : `<input type="checkbox" class="form-check-input" disabled title="Đơn hàng đã đóng">`;

        return `
          <tr>
            <td class="text-center">${checkboxHtml}</td>
            <td><a href="#" class="order-id fw-bold text-decoration-none" onclick="viewOrderDetails('${order.madonhang}')">${order.madonhang}</a></td>
            <td>
              <div class="fw-bold">${order.tenkhachhang || "Khách vãng lai"}</div>
              <div class="small text-muted">${order.emailkhachhang || ""}</div>
            </td>
            <td class="text-muted">${orderDate}</td>
            <td>${order.soluongsanpham || 0} sản phẩm</td>
            <td class="fw-bold text-dark">${formattedTotal}</td>
            <td class="align-middle">${statusBadge}</td>
            <td class="text-center">
              <button class="btn-view" onclick="viewOrderDetails('${order.madonhang}')">
                <i class="fa-regular fa-eye"></i>
              </button>
            </td>
          </tr>
        `;
      })
      .join("");

    // Đăng ký sự kiện lắng nghe riêng cho các checkbox vừa render
    initCheckboxEvents();
  };

  /**
   * 🟢 BỔ SUNG: Xử lý sự kiện Checkbox chọn hàng loạt
   */
  const initCheckboxEvents = () => {
    const rowCheckboxes = orderTableBody.querySelectorAll(".order-checkbox");

    rowCheckboxes.forEach((cb) => {
      cb.addEventListener("change", () => {
        const orderId = cb.getAttribute("data-id");
        if (cb.checked) {
          selectedOrderIds.push(orderId);
        } else {
          selectedOrderIds = selectedOrderIds.filter((id) => id !== orderId);
        }
        toggleBulkActionContainer();

        // Kiểm tra xem đã chọn tất cả các dòng khả dụng trên trang chưa
        const allChecked = Array.from(rowCheckboxes).every(
          (item) => item.checked,
        );
        if (checkAllOrders) checkAllOrders.checked = allChecked;
      });
    });
  };

  if (checkAllOrders) {
    checkAllOrders.addEventListener("change", (e) => {
      const isChecked = e.target.checked;
      const rowCheckboxes = orderTableBody.querySelectorAll(".order-checkbox");

      selectedOrderIds = [];
      rowCheckboxes.forEach((cb) => {
        cb.checked = isChecked;
        if (isChecked) {
          selectedOrderIds.push(cb.getAttribute("data-id"));
        }
      });
      toggleBulkActionContainer();
    });
  }

  const toggleBulkActionContainer = () => {
    if (!bulkActionContainer) return;
    if (selectedOrderIds.length > 0) {
      bulkActionContainer.classList.remove("d-none");
      const badgeCount = bulkActionContainer.querySelector(".selected-count");
      if (badgeCount) badgeCount.innerText = selectedOrderIds.length;
    } else {
      bulkActionContainer.classList.add("d-none");
    }
  };

  const resetBulkSelection = () => {
    selectedOrderIds = [];
    if (checkAllOrders) checkAllOrders.checked = false;
    toggleBulkActionContainer();
  };

  /**
   * 🟢 BỔ SUNG: Xử lý Gửi lệnh duyệt/hủy hàng loạt lên Server
   */
  const handleBulkUpdateStatus = async (type) => {
    if (selectedOrderIds.length === 0) return;

    let titleText = type === "APPROVE" ? "Duyệt hàng loạt?" : "Hủy hàng loạt?";
    let textContent =
      type === "APPROVE"
        ? `Hệ thống sẽ tự động chuyển tiếp trạng thái tiếp theo cho ${selectedOrderIds.length} đơn hàng đã chọn.`
        : `Bạn có chắc muốn HỦY đồng thời ${selectedOrderIds.length} đơn hàng đã chọn?`;
    let confirmColor = type === "APPROVE" ? "#198754" : "#dc3545";

    const confirmResult = await Swal.fire({
      title: titleText,
      text: textContent,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: confirmColor,
      confirmButtonText: "Xác nhận xử lý",
      cancelButtonText: "Bỏ qua",
    });

    if (!confirmResult.isConfirmed) return;

    Swal.fire({
      title: "Đang xử lý hàng loạt...",
      text: "Vui lòng không đóng trình duyệt",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    try {
      const userData = JSON.parse(localStorage.getItem("hpstore_user"));
      const token = userData?.token;

      // Gọi API PATCH / PUT xử lý theo danh sách ID mảng
      await axios.put(
        `${BASE_URL}/orders/bulk-status`,
        {
          orderIds: selectedOrderIds,
          actionType: type, // "APPROVE" hoặc "CANCEL"
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      await Swal.fire({
        icon: "success",
        title: "Thành công!",
        text: `Đã xử lý thành công ${selectedOrderIds.length} đơn hàng.`,
        confirmButtonColor: "#0d6efd",
      });

      fetchOrders(currentPage);
    } catch (error) {
      console.error("Lỗi duyệt hàng loạt:", error);
      Swal.fire({
        icon: "error",
        title: "Thất bại",
        text:
          error.response?.data?.message ||
          "Có lỗi xảy ra khi cập nhật trạng thái số đông.",
        confirmButtonColor: "#0d6efd",
      });
    }
  };

  if (btnBulkApprove)
    btnBulkApprove.onclick = () => handleBulkUpdateStatus("APPROVE");
  if (btnBulkCancel)
    btnBulkCancel.onclick = () => handleBulkUpdateStatus("CANCEL");

  /**
   * 4. Hàm render các nút bấm phân trang Bootstrap 5
   */
  const renderPagination = () => {
    if (!paginationContainer) return;
    if (totalPages <= 1) {
      paginationContainer.innerHTML = "";
      return;
    }

    let html = `<nav><ul class="pagination pagination-sm mb-0">`;

    html += `
      <li class="page-item ${currentPage === 1 ? "disabled" : ""}">
        <button class="page-link" data-page="${currentPage - 1}" aria-label="Previous">
          <span aria-hidden="true">&laquo;</span>
        </button>
      </li>
    `;

    for (let i = 1; i <= totalPages; i++) {
      html += `
        <li class="page-item ${currentPage === i ? "active" : ""}">
          <button class="page-link" data-page="${i}">${i}</button>
        </li>
      `;
    }

    html += `
      <li class="page-item ${currentPage === totalPages ? "disabled" : ""}">
        <button class="page-link" data-page="${currentPage + 1}" aria-label="Next">
          <span aria-hidden="true">&raquo;</span>
        </button>
      </li>
    `;

    html += `</ul></nav>`;
    paginationContainer.innerHTML = html;

    paginationContainer.querySelectorAll(".page-link").forEach((button) => {
      button.addEventListener("click", (e) => {
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
          fetchOrders(targetPage);
        }
      });
    });
  };

  /**
   * 5. Xử lý cập nhật trạng thái đơn hàng (Đơn lẻ)
   */
  const handleUpdateStatus = async (maDonHang, trangThaiMoi) => {
    let actionText = "";
    let confirmColor = "#0d6efd";

    switch (trangThaiMoi) {
      case "Đang xử lý":
        actionText = "XÁC NHẬN đơn hàng này";
        confirmColor = "#ffc107";
        break;
      case "Đang giao":
        actionText = "duyệt đơn hàng và chuyển sang GIAO HÀNG";
        break;
      case "Đã giao":
        actionText = "xác nhận đơn hàng đã GIAO THÀNH CÔNG đến khách";
        confirmColor = "#198754";
        break;
      case "Thành công":
        actionText =
          "HOÀN THÀNH đơn hàng (Hệ thống sẽ tự động chốt toán và cộng điểm tích lũy)";
        confirmColor = "#198754";
        break;
      case "Đã hủy":
        actionText = "HỦY đơn hàng này";
        confirmColor = "#dc3545";
        break;
      default:
        actionText = `chuyển trạng thái sang ${trangThaiMoi}`;
    }

    const confirmResult = await Swal.fire({
      title: "Xác nhận hành động?",
      text: `Bạn có chắc chắn muốn ${actionText}?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: confirmColor,
      confirmButtonText: "Đồng ý",
      cancelButtonText: "Bỏ qua",
    });

    if (!confirmResult.isConfirmed) return;

    Swal.fire({
      title: "Đang xử lý...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    try {
      const userData = JSON.parse(localStorage.getItem("hpstore_user"));
      const token = userData?.token;
      await axios.put(
        `${BASE_URL}/orders/status/${maDonHang}`,
        { TrangThai: trangThaiMoi },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      await Swal.fire({
        icon: "success",
        title: "Thành công!",
        text: `Đơn hàng ${maDonHang} đã chuyển sang trạng thái: ${trangThaiMoi}.`,
        confirmButtonColor: "#0d6efd",
      });

      const currentModal = Modal.getInstance(
        document.getElementById("orderDetailModal"),
      );
      if (currentModal) currentModal.hide();

      fetchOrders(currentPage);
    } catch (error) {
      console.error("Lỗi cập nhật trạng thái:", error);
      Swal.fire({
        icon: "error",
        title: "Thất bại",
        text:
          error.response?.data?.message ||
          "Không thể cập nhật trạng thái đơn hàng.",
        confirmButtonColor: "#0d6efd",
      });
    }
  };

  window.handleUpdateStatus = handleUpdateStatus;

  /**
   * 6. Xem chi tiết đơn hàng (Giữ nguyên gốc)
   */
  window.viewOrderDetails = async (maDonHang) => {
    Swal.fire({
      title: "Đang tải...",
      text: `Đang lấy thông tin đơn hàng ${maDonHang}`,
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    try {
      const userData = JSON.parse(localStorage.getItem("hpstore_user"));
      const token = userData?.token;
      const response = await axios.get(`${BASE_URL}/orders/${maDonHang}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const order = response.data;
      Swal.close();

      document.getElementById("modalMaDonHang").innerText = order.MaDonHang;
      document.getElementById("modalNgayDat").innerText = order.NgayDat
        ? new Date(order.NgayDat).toISOString().split("T")[0]
        : "---";
      const modalTrangThaiEl = document.getElementById("modalTrangThai");
      if (modalTrangThaiEl) {
        modalTrangThaiEl.innerText = order.TrangThai || "---";
        let bClass = "badge-status badge-status-pending";
        if (order.TrangThai === "Thành công" || order.TrangThai === "Đã giao") bClass = "badge-status badge-status-success";
        else if (order.TrangThai === "Đang giao") bClass = "badge-status badge-status-shipping";
        else if (order.TrangThai === "Đang xử lý") bClass = "badge-status badge-status-processing";
        else if (order.TrangThai === "Đã hủy") bClass = "badge-status badge-status-cancelled";
        modalTrangThaiEl.className = bClass;
      }
      document.getElementById("modalGhiChu").innerText =
        order.GhiChu || "Không có";
      document.getElementById("modalTongTien").innerText =
        new Intl.NumberFormat("vi-VN").format(order.TongTien) + "đ";
      document.getElementById("modalKhachHang").innerText =
        order.KhachHang.HoTen || "Khách vãng lai";
      document.getElementById("modalSDT").innerText =
        order.KhachHang.SDT || "---";
      document.getElementById("modalEmail").innerText =
        order.KhachHang.Email || "---";
      document.getElementById("modalDiaChi").innerText =
        order.KhachHang.DiaChi || "---";
      document.getElementById("modalTenDangNhap").innerText =
        order.KhachHang.TenDangNhap || "Không có tài khoản";

      const modalProductItems = document.getElementById("modalProductItems");
      if (
        !order.Items ||
        order.Items.length === 0 ||
        order.Items[0].MaSP === null
      ) {
        modalProductItems.innerHTML = `<tr><td colspan="5" class="text-center py-3 text-muted">Đơn hàng không có sản phẩm nào</td></tr>`;
      } else {
        modalProductItems.innerHTML = order.Items.map((item) => {
          const price = Number(item.GiaBan || 0);
          const quantity = Number(item.SoLuong || 0);
          const discount = Number(item.GiamGia || 0);
          const subTotal = price * quantity - discount;

          return `
            <tr>
              <td class="fw-bold text-secondary">${item.MaSP}</td>
              <td class="text-center fw-bold">${quantity}</td>
              <td class="text-end">${new Intl.NumberFormat("vi-VN").format(price)}đ</td>
              <td class="text-end text-success">-${new Intl.NumberFormat("vi-VN").format(discount)}đ</td>
              <td class="text-end fw-bold text-dark">${new Intl.NumberFormat("vi-VN").format(subTotal)}đ</td>
            </tr>
          `;
        }).join("");
      }

      const modalActionButtons = document.getElementById("modalActionButtons");
      switch (order.TrangThai) {
        case "Chờ xác nhận":
          modalActionButtons.innerHTML = `
            <button class="btn btn-warning text-dark me-2 px-3 fw-bold fs-5" onclick="handleUpdateStatus('${order.MaDonHang}', 'Đang xử lý')">
              <i class="fa-solid fa-bell-concierge me-1"></i> Xác nhận đơn hàng
            </button>
            <button class="btn btn-danger px-3 fs-5" onclick="handleUpdateStatus('${order.MaDonHang}', 'Đã hủy')">
              <i class="fa-solid fa-xmark me-1"></i> Hủy đơn hàng
            </button>
          `;
          break;
        case "Đang xử lý":
          modalActionButtons.innerHTML = `
            <button class="btn btn-primary me-2 px-3 fw-bold fs-5" onclick="handleUpdateStatus('${order.MaDonHang}', 'Đang giao')">
              <i class="fa-solid fa-truck-fast me-1"></i> Duyệt đơn (Giao hàng)
            </button>
            <button class="btn btn-danger px-3 fs-5" onclick="handleUpdateStatus('${order.MaDonHang}', 'Đã hủy')">
              <i class="fa-solid fa-xmark me-1"></i> Hủy đơn hàng
            </button>
          `;
          break;
        case "Đang giao":
          modalActionButtons.innerHTML = `
            <button class="btn btn-success me-2 px-3 fw-bold fs-5" onclick="handleUpdateStatus('${order.MaDonHang}', 'Đã giao')">
              <i class="fa-solid fa-box-open me-1"></i> Đã giao hàng
            </button>
            <button class="btn btn-danger px-3 fs-5" onclick="handleUpdateStatus('${order.MaDonHang}', 'Đã hủy')">
              <i class="fa-solid fa-xmark me-1"></i> Khách hoàn/Hủy đơn
            </button>
          `;
          break;
        case "Đã giao":
          modalActionButtons.innerHTML = `
            <button class="btn btn-success me-2 px-3 fw-bold fs-5" style="background-color: #198754;" onclick="handleUpdateStatus('${order.MaDonHang}', 'Thành công')">
              <i class="fa-solid fa-circle-check me-1"></i> Hoàn thành (Tích điểm)
            </button>
          `;
          break;
        default:
          modalActionButtons.innerHTML = "";
          break;
      }

      const myModal = new Modal(document.getElementById("orderDetailModal"));
      myModal.show();
    } catch (error) {
      console.error("Lỗi lấy chi tiết:", error);
      Swal.fire({
        icon: "error",
        title: "Thất bại",
        text: "Không thể lấy thông tin chi tiết đơn hàng.",
        confirmButtonColor: "#0d6efd",
      });
    }
  };

  /**
   * 7. Xuất file Excel (Giữ nguyên gốc)
   */
  const exportToExcel = async (data) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Danh sách đơn hàng");

    worksheet.columns = [
      { header: "Mã đơn hàng", key: "MaDonHang", width: 20 },
      { header: "Khách hàng", key: "TenKhachHang", width: 25 },
      { header: "Email", key: "EmailKhachHang", width: 25 },
      { header: "Ngày đặt", key: "NgayDat", width: 15 },
      { header: "Số lượng SP", key: "SoLuongSanPham", width: 12 },
      { header: "Tổng tiền (VNĐ)", key: "TongTien", width: 15 },
      { header: "Trạng thái", key: "TrangThai", width: 15 },
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = {
      name: "Segoe UI",
      bold: true,
      color: { argb: "FFFFFF" },
    };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "00B050" },
    };
    headerRow.alignment = { vertical: "middle", horizontal: "center" };

    data.forEach((order) => {
      worksheet.addRow({
        MaDonHang: order.madonhang,
        TenKhachHang: order.tenkhachhang || "Khách vãng lai",
        EmailKhachHang: order.emailkhachhang || "",
        NgayDat: order.ngaydat
          ? new Date(order.ngaydat).toISOString().split("T")[0]
          : "",
        SoLuongSanPham: order.soluongsanpham,
        TongTien: order.tongtien,
        TrangThai: order.trangthai,
      });
    });

    worksheet.getColumn("TongTien").numFmt = '#,##0"đ"';
    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        if (rowNumber > 1) {
          cell.font = { name: "Segoe UI", size: 11 };
          cell.alignment = { vertical: "middle" };
        }
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    saveAs(blob, `Bao_cao_don_hang_${new Date().getTime()}.xlsx`);
  };

  btnExport.onclick = async () => {
    if (currentTableData.length === 0) {
      Swal.fire("Thông báo", "Không có dữ liệu để xuất báo cáo!", "info");
      return;
    }

    const result = await Swal.fire({
      title: "Xác nhận xuất báo cáo?",
      text: `Tải xuống file Excel chứa ${currentTableData.length} đơn hàng trên trang này.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#00b050",
      confirmButtonText: "Tải xuống",
      cancelButtonText: "Hủy",
    });

    if (result.isConfirmed) {
      Swal.fire({
        title: "Đang xử lý...",
        didOpen: () => Swal.showLoading(),
        allowOutsideClick: false,
      });
      try {
        await exportToExcel(currentTableData);
        Swal.fire(
          "Thành công!",
          "File đã được lưu vào máy tính của bạn.",
          "success",
        );
      } catch (error) {
        console.error(error);
        Swal.fire("Lỗi", "Có lỗi xảy ra khi tạo file Excel.", "error");
      }
    }
  };

  fetchOrders(1);
}
