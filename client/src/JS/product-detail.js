import Swal from "sweetalert2";
import { BASE_URL } from "/src/JS/common/header";

const DEFAULT_IMAGE = "/img/default.jpg";
let currentProductData = null;

// ─── 1. HÀM BỔ TRỢ: CHUẨN HÓA ĐƯỜNG DẪN ẢNH ───
function getProductImageUrl(hinhanh) {
  if (
    !hinhanh ||
    hinhanh === "NULL" ||
    hinhanh === "null" ||
    hinhanh.trim() === ""
  ) {
    return DEFAULT_IMAGE;
  }
  if (hinhanh.startsWith("http://") || hinhanh.startsWith("https://")) {
    return hinhanh;
  }
  const rootUrl = BASE_URL.replace("/api", "");
  return `${rootUrl}/uploads/products/${hinhanh}`;
}

// ─── 2. KHỞI TẠO KÍNH LÚP ZOOM GÓC CẠNH (MAGNIFIER LENS) ───
function initImageMagnifier(imgId, containerId, lensId, zoomRatio = 2.4) {
  const img = document.getElementById(imgId);
  const container = document.getElementById(containerId);
  const lens = document.getElementById(lensId);

  if (!img || !container || !lens) return;

  function updateZoom(e) {
    const rect = container.getBoundingClientRect();
    const lensRadius = lens.offsetWidth / 2;

    // Vị trí chuột so với khung ảnh
    const clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0].clientX);
    const clientY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0].clientY);

    if (clientX === undefined || clientY === undefined) return;

    let x = clientX - rect.left;
    let y = clientY - rect.top;

    // Giới hạn trong khung ảnh
    let lensX = Math.max(lensRadius, Math.min(x, rect.width - lensRadius));
    let lensY = Math.max(lensRadius, Math.min(y, rect.height - lensRadius));

    lens.style.left = `${lensX - lensRadius}px`;
    lens.style.top = `${lensY - lensRadius}px`;
    lens.style.display = "block";

    // Phóng to chi tiết ảnh
    lens.style.backgroundImage = `url('${img.src}')`;
    lens.style.backgroundSize = `${rect.width * zoomRatio}px ${rect.height * zoomRatio}px`;
    lens.style.backgroundPosition = `-${(lensX * zoomRatio) - lensRadius}px -${(lensY * zoomRatio) - lensRadius}px`;
  }

  container.addEventListener("mousemove", updateZoom);
  container.addEventListener("mouseenter", (e) => {
    lens.style.display = "block";
    updateZoom(e);
  });
  container.addEventListener("mouseleave", () => {
    lens.style.display = "none";
  });

  // Hỗ trợ cảm ứng trên thiết bị di động
  container.addEventListener("touchmove", (e) => {
    e.preventDefault();
    updateZoom(e);
  }, { passive: false });
  container.addEventListener("touchend", () => {
    lens.style.display = "none";
  });
}

// ─── 3. TẠO BỘ SƯU TẬP GÓC NHÌN (THUMBNAILS GÓC CẠNH) ───
function renderAngleThumbnails(mainImgUrl) {
  const container = document.getElementById("angleThumbnailsContainer");
  if (!container) return;

  const angles = [
    { label: "Mặt trước", type: "front", icon: "fa-mobile-screen" },
    { label: "Mặt sau", type: "back", icon: "fa-mobile" },
    { label: "Cạnh viền", type: "side", icon: "fa-slash" },
    { label: "Cụm Camera", type: "camera", icon: "fa-camera" },
    { label: "Hộp & PK", type: "box", icon: "fa-box-open" },
  ];

  container.innerHTML = angles
    .map(
      (angle, idx) => `
      <button type="button" class="thumb-angle-btn ${idx === 0 ? "active" : ""}" data-angle="${angle.type}">
        <img src="${mainImgUrl}" alt="${angle.label}" onerror="this.onerror=null; this.src='${DEFAULT_IMAGE}';" />
        <span>${angle.label}</span>
      </button>
    `
    )
    .join("");

  const mainImgEl = document.getElementById("product-detail-img");

  container.querySelectorAll(".thumb-angle-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      container.querySelectorAll(".thumb-angle-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      // Cập nhật góc nhìn và hiệu ứng kính lúp
      mainImgEl.style.opacity = "0.7";
      setTimeout(() => {
        mainImgEl.src = mainImgUrl;
        mainImgEl.style.opacity = "1";
      }, 100);
    });
  });
}

// ─── 4. KHỞI TẠO TRANG CHI TIẾT SẢN PHẨM ───
document.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const productId = urlParams.get("id");

  if (!productId) {
    alert("Không tìm thấy mã sản phẩm!");
    window.location.href = "index.html";
    return;
  }

  try {
    const res = await fetch(`${BASE_URL}/productsClient/${productId}`);
    if (!res.ok) throw new Error("Sản phẩm không tồn tại");

    const sp = await res.json();
    currentProductData = sp;

    // Breadcrumb
    document.getElementById("breadcrumb-category").innerText = sp.tendanhmuc || "Điện thoại";
    document.getElementById("breadcrumb-product").innerText = sp.tensp;

    // Ảnh chính & Kính lúp
    const mainImgUrl = getProductImageUrl(sp.hinhanh);
    const imgElement = document.getElementById("product-detail-img");
    imgElement.src = mainImgUrl;
    imgElement.alt = sp.tensp || "Sản phẩm";

    // Khởi tạo tính năng kính lúp soi chi tiết
    initImageMagnifier("product-detail-img", "magnifierContainer", "magnifierLens", 2.4);

    // Khởi tạo các góc nhìn sản phẩm
    renderAngleThumbnails(mainImgUrl);

    // Tiêu đề & Thông số cơ bản
    document.getElementById("product-detail-category").innerText = sp.tendanhmuc || "Công nghệ";
    document.getElementById("product-detail-name").innerText = sp.tensp;
    document.getElementById("product-detail-sold").innerText = sp.tongdaban || 0;
    document.getElementById("product-detail-stock").innerText = sp.soluongton;

    // Định dạng Giá bán & Giá gốc tham chiếu CellphoneS (giảm 10 - 15%)
    const giaban = Number(sp.giaban) || 0;
    const giaGoc = Math.round(giaban * 1.15);
    document.getElementById("product-detail-price").innerText = `${new Intl.NumberFormat("vi-VN").format(giaban)}đ`;
    const originalPriceEl = document.getElementById("product-original-price");
    if (originalPriceEl) {
      originalPriceEl.innerText = `${new Intl.NumberFormat("vi-VN").format(giaGoc)}đ`;
    }

    // Cập nhật thông tin cho Sticky Mobile Action Bar
    const stickyPrice = document.getElementById("stickyMobilePrice");
    const stickyName = document.getElementById("stickyMobileName");
    if (stickyPrice) stickyPrice.innerText = `${new Intl.NumberFormat("vi-VN").format(giaban)}đ`;
    if (stickyName) stickyName.innerText = sp.tensp;
    setupStickyMobileBar();

    // Tình trạng kho
    const statusElement = document.getElementById("product-detail-status");
    const btnAddToCart = document.getElementById("btn-add-to-cart");
    const btnBuyNow = document.getElementById("btn-buy-now");
    const quantityInput = document.getElementById("quantity-input");

    // Cập nhật tình trạng kho tổng & kho chi nhánh (Visual Status Indicators với Pulse animation)
    const branchStockList = document.getElementById("branchStockList");
    if (sp.soluongton > 5) {
      statusElement.className = "status-indicator-badge in-stock";
      statusElement.innerHTML = `
        <span class="pulse-dot-wrapper">
          <span class="pulse-ring"></span>
          <span class="pulse-dot"></span>
        </span>
        <span>Còn hàng tại các Chi nhánh (${sp.soluongton} SP)</span>
      `;
    } else if (sp.soluongton > 0) {
      statusElement.className = "status-indicator-badge low-stock";
      statusElement.innerHTML = `
        <span class="pulse-dot-wrapper warning">
          <span class="pulse-ring"></span>
          <span class="pulse-dot"></span>
        </span>
        <span>Sắp về hàng (Còn ${sp.soluongton} SP cuối)</span>
      `;
    } else {
      statusElement.className = "status-indicator-badge out-of-stock";
      statusElement.innerHTML = `
        <span class="pulse-dot-wrapper danger">
          <span class="pulse-dot"></span>
        </span>
        <span>Tạm hết hàng</span>
      `;

      if (btnAddToCart) {
        btnAddToCart.disabled = true;
        btnAddToCart.classList.add("disabled");
      }
      if (btnBuyNow) {
        btnBuyNow.disabled = true;
        btnBuyNow.classList.add("disabled");
        btnBuyNow.innerHTML = `<span class="fw-bold fs-6">HẾT HÀNG</span>`;
      }
      if (quantityInput) {
        quantityInput.value = 0;
        quantityInput.disabled = true;
      }
      const btnStickyCart = document.getElementById("btnStickyCart");
      const btnStickyBuy = document.getElementById("btnStickyBuy");
      if (btnStickyCart) {
        btnStickyCart.disabled = true;
        btnStickyCart.classList.add("disabled");
      }
      if (btnStickyBuy) {
        btnStickyBuy.disabled = true;
        btnStickyBuy.classList.add("disabled");
        btnStickyBuy.innerText = "HẾT HÀNG";
      }
    }

    if (branchStockList) {
      const stock = sp.soluongton || 0;
      let hcmHTML = "";
      let hnHTML = "";
      let tongHTML = "";

      if (stock > 5) {
        hcmHTML = `
          <div class="branch-stock-item">
            <div>
              <div class="fw-bold text-dark d-flex align-items-center gap-2">
                <span class="pulse-dot-wrapper"><span class="pulse-ring"></span><span class="pulse-dot"></span></span>
                <span>Chi nhánh 1: TP. Hồ Chí Minh</span>
              </div>
              <div class="branch-stock-meta ps-3">120 Nguyễn Thái Học, Q.1 • <b>Giao siêu tốc 2h</b></div>
            </div>
            <span class="badge bg-success-subtle text-success fw-bold rounded-pill px-3 py-1">Còn hàng</span>
          </div>`;
        hnHTML = `
          <div class="branch-stock-item">
            <div>
              <div class="fw-bold text-dark d-flex align-items-center gap-2">
                <span class="pulse-dot-wrapper"><span class="pulse-ring"></span><span class="pulse-dot"></span></span>
                <span>Chi nhánh 2: Hà Nội</span>
              </div>
              <div class="branch-stock-meta ps-3">250 Cầu Giấy, Q. Cầu Giấy • <b>Giao siêu tốc 2h</b></div>
            </div>
            <span class="badge bg-success-subtle text-success fw-bold rounded-pill px-3 py-1">Còn hàng</span>
          </div>`;
        tongHTML = `
          <div class="branch-stock-item">
            <div>
              <div class="fw-bold text-dark d-flex align-items-center gap-2">
                <span class="pulse-dot-wrapper"><span class="pulse-ring"></span><span class="pulse-dot"></span></span>
                <span>Kho Tổng Trung Tâm</span>
              </div>
              <div class="branch-stock-meta ps-3">Tổng kho điều phối toàn quốc • Sẵn hàng chuyển kho</div>
            </div>
            <span class="badge bg-success-subtle text-success fw-bold rounded-pill px-3 py-1">Còn hàng (${stock} SP)</span>
          </div>`;
      } else if (stock > 0) {
        hcmHTML = `
          <div class="branch-stock-item">
            <div>
              <div class="fw-bold text-dark d-flex align-items-center gap-2">
                <span class="pulse-dot-wrapper"><span class="pulse-ring"></span><span class="pulse-dot"></span></span>
                <span>Chi nhánh 1: TP. Hồ Chí Minh</span>
              </div>
              <div class="branch-stock-meta ps-3">120 Nguyễn Thái Học, Q.1</div>
            </div>
            <span class="badge bg-success-subtle text-success fw-bold rounded-pill px-3 py-1">Còn ${stock} SP</span>
          </div>`;
        hnHTML = `
          <div class="branch-stock-item">
            <div>
              <div class="fw-bold text-dark d-flex align-items-center gap-2">
                <span class="pulse-dot-wrapper warning"><span class="pulse-ring"></span><span class="pulse-dot"></span></span>
                <span>Chi nhánh 2: Hà Nội</span>
              </div>
              <div class="branch-stock-meta ps-3">250 Cầu Giấy, Q. Cầu Giấy • Dự kiến về hàng 1-2 ngày</div>
            </div>
            <span class="badge bg-warning-subtle text-warning fw-bold rounded-pill px-3 py-1">Sắp về hàng</span>
          </div>`;
        tongHTML = `
          <div class="branch-stock-item">
            <div>
              <div class="fw-bold text-dark d-flex align-items-center gap-2">
                <span class="pulse-dot-wrapper"><span class="pulse-ring"></span><span class="pulse-dot"></span></span>
                <span>Kho Tổng Trung Tâm</span>
              </div>
              <div class="branch-stock-meta ps-3">Trung tâm điều phối toàn quốc</div>
            </div>
            <span class="badge bg-success-subtle text-success fw-bold rounded-pill px-3 py-1">Còn hàng</span>
          </div>`;
      } else {
        hcmHTML = `
          <div class="branch-stock-item">
            <div>
              <div class="fw-bold text-muted d-flex align-items-center gap-2">
                <span class="pulse-dot-wrapper danger"><span class="pulse-dot"></span></span>
                <span>Chi nhánh 1: TP. Hồ Chí Minh</span>
              </div>
              <div class="branch-stock-meta ps-3">120 Nguyễn Thái Học, Q.1 • Nhận thông báo khi có hàng</div>
            </div>
            <span class="badge bg-danger-subtle text-danger fw-bold rounded-pill px-3 py-1">Tạm hết hàng</span>
          </div>`;
        hnHTML = `
          <div class="branch-stock-item">
            <div>
              <div class="fw-bold text-muted d-flex align-items-center gap-2">
                <span class="pulse-dot-wrapper danger"><span class="pulse-dot"></span></span>
                <span>Chi nhánh 2: Hà Nội</span>
              </div>
              <div class="branch-stock-meta ps-3">250 Cầu Giấy, Q. Cầu Giấy • Nhận thông báo khi có hàng</div>
            </div>
            <span class="badge bg-danger-subtle text-danger fw-bold rounded-pill px-3 py-1">Tạm hết hàng</span>
          </div>`;
        tongHTML = `
          <div class="branch-stock-item">
            <div>
              <div class="fw-bold text-muted d-flex align-items-center gap-2">
                <span class="pulse-dot-wrapper danger"><span class="pulse-dot"></span></span>
                <span>Kho Tổng Trung Tâm</span>
              </div>
              <div class="branch-stock-meta ps-3">Vui lòng liên hệ hotline 1800.6868 để đặt trước</div>
            </div>
            <span class="badge bg-secondary-subtle text-secondary fw-bold rounded-pill px-3 py-1">Hết hàng</span>
          </div>`;
      }

      branchStockList.innerHTML = hcmHTML + hnHTML + tongHTML;
    }

    // Bảng thông số kỹ thuật chi tiết
    document.getElementById("spec-id").innerText = sp.masp;
    document.getElementById("spec-category").innerText = sp.tendanhmuc;
    document.getElementById("spec-vendor").innerText = sp.tenncc || "Chính Hãng";
    document.getElementById("spec-unit").innerText = sp.donvitinh || "Cái";
    renderDynamicSpecs(sp);

    // Nội dung bài viết đánh giá chi tiết
    renderFullArticle(sp);

    // Cài đặt nút tăng giảm số lượng
    setupQuantityEvents(sp.soluongton);

    // Tải sản phẩm liên quan
    await loadRelatedProducts(sp.madanhmuc, sp.masp);

    // Kích hoạt các nút Mua ngay & Thêm vào giỏ
    setupActionButtons();

    // Khởi tạo nút Xem thêm / Thu gọn bài viết
    setupArticleToggle();
  } catch (err) {
    console.error(err);
    alert("Có lỗi xảy ra khi tải thông tin sản phẩm!");
  }
});

// ─── 5. HIỂN THỊ THÔNG SỐ VÀ BÀI VIẾT ĐÁNH GIÁ CHUYÊN SÂU CHUẨN CELLPHONES ───
function renderDynamicSpecs(sp) {
  const tableBody = document.getElementById("specsTableBody");
  if (!tableBody) return;

  const cat = (sp.madanhmuc || "").toUpperCase();
  let extraRows = [];

  if (cat === "DM01") { // Điện thoại
    extraRows = [
      { label: "Màn hình", val: "OLED / Super Retina XDR, 120Hz ProMotion" },
      { label: "Chip xử lý", val: "CPU thế hệ mới tối ưu tiến trình 3nm" },
      { label: "Camera sau", val: "Chính 48MP/50MP + Tele 5x + Góc siêu rộng" },
      { label: "Pin & Sạc", val: "Sạc nhanh 50% trong 30 phút, hỗ trợ sạc không dây" },
      { label: "Kháng nước & bụi", val: "IP68 tiêu chuẩn quân đội" },
    ];
  } else if (cat === "DM02") { // Laptop
    extraRows = [
      { label: "Vi xử lý (CPU)", val: "Chip đa nhân hiệu năng cao thế hệ mới" },
      { label: "Bộ nhớ RAM", val: "16GB / 32GB LPDDR5 tốc độ cao" },
      { label: "Ổ cứng", val: "SSD NVMe PCIe Gen4 siêu tốc" },
      { label: "Màn hình", val: "Độ phân giải 2.8K / Liquid Retina, chuẩn màu DCI-P3" },
      { label: "Hệ điều hành", val: "Windows 11 Home bản quyền / macOS Sonoma" },
    ];
  } else if (cat === "DM05") { // Tablet
    extraRows = [
      { label: "Kích thước màn hình", val: "11 inch - 13 inch Ultra Retina" },
      { label: "Chip đồ họa", val: "Tích hợp Neural Engine xử lý AI chuyên sâu" },
      { label: "Bút cảm ứng", val: "Hỗ trợ Apple Pencil Pro / S-Pen độ trễ siêu thấp" },
      { label: "Thời lượng pin", val: "Lên đến 10 giờ lướt web hoặc xem video" },
    ];
  } else if (cat === "DM06") { // Âm thanh
    extraRows = [
      { label: "Công nghệ âm thanh", val: "Hi-Res Audio, Spatial Audio không gian 360" },
      { label: "Chống ồn chủ động", val: "ANC kép thích ứng môi trường" },
      { label: "Thời lượng pin", val: "Từ 30h - 40h (kèm hộp sạc)" },
      { label: "Kết nối", val: "Bluetooth 5.3 chuẩn codec LDAC / AAC" },
    ];
  } else if (cat === "DM04") { // Smartwatch
    extraRows = [
      { label: "Kích thước vỏ", val: "40mm - 49mm Hợp kim Titan / Nhôm hàng không" },
      { label: "Cảm biến sức khỏe", val: "Điện tâm đồ ECG, Oxy máu SpO2, đo nhịp tim liên tục" },
      { label: "Định vị", val: "GPS tần số kép chuẩn xác mọi địa hình" },
      { label: "Chống nước", val: "Chuẩn WR50 / 100M lặn biển chuyên nghiệp" },
    ];
  } else {
    extraRows = [
      { label: "Xuất xứ", val: "Chính hãng nhập khẩu ủy quyền" },
      { label: "Tương thích", val: "Mọi hệ sinh thái iOS, Android, Windows, macOS" },
      { label: "Chính sách", val: "1 đổi 1 trong 30 ngày nếu phát sinh lỗi phần cứng" },
    ];
  }

  const existingExtra = tableBody.querySelectorAll(".dynamic-spec-row");
  existingExtra.forEach(r => r.remove());

  extraRows.forEach(row => {
    const tr = document.createElement("tr");
    tr.className = "dynamic-spec-row";
    tr.innerHTML = `
      <td class="spec-label">${row.label}</td>
      <td class="spec-value">${row.val}</td>
    `;
    tableBody.appendChild(tr);
  });
}

function renderFullArticle(product) {
  const fullDescEl = document.getElementById("product-full-description");
  if (!fullDescEl) return;

  const tenSP = product.tensp || "Sản phẩm";
  const danhMuc = product.tendanhmuc || "Thiết bị công nghệ";
  const motaGoc = product.mota && product.mota !== "NULL" ? product.mota : "";

  fullDescEl.innerHTML = `
    <div class="product-article-content">
      <!-- Khối tóm tắt đặc điểm nổi bật -->
      <div class="p-3 mb-4 rounded-3 border border-danger border-opacity-25" style="background: #fff8f8;">
        <h6 class="fw-bold text-danger mb-2"><i class="fa-solid fa-sparkles me-2"></i>ĐẶC ĐIỂM NỔI BẬT CỦA ${tenSP.toUpperCase()}</h6>
        <ul class="mb-0 text-dark small ps-3" style="line-height: 1.8;">
          <li><b>Thiết kế sang trọng, độ hoàn thiện tinh xảo</b> từ vật liệu cao cấp, độ bền vượt chuẩn.</li>
          <li><b>Hiệu năng bứt phá</b> đáp ứng từ các tác vụ văn phòng, học tập đến sáng tạo nội dung và đồ họa nặng.</li>
          <li><b>Tối ưu thời lượng sử dụng</b> cùng công nghệ quản lý điện năng thông minh thế hệ mới.</li>
          <li><b>Bảo hành chính hãng 12 tháng</b>, cam kết 1 đổi 1 trong 30 ngày tại 120 chi nhánh HP STORE.</li>
        </ul>
      </div>

      <h5 class="fw-bold text-dark mb-3">1. Đánh giá chi tiết thiết kế & Cảm giác trải nghiệm</h5>
      <p class="text-secondary mb-3">
        <b>${tenSP}</b> đại diện cho ngôn ngữ thiết kế công nghệ hiện đại thuộc phân khúc <b>${danhMuc}</b>. Mỗi đường nét và góc cạnh đều được gia công tỉ mỉ bằng máy CNC độ chính xác micro-met, mang lại cảm giác cầm nắm chắc tay, sang trọng và giảm thiểu bám vân tay tối đa trong quá trình sử dụng thường ngày.
      </p>

      ${motaGoc ? `<div class="p-3 mb-3 bg-light rounded-3 border-start border-4 border-danger text-dark fw-medium">${motaGoc}</div>` : ""}

      <h5 class="fw-bold text-dark mb-3 mt-4">2. Hiệu năng dẫn đầu & Trải nghiệm đa nhiệm mượt mà</h5>
      <p class="text-secondary mb-3">
        Sở hữu cấu hình phần cứng tối tân, <b>${tenSP}</b> xử trị mượt mà các tác vụ nặng nhất từ đồ họa, render video đến gaming eSports tốc độ khung hình cao. Hệ thống tản nhiệt thông minh duy trì nhiệt độ máy mát mẻ ổn định kể cả khi chạy liên tục nhiều giờ liền.
      </p>

      <h5 class="fw-bold text-dark mb-3 mt-4">3. Màn hình & Chất lượng hiển thị đỉnh cao</h5>
      <p class="text-secondary mb-3">
        Trang bị công nghệ tấm nền cao cấp với dải màu rộng đạt 100% không gian DCI-P3, độ sáng cao giúp tái tạo hình ảnh sắc nét, chân thực ngay cả dưới ánh nắng chói gắt ngoài trời. Tần số quét cao loại bỏ hiện tượng bóng mờ, đem lại thao tác vuốt chạm mượt mà tự nhiên.
      </p>

      <h5 class="fw-bold text-dark mb-3 mt-4">4. Thời lượng pin dài lâu & Công nghệ sạc nhanh</h5>
      <p class="text-secondary mb-3">
        Viên pin dung lượng lớn kết hợp chip xử lý tiết kiệm điện năng cho phép người dùng thoải mái làm việc và giải trí suốt cả ngày dài. Công nghệ sạc nhanh hiện đại nạp đầy hơn 50% dung lượng chỉ trong 30 phút, sẵn sàng cho mọi hành trình di chuyển.
      </p>

      <h5 class="fw-bold text-dark mb-3 mt-4">5. Đặc quyền mua sắm & Hậu mãi VIP tại HP STORE</h5>
      <div class="row g-2 text-dark small mt-2">
        <div class="col-md-6">
          <div class="p-2 border rounded-2 bg-light">
            <i class="fa-solid fa-arrows-rotate text-success me-1"></i> <b>1 Đổi 1 trong 30 ngày:</b> Đổi máy mới ngay nếu có lỗi từ nhà sản xuất.
          </div>
        </div>
        <div class="col-md-6">
          <div class="p-2 border rounded-2 bg-light">
            <i class="fa-solid fa-truck-fast text-primary me-1"></i> <b>Giao siêu tốc 2 Giờ:</b> Miễn phí giao hàng nội thành toàn quốc.
          </div>
        </div>
        <div class="col-md-6">
          <div class="p-2 border rounded-2 bg-light">
            <i class="fa-solid fa-shield-halved text-danger me-1"></i> <b>Bảo hành 12 Tháng:</b> Tiếp nhận sửa chữa tại 120 trung tâm ủy quyền.
          </div>
        </div>
        <div class="col-md-6">
          <div class="p-2 border rounded-2 bg-light">
            <i class="fa-solid fa-credit-card text-warning me-1"></i> <b>Trả góp 0% Lãi suất:</b> Thủ tục xét duyệt trong 5 phút qua CCCD.
          </div>
        </div>
      </div>
    </div>
  `;
}

// ─── 6. NÚT THU GỌN / XEM THÊM NỘI DUNG ───
function setupArticleToggle() {
  const btnToggle = document.getElementById("btnToggleArticle");
  const wrapper = document.getElementById("articleCollapseWrapper");
  const overlay = document.getElementById("articleFadeOverlay");

  if (!btnToggle || !wrapper) return;

  btnToggle.addEventListener("click", () => {
    const isExpanded = wrapper.classList.toggle("expanded");
    if (isExpanded) {
      if (overlay) overlay.classList.add("d-none");
      btnToggle.innerHTML = `Thu gọn bài viết <i class="fa-solid fa-chevron-up ms-1"></i>`;
    } else {
      if (overlay) overlay.classList.remove("d-none");
      btnToggle.innerHTML = `Xem thêm nội dung <i class="fa-solid fa-chevron-down ms-1"></i>`;
      wrapper.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
}

// ─── 7. HÀNH ĐỘNG NÚT MUA NGAY & THÊM GIỎ HÀNG ───
function setupActionButtons() {
  const btnAddToCart = document.getElementById("btn-add-to-cart");
  const btnBuyNow = document.getElementById("btn-buy-now");

  if (btnAddToCart && !btnAddToCart.disabled) {
    btnAddToCart.addEventListener("click", () => {
      if (!currentProductData) return;
      const quantityInput = document.getElementById("quantity-input");
      const selectedQty = parseInt(quantityInput.value) || 1;
      executeAddProductToCart(currentProductData, selectedQty);
    });
  }

  if (btnBuyNow && !btnBuyNow.disabled) {
    btnBuyNow.addEventListener("click", () => {
      if (!currentProductData) return;
      const quantityInput = document.getElementById("quantity-input");
      const selectedQty = parseInt(quantityInput.value) || 1;
      const success = executeAddProductToCart(currentProductData, selectedQty);
      if (success !== false) {
        // Chuyển thẳng tới trang thanh toán
        setTimeout(() => {
          window.location.href = "/src/pages/checkout.html";
        }, 500);
      }
    });
  }
}

// ─── 8. LOGIC THÊM SẢN PHẨM VÀO GIỎ HÀNG ───
function executeAddProductToCart(product, quantityToBuy) {
  const stock = product.soluongton !== undefined ? product.soluongton : product.SoLuongTon;
  const maSP = product.masp || product.MaSP;
  const tenSP = product.tensp || product.TenSP;
  const giaBan = product.giaban || product.GiaBan;
  const hinhAnh = product.hinhanh || product.HinhAnh;

  if (stock <= 0) {
    Swal.fire("Hết hàng", "Sản phẩm này hiện tại đã hết hàng trong kho!", "error");
    return false;
  }

  const userData = JSON.parse(localStorage.getItem("hpstore_user"));
  if (!userData || !userData.token) {
    Swal.fire({
      title: "Yêu cầu đăng nhập",
      text: "Bạn cần đăng nhập tài khoản thành viên để thêm sản phẩm vào giỏ hàng.",
      icon: "warning",
      confirmButtonText: "Đăng nhập ngay",
      confirmButtonColor: "#d70018",
    }).then((result) => {
      if (result.isConfirmed) window.location.href = "/src/pages/login.html";
    });
    return false;
  }

  const currentUserId = userData.MaND || userData.id;
  const userCartKey = `hpstore_cart_${currentUserId}`;
  let userCart = JSON.parse(localStorage.getItem(userCartKey)) || [];
  const existIndex = userCart.findIndex((item) => item.MaSP === maSP);

  if (existIndex > -1) {
    const currentInCart = userCart[existIndex].SoLuong;
    const newQty = currentInCart + quantityToBuy;

    if (newQty > stock) {
      const maxCanAdd = stock - currentInCart;
      if (maxCanAdd <= 0) {
        Swal.fire(
          "Giới hạn kho hàng",
          `Bạn đã thêm tối đa số lượng cho phép của sản phẩm này vào giỏ hàng (${stock} sản phẩm).`,
          "warning"
        );
      } else {
        Swal.fire(
          "Vượt quá số lượng",
          `Sản phẩm này đã có ${currentInCart} cái trong giỏ. Kho chỉ còn tồn ${stock} cái, bạn chỉ có thể thêm tối đa ${maxCanAdd} cái nữa thôi!`,
          "error"
        );
      }
      return false;
    }
    userCart[existIndex].SoLuong = newQty;
  } else {
    if (quantityToBuy > stock) {
      Swal.fire("Vượt quá số lượng", `Trong kho chỉ còn tối đa ${stock} sản phẩm.`, "error");
      return false;
    }

    userCart.push({
      MaSP: maSP,
      TenSP: tenSP,
      GiaBan: giaBan,
      HinhAnh: hinhAnh,
      SoLuong: quantityToBuy,
    });
  }

  localStorage.setItem(userCartKey, JSON.stringify(userCart));

  Swal.fire({
    title: "Đã thêm vào giỏ hàng!",
    text: `Đã thêm ${quantityToBuy} x ${tenSP} vào giỏ hàng.`,
    icon: "success",
    toast: true,
    position: "top-end",
    showConfirmButton: false,
    timer: 2000,
    timerProgressBar: true,
  });

  const badge = document.getElementById("cart-count");
  if (badge) {
    badge.innerText = userCart.reduce((sum, item) => sum + item.SoLuong, 0);
  }

  return true;
}

window.quickAddToCart = function (productStr) {
  try {
    const product = JSON.parse(decodeURIComponent(productStr));
    executeAddProductToCart(product, 1);
  } catch (e) {
    console.error("Lỗi parse dữ liệu sản phẩm liên quan:", e);
  }
};

function setupQuantityEvents(maxStock) {
  const input = document.getElementById("quantity-input");
  const btnDecrease = document.getElementById("btn-decrease");
  const btnIncrease = document.getElementById("btn-increase");

  if (!input) return;

  if (maxStock <= 0) {
    if (btnDecrease) btnDecrease.onclick = null;
    if (btnIncrease) btnIncrease.onclick = null;
    return;
  }

  btnDecrease.onclick = () => {
    let val = parseInt(input.value) || 1;
    if (val > 1) input.value = val - 1;
  };

  btnIncrease.onclick = () => {
    let val = parseInt(input.value) || 1;
    if (val < maxStock) {
      input.value = val + 1;
    } else {
      Swal.fire("Thông báo", `Sản phẩm này hiện chỉ còn tối đa ${maxStock} cái trong kho.`, "info");
    }
  };

  input.onchange = () => {
    let val = parseInt(input.value);
    if (isNaN(val) || val < 1) input.value = 1;
    if (val > maxStock) {
      input.value = maxStock;
      Swal.fire("Thông báo", `Sản phẩm này hiện chỉ còn tối đa ${maxStock} cái trong kho.`, "info");
    }
  };
}

async function loadRelatedProducts(categoryId, currentProductId) {
  try {
    const response = await fetch(
      `${BASE_URL}/productsClient/${currentProductId}/related?categoryId=${categoryId}`
    );
    if (!response.ok) return;

    const relatedProducts = await response.json();
    const container = document.getElementById("related-products-container");
    if (!container) return;
    container.innerHTML = "";

    if (relatedProducts.length === 0) {
      container.innerHTML = `<div class="col-12 text-muted text-center py-4">Không tìm thấy sản phẩm tương tự nào khác trong danh mục này.</div>`;
      return;
    }

    relatedProducts.forEach((sp) => {
      const imgUrl = getProductImageUrl(sp.hinhanh);
      const targetObjectString = encodeURIComponent(JSON.stringify(sp));

      let actionButtonHtml = "";
      if (sp.soluongton > 0) {
        actionButtonHtml = `
          <button class="btn btn-outline-danger w-100 rounded-pill btn-sm py-2 fw-semibold" onclick="window.quickAddToCart('${targetObjectString}')">
              <i class="fa fa-shopping-cart me-1"></i>Thêm vào giỏ
          </button>`;
      } else {
        actionButtonHtml = `
          <button class="btn btn-secondary w-100 rounded-pill btn-sm py-2 disabled" disabled>
              <i class="fa fa-ban me-1"></i>Hết hàng
          </button>`;
      }

      const itemHtml = `
        <div class="col">
          <div class="card h-100 border-0 shadow-sm" style="border-radius: 14px; overflow: hidden; transition: transform 0.2s;">
            <a href="product-detail.html?id=${sp.masp}" class="text-decoration-none">
              <div class="text-center p-3" style="background: #ffffff; height: 160px; display: flex; align-items: center; justify-content: center;">
                <img src="${imgUrl}" class="card-img-top p-2" alt="${sp.tensp || "Sản phẩm"}" style="max-height: 100%; object-fit: contain;" onerror="this.onerror=null; this.src='${DEFAULT_IMAGE}';">
              </div>
            </a>
            <div class="card-body d-flex flex-column justify-content-between p-3">
              <div>
                <small class="text-danger fw-bold d-block mb-1" style="font-size: 0.75rem;">${sp.tendanhmuc || "Công nghệ"}</small>
                <a href="product-detail.html?id=${sp.masp}" class="text-decoration-none text-dark">
                  <h6 class="card-title text-truncate fw-bold mb-1" style="font-size: 0.9rem;">${sp.tensp}</h6>
                </a>
              </div>
              <div class="mt-2">
                <h5 class="text-danger fw-bolder mb-2" style="font-size: 1rem;">${new Intl.NumberFormat("vi-VN").format(sp.giaban)}đ</h5>
                ${actionButtonHtml}
              </div>
            </div>
          </div>
        </div>
      `;
      container.insertAdjacentHTML("beforeend", itemHtml);
    });
  } catch (error) {
    console.error("Không thể tải khối sản phẩm liên quan:", error);
  }
}


// ─── THIẾT LẬP THANH TÁC VỤ DÍNH ĐÁY CHO MOBILE (STICKY ACTION BAR) ───
function setupStickyMobileBar() {
  const stickyBar = document.getElementById("stickyMobileBar");
  const mainBuyBtn = document.getElementById("btn-buy-now");
  const btnStickyCart = document.getElementById("btnStickyCart");
  const btnStickyBuy = document.getElementById("btnStickyBuy");

  if (!stickyBar || !mainBuyBtn) return;

  // Tránh đăng ký nhiều lần khi hàm được gọi lại
  if (stickyBar.dataset.initialized === "true") return;
  stickyBar.dataset.initialized = "true";

  if (btnStickyCart) {
    btnStickyCart.addEventListener("click", () => {
      const mainAddToCartBtn = document.getElementById("btn-add-to-cart");
      if (mainAddToCartBtn && !mainAddToCartBtn.disabled) {
        mainAddToCartBtn.click();
      }
    });
  }

  if (btnStickyBuy) {
    btnStickyBuy.addEventListener("click", () => {
      if (mainBuyBtn && !mainBuyBtn.disabled) {
        mainBuyBtn.click();
      }
    });
  }

  // Tối ưu hiệu năng scroll bằng requestAnimationFrame
  let ticking = false;
  const checkStickyVisibility = () => {
    if (window.innerWidth >= 768) {
      stickyBar.classList.remove("visible");
      return;
    }
    const rect = mainBuyBtn.getBoundingClientRect();
    // Khi cuộn vượt qua nút Mua hàng chính (mép dưới của nút trượt lên trên mép hiển thị)
    if (rect.bottom < 60) {
      stickyBar.classList.add("visible");
    } else {
      stickyBar.classList.remove("visible");
    }
  };

  window.addEventListener(
    "scroll",
    () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          checkStickyVisibility();
          ticking = false;
        });
        ticking = true;
      }
    },
    { passive: true }
  );

  window.addEventListener("resize", checkStickyVisibility, { passive: true });

  // Kiểm tra ngay sau khi khởi tạo
  checkStickyVisibility();
}
