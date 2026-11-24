import axios from "axios";
import Swal from "sweetalert2";
import { Modal } from "bootstrap";
import { BASE_URL } from "/src/JS/common/header";

let editModal;
let addModal;
let viewModal;

// Khai báo các biến trạng thái phân trang và tìm kiếm (State)
let currentPage = 1;
const limit = 10;
let currentSearch = "";

export async function initProductManager() {
  // 1. Khởi tạo Modals
  const editModalEl = document.getElementById("editProductModal");
  const addModalEl = document.getElementById("addProductModal");
  const viewModalEl = document.getElementById("viewProductModal");

  if (editModalEl) editModal = new Modal(editModalEl);
  if (addModalEl) addModal = new Modal(addModalEl);
  if (viewModalEl) viewModal = new Modal(viewModalEl);

  // DOM Elements
  const tableBody = document.getElementById("productTableBody");
  const totalCount = document.getElementById("totalProducts");
  const searchInput = document.getElementById("searchProduct");
  const btnAddProduct = document.getElementById("btnAddProduct");
  const paginationContainer = document.getElementById("paginationContainer");

  // Excel Elements
  const btnImportExcel = document.getElementById("btnImportExcel");
  const excelFileInput = document.getElementById("excelFileInput");

  // Forms
  const editForm = document.getElementById("editProductForm");
  const addForm = document.getElementById("addProductForm");

  // --- CÁC HÀM BỔ TRỢ (HELPER FUNCTIONS) ---

  // Ràng buộc dữ liệu đầu vào (Validate Frontend)
  const validateProductData = (tenSP, giaNhap, giaBan) => {
    const trimmedTen = tenSP ? tenSP.trim() : "";

    if (!trimmedTen) {
      Swal.fire(
        "Lỗi nhập liệu",
        "Tên sản phẩm không được để trống!",
        "warning",
      );
      return false;
    }

    if (!trimmedTen.includes(" ")) {
      Swal.fire(
        "Lỗi nhập liệu",
        "Tên sản phẩm phải có đầy đủ các từ và cách nhau bằng dấu cách (Ví dụ: Áo sơ mi, Điện thoại...).",
        "warning",
      );
      return false;
    }

    const numGiaNhap = Number(giaNhap);
    if (isNaN(numGiaNhap) || numGiaNhap < 10000) {
      Swal.fire(
        "Lỗi nhập liệu",
        "Giá nhập sản phẩm phải từ 10.000đ trở lên!",
        "warning",
      );
      return false;
    }

    const numGiaBan = Number(giaBan);
    if (isNaN(numGiaBan) || numGiaBan < 10000) {
      Swal.fire(
        "Lỗi nhập liệu",
        "Giá bán sản phẩm phải từ 10.000đ trở lên!",
        "warning",
      );
      return false;
    }

    if (numGiaBan <= numGiaNhap) {
      Swal.fire(
        "Lỗi chiến lược giá",
        "Giá bán bắt buộc phải lớn hơn giá nhập để đảm bảo lợi nhuận!",
        "warning",
      );
      return false;
    }

    return true;
  };

  // Tải danh mục và nhà cung cấp vào các Select Box
  const loadDropdowns = async () => {
    try {
      const [resDM, resNCC] = await Promise.all([
        axios.get(`${BASE_URL}/categories`),
        axios.get(`${BASE_URL}/suppliers/active/list`),
      ]);

      // --- KIỂM TRA VÀ TRÍCH XUẤT ĐÚNG MẢNG DANH MỤC ---
      let categoriesData = [];
      if (Array.isArray(resDM.data)) {
        categoriesData = resDM.data;
      } else if (resDM.data && Array.isArray(resDM.data.data)) {
        categoriesData = resDM.data.data; // Trường hợp backend bọc trong object { data: [...] }
      } else if (resDM.data && Array.isArray(resDM.data.categories)) {
        categoriesData = resDM.data.categories; // Trường hợp backend trả về { categories: [...] }
      } else {
        console.error("Dữ liệu danh mục trả về không phải mảng:", resDM.data);
      }

      // --- KIỂM TRA VÀ TRÍCH XUẤT ĐÚNG MẢNG NHÀ CUNG CẤP ---
      let suppliersData = [];
      if (Array.isArray(resNCC.data)) {
        suppliersData = resNCC.data;
      } else if (resNCC.data && Array.isArray(resNCC.data.data)) {
        suppliersData = resNCC.data.data;
      } else if (resNCC.data && Array.isArray(resNCC.data.suppliers)) {
        suppliersData = resNCC.data.suppliers;
      } else {
        console.error(
          "Dữ liệu nhà cung cấp trả về không phải mảng:",
          resNCC.data,
        );
      }

      // Render Options cho Danh Mục
      const dmOptions =
        '<option value="" disabled selected>-- Chọn danh mục --</option>' +
        categoriesData
          .map(
            (dm) => `<option value="${dm.madanhmuc}">${dm.tendanhmuc}</option>`,
          )
          .join("");

      // Render Options cho Nhà Cung Cấp
      const nccOptions =
        '<option value="" disabled selected>Chọn nhà cung cấp</option>' +
        suppliersData
          .map((ncc) => `<option value="${ncc.mancc}">${ncc.tenncc}</option>`)
          .join("");

      // Điền dữ liệu vào DOM một cách an toàn
      const editMaDMEl = document.getElementById("editMaDanhMuc");
      const addMaDMEl = document.getElementById("addMaDanhMuc");
      const editMaNCCEl = document.getElementById("editMaNCC");
      const addMaNCCEl = document.getElementById("addMaNCC");

      if (editMaDMEl) editMaDMEl.innerHTML = dmOptions;
      if (addMaDMEl) addMaDMEl.innerHTML = dmOptions;
      if (editMaNCCEl) editMaNCCEl.innerHTML = nccOptions;
      if (addMaNCCEl) addMaNCCEl.innerHTML = nccOptions;
    } catch (err) {
      console.error("Lỗi tải dữ liệu danh mục/NCC:", err);
    }
  };

  // Hàm xử lý Preview ảnh
  const setupImagePreview = (fileInputId, imgPreviewId) => {
    const fileInput = document.getElementById(fileInputId);
    const imgPreview = document.getElementById(imgPreviewId);
    if (fileInput && imgPreview) {
      fileInput.onchange = () => {
        const [file] = fileInput.files;
        if (file) {
          imgPreview.src = URL.createObjectURL(file);
        }
      };
    }
  };

  // Render bảng sản phẩm
  const renderProducts = (products) => {
    if (!tableBody) return;
    if (!products || products.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">Không tìm thấy sản phẩm nào phù hợp.</td></tr>`;
      return;
    }

    tableBody.innerHTML = products
      .map((sp) => {
        const isOutOfStock = sp.soluongton <= 0;
        const themeClass = !isOutOfStock ? "success" : "danger";
        const statusText = !isOutOfStock ? "Còn hàng" : "Hết hàng";

        return `
            <tr>
                <td>
                    <div class="d-flex align-items-center">
                        <div class="rounded-3 me-3 d-flex align-items-center justify-content-center bg-light" 
                             style="width: 45px; height: 45px; overflow: hidden; border: 1px solid #eee;">
                            <img src="${sp.hinhanh ? sp.hinhanh : "/assets/images/default-product.png"}" style="width: 100%; height: 100%; object-fit: cover;">
                        </div>
                        <div>
                            <div class="fw-bold mb-0">${sp.tensp}</div>
                            <div class="text-muted small">ID: #${sp.masp}</div>
                        </div>
                    </div>
                </td>
                <td class="text-muted">${sp.tendanhmuc || "Chưa phân loại"}</td>
                <td class="fw-bold">${new Intl.NumberFormat("vi-VN").format(sp.giaban)}đ</td>
                <td><span class="fw-bold text-${themeClass}">${sp.soluongton} sp</span></td>
                <td>
                    <span class="badge bg-${themeClass}-subtle text-${themeClass} px-3 py-2" style="border-radius: 8px;">
                        ${statusText}
                    </span>
                </td>
                <td class="text-end text-nowrap">
                    <button class="btn btn-link text-primary p-1 mx-1 btn-view" data-id="${sp.masp}"><i class="fa-regular fa-eye"></i></button>
                    <button class="btn btn-link text-success p-1 mx-1 btn-edit" data-id="${sp.masp}"><i class="fa-regular fa-pen-to-square"></i></button>
                    <button class="btn btn-link text-danger p-1 mx-1 btn-delete" data-id="${sp.masp}"><i class="fa-regular fa-trash-can"></i></button>
                </td>
            </tr>`;
      })
      .join("");
  };

  // 🔥 SỬA ĐỔI 1: Tối ưu Render thanh phân trang & Ngăn lỗi click lặp lại
  const renderPagination = (totalPages, pageCurrent) => {
    if (!paginationContainer) return;
    if (totalPages <= 1) {
      paginationContainer.innerHTML = "";
      return;
    }

    let html = "";

    // 1. NÚT BACK
    html += `
      <li class="page-item ${pageCurrent === 1 ? "disabled" : ""}">
        <button class="page-link" data-page="${pageCurrent - 1}" ${pageCurrent === 1 ? "disabled" : ""} aria-label="Previous">
          <span aria-hidden="true">&laquo;</span>
        </button>
      </li>
    `;

    const delta = 1;
    const range = [];

    for (let i = 1; i <= totalPages; i++) {
      if (
        i === 1 ||
        i === totalPages ||
        (i >= pageCurrent - delta && i <= pageCurrent + delta)
      ) {
        range.push(i);
      }
    }

    let l;
    for (let i of range) {
      if (l) {
        if (i - l === 2) {
          html += `
            <li class="page-item">
              <button class="page-link" data-page="${l + 1}">${l + 1}</button>
            </li>
          `;
        } else if (i - l > 2) {
          html += `
            <li class="page-item disabled">
              <span class="page-link bg-light text-muted">...</span>
            </li>
          `;
        }
      }

      html += `
        <li class="page-item ${i === pageCurrent ? "active" : ""}">
          <button class="page-link ${i === pageCurrent ? "fw-bold shadow-sm" : ""}" data-page="${i}">${i}</button>
        </li>
      `;
      l = i;
    }

    // 2. NÚT NEXT
    html += `
      <li class="page-item ${pageCurrent === totalPages ? "disabled" : ""}">
        <button class="page-link" data-page="${pageCurrent + 1}" ${pageCurrent === totalPages ? "disabled" : ""} aria-label="Next">
          <span aria-hidden="true">&raquo;</span>
        </button>
      </li>
    `;

    paginationContainer.innerHTML = html;
  };

  // 🔥 SỬA ĐỔI 2: Sử dụng Ủy quyền sự kiện (Event Delegation) cho phân trang độc lập, tránh xung đột click
  if (paginationContainer) {
    paginationContainer.onclick = (e) => {
      const button = e.target.closest(".page-link");
      if (!button || button.parentElement.classList.contains("disabled"))
        return;

      const targetPage = parseInt(button.getAttribute("data-page"));
      if (targetPage && targetPage !== currentPage) {
        currentPage = targetPage;
        loadData(); // Gọi hàm tải trang mới

        if (tableBody) {
          tableBody.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      }
    };
  }

  // Hàm tải dữ liệu từ Server API
  const loadData = async () => {
    try {
      const res = await axios.get(`${BASE_URL}/products`, {
        params: {
          page: currentPage,
          limit: limit,
          search: currentSearch,
        },
      });

      // Bóc tách cấu trúc từ backend trả về
      const { products, totalItems, totalPages } = res.data;

      renderProducts(products);
      renderPagination(totalPages, currentPage);
      if (totalCount) totalCount.innerText = totalItems;
    } catch (err) {
      console.error("Lỗi tải danh sách sản phẩm:", err);
    }
  };

  // --- LẮNG NGHE SỰ KIỆN HỆ THỐNG ---

  // Xử lý tìm kiếm Real-time bằng Debounce
  if (searchInput) {
    let searchTimeout;
    searchInput.oninput = (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        currentSearch = e.target.value;
        currentPage = 1; // Reset về trang 1 khi gõ tìm kiếm mới
        loadData();
      }, 400);
    };
  }

  // Xử lý sự kiện Import Excel
  if (btnImportExcel && excelFileInput) {
    btnImportExcel.onclick = () => {
      excelFileInput.click();
    };

    excelFileInput.onchange = async () => {
      const file = excelFileInput.files[0];
      if (!file) return;

      const fileExtension = file.name.split(".").pop().toLowerCase();
      if (fileExtension !== "xlsx" && fileExtension !== "xls") {
        Swal.fire(
          "Định dạng không hợp lệ",
          "Vui lòng chọn tệp tin có đuôi định dạng .xlsx hoặc .xls",
          "error",
        );
        excelFileInput.value = "";
        return;
      }

      const formData = new FormData();
      formData.append("excelFile", file);

      try {
        Swal.fire({
          title: "Đang xử lý dữ liệu...",
          text: "Hệ thống đang phân tích dữ liệu từ Excel, vui lòng đợi.",
          allowOutsideClick: false,
          didOpen: () => {
            Swal.showLoading();
          },
        });

        const response = await axios.post(
          `${BASE_URL}/products/import-excel`,
          formData,
          {
            headers: { "Content-Type": "multipart/form-data" },
          },
        );

        Swal.close();
        Swal.fire({
          icon: "success",
          title: "Thành công!",
          text: response.data.message || `Đã nhập thành công dữ liệu sản phẩm!`,
          confirmButtonColor: "#198754",
        });

        loadData();
      } catch (err) {
        Swal.close();
        console.error("Lỗi Import file:", err);
        const errMsg =
          err.response?.data?.message ||
          "Không thể phân tích hoặc lưu dữ liệu từ file Excel.";
        Swal.fire("Lỗi đồng bộ", errMsg, "error");
      } finally {
        excelFileInput.value = "";
      }
    };
  }

  // --- QUẢN LÝ ẢNH GÓC CHỤP PHỤ (TỐI ĐA 5 ẢNH / SẢN PHẨM) ---
  const MAX_EXTRA_IMAGES = 5;
  const DEFAULT_ANGLE_LABELS = [
    "Mặt sau",
    "Cạnh viền",
    "Cụm Camera",
    "Hộp & PK",
    "Góc khác",
  ];

  let addExtraItems = []; // [{ file, label, previewUrl }]
  let editExistingImages = []; // [{ maanh, duongdan, nhan }]
  let editDeletedIds = []; // [maanh, ...]
  let editNewExtraItems = []; // [{ file, label, previewUrl }]

  const updateExtraBadges = () => {
    const addBadge = document.getElementById("addExtraCountBadge");
    if (addBadge) {
      addBadge.innerText = `${addExtraItems.length}/${MAX_EXTRA_IMAGES} ảnh phụ`;
    }
    const editBadge = document.getElementById("editExtraCountBadge");
    if (editBadge) {
      const totalEdit = editExistingImages.length + editNewExtraItems.length;
      editBadge.innerText = `${totalEdit}/${MAX_EXTRA_IMAGES} ảnh phụ`;
    }
  };

  const renderAddExtraGallery = () => {
    const container = document.getElementById("addExtraGalleryPreview");
    if (!container) return;
    container.innerHTML = addExtraItems
      .map(
        (item, idx) => `
        <div class="border rounded-3 p-1 bg-light position-relative" style="width: 108px;">
          <button type="button" class="btn btn-danger btn-sm p-0 position-absolute top-0 end-0 rounded-circle btn-remove-add-extra" data-idx="${idx}" style="width: 20px; height: 20px; line-height: 1; font-size: 11px;">&times;</button>
          <img src="${item.previewUrl}" class="rounded mb-1" style="width: 100%; height: 64px; object-fit: cover;" />
          <input type="text" class="form-control form-control-sm py-0 px-1 add-extra-label" data-idx="${idx}" value="${item.label.replace(/"/g, "&quot;")}" style="font-size: 11px; height: 24px;" placeholder="Nhãn góc..." />
        </div>`,
      )
      .join("");

    container.querySelectorAll(".btn-remove-add-extra").forEach((btn) => {
      btn.onclick = () => {
        const i = parseInt(btn.getAttribute("data-idx"), 10);
        if (addExtraItems[i]?.previewUrl) URL.revokeObjectURL(addExtraItems[i].previewUrl);
        addExtraItems.splice(i, 1);
        renderAddExtraGallery();
      };
    });

    container.querySelectorAll(".add-extra-label").forEach((input) => {
      input.oninput = () => {
        const i = parseInt(input.getAttribute("data-idx"), 10);
        if (addExtraItems[i]) addExtraItems[i].label = input.value;
      };
    });

    updateExtraBadges();
  };

  const renderEditGalleries = () => {
    const existingEl = document.getElementById("editExistingGallery");
    if (existingEl) {
      existingEl.innerHTML = editExistingImages
        .map(
          (img) => `
          <div class="border rounded-3 p-1 bg-white position-relative shadow-sm" style="width: 108px;">
            <button type="button" class="btn btn-danger btn-sm p-0 position-absolute top-0 end-0 rounded-circle btn-remove-existing-img" data-id="${img.maanh}" title="Xóa ảnh này" style="width: 20px; height: 20px; line-height: 1; font-size: 11px;">&times;</button>
            <img src="${img.duongdan}" class="rounded mb-1" style="width: 100%; height: 64px; object-fit: cover;" />
            <div class="text-truncate text-center text-muted fw-semibold" style="font-size: 11px;" title="${img.nhan || ""}">${img.nhan || "Ảnh phụ"}</div>
          </div>`,
        )
        .join("");

      existingEl.querySelectorAll(".btn-remove-existing-img").forEach((btn) => {
        btn.onclick = () => {
          const imgId = parseInt(btn.getAttribute("data-id"), 10);
          editExistingImages = editExistingImages.filter((x) => x.maanh !== imgId);
          if (!editDeletedIds.includes(imgId)) editDeletedIds.push(imgId);
          renderEditGalleries();
        };
      });
    }

    const newEl = document.getElementById("editNewGalleryPreview");
    if (newEl) {
      newEl.innerHTML = editNewExtraItems
        .map(
          (item, idx) => `
          <div class="border border-primary-subtle rounded-3 p-1 bg-light position-relative" style="width: 108px;">
            <button type="button" class="btn btn-danger btn-sm p-0 position-absolute top-0 end-0 rounded-circle btn-remove-edit-new" data-idx="${idx}" style="width: 20px; height: 20px; line-height: 1; font-size: 11px;">&times;</button>
            <img src="${item.previewUrl}" class="rounded mb-1" style="width: 100%; height: 64px; object-fit: cover;" />
            <input type="text" class="form-control form-control-sm py-0 px-1 edit-new-label" data-idx="${idx}" value="${item.label.replace(/"/g, "&quot;")}" style="font-size: 11px; height: 24px;" placeholder="Nhãn góc..." />
          </div>`,
        )
        .join("");

      newEl.querySelectorAll(".btn-remove-edit-new").forEach((btn) => {
        btn.onclick = () => {
          const i = parseInt(btn.getAttribute("data-idx"), 10);
          if (editNewExtraItems[i]?.previewUrl) URL.revokeObjectURL(editNewExtraItems[i].previewUrl);
          editNewExtraItems.splice(i, 1);
          renderEditGalleries();
        };
      });

      newEl.querySelectorAll(".edit-new-label").forEach((input) => {
        input.oninput = () => {
          const i = parseInt(input.getAttribute("data-idx"), 10);
          if (editNewExtraItems[i]) editNewExtraItems[i].label = input.value;
        };
      });
    }

    updateExtraBadges();
  };

  const addExtraInput = document.getElementById("addExtraFilesInput");
  if (addExtraInput) {
    addExtraInput.onchange = () => {
      const files = Array.from(addExtraInput.files || []);
      const remaining = MAX_EXTRA_IMAGES - addExtraItems.length;
      if (files.length > remaining) {
        Swal.fire(
          "Giới hạn 5 ảnh phụ",
          `Bạn chỉ có thể thêm tối đa ${remaining} ảnh góc chụp phụ nữa.`,
          "info",
        );
      }
      files.slice(0, Math.max(0, remaining)).forEach((file) => {
        const idx = addExtraItems.length;
        addExtraItems.push({
          file,
          label: DEFAULT_ANGLE_LABELS[idx] || `Góc chụp ${idx + 1}`,
          previewUrl: URL.createObjectURL(file),
        });
      });
      addExtraInput.value = "";
      renderAddExtraGallery();
    };
  }

  const editExtraInput = document.getElementById("editExtraFilesInput");
  if (editExtraInput) {
    editExtraInput.onchange = () => {
      const files = Array.from(editExtraInput.files || []);
      const currentTotal = editExistingImages.length + editNewExtraItems.length;
      const remaining = MAX_EXTRA_IMAGES - currentTotal;
      if (files.length > remaining) {
        Swal.fire(
          "Giới hạn 5 ảnh phụ",
          remaining <= 0
            ? "Sản phẩm đã đủ 5 ảnh phụ. Hãy xóa bớt ảnh cũ trước khi thêm ảnh mới."
            : `Bạn chỉ có thể thêm tối đa ${remaining} ảnh góc chụp phụ nữa.`,
          "info",
        );
      }
      files.slice(0, Math.max(0, remaining)).forEach((file) => {
        const idx = editExistingImages.length + editNewExtraItems.length;
        editNewExtraItems.push({
          file,
          label: DEFAULT_ANGLE_LABELS[idx] || `Góc chụp ${idx + 1}`,
          previewUrl: URL.createObjectURL(file),
        });
      });
      editExtraInput.value = "";
      renderEditGalleries();
    };
  }

  // Mở modal thêm sản phẩm
  if (btnAddProduct) {
    btnAddProduct.onclick = () => {
      if (addForm) addForm.reset();
      addExtraItems.forEach((it) => it.previewUrl && URL.revokeObjectURL(it.previewUrl));
      addExtraItems = [];
      renderAddExtraGallery();
      const defaultImg = document.getElementById("addImgPreview");
      if (defaultImg) defaultImg.src = "/assets/images/default-product.png";
      if (addModal) addModal.show();
    };
  }

  // Xử lý Thêm mới
  if (addForm) {
    addForm.onsubmit = async (e) => {
      e.preventDefault();

      const tenSP = document.getElementById("addTenSP").value;
      const giaNhap = document.getElementById("addGiaNhap").value;
      const giaBan = document.getElementById("addGiaBan").value;

      if (!validateProductData(tenSP, giaNhap, giaBan)) return;

      const formData = new FormData(addForm);
      if (addExtraItems.length > 0) {
        const labels = [];
        addExtraItems.forEach((item) => {
          formData.append("HinhAnhPhu", item.file);
          labels.push(item.label.trim());
        });
        formData.append("HinhAnhPhuLabels", JSON.stringify(labels));
      }

      try {
        await axios.post(`${BASE_URL}/products/add`, formData);
        if (addModal) addModal.hide();
        addExtraItems.forEach((it) => it.previewUrl && URL.revokeObjectURL(it.previewUrl));
        addExtraItems = [];
        renderAddExtraGallery();
        Swal.fire("Thành công", "Đã thêm sản phẩm mới", "success");
        loadData();
      } catch (err) {
        Swal.fire(
          "Lỗi",
          err.response?.data?.message || "Không thể thêm sản phẩm",
          "error",
        );
      }
    };
  }

  // Xử lý Sửa, Xóa & Xem chi tiết dữ liệu
  if (tableBody) {
    tableBody.addEventListener("click", async (e) => {
      const target = e.target.closest("button");
      if (!target) return;
      const id = target.getAttribute("data-id");

      // 1. XEM CHI TIẾT
      if (target.classList.contains("btn-view")) {
        try {
          const res = await axios.get(`${BASE_URL}/products/${id}`);
          const sp = res.data;
          if (sp) {
            document.getElementById("viewMaSP").innerText = sp.masp;
            document.getElementById("viewTenSP").innerText = sp.tensp;
            document.getElementById("viewDanhMuc").innerText =
              sp.tendanhmuc || "Chưa phân loại";
            document.getElementById("viewNhaCungCap").innerText =
              sp.tenncc || "Chưa xác định";
            document.getElementById("viewGiaNhap").innerText =
              new Intl.NumberFormat("vi-VN").format(sp.gianhap) + "đ";
            document.getElementById("viewGiaBan").innerText =
              new Intl.NumberFormat("vi-VN").format(sp.giaban) + "đ";
            document.getElementById("viewSoLuongTon").innerText =
              sp.soluongton + " sản phẩm";
            document.getElementById("viewDonViTinh").innerText =
              sp.donvitinh || "Chưa thiết lập";
            document.getElementById("viewMoTa").innerText =
              sp.mota || "(Không có mô tả sản phẩm)";
            document.getElementById("viewImagePreview").src = sp.hinhanh
              ? sp.hinhanh
              : "/assets/images/default-product.png";

            const viewThumbs = document.getElementById("viewGalleryThumbs");
            if (viewThumbs) {
              const imgs = Array.isArray(sp.images) ? sp.images : [];
              viewThumbs.innerHTML = imgs
                .map(
                  (img, idx) => `
                  <button type="button" class="btn p-0 border ${idx === 0 ? "border-primary" : ""} rounded-2 overflow-hidden bg-light" style="width: 52px; height: 52px;" title="${img.nhan || ""}" onclick="document.getElementById('viewImagePreview').src='${img.duongdan}'">
                    <img src="${img.duongdan}" style="width: 100%; height: 100%; object-fit: cover;" />
                  </button>`,
                )
                .join("");
            }

            if (viewModal) viewModal.show();
          }
        } catch (err) {
          console.error("Lỗi lấy dữ liệu chi tiết:", err);
          Swal.fire(
            "Lỗi",
            "Không thể lấy thông tin chi tiết sản phẩm",
            "error",
          );
        }
      }

      // 2. XÓA SẢN PHẨM
      if (target.classList.contains("btn-delete")) {
        const result = await Swal.fire({
          title: "Xác nhận xóa?",
          text: "Dữ liệu sẽ không thể khôi phục!",
          icon: "warning",
          showCancelButton: true,
          confirmButtonColor: "#dc3545",
          cancelButtonColor: "#6c757d",
          confirmButtonText: "Xóa ngay",
          cancelButtonText: "Hủy",
        });

        if (result.isConfirmed) {
          try {
            await axios.delete(`${BASE_URL}/products/delete/${id}`);
            Swal.fire(
              "Đã xóa!",
              "Sản phẩm đã được gỡ khỏi hệ thống.",
              "success",
            );
            loadData();
          } catch (err) {
            console.error("Lỗi khi xóa:", err);
            const errorMessage =
              err.response?.data?.message ||
              "Không thể thực hiện lệnh xóa sản phẩm này.";
            Swal.fire("Không thể xóa!", errorMessage, "error");
          }
        }
      }

      // 3. ĐỔ DỮ LIỆU SỬA
      if (target.classList.contains("btn-edit")) {
        try {
          const res = await axios.get(`${BASE_URL}/products/${id}`);
          const sp = res.data;
          if (sp) {
            document.getElementById("editMaSP").value = sp.masp;
            document.getElementById("editMaNCC").value = sp.mancc;
            document.getElementById("editTenSP").value = sp.tensp;
            document.getElementById("editGiaNhap").value = sp.gianhap;
            document.getElementById("editGiaBan").value = sp.giaban;
            document.getElementById("editSoLuongTon").value = sp.soluongton;
            document.getElementById("editMoTa").value = sp.mota || "";
            document.getElementById("editDonViTinh").value = sp.donvitinh || "";
            document.getElementById("editMaDanhMuc").value = sp.madanhmuc;
            document.getElementById("editHinhAnhCu").value = sp.hinhanh || "";
            document.getElementById("editImagePreview").src = sp.hinhanh
              ? sp.hinhanh
              : "/assets/images/default-product.png";

            const editFileMain = document.getElementById("editFileHinhAnh");
            if (editFileMain) editFileMain.value = "";
            editNewExtraItems.forEach((it) => it.previewUrl && URL.revokeObjectURL(it.previewUrl));
            editNewExtraItems = [];
            editDeletedIds = [];
            editExistingImages = Array.isArray(sp.images)
              ? sp.images.filter((img) => !img.la_anh_chinh)
              : [];
            renderEditGalleries();

            if (editModal) editModal.show();
          }
        } catch (err) {
          Swal.fire("Lỗi", "Lỗi lấy dữ liệu chi tiết", "error");
        }
      }
    });
  }

  // Xử lý Cập nhật
  if (editForm) {
    editForm.onsubmit = async (e) => {
      e.preventDefault();
      const maSP = document.getElementById("editMaSP").value;
      const formData = new FormData();

      formData.append("TenSP", document.getElementById("editTenSP").value);
      formData.append("GiaNhap", document.getElementById("editGiaNhap").value);
      formData.append("GiaBan", document.getElementById("editGiaBan").value);
      formData.append(
        "SoLuongTon",
        document.getElementById("editSoLuongTon").value,
      );
      formData.append("MoTa", document.getElementById("editMoTa").value);
      formData.append(
        "DonViTinh",
        document.getElementById("editDonViTinh").value,
      );
      formData.append(
        "MaDanhMuc",
        document.getElementById("editMaDanhMuc").value,
      );
      formData.append("MaNCC", document.getElementById("editMaNCC").value);

      const fileInput = document.getElementById("editFileHinhAnh");
      if (fileInput && fileInput.files[0]) {
        formData.append("HinhAnh", fileInput.files[0]);
      } else {
        formData.append(
          "HinhAnhCu",
          document.getElementById("editHinhAnhCu").value,
        );
      }

      if (editDeletedIds.length > 0) {
        formData.append("DeletedImageIds", JSON.stringify(editDeletedIds));
      }

      if (editNewExtraItems.length > 0) {
        const labels = [];
        editNewExtraItems.forEach((item) => {
          formData.append("HinhAnhPhu", item.file);
          labels.push(item.label.trim());
        });
        formData.append("HinhAnhPhuLabels", JSON.stringify(labels));
      }

      try {
        await axios.put(`${BASE_URL}/products/update/${maSP}`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        if (editModal) editModal.hide();
        editNewExtraItems.forEach((it) => it.previewUrl && URL.revokeObjectURL(it.previewUrl));
        editNewExtraItems = [];
        editDeletedIds = [];
        Swal.fire("Thành công", "Đã cập nhật sản phẩm thành công!", "success");
        loadData();
      } catch (err) {
        console.error("Lỗi cập nhật frontend:", err);
        Swal.fire(
          "Lỗi",
          err.response?.data?.message || "Không thể cập nhật",
          "error",
        );
      }
    };
  }

  // --- KHỞI CHẠY LẦN ĐẦU THEO THỨ TỰ AN TOÀN ---
  setupImagePreview("editFileHinhAnh", "editImagePreview");
  setupImagePreview("addFileHinhAnh", "addImgPreview");

  // Gọi bất đồng bộ song song để tăng tốc độ load trang
  await Promise.all([loadDropdowns(), loadData()]);
}
