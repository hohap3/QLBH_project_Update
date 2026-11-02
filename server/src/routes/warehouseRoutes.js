// routes/warehouseRoutes.js
const express = require("express");
const router = express.Router();
const WarehouseController = require("../controllers/warehouseController");
const { verifyToken, authorizeRoles } = require("../middleware/auth");

// 🟢 Áp dụng Auth cho toàn bộ route liên quan đến Kho hàng
router.use(verifyToken, authorizeRoles("Manager", "Employee", "Admin", "Staff"));

// 1. Tuyến đường lấy toàn bộ danh sách lịch sử biến động kho hàng
router.get("/transactions", WarehouseController.getAllTransactions);

// 2. Tuyến đường xem lịch sử biến động kho của một sản phẩm nhất định
router.get("/transactions/:maSP", WarehouseController.getTransactionsByProduct);

// 3. Tuyến đường thực hiện một phiên Nhập hoặc Xuất kho mới (Chỉ Manager/Admin có quyền xuất/nhập kho)
router.post("/transaction", authorizeRoles("Manager", "Admin"), WarehouseController.createTransaction);

module.exports = router;
