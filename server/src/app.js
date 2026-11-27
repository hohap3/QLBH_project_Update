const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/authRoutes"); // Kiểm tra đường dẫn này
const userRoutes = require("./routes/userRoutes");
const productManagerRoutes = require("./routes/productManagerRoutes");
const productCategoryRoutes = require("./routes/productCategoryRoutes");
const supplierRoutes = require("./routes/supplierRoutes");
const customerRoutes = require("./routes/customerRoutes");
const orderRoutes = require("./routes/orderRoutes");
const thongkeRoutes = require("./routes/thongkeRoutes");
const productRoutesClient = require("./routes/productRoutes");
const profileRoutes = require("./routes/profileRoutes");
const orderHistoryRoutes = require("./routes/orderHistoryRoutes");
const checkoutRoutes = require("./routes/checkoutRoutes");
const accountRoutes = require("./routes/accountRoutes");
const employeeRoutes = require("./routes/employeeRoutes");
const warehouseRoutes = require("./routes/warehouseRoutes");
const wishlistRoutes = require("./routes/wishlistRoutes");
const cartRoutes = require("./routes/cartRoutes");
const reviewRoutes = require("./routes/reviewRoutes");

const path = require("path");

const app = express();

// Middleware (Phải đặt TRƯỚC Routes)
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/products", productManagerRoutes);
app.use("/api/categories", productCategoryRoutes);
app.use("/api/suppliers", supplierRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/orders", orderRoutes);

app.use(
  "/uploads/products",
  express.static(path.join(process.cwd(), "src/public/uploads/products")),
);

app.use("/api/thongke", thongkeRoutes);
app.use("/api/productsClient", productRoutesClient);
app.use("/api/profile", profileRoutes);
app.use("/api/orderHistory", orderHistoryRoutes);
app.use("/api/checkout", checkoutRoutes);
app.use("/api/account", accountRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/warehouse", warehouseRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/reviews", reviewRoutes);

// Test route
app.get("/", (req, res) => {
  res.send("Backend QLBH đang hoạt động ổn định trên Render!");
});

// Centralized Error Handler (Middleware xử lý lỗi tập trung)
app.use((err, req, res, next) => {
  console.error("🔥 Hệ thống gặp lỗi:", err.stack);
  res.status(500).json({
    message: "Đã xảy ra lỗi hệ thống trên server!",
    error:
      process.env.NODE_ENV === "production"
        ? "Internal Server Error"
        : err.message,
  });
});
module.exports = app;
