import Swal from "sweetalert2";

const STYLE_ID = "hp-swal-modern-theme";

/**
 * Tiêm CSS tối ưu giao diện SweetAlert2 (Modal + Toast) đồng bộ theo phong cách HP STORE.
 * Tự động chạy 1 lần khi module được import (qua header.js dùng chung toàn bộ website).
 */
export function initSwalTheme() {
  if (typeof document === "undefined" || document.getElementById(STYLE_ID)) {
    return;
  }

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    /* ─── Backdrop mờ kính tinh tế cho Modal ─── */
    .swal2-container.swal2-backdrop-show {
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      background: rgba(15, 23, 42, 0.45) !important;
    }

    /* ─── Modal giữa màn hình hiện đại ─── */
    .swal2-popup:not(.swal2-toast) {
      font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
      border-radius: 18px !important;
      padding: 1.75rem 1.75rem 1.5rem !important;
      box-shadow: 0 24px 60px -12px rgba(15, 23, 42, 0.25), 0 0 0 1px rgba(15, 23, 42, 0.05) !important;
      max-width: 440px !important;
    }

    .swal2-popup:not(.swal2-toast) .swal2-title {
      font-size: 1.2rem !important;
      font-weight: 700 !important;
      color: #0f172a !important;
      letter-spacing: -0.01em !important;
      padding-top: 0.25rem !important;
    }

    .swal2-popup:not(.swal2-toast) .swal2-html-container {
      font-size: 0.92rem !important;
      color: #475569 !important;
      line-height: 1.55 !important;
      margin-top: 0.5rem !important;
    }

    .swal2-popup:not(.swal2-toast) .swal2-icon {
      transform: scale(0.84);
      margin: 0.25rem auto 0.5rem !important;
    }

    .swal2-popup:not(.swal2-toast) .swal2-actions {
      gap: 0.6rem !important;
      margin-top: 1.35rem !important;
    }

    .swal2-popup:not(.swal2-toast) .swal2-styled {
      border-radius: 10px !important;
      font-weight: 600 !important;
      font-size: 0.9rem !important;
      padding: 0.62rem 1.35rem !important;
      box-shadow: none !important;
      transition: transform 0.14s ease, filter 0.14s ease !important;
    }

    .swal2-popup:not(.swal2-toast) .swal2-styled:hover {
      filter: brightness(0.95);
      transform: translateY(-1px);
    }

    .swal2-popup:not(.swal2-toast) .swal2-confirm {
      background-color: #d70018;
    }

    .swal2-popup:not(.swal2-toast) .swal2-cancel {
      background-color: #f1f5f9 !important;
      color: #334155 !important;
      border: 1px solid #e2e8f0 !important;
    }

    .swal2-popup:not(.swal2-toast) .swal2-input,
    .swal2-popup:not(.swal2-toast) .swal2-textarea {
      border-radius: 10px !important;
      border: 1.5px solid #cbd5e1 !important;
      font-size: 0.95rem !important;
      box-shadow: none !important;
    }

    .swal2-popup:not(.swal2-toast) .swal2-input:focus,
    .swal2-popup:not(.swal2-toast) .swal2-textarea:focus {
      border-color: #d70018 !important;
      box-shadow: 0 0 0 3px rgba(215, 0, 24, 0.12) !important;
    }

    /* ─── Toast hiện đại ở góc trên bên phải ─── */
    .swal2-container.swal2-top-end,
    .swal2-container.swal2-top-right {
      padding: 1rem !important;
      z-index: 10900 !important;
    }

    .swal2-popup.swal2-toast {
      font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
      border-radius: 14px !important;
      padding: 0.85rem 1.1rem !important;
      background: #ffffff !important;
      border: 1px solid #e2e8f0 !important;
      border-left: 4px solid #d70018 !important;
      box-shadow: 0 14px 36px -8px rgba(15, 23, 42, 0.2), 0 4px 12px -4px rgba(15, 23, 42, 0.08) !important;
      align-items: center !important;
      max-width: 380px !important;
    }

    .swal2-popup.swal2-toast.swal2-icon-success {
      border-left-color: #16a34a !important;
    }

    .swal2-popup.swal2-toast.swal2-icon-error {
      border-left-color: #dc2626 !important;
    }

    .swal2-popup.swal2-toast.swal2-icon-warning {
      border-left-color: #f59e0b !important;
    }

    .swal2-popup.swal2-toast.swal2-icon-info {
      border-left-color: #2563eb !important;
    }

    .swal2-popup.swal2-toast .swal2-title {
      font-size: 0.92rem !important;
      font-weight: 700 !important;
      color: #0f172a !important;
      margin: 0 0 0.15rem 0 !important;
    }

    .swal2-popup.swal2-toast .swal2-html-container {
      font-size: 0.82rem !important;
      color: #475569 !important;
      margin: 0 !important;
      line-height: 1.4 !important;
    }

    .swal2-popup.swal2-toast .swal2-timer-progress-bar {
      height: 3px !important;
      background: rgba(15, 23, 42, 0.18) !important;
    }

    .swal2-popup.swal2-toast.swal2-icon-success .swal2-timer-progress-bar {
      background: #16a34a !important;
    }

    .swal2-popup.swal2-toast.swal2-icon-error .swal2-timer-progress-bar {
      background: #dc2626 !important;
    }
  `;

  document.head.appendChild(style);
}

// Tự động kích hoạt giao diện ngay khi file được import
initSwalTheme();

/**
 * Toast hiện đại dùng chung toàn hệ thống (không che màn hình, tự dừng khi rê chuột vào)
 */
export const hpToast = Swal.mixin({
  toast: true,
  position: "top-end",
  showConfirmButton: false,
  timer: 2200,
  timerProgressBar: true,
  didOpen: (toast) => {
    toast.addEventListener("mouseenter", Swal.stopTimer);
    toast.addEventListener("mouseleave", Swal.resumeTimer);
  },
});

export function toastSuccess(title, text = "", timer = 2200) {
  return hpToast.fire({ icon: "success", title, text, timer });
}

export function toastError(title, text = "", timer = 3000) {
  return hpToast.fire({ icon: "error", title, text, timer });
}

export function toastWarning(title, text = "", timer = 2600) {
  return hpToast.fire({ icon: "warning", title, text, timer });
}

export function toastInfo(title, text = "", timer = 2400) {
  return hpToast.fire({ icon: "info", title, text, timer });
}
