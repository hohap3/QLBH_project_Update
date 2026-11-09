import { resolve } from "path";
import { defineConfig } from "vite";

export default defineConfig({
  base: "/",

  server: {
    historyApiFallback: {
      rewrites: [
        { from: /^\/login$/, to: "/src/pages/login.html" },
        { from: /^\/register$/, to: "/src/pages/register.html" },
        { from: /^\/dashboard$/, to: "/src/pages/dashboard.html" },
        { from: /^\/cart$/, to: "/src/pages/cart.html" },
        { from: /^\/checkout$/, to: "/src/pages/checkout.html" },
        { from: /^\/danh-muc$/, to: "/src/pages/danh-muc.html" },
        { from: /^\/don-hang$/, to: "/src/pages/don-hang.html" },
        { from: /^\/order-history$/, to: "/src/pages/order-history.html" },
        { from: /^\/product-detail$/, to: "/src/pages/product-detail.html" },
        { from: /^\/hoso$/, to: "/src/pages/hoso.html" },
        { from: /^\/khach-hang$/, to: "/src/pages/khach-hang.html" },
        { from: /^\/nha-cung-cap$/, to: "/src/pages/nha-cung-cap.html" },
        { from: /^\/quanly-khohang$/, to: "/src/pages/quanly-khohang.html" },
        { from: /^\/quanly-nhanvien$/, to: "/src/pages/quanly-nhanvien.html" },
        { from: /^\/employeeManager$/, to: "/src/pages/employeeManager.html" },
        { from: /^\/san-pham$/, to: "/src/pages/san-pham.html" },
        { from: /^\/tong-quan$/, to: "/src/pages/tong-quan.html" },
        { from: /^\/update-pass$/, to: "/src/pages/update-pass.html" },
        { from: /^\/cai-dat$/, to: "/src/pages/cai-dat.html" },
      ],
    },
  },

  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        login: resolve(__dirname, "src/pages/login.html"),
        register: resolve(__dirname, "src/pages/register.html"),
        dashboard: resolve(__dirname, "src/pages/dashboard.html"),
        cart: resolve(__dirname, "src/pages/cart.html"),
        checkout: resolve(__dirname, "src/pages/checkout.html"),
        // 🟢 SỬA TÊN KEY: Giữ đúng tên file vật lý để Vite build ra chính xác tên cũ
        "danh-muc": resolve(__dirname, "src/pages/danh-muc.html"),
        "don-hang": resolve(__dirname, "src/pages/don-hang.html"),
        "order-history": resolve(__dirname, "src/pages/order-history.html"),
        "product-detail": resolve(__dirname, "src/pages/product-detail.html"),
        hoso: resolve(__dirname, "src/pages/hoso.html"),
        "khach-hang": resolve(__dirname, "src/pages/khach-hang.html"),
        "nha-cung-cap": resolve(__dirname, "src/pages/nha-cung-cap.html"),
        "quanly-khohang": resolve(__dirname, "src/pages/quanly-khohang.html"),
        "quanly-nhanvien": resolve(__dirname, "src/pages/quanly-nhanvien.html"),
        employeeManager: resolve(__dirname, "src/pages/employeeManager.html"),
        "san-pham": resolve(__dirname, "src/pages/san-pham.html"),
        "tong-quan": resolve(__dirname, "src/pages/tong-quan.html"),
        "update-pass": resolve(__dirname, "src/pages/update-pass.html"),
        "cai-dat": resolve(__dirname, "src/pages/cai-dat.html"),
        "forgot-password": resolve(__dirname, "src/pages/forgot-password.html"),
      },
    },
  },
});
