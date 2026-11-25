// src/JS/common/pagination.js
// Component phân trang chuẩn dùng chung cho 7 trang quản trị HP STORE:
// - Hiển thị phạm vi bản ghi (VD: Hiển thị 1–10 / 32 mục)
// - Nút Trang đầu / Trước / Số trang có dấu "..." thông minh / Sau / Trang cuối
// - Ô nhập "Đến trang" khi có nhiều hơn 4 trang
// - Tương thích cả container <div> lẫn <ul> hiện có

function buildPageList(current, total) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  if (start > 2) pages.push("...");
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < total - 1) pages.push("...");
  pages.push(total);
  return pages;
}

export function renderAdminPagination(
  container,
  {
    currentPage = 1,
    totalPages = 1,
    totalItems = null,
    pageSize = 10,
    onPageChange,
  } = {},
) {
  if (!container) return;

  const page = Math.max(1, parseInt(currentPage, 10) || 1);
  const total = Math.max(1, parseInt(totalPages, 10) || 1);
  const isUl = container.tagName === "UL";

  // Dọn thanh info phụ nếu trước đó có tạo bên cạnh <ul>
  const infoId = `${container.id || "pg"}_meta_info`;
  const existingMeta = document.getElementById(infoId);

  if (total <= 1) {
    container.innerHTML = "";
    if (existingMeta) existingMeta.remove();
    return;
  }

  const pageItems = buildPageList(page, total);

  const btnStyle = (active) =>
    active
      ? "background-color:#d70018;border-color:#d70018;color:#fff;font-weight:700;min-width:34px;"
      : "min-width:34px;color:#334155;";

  const listItemsHtml = `
    <li class="page-item ${page === 1 ? "disabled" : ""}">
      <button type="button" class="page-link rounded-2 mx-1" data-page="1" ${page === 1 ? "disabled" : ""} title="Trang đầu" aria-label="Trang đầu">
        <i class="fa-solid fa-angles-left" style="font-size:11px;"></i>
      </button>
    </li>
    <li class="page-item ${page === 1 ? "disabled" : ""}">
      <button type="button" class="page-link rounded-2 mx-1" data-page="${page - 1}" ${page === 1 ? "disabled" : ""} title="Trang trước" aria-label="Trang trước">
        <i class="fa-solid fa-angle-left" style="font-size:12px;"></i>
      </button>
    </li>
    ${pageItems
      .map((item) => {
        if (item === "...") {
          return `<li class="page-item disabled"><span class="page-link border-0 bg-transparent text-muted px-1">…</span></li>`;
        }
        const isActive = item === page;
        return `
          <li class="page-item ${isActive ? "active" : ""}">
            <button type="button" class="page-link rounded-2 mx-1 ${isActive ? "shadow-sm" : ""}" data-page="${item}" style="${btnStyle(isActive)}">${item}</button>
          </li>`;
      })
      .join("")}
    <li class="page-item ${page === total ? "disabled" : ""}">
      <button type="button" class="page-link rounded-2 mx-1" data-page="${page + 1}" ${page === total ? "disabled" : ""} title="Trang sau" aria-label="Trang sau">
        <i class="fa-solid fa-angle-right" style="font-size:12px;"></i>
      </button>
    </li>
    <li class="page-item ${page === total ? "disabled" : ""}">
      <button type="button" class="page-link rounded-2 mx-1" data-page="${total}" ${page === total ? "disabled" : ""} title="Trang cuối" aria-label="Trang cuối">
        <i class="fa-solid fa-angles-right" style="font-size:11px;"></i>
      </button>
    </li>
  `;

  // Tính text hiển thị số lượng
  let summaryText = `Trang <b>${page}</b> / <b>${total}</b>`;
  if (typeof totalItems === "number" && totalItems > 0) {
    const from = (page - 1) * pageSize + 1;
    const to = Math.min(page * pageSize, totalItems);
    summaryText = `Hiển thị <b>${from}–${to}</b> / <b>${totalItems}</b> mục · Trang <b>${page}/${total}</b>`;
  }

  const jumpHtml =
    total > 4
      ? `
      <div class="d-inline-flex align-items-center gap-1 ms-2">
        <span class="text-muted small d-none d-sm-inline">Đến trang:</span>
        <input type="number" min="1" max="${total}" value="${page}" class="form-control form-control-sm text-center hp-pg-jump-input" style="width:58px;height:31px;border-radius:8px;" aria-label="Nhập số trang" />
        <button type="button" class="btn btn-sm btn-outline-secondary hp-pg-jump-btn px-2" style="height:31px;border-radius:8px;">Đi</button>
      </div>`
      : "";

  const goTo = (target) => {
    const p = parseInt(target, 10);
    if (!isNaN(p) && p >= 1 && p <= total && p !== page && typeof onPageChange === "function") {
      onPageChange(p);
    }
  };

  if (isUl) {
    container.classList.add("pagination", "pagination-sm", "mb-0", "flex-wrap", "justify-content-center");
    container.innerHTML = listItemsHtml;

    // Hiển thị thông tin trang phía trên hoặc dưới <ul> nếu có parent
    if (container.parentElement) {
      let metaEl = existingMeta;
      if (!metaEl) {
        metaEl = document.createElement("div");
        metaEl.id = infoId;
        metaEl.className = "d-flex flex-wrap align-items-center justify-content-center gap-2 text-muted small mt-2";
        container.parentElement.appendChild(metaEl);
      }
      metaEl.innerHTML = `<span>${summaryText}</span>${jumpHtml}`;
      bindJumpControls(metaEl, goTo);
    }
  } else {
    container.innerHTML = `
      <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 w-100 px-2">
        <div class="text-muted small">${summaryText}</div>
        <div class="d-flex flex-wrap align-items-center gap-1">
          <nav aria-label="Phân trang"><ul class="pagination pagination-sm mb-0 flex-wrap">${listItemsHtml}</ul></nav>
          ${jumpHtml}
        </div>
      </div>
    `;
    bindJumpControls(container, goTo);
  }

  container.onclick = (e) => {
    const btn = e.target.closest("button.page-link[data-page]");
    if (!btn || btn.disabled) return;
    e.preventDefault();
    e.stopPropagation();
    goTo(btn.getAttribute("data-page"));
  };
}

function bindJumpControls(rootEl, goTo) {
  const input = rootEl.querySelector(".hp-pg-jump-input");
  const btn = rootEl.querySelector(".hp-pg-jump-btn");
  if (input && btn) {
    const trigger = () => goTo(input.value);
    btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      trigger();
    };
    input.onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        trigger();
      }
    };
  }
}
