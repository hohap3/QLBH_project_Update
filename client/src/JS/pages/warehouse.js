import axios from "axios";
import Swal from "sweetalert2";
import { BASE_URL } from "/src/JS/common/header";
import * as bootstrap from "bootstrap";

// Mảng chứa dữ liệu của TRANG HIỆN TẠI để phục vụ việc xuất file Excel tại chỗ
let currentTableData = [];

// Biến quản lý trạng thái phân trang cục bộ
let currentPage = 1;
let totalPages = 1;

// Hàm lấy token xác thực từ LocalStorage
function getAuthHeaders() {
  try {
    const saved = localStorage.getItem("hpstore_user");
    if (!saved) return {};
    const parsed = JSON.parse(saved);
    if (parsed && parsed.token) {
      return { Authorization: `Bearer ${parsed.token}` };
    }
  } catch (e) {
    console.error("Lỗi đọc token từ localStorage:", e);
  }
  return {};
}

// Khởi tạo trang Quản lý Kho Hàng
export async function initWarehouseManager() {
  // 1. Tự động tải thư viện SheetJS phục vụ xuất Excel nếu chưa được nạp vào trang
  if (!window.XLSX) {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
    document.head.appendChild(script);
  }

  // 2. Nút mở Modal Tạo phiếu kho
  const btnOpenModal = document.getElementById("btnOpenTransactionModal");
  if (btnOpenModal) {
    btnOpenModal.onclick = (e) => {
      e.preventDefault();
      const modalEl = document.getElementById("modalTransaction");
      if (modalEl) {
        const bs = window.bootstrap || bootstrap;
        const modal = bs.Modal.getOrCreateInstance(modalEl);
        modal.show();
      }
    };
  }

  // 3. Lọc & Tìm kiếm giao dịch kho
  const searchInput = document.getElementById("searchWarehouse");
  if (searchInput) {
    searchInput.oninput = () => {
      const searchVal = searchInput.value.trim().toLowerCase();
      const displayData = currentTableData.filter((item) => {
        return (
          !searchVal ||
          (item.magd && item.magd.toLowerCase().includes(searchVal)) ||
          (item.tensp && item.tensp.toLowerCase().includes(searchVal)) ||
          (item.masp && item.masp.toLowerCase().includes(searchVal))
        );
      });
      renderTable(displayData);
    };
  }

  const filterLoai = document.getElementById("filterLoaiGD");
  if (filterLoai) {
    filterLoai.onchange = () => fetchWarehouseLogs(1);
  }

  const filterKho = document.getElementById("filterKho");
  if (filterKho) {
    filterKho.onchange = () => {
      // Đồng bộ ô chọn kho trong modal nếu người dùng đang xem kho này
      const modalKho = document.getElementById("selectKho");
      if (modalKho) modalKho.value = filterKho.value;
      fetchWarehouseLogs(1);
    };
  }

  // 4. Nút Làm mới bộ lọc
  const btnReset = document.getElementById("btnResetFilter");
  if (btnReset) {
    btnReset.onclick = resetFilters;
  }

  // 5. Submit Form Giao dịch kho
  const formTrans = document.getElementById("formWarehouseTransaction");
  if (formTrans) {
    formTrans.onsubmit = handleCreateTransaction;
  }

  // 6. Nút Xuất Excel
  const btnExport = document.getElementById("btnExportExcel");
  if (btnExport) {
    btnExport.onclick = exportToExcel;
  }

  // 7. Đồng bộ chọn kho trong modal để tải danh sách sản phẩm
  const modalSelectKho = document.getElementById("selectKho");
  if (modalSelectKho) {
    modalSelectKho.onchange = () => loadProductsToSelect();
  }

  // Tải danh sách sản phẩm và dữ liệu giao dịch ban đầu
  await loadProductsToSelect();
  await fetchWarehouseLogs(1);
}

// 1. Tải danh sách lịch sử kho từ API
async function fetchWarehouseLogs(page = 1) {
  const tbody = document.getElementById("warehouseDataBody");
  try {
    const filterLoai = document.getElementById("filterLoaiGD")?.value || "";
    const filterKho = document.getElementById("filterKho")?.value || "KHO_TONG";

    let url = `${BASE_URL}/warehouse/transactions?page=${page}&makho=${encodeURIComponent(filterKho)}`;
    if (filterLoai !== "") {
      url += `&loaiGD=${encodeURIComponent(filterLoai)}`;
    }

    const headers = getAuthHeaders();
    const response = await axios.get(url, { headers });

    if (response.data.success) {
      const {
        data,
        currentPage: resPage,
        totalPages: resTotalPages,
      } = response.data;

      currentPage = resPage;
      totalPages = resTotalPages;
      currentTableData = data || [];

      const searchVal =
        document.getElementById("searchWarehouse")?.value.trim().toLowerCase() || "";
      const displayData = currentTableData.filter((item) => {
        return (
          !searchVal ||
          (item.magd && item.magd.toLowerCase().includes(searchVal)) ||
          (item.tensp && item.tensp.toLowerCase().includes(searchVal)) ||
          (item.masp && item.masp.toLowerCase().includes(searchVal))
        );
      });

      renderTable(displayData);
      renderPagination();
    }
  } catch (error) {
    console.error("Lỗi lấy dữ liệu kho:", error);
    if (tbody) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        tbody.innerHTML = `
          <tr><td colspan="8" class="text-center text-warning py-4">
            <i class="fa-solid fa-lock me-2"></i> Phiên đăng nhập hết hạn hoặc chưa đăng nhập. Vui lòng đăng nhập với tài khoản <b>admin</b> hoặc <b>manager</b>.
          </td></tr>
        `;
      } else {
        tbody.innerHTML = `
          <tr><td colspan="8" class="text-center text-danger py-4">
            <i class="fa-solid fa-triangle-exclamation me-2"></i> ${error.response?.data?.message || "Không thể tải dữ liệu lịch sử kho."}
          </td></tr>
        `;
      }
    }
  }
}

// 2. Render danh sách ra bảng HTML
function renderTable(data) {
  const tbody = document.getElementById("warehouseDataBody");
  if (!tbody) return;

  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-muted">Không tìm thấy giao dịch nào phù hợp trong kho này.</td></tr>`;
    return;
  }

  tbody.innerHTML = data
    .map((item) => {
      const isNhap = parseInt(item.loaigd, 10) === 1;
      const badgeClass = isNhap
        ? "bg-success text-white rounded-pill px-3 py-1 fw-semibold"
        : "bg-danger text-white rounded-pill px-3 py-1 fw-semibold";
      const badgeText = isNhap ? "Nhập kho" : "Xuất kho";
      const prefix = isNhap ? "+" : "-";

      return `
        <tr>
          <td class="fw-bold text-secondary align-middle">${item.magd}</td>
          <td class="align-middle">
            <div class="fw-semibold text-dark">${item.tensp || "---"}</div>
            <small class="text-muted">Mã: ${item.masp}</small>
          </td>
          <td class="align-middle"><span class="badge ${badgeClass}" style="white-space: nowrap;">${badgeText}</span></td>
          <td class="text-center fw-bold align-middle ${isNhap ? "text-success" : "text-danger"}">${prefix}${item.soluong}</td>
          <td class="text-center text-muted align-middle">${item.donvitinh || "Cái"}</td>
          <td class="text-center text-muted align-middle">${item.tontruoc}</td>
          <td class="text-center fw-bold text-dark align-middle">${item.tonsau}</td>
          <td class="align-middle text-muted">${item.ngaygd ? new Date(item.ngaygd).toLocaleString("vi-VN") : "---"}</td>
        </tr>
      `;
    })
    .join("");
}

// 3. Render các nút bấm phân trang Bootstrap 5
function renderPagination() {
  const paginationContainer = document.getElementById("warehousePaginationContainer");
  if (!paginationContainer) return;

  if (totalPages <= 1) {
    paginationContainer.innerHTML = "";
    return;
  }

  let html = `<nav><ul class="pagination pagination-sm mb-0">`;

  // Nút Previous
  html += `
    <li class="page-item ${currentPage === 1 ? "disabled" : ""}">
      <button class="page-link" data-page="${currentPage - 1}" aria-label="Previous">
        <span aria-hidden="true">&laquo;</span>
      </button>
    </li>
  `;

  // Các nút số trang
  for (let i = 1; i <= totalPages; i++) {
    html += `
      <li class="page-item ${currentPage === i ? "active" : ""}">
        <button class="page-link" data-page="${i}">${i}</button>
      </li>
    `;
  }

  // Nút Next
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
    button.onclick = (e) => {
      const targetPage = parseInt(e.currentTarget.getAttribute("data-page"), 10);
      if (targetPage && targetPage !== currentPage && targetPage >= 1 && targetPage <= totalPages) {
        fetchWarehouseLogs(targetPage);
      }
    };
  });
}

// 4. Reset bộ lọc
function resetFilters() {
  const searchInput = document.getElementById("searchWarehouse");
  if (searchInput) searchInput.value = "";
  const filterLoai = document.getElementById("filterLoaiGD");
  if (filterLoai) filterLoai.value = "";
  const filterKho = document.getElementById("filterKho");
  if (filterKho) filterKho.value = "KHO_TONG";
  fetchWarehouseLogs(1);
}

// 5. Lấy danh sách sản phẩm đổ vào thẻ Select trong Modal
async function loadProductsToSelect() {
  const select = document.getElementById("selectProduct");
  if (!select) return;
  try {
    const headers = getAuthHeaders();
    const response = await axios.get(`${BASE_URL}/products?limit=100`, { headers });
    let products = [];

    if (response.data && Array.isArray(response.data.products)) {
      products = response.data.products;
    } else if (response.data && Array.isArray(response.data.data)) {
      products = response.data.data;
    } else if (Array.isArray(response.data)) {
      products = response.data;
    }

    if (products.length === 0) {
      select.innerHTML = `<option value="">-- Không có sản phẩm nào --</option>`;
      return;
    }

    select.innerHTML = products
      .map((p) => {
        const maSP = p.masp || p.MaSP;
        const tenSP = p.tensp || p.TenSP;
        const ton = p.soluongton !== undefined ? p.soluongton : 0;
        return `<option value="${maSP}">${tenSP} [${maSP}] (Tổng tồn: ${ton})</option>`;
      })
      .join("");
  } catch (err) {
    console.error("Không tải được sản phẩm vào ô chọn:", err);
    select.innerHTML = `<option value="">-- Lỗi tải danh sách sản phẩm --</option>`;
  }
}

// 6. Xử lý gửi Form tạo giao dịch kho mới
async function handleCreateTransaction(e) {
  e.preventDefault();

  const makho = document.getElementById("selectKho")?.value || "KHO_TONG";
  const maSP = document.getElementById("selectProduct")?.value;
  const loaiGDElement = document.querySelector('input[name="radioLoaiGD"]:checked');
  const soLuongRaw = document.getElementById("numSoLuong")?.value.trim() || "";

  if (!maSP) {
    Swal.fire("Thông báo", "Vui lòng chọn sản phẩm!", "warning");
    return;
  }

  if (!loaiGDElement) {
    Swal.fire(
      "Thông báo",
      "Vui lòng chọn loại giao dịch (Nhập kho / Xuất kho)!",
      "warning",
    );
    return;
  }

  const soLuong = parseInt(soLuongRaw, 10);
  if (isNaN(soLuong) || soLuong <= 0) {
    Swal.fire({
      icon: "warning",
      title: "Lỗi nhập liệu",
      text: "Số lượng giao dịch kho bắt buộc phải là số và lớn hơn 0!",
      confirmButtonColor: "#6138ff",
    });
    return;
  }

  if (soLuong > 100000) {
    Swal.fire({
      icon: "warning",
      title: "Vượt quá hạn mức",
      text: "Số lượng cho mỗi giao dịch không được vượt quá 100.000 đơn vị!",
      confirmButtonColor: "#6138ff",
    });
    return;
  }

  try {
    const headers = getAuthHeaders();
    const response = await axios.post(
      `${BASE_URL}/warehouse/transaction`,
      {
        maSP,
        makho,
        loaiGD: parseInt(loaiGDElement.value, 10),
        soLuong: soLuong,
      },
      { headers },
    );

    if (response.data.success) {
      Swal.fire("Thành công", response.data.message, "success");
      document.getElementById("formWarehouseTransaction")?.reset();

      const modalEl = document.getElementById("modalTransaction");
      if (modalEl) {
        const bs = window.bootstrap || bootstrap;
        const modal = bs.Modal.getInstance(modalEl);
        if (modal) modal.hide();
      }

      // Cập nhật lại dropdown sản phẩm và bảng lịch sử kho
      await loadProductsToSelect();
      await fetchWarehouseLogs(1);
    }
  } catch (error) {
    console.error("Lỗi tạo giao dịch:", error);
    Swal.fire(
      "Thao tác lỗi",
      error.response?.data?.message || "Không thể thực hiện giao dịch!",
      "error",
    );
  }
}

// 7. Xuất file Excel
function exportToExcel() {
  if (!window.XLSX) {
    Swal.fire(
      "Thông báo",
      "Thư viện xuất Excel đang được nạp, vui lòng thử lại sau giây lát!",
      "info",
    );
    return;
  }

  if (currentTableData.length === 0) {
    Swal.fire("Cảnh báo", "Không có dữ liệu kho để xuất báo cáo!", "warning");
    return;
  }

  const excelData = currentTableData.map((item, index) => ({
    STT: index + 1,
    "Mã Giao Dịch": item.magd,
    "Mã Sản Phẩm": item.masp,
    "Tên Sản Phẩm": item.tensp || "Chưa rõ",
    "Loại Giao Dịch": parseInt(item.loaigd, 10) === 1 ? "Nhập kho" : "Xuất kho",
    "Số Lượng": item.soluong,
    "Đơn Vị Tính": item.donvitinh || "Cái",
    "Tồn Trước Biến Động": item.tontruoc,
    "Tồn Sau Biến Động": item.tonsau,
    "Thời Gian Thực Hiện": item.ngaygd
      ? new Date(item.ngaygd).toLocaleString("vi-VN")
      : "---",
  }));

  const worksheet = XLSX.utils.json_to_sheet(excelData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Báo cáo Kho HP STORE");

  const max_len = excelData.reduce(
    (w, r) => Math.max(w, r["Tên Sản Phẩm"] ? r["Tên Sản Phẩm"].length : 15),
    15,
  );

  worksheet["!cols"] = [
    { wch: 6 },
    { wch: 15 },
    { wch: 20 },
    { wch: max_len + 5 },
    { wch: 15 },
    { wch: 10 },
    { wch: 12 },
    { wch: 20 },
    { wch: 20 },
    { wch: 25 },
  ];

  const today = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(
    workbook,
    `BaoCao_KhoHang_HPSTORE_Trang${currentPage}_${today}.xlsx`,
  );
}
