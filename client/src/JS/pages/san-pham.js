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
                            <img src="${sp.hinhanh ? sp.hinhanh : "/img/default.jpg"}" style="width: 100%; height: 100%; object-fit: cover;">
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

  // --- QUẢN LÝ 5 Ô ẢNH GÓC CHỤP PHỤ CỐ ĐỊNH (Mặt sau, Cạnh viền, Cụm Camera, Hộp & PK, Góc khác) ---
  const ANGLE_SLOTS = [
    { key: "back", label: "Mặt sau", thutu: 1, icon: "fa-mobile-screen-button" },
    { key: "side", label: "Cạnh viền", thutu: 2, icon: "fa-sliders" },
    { key: "camera", label: "Cụm Camera", thutu: 3, icon: "fa-camera" },
    { key: "box", label: "Hộp & PK", thutu: 4, icon: "fa-box-open" },
    { key: "other", label: "Góc khác", thutu: 5, icon: "fa-image" },
  ];

  // State cho mỗi ô: { existing: { maanh, duongdan } | null, file: File | null, previewUrl: string | null }
  const createEmptySlotState = () =>
    ANGLE_SLOTS.reduce((acc, s) => {
      acc[s.key] = { existing: null, file: null, previewUrl: null };
      return acc;
    }, {});

  let addSlots = createEmptySlotState();
  let editSlots = createEmptySlotState();
  let editDeletedIds = [];

  const revokeSlotUrls = (slotsObj) => {
    Object.values(slotsObj).forEach((st) => {
      if (st?.previewUrl) URL.revokeObjectURL(st.previewUrl);
    });
  };

  const countFilledSlots = (slotsObj) =>
    ANGLE_SLOTS.filter((s) => slotsObj[s.key]?.file || slotsObj[s.key]?.existing).length;

  const renderAngleSlots = (mode) => {
    const isEdit = mode === "edit";
    const slotsObj = isEdit ? editSlots : addSlots;
    const container = document.getElementById(
      isEdit ? "editAngleSlotsGrid" : "addAngleSlotsGrid",
    );
    const badge = document.getElementById(
      isEdit ? "editExtraCountBadge" : "addExtraCountBadge",
    );
    if (badge) {
      badge.innerText = `${countFilledSlots(slotsObj)}/${ANGLE_SLOTS.length} góc chụp`;
    }
    if (!container) return;

    container.innerHTML = ANGLE_SLOTS.map((slot) => {
      const st = slotsObj[slot.key];
      const imgSrc = st.previewUrl || st.existing?.duongdan || "";
      const hasImg = Boolean(imgSrc);
      const inputId = `${mode}SlotFile_${slot.key}`;

      return `
        <div class="col">
          <div class="border rounded-3 p-2 bg-white h-100 d-flex flex-column align-items-center text-center position-relative shadow-sm">
            ${
              hasImg
                ? `<button type="button" class="btn btn-danger btn-sm p-0 position-absolute top-0 end-0 m-1 rounded-circle btn-clear-slot" data-mode="${mode}" data-key="${slot.key}" title="Gỡ ảnh ${slot.label}" style="width: 20px; height: 20px; line-height: 1; font-size: 11px; z-index: 2;">&times;</button>`
                : ""
            }
            <div class="fw-bold text-dark mb-1" style="font-size: 11.5px;">${slot.label}</div>
            <label for="${inputId}" class="w-100 rounded-2 border d-flex flex-column align-items-center justify-content-center bg-light overflow-hidden mb-1" style="height: 82px; cursor: pointer; border-style: ${hasImg ? "solid" : "dashed"} !important;">
              ${
                hasImg
                  ? `<img src="${imgSrc}" alt="${slot.label}" style="width: 100%; height: 100%; object-fit: cover;" />`
                  : `<i class="fa-solid ${slot.icon} text-secondary mb-1" style="font-size: 18px; opacity: 0.6;"></i><span class="text-muted" style="font-size: 10.5px;">+ Chọn ảnh</span>`
              }
            </label>
            <input type="file" id="${inputId}" class="d-none slot-file-input" data-mode="${mode}" data-key="${slot.key}" accept="image/*" />
            <label for="${inputId}" class="btn btn-outline-secondary btn-sm py-0 px-2 w-100" style="font-size: 10.5px; cursor: pointer;">
              ${hasImg ? "Đổi ảnh" : "Tải lên"}
            </label>
          </div>
        </div>`;
    }).join("");

    container.querySelectorAll(".slot-file-input").forEach((input) => {
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) return;
        const key = input.getAttribute("data-key");
        const st = slotsObj[key];
        if (st.previewUrl) URL.revokeObjectURL(st.previewUrl);
        // Nếu đang ở chế độ Sửa và ô này đã có ảnh cũ trong DB → đánh dấu xóa ảnh cũ để thay bằng ảnh mới
        if (isEdit && st.existing?.maanh) {
          if (!editDeletedIds.includes(st.existing.maanh)) {
            editDeletedIds.push(st.existing.maanh);
          }
          st.existing = null;
        }
        st.file = file;
        st.previewUrl = URL.createObjectURL(file);
        renderAngleSlots(mode);
      };
    });

    container.querySelectorAll(".btn-clear-slot").forEach((btn) => {
      btn.onclick = () => {
        const key = btn.getAttribute("data-key");
        const st = slotsObj[key];
        if (st.previewUrl) URL.revokeObjectURL(st.previewUrl);
        if (isEdit && st.existing?.maanh) {
          if (!editDeletedIds.includes(st.existing.maanh)) {
            editDeletedIds.push(st.existing.maanh);
          }
        }
        slotsObj[key] = { existing: null, file: null, previewUrl: null };
        renderAngleSlots(mode);
      };
    });
  };

  // Ánh xạ danh sách ảnh phụ từ DB vào đúng 5 ô góc chụp
  const populateEditSlotsFromImages = (images) => {
    revokeSlotUrls(editSlots);
    editSlots = createEmptySlotState();
    editDeletedIds = [];

    const extraImgs = Array.isArray(images)
      ? images.filter((img) => !img.la_anh_chinh)
      : [];

    const unmatched = [];
    extraImgs.forEach((img) => {
      const code = String(img.loaigoc || "").toLowerCase();
      const labelLower = String(img.nhan || "").toLowerCase();
      let matchedSlot = ANGLE_SLOTS.find(
        (s) =>
          s.key === code ||
          s.label.toLowerCase() === labelLower ||
          (s.key === "back" && labelLower.includes("sau")) ||
          (s.key === "side" && (labelLower.includes("cạnh") || labelLower.includes("viền"))) ||
          (s.key === "camera" && labelLower.includes("camera")) ||
          (s.key === "box" && (labelLower.includes("hộp") || labelLower.includes("phụ kiện") || labelLower.includes("pk"))),
      );
      if (matchedSlot && !editSlots[matchedSlot.key].existing) {
        editSlots[matchedSlot.key].existing = img;
      } else {
        unmatched.push(img);
      }
    });

    // Ảnh phụ cũ không khớp tên sẽ tự điền vào các ô còn trống
    unmatched.forEach((img) => {
      const emptySlot = ANGLE_SLOTS.find((s) => !editSlots[s.key].existing);
      if (emptySlot) {
        editSlots[emptySlot.key].existing = img;
      }
    });

    renderAngleSlots("edit");
  };

  const appendSlotsToFormData = (formData, slotsObj) => {
    const metaList = [];
    ANGLE_SLOTS.forEach((slot) => {
      const st = slotsObj[slot.key];
      if (st?.file) {
        formData.append("HinhAnhPhu", st.file);
        metaList.push({
          nhan: slot.label,
          loaigoc: slot.key,
          thutu: slot.thutu,
        });
      }
    });
    if (metaList.length > 0) {
      formData.append("HinhAnhPhuMeta", JSON.stringify(metaList));
    }
  };

  // Mở modal thêm sản phẩm
  if (btnAddProduct) {
    btnAddProduct.onclick = () => {
      if (addForm) addForm.reset();
      revokeSlotUrls(addSlots);
      addSlots = createEmptySlotState();
      renderAngleSlots("add");
      const defaultImg = document.getElementById("addImgPreview");
      if (defaultImg) defaultImg.src = "/img/default.jpg";
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
      appendSlotsToFormData(formData, addSlots);

      try {
        await axios.post(`${BASE_URL}/products/add`, formData);
        if (addModal) addModal.hide();
        revokeSlotUrls(addSlots);
        addSlots = createEmptySlotState();
        renderAngleSlots("add");
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
              : "/img/default.jpg";

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
              : "/img/default.jpg";

            const editFileMain = document.getElementById("editFileHinhAnh");
            if (editFileMain) editFileMain.value = "";
            populateEditSlotsFromImages(sp.images);

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

      appendSlotsToFormData(formData, editSlots);

      try {
        await axios.put(`${BASE_URL}/products/update/${maSP}`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        if (editModal) editModal.hide();
        revokeSlotUrls(editSlots);
        editSlots = createEmptySlotState();
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
