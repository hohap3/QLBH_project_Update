import axios from "axios";
import Swal from "sweetalert2";
import { BASE_URL } from "/src/JS/common/header";
import { renderAdminPagination } from "/src/JS/common/pagination";
import { toastSuccess, toastInfo } from "/src/JS/common/notify";
import * as bootstrap from "bootstrap";

// Mảng chứa dữ liệu của TRANG HIỆN TẠI để phục vụ việc xuất file Excel tại chỗ
let currentTableData = [];

// Biến quản lý trạng thái phân trang cục bộ (Tab 1: Lịch sử kho)
let currentPage = 1;
let totalPages = 1;

// Biến quản lý trạng thái phân trang (Tab 2: Yêu cầu & Điều chuyển liên kho)
let currentTransferPage = 1;
let totalTransferPages = 1;
let transferSearchTimer = null;

const WAREHOUSE_LABELS = {
  KHO_TONG: "Kho Tổng Trung Tâm",
  KHO_CN1: "Kho Chi nhánh 1",
  KHO_CN2: "Kho Chi nhánh 2",
};

function getWarehouseLabel(code) {
  return WAREHOUSE_LABELS[code] || code || "---";
}

function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getCurrentUser() {
  try {
    const saved =
      localStorage.getItem("hpstore_user") || localStorage.getItem("user");
    return saved ? JSON.parse(saved) : null;
  } catch (e) {
    console.error("Lỗi đọc thông tin người dùng từ localStorage:", e);
    return null;
  }
}

function isManagerOrAdminUser() {
  const user = getCurrentUser();
  const role = String(user?.role || user?.mavaitro || "").toUpperCase();
  return ["ADMIN", "MANAGER"].includes(role);
}

// Hàm lấy token xác thực từ LocalStorage
function getAuthHeaders() {
  const parsed = getCurrentUser();
  const token = parsed?.token || localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Khởi tạo trang Quản lý Kho Hàng
export async function initWarehouseManager() {
  // 1. Tự động tải thư viện SheetJS phục vụ xuất Excel nếu chưa được nạp vào trang
  if (!window.XLSX) {
    const script = document.createElement("script");
    script.src =
      "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
    document.head.appendChild(script);
  }

  // 2. Phân quyền hiển thị nút thao tác theo vai trò
  const isManager = isManagerOrAdminUser();
  const btnOpenModal = document.getElementById("btnOpenTransactionModal");
  const btnOpenDirectTransfer = document.getElementById(
    "btnOpenDirectTransferModal",
  );
  const btnOpenTransferRequest = document.getElementById(
    "btnOpenTransferRequestModal",
  );

  if (!isManager) {
    // Nhân viên chỉ lập yêu cầu chuyển kho, không tự nhập/xuất hoặc điều chuyển trực tiếp
    if (btnOpenModal) btnOpenModal.classList.add("d-none");
    if (btnOpenDirectTransfer) btnOpenDirectTransfer.classList.add("d-none");
  }

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

  if (btnOpenTransferRequest) {
    btnOpenTransferRequest.onclick = (e) => {
      e.preventDefault();
      openTransferModal("request");
    };
  }

  if (btnOpenDirectTransfer) {
    btnOpenDirectTransfer.onclick = (e) => {
      e.preventDefault();
      openTransferModal("direct");
    };
  }

  // 3. Chuyển đổi giữa 2 Tab: Lịch sử kho <-> Yêu cầu & Điều chuyển liên kho
  const tabsContainer = document.getElementById("warehouseMainTabs");
  if (tabsContainer) {
    tabsContainer.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-warehouse-tab]");
      if (!btn) return;
      const targetTab = btn.getAttribute("data-warehouse-tab");
      switchWarehouseTab(targetTab);
    });
  }

  // 4. Lọc & Tìm kiếm giao dịch kho (Tab 1)
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
      const modalKho = document.getElementById("selectKho");
      if (modalKho) modalKho.value = filterKho.value;
      fetchWarehouseLogs(1);
    };
  }

  const btnReset = document.getElementById("btnResetFilter");
  if (btnReset) {
    btnReset.onclick = resetFilters;
  }

  // 5. Lọc & Tìm kiếm phiếu chuyển kho (Tab 2)
  const searchTransfer = document.getElementById("searchTransfer");
  if (searchTransfer) {
    searchTransfer.oninput = () => {
      clearTimeout(transferSearchTimer);
      transferSearchTimer = setTimeout(() => fetchTransferRequests(1), 300);
    };
  }

  const filterTransferStatus = document.getElementById("filterTransferStatus");
  if (filterTransferStatus) {
    filterTransferStatus.onchange = () => fetchTransferRequests(1);
  }

  const btnResetTransfer = document.getElementById("btnResetTransferFilter");
  if (btnResetTransfer) {
    btnResetTransfer.onclick = () => {
      if (searchTransfer) searchTransfer.value = "";
      if (filterTransferStatus) filterTransferStatus.value = "";
      fetchTransferRequests(1);
    };
  }

  // 6. Submit Form Giao dịch kho lẻ & Form Chuyển kho liên kho
  const formTrans = document.getElementById("formWarehouseTransaction");
  if (formTrans) {
    formTrans.onsubmit = handleCreateTransaction;
  }

  const formTransfer = document.getElementById("formWarehouseTransfer");
  if (formTransfer) {
    formTransfer.onsubmit = handleSubmitTransfer;
  }

  // Cập nhật tồn kho thực tế của Kho nguồn khi đổi kho hoặc đổi sản phẩm trong modal chuyển kho
  const transferKhoNguon = document.getElementById("transferKhoNguon");
  const transferSelectProduct = document.getElementById(
    "transferSelectProduct",
  );
  if (transferKhoNguon) {
    transferKhoNguon.onchange = () => refreshSourceStockHint();
  }
  if (transferSelectProduct) {
    transferSelectProduct.onchange = () => refreshSourceStockHint();
  }

  // Event delegation cho nút Duyệt / Từ chối trên bảng phiếu chuyển kho
  const transferTbody = document.getElementById("transferDataBody");
  if (transferTbody) {
    transferTbody.addEventListener("click", (e) => {
      const approveBtn = e.target.closest(".btn-approve-transfer");
      if (approveBtn) {
        const maYeuCau = approveBtn.getAttribute("data-id");
        if (maYeuCau) handleApproveTransfer(maYeuCau);
        return;
      }
      const rejectBtn = e.target.closest(".btn-reject-transfer");
      if (rejectBtn) {
        const maYeuCau = rejectBtn.getAttribute("data-id");
        if (maYeuCau) handleRejectTransfer(maYeuCau);
      }
    });
  }

  // 7. Nút Xuất Excel
  const btnExport = document.getElementById("btnExportExcel");
  if (btnExport) {
    btnExport.onclick = exportToExcel;
  }

  // 8. Đồng bộ chọn kho trong modal nhập/xuất lẻ
  const modalSelectKho = document.getElementById("selectKho");
  if (modalSelectKho) {
    modalSelectKho.onchange = () => loadProductsToSelect();
  }

  // Tải dữ liệu ban đầu cho cả 2 tab (song song)
  await loadProductsToSelect();
  await Promise.all([fetchWarehouseLogs(1), fetchTransferRequests(1)]);
}

function switchWarehouseTab(tabName) {
  const logsSection = document.getElementById("warehouseLogsSection");
  const transfersSection = document.getElementById("warehouseTransfersSection");
  const tabBtnLogs = document.getElementById("tabBtnLogs");
  const tabBtnTransfers = document.getElementById("tabBtnTransfers");

  const isTransfers = tabName === "transfers";
  if (logsSection) logsSection.classList.toggle("d-none", isTransfers);
  if (transfersSection) transfersSection.classList.toggle("d-none", !isTransfers);
  if (tabBtnLogs) tabBtnLogs.classList.toggle("active", !isTransfers);
  if (tabBtnTransfers) tabBtnTransfers.classList.toggle("active", isTransfers);

  if (isTransfers) {
    fetchTransferRequests(currentTransferPage);
  }
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
        totalRecords,
      } = response.data;

      currentPage = resPage;
      totalPages = resTotalPages;
      currentTableData = data || [];

      const searchVal =
        document.getElementById("searchWarehouse")?.value.trim().toLowerCase() ||
        "";
      const displayData = currentTableData.filter((item) => {
        return (
          !searchVal ||
          (item.magd && item.magd.toLowerCase().includes(searchVal)) ||
          (item.tensp && item.tensp.toLowerCase().includes(searchVal)) ||
          (item.masp && item.masp.toLowerCase().includes(searchVal))
        );
      });

      renderTable(displayData);
      renderPagination(totalRecords || null);
    }
  } catch (error) {
    console.error("Lỗi lấy dữ liệu kho:", error);
    if (tbody) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        tbody.innerHTML = `
          <tr><td colspan="8" class="text-center text-warning py-4">
            <i class="fa-solid fa-lock me-2"></i> Phiên đăng nhập hết hạn hoặc chưa đăng nhập. Vui lòng đăng nhập lại.
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

// 2. Render danh sách lịch sử kho ra bảng HTML
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
          <td class="fw-bold text-secondary align-middle">${escapeHtml(item.magd)}</td>
          <td class="align-middle">
            <div class="fw-semibold text-dark">${escapeHtml(item.tensp || "---")}</div>
            <small class="text-muted">Mã: ${escapeHtml(item.masp)}</small>
          </td>
          <td class="align-middle"><span class="badge ${badgeClass}" style="white-space: nowrap;">${badgeText}</span></td>
          <td class="text-center fw-bold align-middle ${isNhap ? "text-success" : "text-danger"}">${prefix}${item.soluong}</td>
          <td class="text-center text-muted align-middle">${escapeHtml(item.donvitinh || "Cái")}</td>
          <td class="text-center text-muted align-middle">${item.tontruoc}</td>
          <td class="text-center fw-bold text-dark align-middle">${item.tonsau}</td>
          <td class="align-middle text-muted">${item.ngaygd ? new Date(item.ngaygd).toLocaleString("vi-VN") : "---"}</td>
        </tr>
      `;
    })
    .join("");
}

// 3. Render thanh phân trang cho Tab 1
function renderPagination(totalRecords = null) {
  const paginationContainer = document.getElementById(
    "warehousePaginationContainer",
  );
  renderAdminPagination(paginationContainer, {
    currentPage,
    totalPages,
    totalItems: totalRecords,
    pageSize: 10,
    onPageChange: (targetPage) => fetchWarehouseLogs(targetPage),
  });
}

// 4. Reset bộ lọc Tab 1
function resetFilters() {
  const searchInput = document.getElementById("searchWarehouse");
  if (searchInput) searchInput.value = "";
  const filterLoai = document.getElementById("filterLoaiGD");
  if (filterLoai) filterLoai.value = "";
  const filterKho = document.getElementById("filterKho");
  if (filterKho) filterKho.value = "KHO_TONG";
  fetchWarehouseLogs(1);
}

// 5. Lấy danh sách sản phẩm đổ vào các thẻ Select trong 2 Modal
async function loadProductsToSelect() {
  const select = document.getElementById("selectProduct");
  const transferSelect = document.getElementById("transferSelectProduct");
  if (!select && !transferSelect) return;

  try {
    const headers = getAuthHeaders();
    const response = await axios.get(`${BASE_URL}/products?limit=200`, {
      headers,
    });
    let products = [];

    if (response.data && Array.isArray(response.data.products)) {
      products = response.data.products;
    } else if (response.data && Array.isArray(response.data.data)) {
      products = response.data.data;
    } else if (Array.isArray(response.data)) {
      products = response.data;
    }

    const optionsHtml =
      products.length === 0
        ? `<option value="">-- Không có sản phẩm nào --</option>`
        : products
            .map((p) => {
              const maSP = p.masp || p.MaSP;
              const tenSP = p.tensp || p.TenSP;
              const ton = p.soluongton !== undefined ? p.soluongton : 0;
              return `<option value="${escapeHtml(maSP)}">${escapeHtml(tenSP)} [${escapeHtml(maSP)}] (Tổng tồn: ${ton})</option>`;
            })
            .join("");

    if (select) select.innerHTML = optionsHtml;
    if (transferSelect) transferSelect.innerHTML = optionsHtml;
  } catch (err) {
    console.error("Không tải được sản phẩm vào ô chọn:", err);
    const errOpt = `<option value="">-- Lỗi tải danh sách sản phẩm --</option>`;
    if (select) select.innerHTML = errOpt;
    if (transferSelect) transferSelect.innerHTML = errOpt;
  }
}

// 6. Xử lý gửi Form tạo giao dịch kho lẻ (Nhập / Xuất 1 kho)
async function handleCreateTransaction(e) {
  e.preventDefault();

  const makho = document.getElementById("selectKho")?.value || "KHO_TONG";
  const maSP = document.getElementById("selectProduct")?.value;
  const loaiGDElement = document.querySelector(
    'input[name="radioLoaiGD"]:checked',
  );
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
      toastSuccess("Thành công!", response.data.message);
      document.getElementById("formWarehouseTransaction")?.reset();

      const modalEl = document.getElementById("modalTransaction");
      if (modalEl) {
        const bs = window.bootstrap || bootstrap;
        const modal = bs.Modal.getInstance(modalEl);
        if (modal) modal.hide();
      }

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

// =========================================================================
// CHỨC NĂNG YÊU CẦU CHUYỂN KHO & ĐIỀU CHUYỂN HÀNG LIÊN KHO
// =========================================================================

function openTransferModal(mode = "request") {
  const modalEl = document.getElementById("modalWarehouseTransfer");
  if (!modalEl) return;

  const modeInput = document.getElementById("transferMode");
  const titleEl = document.getElementById("transferModalTitle");
  const subtitleEl = document.getElementById("transferModalSubtitle");
  const submitBtn = document.getElementById("btnSubmitWarehouseTransfer");

  if (modeInput) modeInput.value = mode;

  if (mode === "direct") {
    if (titleEl) titleEl.textContent = "Điều chuyển hàng liên kho trực tiếp";
    if (subtitleEl) {
      subtitleEl.textContent =
        "Hệ thống sẽ trừ tồn Kho nguồn và cộng tồn Kho đích ngay lập tức";
    }
    if (submitBtn) {
      submitBtn.className = "btn btn-info text-white fw-semibold";
      submitBtn.innerHTML =
        '<i class="fa-solid fa-right-left me-1"></i> Xác nhận điều chuyển ngay';
    }
  } else {
    if (titleEl) titleEl.textContent = "Lập yêu cầu chuyển kho";
    if (subtitleEl) {
      subtitleEl.textContent =
        "Phiếu sẽ ở trạng thái Chờ duyệt và gửi lên Quản lý phê duyệt";
    }
    if (submitBtn) {
      submitBtn.className = "btn btn-warning text-dark fw-semibold";
      submitBtn.innerHTML =
        '<i class="fa-solid fa-paper-plane me-1"></i> Gửi yêu cầu chuyển kho';
    }
  }

  const bs = window.bootstrap || bootstrap;
  const modal = bs.Modal.getOrCreateInstance(modalEl);
  modal.show();

  refreshSourceStockHint();
}

async function refreshSourceStockHint() {
  const stockValEl = document.getElementById("transferSourceStockValue");
  const maSP = document.getElementById("transferSelectProduct")?.value;
  const makho = document.getElementById("transferKhoNguon")?.value || "KHO_TONG";
  if (!stockValEl || !maSP) return;

  stockValEl.textContent = "Đang kiểm tra...";
  try {
    const res = await axios.get(
      `${BASE_URL}/warehouse/stock?maSP=${encodeURIComponent(maSP)}&makho=${encodeURIComponent(makho)}`,
      { headers: getAuthHeaders() },
    );
    const ton = Number(res.data?.soluongton ?? 0);
    stockValEl.textContent = `${ton} sản phẩm`;
    stockValEl.className = ton > 0 ? "text-success fw-bold" : "text-danger fw-bold";
  } catch {
    stockValEl.textContent = "Không tra cứu được";
    stockValEl.className = "text-muted";
  }
}

async function handleSubmitTransfer(e) {
  e.preventDefault();

  const mode = document.getElementById("transferMode")?.value || "request";
  const khoNguon = document.getElementById("transferKhoNguon")?.value;
  const khoDich = document.getElementById("transferKhoDich")?.value;
  const maSP = document.getElementById("transferSelectProduct")?.value;
  const soLuong = parseInt(
    document.getElementById("transferSoLuong")?.value.trim() || "",
    10,
  );
  const lyDo = document.getElementById("transferLyDo")?.value.trim() || "";

  if (!maSP) {
    Swal.fire("Thông báo", "Vui lòng chọn sản phẩm cần chuyển!", "warning");
    return;
  }
  if (!khoNguon || !khoDich || khoNguon === khoDich) {
    Swal.fire(
      "Lỗi chọn kho",
      "Kho nguồn và Kho đích không được trùng nhau!",
      "warning",
    );
    return;
  }
  if (isNaN(soLuong) || soLuong <= 0 || soLuong > 100000) {
    Swal.fire(
      "Lỗi số lượng",
      "Số lượng chuyển kho phải là số nguyên từ 1 đến 100.000!",
      "warning",
    );
    return;
  }

  const endpoint =
    mode === "direct"
      ? `${BASE_URL}/warehouse/transfers/direct`
      : `${BASE_URL}/warehouse/transfers/request`;

  try {
    const res = await axios.post(
      endpoint,
      { maSP, khoNguon, khoDich, soLuong, lyDo },
      { headers: getAuthHeaders() },
    );

    if (res.data?.success) {
      toastSuccess("Thành công!", res.data.message, 2600);
      document.getElementById("formWarehouseTransfer")?.reset();

      const modalEl = document.getElementById("modalWarehouseTransfer");
      if (modalEl) {
        const bs = window.bootstrap || bootstrap;
        bs.Modal.getInstance(modalEl)?.hide();
      }

      // Chuyển sang Tab Yêu cầu & Điều chuyển để người dùng thấy ngay phiếu vừa tạo
      switchWarehouseTab("transfers");
      await Promise.all([
        fetchTransferRequests(1),
        mode === "direct" ? fetchWarehouseLogs(1) : Promise.resolve(),
      ]);
    }
  } catch (error) {
    console.error("Lỗi tạo phiếu chuyển kho:", error);
    Swal.fire(
      "Thất bại",
      error.response?.data?.message || "Không thể xử lý yêu cầu chuyển kho!",
      "error",
    );
  }
}

async function fetchTransferRequests(page = 1) {
  const tbody = document.getElementById("transferDataBody");
  const pendingBadge = document.getElementById("pendingTransferBadge");

  try {
    const status = document.getElementById("filterTransferStatus")?.value || "";
    const search = document.getElementById("searchTransfer")?.value.trim() || "";

    let url = `${BASE_URL}/warehouse/transfers?page=${page}`;
    if (status) url += `&status=${encodeURIComponent(status)}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;

    const res = await axios.get(url, { headers: getAuthHeaders() });
    if (res.data?.success) {
      currentTransferPage = res.data.currentPage || 1;
      totalTransferPages = res.data.totalPages || 1;
      const pendingCount = Number(res.data.pendingCount || 0);

      if (pendingBadge) {
        pendingBadge.textContent = String(pendingCount);
        pendingBadge.classList.toggle("d-none", pendingCount <= 0);
      }

      renderTransferTable(res.data.data || []);
      renderAdminPagination(
        document.getElementById("transferPaginationContainer"),
        {
          currentPage: currentTransferPage,
          totalPages: totalTransferPages,
          totalItems: res.data.totalRecords || 0,
          pageSize: 10,
          onPageChange: (targetPage) => fetchTransferRequests(targetPage),
        },
      );
    }
  } catch (error) {
    console.error("Lỗi tải danh sách phiếu chuyển kho:", error);
    if (tbody) {
      tbody.innerHTML = `
        <tr><td colspan="8" class="text-center text-danger py-4">
          <i class="fa-solid fa-triangle-exclamation me-2"></i> ${escapeHtml(error.response?.data?.message || "Không thể tải danh sách phiếu chuyển kho.")}
        </td></tr>
      `;
    }
  }
}

function renderTransferTable(rows) {
  const tbody = document.getElementById("transferDataBody");
  if (!tbody) return;

  if (!rows || rows.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center py-5 text-muted">
          Chưa có phiếu yêu cầu hoặc điều chuyển kho nào phù hợp.
        </td>
      </tr>
    `;
    return;
  }

  const canApprove = isManagerOrAdminUser();

  tbody.innerHTML = rows
    .map((item) => {
      let statusBadge = "";
      if (item.trangthai === "CHO_DUYET") {
        statusBadge =
          '<span class="badge rounded-pill bg-warning-subtle text-dark border border-warning px-3 py-1"><i class="fa-regular fa-clock me-1"></i>Chờ duyệt</span>';
      } else if (item.trangthai === "DA_DUYET") {
        statusBadge =
          '<span class="badge rounded-pill bg-success-subtle text-success border border-success px-3 py-1"><i class="fa-solid fa-circle-check me-1"></i>Đã duyệt</span>';
      } else {
        statusBadge =
          '<span class="badge rounded-pill bg-danger-subtle text-danger border border-danger px-3 py-1"><i class="fa-solid fa-ban me-1"></i>Từ chối</span>';
      }

      const createdTime = item.ngaytao
        ? new Date(item.ngaytao).toLocaleString("vi-VN")
        : "---";
      const approvedTime = item.ngayduyet
        ? new Date(item.ngayduyet).toLocaleString("vi-VN")
        : "";

      let actionHtml = '<span class="text-muted small">—</span>';
      if (item.trangthai === "CHO_DUYET") {
        if (canApprove) {
          actionHtml = `
            <div class="d-inline-flex gap-1">
              <button type="button" class="btn btn-sm btn-success fw-semibold px-2 py-1 text-nowrap btn-approve-transfer" data-id="${escapeHtml(item.mayeucau)}" title="Duyệt và chuyển tồn kho ngay">
                <i class="fa-solid fa-check me-1"></i>Duyệt
              </button>
              <button type="button" class="btn btn-sm btn-outline-danger px-2 py-1 text-nowrap btn-reject-transfer" data-id="${escapeHtml(item.mayeucau)}" title="Từ chối yêu cầu">
                <i class="fa-solid fa-xmark me-1"></i>Từ chối
              </button>
            </div>
          `;
        } else {
          actionHtml =
            '<span class="badge bg-light text-secondary border">Đang chờ Quản lý</span>';
        }
      }

      return `
        <tr>
          <td class="align-middle">
            <div class="fw-bold text-primary">${escapeHtml(item.mayeucau)}</div>
            <small class="text-muted">${createdTime}</small>
          </td>
          <td class="align-middle">
            <div class="fw-semibold text-dark">${escapeHtml(item.tensp || "---")}</div>
            <small class="text-muted">Mã: ${escapeHtml(item.masp)}</small>
          </td>
          <td class="align-middle">
            <div class="d-flex align-items-center gap-1 flex-wrap small">
              <span class="badge bg-light text-dark border">${escapeHtml(getWarehouseLabel(item.khonguon))}</span>
              <i class="fa-solid fa-arrow-right text-primary"></i>
              <span class="badge bg-primary-subtle text-primary border border-primary-subtle">${escapeHtml(getWarehouseLabel(item.khodich))}</span>
            </div>
          </td>
          <td class="text-center align-middle fw-bold text-dark">
            ${item.soluong} <small class="text-muted fw-normal">${escapeHtml(item.donvitinh || "Cái")}</small>
          </td>
          <td class="align-middle">
            <div class="fw-semibold small">${escapeHtml(item.tennguoitao || item.nguoitao || "---")}</div>
            <div class="small text-muted">${escapeHtml(item.lydo || "Không có ghi chú")}</div>
          </td>
          <td class="text-center align-middle">${statusBadge}</td>
          <td class="align-middle small">
            ${
              item.tennguoiduyet
                ? `<div class="fw-semibold">${escapeHtml(item.tennguoiduyet)}</div>
                   <div class="text-muted">${escapeHtml(item.ghichuduyet || "")}</div>
                   <div class="text-muted" style="font-size:11px;">${approvedTime}</div>`
                : '<span class="text-muted">Chưa xử lý</span>'
            }
          </td>
          <td class="text-center align-middle">${actionHtml}</td>
        </tr>
      `;
    })
    .join("");
}

async function handleApproveTransfer(maYeuCau) {
  const confirm = await Swal.fire({
    title: `Duyệt phiếu ${maYeuCau}?`,
    text: "Hệ thống sẽ tự động trừ tồn ở Kho nguồn, cộng tồn ở Kho đích và ghi sổ lịch sử cho cả 2 kho.",
    icon: "question",
    input: "text",
    inputPlaceholder: "Ghi chú duyệt (không bắt buộc)...",
    showCancelButton: true,
    confirmButtonColor: "#198754",
    confirmButtonText: "Xác nhận duyệt & chuyển kho",
    cancelButtonText: "Hủy",
  });

  if (!confirm.isConfirmed) return;

  try {
    const res = await axios.put(
      `${BASE_URL}/warehouse/transfers/${encodeURIComponent(maYeuCau)}/approve`,
      { ghiChuDuyet: confirm.value || "" },
      { headers: getAuthHeaders() },
    );

    if (res.data?.success) {
      toastSuccess("Đã duyệt phiếu!", res.data.message, 2600);
      await Promise.all([
        fetchTransferRequests(currentTransferPage),
        fetchWarehouseLogs(1),
      ]);
    }
  } catch (error) {
    Swal.fire(
      "Không thể duyệt",
      error.response?.data?.message || "Duyệt phiếu chuyển kho thất bại!",
      "error",
    );
  }
}

async function handleRejectTransfer(maYeuCau) {
  const confirm = await Swal.fire({
    title: `Từ chối phiếu ${maYeuCau}?`,
    input: "textarea",
    inputLabel: "Lý do từ chối",
    inputPlaceholder: "Nhập lý do để nhân viên nắm thông tin...",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#dc3545",
    confirmButtonText: "Xác nhận từ chối",
    cancelButtonText: "Hủy",
  });

  if (!confirm.isConfirmed) return;

  try {
    const res = await axios.put(
      `${BASE_URL}/warehouse/transfers/${encodeURIComponent(maYeuCau)}/reject`,
      { ghiChuDuyet: confirm.value || "Quản lý từ chối yêu cầu" },
      { headers: getAuthHeaders() },
    );

    if (res.data?.success) {
      toastInfo("Đã từ chối phiếu", res.data.message, 2600);
      await fetchTransferRequests(currentTransferPage);
    }
  } catch (error) {
    Swal.fire(
      "Lỗi",
      error.response?.data?.message || "Từ chối phiếu thất bại!",
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
