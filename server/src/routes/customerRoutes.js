const express = require("express");
const router = express.Router();
const customerController = require("../controllers/customerController");
const { verifyToken, authorizeRoles } = require("../middleware/auth");

// Bảo vệ toàn bộ route Quản lý Khách hàng (Chỉ Admin / Manager)
router.use(verifyToken, authorizeRoles("Admin", "Manager"));

// Lấy danh sách khách hàng: GET /api/customers
router.get("/", customerController.getCustomers);

// Lấy chi tiết thông tin cơ bản: GET /api/customers/detail/:id
router.get("/detail/:id", customerController.getCustomerById);

// ✅ ĐÃ THÊM: Lấy chi tiết kèm lịch sử mua hàng: GET /api/customers/history/:id
router.get("/history/:id", customerController.getCustomerHistory);

// Thêm mới: POST /api/customers/add
router.post("/add", customerController.addCustomer);

// Cập nhật thông tin: PUT /api/customers/update/:id
router.put("/update/:id", customerController.editCustomer);

// ✅ ĐÃ THAY ĐỔI: Chuyển đổi trạng thái hoạt động (Khóa/Mở khóa): PUT /api/customers/toggle-status/:id
router.put("/toggle-status/:id", customerController.toggleCustomerStatus);

module.exports = router;
