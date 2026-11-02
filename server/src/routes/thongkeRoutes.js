const express = require("express");
const router = express.Router();
const ThongKeController = require("../controllers/thongKeController");
const { scopeBranchAccess } = require("../middleware/auth");

// Áp dụng middleware kiểm soát phạm vi chi nhánh (Scoped Branch Access) cho toàn bộ API thống kê
router.use(scopeBranchAccess);

// Các API endpoint phục vụ cho dữ liệu vẽ biểu đồ Admin Dashboard
router.get("/san-pham-danh-muc", ThongKeController.getStatsCategory);
router.get("/overview", ThongKeController.getDashboardOverview);
router.get("/top-products", ThongKeController.getTopProducts);
router.get("/monthly-orders", ThongKeController.getMonthlyStats);
router.get("/monthly-revenue", ThongKeController.getMonthlyRevenue);
router.get("/customer-analytics", ThongKeController.getCustomerAnalytics);
router.get("/inventory-analytics", ThongKeController.getInventoryAnalytics);

module.exports = router;
