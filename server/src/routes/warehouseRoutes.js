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

// 4. Tra cứu tồn kho thực tế của 1 sản phẩm tại 1 kho cụ thể
router.get("/stock", WarehouseController.getWarehouseStock);

// 5. Quản lý Yêu cầu & Điều chuyển hàng liên kho
router.get("/transfers", WarehouseController.getTransferRequests);
router.post("/transfers/request", WarehouseController.createTransferRequest);
router.post(
  "/transfers/direct",
  authorizeRoles("Manager", "Admin"),
  WarehouseController.directTransfer,
);
router.put(
  "/transfers/:maYeuCau/approve",
  authorizeRoles("Manager", "Admin"),
  WarehouseController.approveTransferRequest,
);
router.put(
  "/transfers/:maYeuCau/reject",
  authorizeRoles("Manager", "Admin"),
  WarehouseController.rejectTransferRequest,
);

module.exports = router;
