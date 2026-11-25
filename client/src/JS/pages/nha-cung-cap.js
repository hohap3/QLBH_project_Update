import axios from "axios";
import Swal from "sweetalert2";
import { Modal } from "bootstrap";
import { BASE_URL } from "/src/JS/common/header";
import { renderAdminPagination } from "/src/JS/common/pagination";

let supplierModal;

export async function initSupplierManager() {
  // --- DOM Elements ---
  const tableBody = document.getElementById("supplierTableBody");
  const supplierForm = document.getElementById("supplierForm");
  const modalEl = document.getElementById("supplierModal");
  const modalTitle = document.getElementById("modalTitle");
  const btnAddSupplier = document.getElementById("btnAddSupplier");
  const searchInput = document.getElementById("searchSupplier");
  const filterStatus = document.getElementById("filterStatus");
  const totalCount = document.getElementById("totalSuppliers");
  const paginationContainer = document.getElementById("supplierPaginationContainer");

  let allSuppliers = [];
  let filteredSuppliers = [];
  let currentPage = 1;
  const LIMIT = 8;

  // Khởi tạo Bootstrap Modal
  if (modalEl) supplierModal = new Modal(modalEl);

  // --- Helper Functions ---

  const renderPaginatedSuppliers = () => {
    const totalItems = filteredSuppliers.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / LIMIT));
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIdx = (currentPage - 1) * LIMIT;
    const pageData = filteredSuppliers.slice(startIdx, startIdx + LIMIT);

    renderTable(pageData);
    renderAdminPagination(paginationContainer, {
      currentPage,
      totalPages,
      totalItems,
      pageSize: LIMIT,
      onPageChange: (targetPage) => {
        currentPage = targetPage;
        renderPaginatedSuppliers();
      },
    });
  };

  // 1. Tải danh sách nhà cung cấp
  const loadSuppliers = async () => {
    try {
      const res = await axios.get(`${BASE_URL}/suppliers`);
      allSuppliers = Array.isArray(res.data) ? res.data : [];
      if (totalCount) totalCount.innerText = allSuppliers.length;
      handleFilter(false);
    } catch (err) {
      console.error("Lỗi tải nhà cung cấp:", err);
      Swal.fire("Lỗi", "Không thể kết nối đến máy chủ", "error");
    }
  };

  // 2. Render Table
  const renderTable = (data) => {
    if (!data || data.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="6" class="text-center py-5 text-muted">Không tìm thấy nhà cung cấp nào phù hợp</td></tr>`;
      return;
    }

    tableBody.innerHTML = data
      .map(
        (ncc) => `
            <tr>
                <td class="ps-4"><strong>${ncc.mancc}</strong></td>
                <td><span class="fw-bold text-primary">${ncc.tenncc}</span></td>
                <td>
                    <div class="small"><i class="fa-solid fa-phone me-1"></i> ${ncc.sdt || "N/A"}</div>
                    <div class="small text-muted"><i class="fa-solid fa-envelope me-1"></i> ${ncc.email || "N/A"}</div>
                </td>
                <td><small class="text-muted">${ncc.diachi || "<i>Chưa cập nhật</i>"}</small></td>
                <td>
                ${
                  ncc.trangthai
                    ? `<span class="badge rounded-pill bg-success-subtle text-success border border-success px-3 py-2" style="font-size:14px" >
                            <i class="fa-solid fa-circle-check me-1"></i> Đang hoạt động
                    </span>`
                    : `<span class="badge rounded-pill bg-danger-subtle text-danger border border-danger px-3 py-2" style="font-size:14px" >
                        <i class="fa-solid fa-circle-xmark me-1"></i> Ngừng hợp tác
                    </span>`
                }
            </td>
                <td class="text-end pe-4">
                    <div class="d-flex justify-content-end align-items-center" style="white-space: nowrap;">
                        <button class="btn btn-sm btn-outline-primary me-2 btn-edit" data-id="${ncc.mancc}">
                            <i class="fa-regular fa-pen-to-square"></i> Sửa
                        </button>
                        <button class="btn btn-sm btn-outline-danger btn-delete" data-id="${ncc.mancc}">
                            <i class="fa-regular fa-trash-can"></i> Xóa
                        </button>
                    </div>
                </td>
            </tr>
        `,
      )
      .join("");
  };

  // 3. Reset Form
  const resetForm = () => {
    supplierForm.reset();
    const maInput = document.getElementById("maNCC");
    const tenInput = document.getElementById("tenNCC");

    // Reset trạng thái lỗi
    [maInput, tenInput].forEach((el) => el.classList.remove("is-invalid"));

    maInput.readOnly = false;
    maInput.classList.remove("bg-light");
    document.getElementById("trangThai").checked = true; // Mặc định hoạt động
    modalTitle.innerText = "Thêm Nhà Cung Cấp Mới";
  };

  // --- Event Handlers ---

  // Mở Modal thêm mới
  if (btnAddSupplier) {
    btnAddSupplier.onclick = () => {
      resetForm();
      supplierModal.show();
    };
  }

  // Tìm kiếm & Lọc trạng thái
  const handleFilter = (resetPage = true) => {
    const searchVal = (searchInput?.value || "").toLowerCase().trim();
    const statusVal = filterStatus?.value || ""; // "" hoặc "1" hoặc "0"

    filteredSuppliers = allSuppliers.filter((ncc) => {
      const haystack = [
        ncc.mancc,
        ncc.tenncc,
        ncc.sdt,
        ncc.email,
        ncc.diachi,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const searchMatch = !searchVal || haystack.includes(searchVal);

      let statusMatch = true;
      if (statusVal === "1") {
        statusMatch = Boolean(ncc.trangthai);
      } else if (statusVal === "0") {
        statusMatch = !ncc.trangthai;
      }

      return searchMatch && statusMatch;
    });

    if (resetPage) currentPage = 1;
    renderPaginatedSuppliers();
  };

  if (searchInput) searchInput.oninput = () => handleFilter(true);
  if (filterStatus) filterStatus.onchange = () => handleFilter(true);

  // Xử lý Submit Form
  supplierForm.onsubmit = async (e) => {
    e.preventDefault();

    const maInput = document.getElementById("maNCC");
    const tenInput = document.getElementById("tenNCC");
    const sdt = document.getElementById("sdt").value.trim();
    const email = document.getElementById("email").value.trim();
    const diaChi = document.getElementById("diaChi").value.trim();
    const trangThai = document.getElementById("trangThai").checked;

    const isEdit = maInput.readOnly;
    let isValid = true;

    // Validation
    [maInput, tenInput].forEach((el) => el.classList.remove("is-invalid"));
    if (!tenInput.value.trim()) {
      tenInput.classList.add("is-invalid");
      isValid = false;
    }
    if (!isEdit && !maInput.value.trim()) {
      maInput.classList.add("is-invalid");
      isValid = false;
    }

    if (!isValid) return;

    const data = {
      MaNCC: maInput.value.trim(),
      TenNCC: tenInput.value.trim(),
      SDT: sdt || null,
      Email: email || null,
      DiaChi: diaChi || null,
      TrangThai: trangThai ? 1 : 0,
    };

    try {
      if (isEdit) {
        await axios.put(`${BASE_URL}/suppliers/update/${data.MaNCC}`, data);
        Swal.fire("Thành công", "Đã cập nhật nhà cung cấp", "success");
      } else {
        await axios.post(`${BASE_URL}/suppliers/add`, data);
        Swal.fire("Thành công", "Đã thêm nhà cung cấp mới", "success");
      }
      supplierModal.hide();
      loadSuppliers();
    } catch (err) {
      const errorMsg = err.response?.data?.message || "Lỗi xử lý dữ liệu";
      Swal.fire("Thất bại", errorMsg, "error");
    }
  };

  // Xử lý click Table (Sửa/Xóa)
  tableBody.onclick = async (e) => {
    const btnEdit = e.target.closest(".btn-edit");
    const btnDelete = e.target.closest(".btn-delete");

    if (btnDelete) {
      const id = btnDelete.getAttribute("data-id");
      const result = await Swal.fire({
        title: "Xác nhận xóa?",
        text: "Dữ liệu này sẽ không thể khôi phục!",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#d33",
        confirmButtonText: "Xác nhận xóa",
      });

      if (result.isConfirmed) {
        try {
          await axios.delete(`${BASE_URL}/suppliers/delete/${id}`);
          Swal.fire("Thành công", "Đã xóa nhà cung cấp", "success");
          loadSuppliers();
        } catch (err) {
          Swal.fire(
            "Lỗi",
            err.response?.data?.message || "Không thể xóa",
            "error",
          );
        }
      }
    }

    if (btnEdit) {
      const id = btnEdit.getAttribute("data-id");
      try {
        const res = await axios.get(`${BASE_URL}/suppliers/${id}`);
        const data = res.data;

        const maInput = document.getElementById("maNCC");
        maInput.value = data.mancc;
        maInput.readOnly = true;
        maInput.classList.add("bg-light");

        document.getElementById("tenNCC").value = data.tenncc;
        document.getElementById("sdt").value = data.sdt || "";
        document.getElementById("email").value = data.email || "";
        document.getElementById("diaChi").value = data.diachi || "";
        document.getElementById("trangThai").checked = data.trangthai;

        modalTitle.innerText = "Cập Nhật Nhà Cung Cấp";
        supplierModal.show();
      } catch (err) {
        Swal.fire("Lỗi", "Không thể lấy dữ liệu chi tiết", "error");
      }
    }
  };

  // Khởi tạo ban đầu
  loadSuppliers();
}
