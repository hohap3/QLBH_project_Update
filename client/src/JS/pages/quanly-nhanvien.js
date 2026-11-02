import axios from "axios";
import Swal from "sweetalert2";
import { Modal } from "bootstrap";
import { BASE_URL } from "/src/JS/common/header";

let employeeModal;
let roleModal;
let currentEditId = null;
let currentPage = 1;
const limitPerPage = 10;

function getAuthHeaders() {
  const token = localStorage.getItem("token");
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
}

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch (e) {
    return {};
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initEmployeeManager();
});

export async function initEmployeeManager() {
  const tableBody = document.getElementById("employeeTableBody");
  const employeeForm = document.getElementById("employeeForm");
  const modalEl = document.getElementById("employeeModal");
  const modalTitle = document.getElementById("modalTitle");
  const btnAddEmployee = document.getElementById("btnAddEmployee");
  const searchInput = document.getElementById("searchEmployee");
  const filterStatus = document.getElementById("filterStatus");
  const totalCount = document.getElementById("totalEmployees");
  const usernameWrapper = document.getElementById("usernameWrapper");
  const passwordWrapper = document.getElementById("passwordWrapper");

  // Modal phân quyền
  const roleModalEl = document.getElementById("roleModal");
  const roleForm = document.getElementById("roleForm");
  const newRoleSelect = document.getElementById("newRoleSelect");
  const roleBranchWrapper = document.getElementById("roleBranchWrapper");

  let paginationContainer = document.getElementById("employeePagination");
  if (!paginationContainer) {
    paginationContainer = document.createElement("nav");
    paginationContainer.id = "employeePagination";
    paginationContainer.className = "d-flex justify-content-center mt-3";
    tableBody.closest(".table-responsive")?.after(paginationContainer);
  }

  if (modalEl) employeeModal = new Modal(modalEl);
  if (roleModalEl) roleModal = new Modal(roleModalEl);

  const currentUser = getCurrentUser();
  const isSuperAdmin = (currentUser.role || "").toUpperCase() === "ADMIN";

  // Thay đổi giao diện modal phân quyền khi chọn vai trò
  if (newRoleSelect && roleBranchWrapper) {
    newRoleSelect.onchange = () => {
      const selected = newRoleSelect.value;
      if (selected === "ADMIN") {
        roleBranchWrapper.style.display = "none";
      } else {
        roleBranchWrapper.style.display = "block";
      }
    };
  }

  // 1. Tải danh sách nhân sự từ Backend
  const loadEmployees = async () => {
    try {
      const searchVal = searchInput ? searchInput.value.trim() : "";
      const statusVal = filterStatus ? filterStatus.value : "";

      const res = await axios.get(`${BASE_URL}/employees`, {
        params: {
          page: currentPage,
          limit: limitPerPage,
          search: searchVal,
          status: statusVal,
        },
        ...getAuthHeaders(),
      });

      if (res.data.success) {
        renderTable(res.data.data);

        const paginationInfo = res.data.pagination || {};
        if (totalCount) {
          totalCount.innerText = paginationInfo.totalItems || res.data.data.length;
        }

        renderPagination(
          paginationInfo.totalPages || 1,
          paginationInfo.currentPage || 1
        );
      }
    } catch (err) {
      console.error("Lỗi lấy danh sách nhân viên:", err);
      tableBody.innerHTML = `<tr><td colspan="8" class="text-center text-danger py-4">Không thể kết nối API danh sách nhân viên</td></tr>`;
    }
  };

  // 2. Render bảng danh sách nhân sự
  const renderTable = (data) => {
    if (!data || data.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-muted">Chưa có nhân viên nào trong hệ thống</td></tr>`;
      return;
    }

    tableBody.innerHTML = data
      .map((nv) => {
        const roleUpper = (nv.mavaitro || "").toUpperCase();
        let roleBadge = `<span class="badge bg-secondary-subtle text-secondary border border-secondary px-2 py-1"><i class="fa-solid fa-user me-1"></i> Nhân viên</span>`;
        if (roleUpper === "ADMIN") {
          roleBadge = `<span class="badge bg-danger-subtle text-danger border border-danger px-2 py-1"><i class="fa-solid fa-crown me-1"></i> Quản trị viên</span>`;
        } else if (roleUpper === "MANAGER") {
          roleBadge = `<span class="badge bg-primary-subtle text-primary border border-primary px-2 py-1"><i class="fa-solid fa-user-tie me-1"></i> Quản lý CN</span>`;
        }

        const branchText = nv.tenchinhanh || "Toàn hệ thống (Hội sở)";

        return `
          <tr>
            <td class="ps-4"><strong>${nv.mand.slice(0, 8)}...</strong></td>
            <td><span class="badge bg-light text-dark border">${nv.tendangnhap}</span></td>
            <td><div class="fw-bold text-dark">${nv.hoten || "<i>Chưa cập nhật</i>"}</div></td>
            <td>${roleBadge}</td>
            <td><span class="badge bg-light text-secondary border">${branchText}</span></td>
            <td>
              <div class="small"><i class="fa-solid fa-phone me-1 text-muted"></i> ${nv.sdt || "N/A"}</div>
              <div class="small text-muted"><i class="fa-solid fa-envelope me-1"></i> ${nv.email || "N/A"}</div>
            </td>
            <td>
              ${
                nv.trangthai === "HOAT_DONG" || nv.trangthai === true || nv.trangthai === "1"
                  ? `<span class="badge rounded-pill bg-success-subtle text-success border border-success px-2 py-1">
                      <i class="fa-solid fa-circle-check me-1"></i> Hoạt động
                    </span>`
                  : `<span class="badge rounded-pill bg-danger-subtle text-danger border border-danger px-2 py-1">
                      <i class="fa-solid fa-circle-xmark me-1"></i> Đang khóa
                    </span>`
              }
            </td>
            <td class="text-end pe-4">
              <div class="d-flex justify-content-end gap-1 flex-wrap">
                ${
                  isSuperAdmin
                    ? `<button class="btn btn-sm btn-outline-info btn-role" 
                        data-id="${nv.mand}" 
                        data-name="${nv.hoten || nv.tendangnhap}" 
                        data-role="${nv.mavaitro}" 
                        data-branch="${nv.machinhanh || 'CN_CHINH'}"
                        title="Ủy quyền Admin / Phân bổ Chi nhánh">
                        <i class="fa-solid fa-shield-halved"></i> Phân quyền
                      </button>`
                    : ""
                }
                <button class="btn btn-sm btn-outline-primary btn-edit" data-id="${nv.mand}" title="Sửa thông tin">
                  <i class="fa-regular fa-pen-to-square"></i> Sửa
                </button>
                <button class="btn btn-sm ${
                  nv.trangthai === "HOAT_DONG" || nv.trangthai === true
                    ? "btn-outline-warning"
                    : "btn-outline-success"
                } btn-toggle-status" data-id="${nv.mand}" data-status="${nv.trangthai}">
                  <i class="fa-solid ${
                    nv.trangthai === "HOAT_DONG" || nv.trangthai === true
                      ? "fa-user-lock"
                      : "fa-user-check"
                  }"></i>
                </button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");
  };

  // Phân trang
  const renderPagination = (totalPages, activePage) => {
    if (totalPages <= 1) {
      paginationContainer.innerHTML = "";
      return;
    }

    let html = `<ul class="pagination pagination-sm m-0">`;
    html += `
      <li class="page-item ${activePage === 1 ? "disabled" : ""}">
        <a class="page-link" href="#" data-page="${activePage - 1}"><i class="fa-solid fa-angle-left"></i></a>
      </li>
    `;

    for (let i = 1; i <= totalPages; i++) {
      html += `
        <li class="page-item ${activePage === i ? "active" : ""}">
          <a class="page-link" href="#" data-page="${i}">${i}</a>
        </li>
      `;
    }

    html += `
      <li class="page-item ${activePage === totalPages ? "disabled" : ""}">
        <a class="page-link" href="#" data-page="${activePage + 1}"><i class="fa-solid fa-angle-right"></i></a>
      </li>
    `;
    html += `</ul>`;
    paginationContainer.innerHTML = html;

    paginationContainer.querySelectorAll(".page-link").forEach((link) => {
      link.onclick = (e) => {
        e.preventDefault();
        const targetPage = parseInt(link.getAttribute("data-page"), 10);
        if (targetPage && targetPage !== activePage && targetPage >= 1 && targetPage <= totalPages) {
          currentPage = targetPage;
          loadEmployees();
        }
      };
    });
  };

  // Reset form thêm/sửa
  const resetForm = () => {
    employeeForm.reset();
    currentEditId = null;
    modalTitle.innerText = "Thêm Nhân Viên Mới";
    if (usernameWrapper) usernameWrapper.style.display = "block";
    if (passwordWrapper) passwordWrapper.style.display = "block";
    document.getElementById("tenDangNhap").required = true;
  };

  if (btnAddEmployee) {
    btnAddEmployee.onclick = () => {
      resetForm();
      employeeModal.show();
    };
  }

  const handleFilter = () => {
    currentPage = 1;
    loadEmployees();
  };

  if (searchInput) {
    let typingTimer;
    searchInput.oninput = () => {
      clearTimeout(typingTimer);
      typingTimer = setTimeout(handleFilter, 400);
    };
  }
  if (filterStatus) filterStatus.onchange = handleFilter;

  // Submit form thêm/sửa nhân viên
  employeeForm.onsubmit = async (e) => {
    e.preventDefault();

    const inputHoTen = document.getElementById("hoTen");
    const inputSdt = document.getElementById("sdt");
    const inputEmail = document.getElementById("email");
    const inputTenDangNhap = document.getElementById("tenDangNhap");
    const inputMatKhau = document.getElementById("matKhau");
    const selectChiNhanh = document.getElementById("maChiNhanh");

    const hoTen = inputHoTen.value.trim();
    const sdt = inputSdt.value.trim();
    const email = inputEmail.value.trim();
    const chiNhanh = selectChiNhanh ? selectChiNhanh.value : "CN_CHINH";

    if (!currentEditId) {
      const tenDangNhap = inputTenDangNhap.value.trim();
      const matKhau = inputMatKhau ? inputMatKhau.value.trim() : "123456";

      if (!tenDangNhap || !hoTen || !sdt || !email) {
        Swal.fire("Cảnh báo", "Vui lòng nhập đầy đủ các trường bắt buộc!", "warning");
        return;
      }

      try {
        await axios.post(
          `${BASE_URL}/employees`,
          {
            TenDangNhap: tenDangNhap,
            MatKhau: matKhau || "123456",
            HoTen: hoTen,
            SDT: sdt,
            Email: email,
            MaChiNhanh: chiNhanh,
          },
          getAuthHeaders()
        );
        Swal.fire("Thành công", "Đã thêm mới tài khoản nhân sự thành công!", "success");
        employeeModal.hide();
        currentPage = 1;
        loadEmployees();
      } catch (err) {
        Swal.fire("Thất bại", err.response?.data?.message || "Lỗi tạo tài khoản", "error");
      }
    } else {
      if (!hoTen || !sdt || !email) {
        Swal.fire("Cảnh báo", "Họ tên, SĐT và Email không được để trống!", "warning");
        return;
      }

      try {
        await axios.put(
          `${BASE_URL}/employees/${currentEditId}`,
          { HoTen: hoTen, SDT: sdt, Email: email, MaChiNhanh: chiNhanh },
          getAuthHeaders()
        );
        Swal.fire("Thành công", "Đã cập nhật thông tin nhân viên", "success");
        employeeModal.hide();
        loadEmployees();
      } catch (err) {
        Swal.fire("Thất bại", err.response?.data?.message || "Lỗi cập nhật", "error");
      }
    }
  };

  // Submit form Phân Quyền (Chỉ Super Admin)
  if (roleForm) {
    roleForm.onsubmit = async (e) => {
      e.preventDefault();
      const targetId = document.getElementById("roleUserId").value;
      const newRole = document.getElementById("newRoleSelect").value;
      const newBranch = document.getElementById("newBranchSelect").value;

      try {
        const res = await axios.put(
          `${BASE_URL}/employees/${targetId}/role`,
          { newRole, newBranch },
          getAuthHeaders()
        );
        Swal.fire("Thành công", res.data.message || "Đã phân quyền thành công!", "success");
        roleModal.hide();
        loadEmployees();
      } catch (err) {
        Swal.fire("Từ chối", err.response?.data?.message || "Lỗi phân quyền", "error");
      }
    };
  }

  // Click sự kiện trên bảng (Sửa, Phân quyền, Khóa/Mở)
  tableBody.onclick = async (e) => {
    const btnRole = e.target.closest(".btn-role");
    const btnEdit = e.target.closest(".btn-edit");
    const btnToggle = e.target.closest(".btn-toggle-status");

    // Xử lý nút Phân quyền
    if (btnRole) {
      e.stopPropagation();
      const id = btnRole.getAttribute("data-id");
      const name = btnRole.getAttribute("data-name");
      const role = (btnRole.getAttribute("data-role") || "STAFF").toUpperCase();
      const branch = btnRole.getAttribute("data-branch") || "CN_CHINH";

      document.getElementById("roleUserId").value = id;
      document.getElementById("roleTargetName").innerText = `${name} (Mã: ${id.slice(0, 8)}...)`;
      document.getElementById("newRoleSelect").value = role;
      document.getElementById("newBranchSelect").value = branch;

      if (role === "ADMIN") {
        roleBranchWrapper.style.display = "none";
      } else {
        roleBranchWrapper.style.display = "block";
      }

      roleModal.show();
      return;
    }

    // Xử lý nút Chỉnh sửa
    if (btnEdit) {
      e.stopPropagation();
      const id = btnEdit.getAttribute("data-id");
      try {
        const res = await axios.get(`${BASE_URL}/employees/${id}`, getAuthHeaders());
        if (res.data.success) {
          const nv = res.data.data;
          currentEditId = nv.mand;

          modalTitle.innerText = `Chỉnh Sửa Nhân Viên: ${nv.mand.slice(0, 8)}...`;
          if (usernameWrapper) usernameWrapper.style.display = "none";
          if (passwordWrapper) passwordWrapper.style.display = "none";
          document.getElementById("tenDangNhap").required = false;

          document.getElementById("hoTen").value = nv.hoten || "";
          document.getElementById("sdt").value = nv.sdt || "";
          document.getElementById("email").value = nv.email || "";
          if (document.getElementById("maChiNhanh") && nv.machinhanh) {
            document.getElementById("maChiNhanh").value = nv.machinhanh;
          }

          employeeModal.show();
        }
      } catch (err) {
        Swal.fire("Lỗi", "Không thể lấy thông tin chi tiết nhân viên", "error");
      }
      return;
    }

    // Xử lý nút Khóa / Kích hoạt
    if (btnToggle) {
      e.stopPropagation();
      const id = btnToggle.getAttribute("data-id");
      const isCurrentActive =
        btnToggle.getAttribute("data-status") === "HOAT_DONG" ||
        btnToggle.getAttribute("data-status") === "true" ||
        btnToggle.getAttribute("data-status") === "1";
      const targetStatus = !isCurrentActive;

      const confirmResult = await Swal.fire({
        title: isCurrentActive ? "Xác nhận khóa tài khoản?" : "Kích hoạt lại tài khoản?",
        text: isCurrentActive
          ? "Nhân viên bị khóa sẽ không thể đăng nhập vào hệ thống!"
          : "Nhân viên sẽ được khôi phục quyền thao tác!",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: targetStatus ? "#198754" : "#dc3545",
        confirmButtonText: isCurrentActive ? "Đồng ý khóa" : "Đồng ý mở lại",
        cancelButtonText: "Hủy bỏ",
      });

      if (confirmResult.isConfirmed) {
        try {
          await axios.patch(
            `${BASE_URL}/employees/${id}/toggle-status`,
            { TrangThai: targetStatus },
            getAuthHeaders()
          );
          Swal.fire(
            "Thành công!",
            targetStatus ? "Đã kích hoạt lại tài khoản." : "Đã khóa tài khoản thành công.",
            "success"
          );
          loadEmployees();
        } catch (err) {
          Swal.fire("Thất bại", err.response?.data?.message || "Không thể thực thi lệnh", "error");
        }
      }
    }
  };

  loadEmployees();
}
